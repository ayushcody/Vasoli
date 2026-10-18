package api

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"strconv"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5/pgxpool"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
	"vasoli-backend/internal/merchantnorm"
)

type ImportService struct {
	DB   *db.Queries
	Pool *pgxpool.Pool
}

type genericCSVMapping struct {
	Date        string `json:"date"`
	Description string `json:"description"`
	Debit       string `json:"debit"`
	Credit      string `json:"credit"`
	Amount      string `json:"amount"`
	Type        string `json:"type"`
}

type parsedImportRow struct {
	RowNumber int32
	Raw       string
	Input     transactionCreateInput
}

const (
	maxImportFileBytes = 10 << 20
	maxImportCSVRows   = 50_000
)

func (s *ImportService) ImportStatement(ctx context.Context, req *connect.Request[pb.ImportStatementRequest]) (*connect.Response[pb.ImportStatementResponse], error) {
	return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("legacy statement import is disabled; use PreviewStatement and CommitStatementImport"))
}

func parseImportRows(format string, file []byte, mappingJSON string) ([]parsedImportRow, error) {
	if len(file) > maxImportFileBytes {
		return nil, fmt.Errorf("file exceeds the %d MiB import limit", maxImportFileBytes/(1<<20))
	}
	var rows []parsedImportRow
	var err error
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "hdfc", "hdfc_statement":
		rows, err = parseHDFCImportRows(file)
	case "icici":
		rows, err = parseGenericImportRows(file, `{"date":"Date","description":"Narration","debit":"Withdrawal","credit":"Deposit"}`)
	case "sbi":
		rows, err = parseGenericImportRows(file, `{"date":"Txn Date","description":"Description","debit":"Debit","credit":"Credit"}`)
	case "axis":
		rows, err = parseGenericImportRows(file, `{"date":"Tran Date","description":"Particulars","debit":"Debit","credit":"Credit"}`)
	case "kotak":
		rows, err = parseGenericImportRows(file, `{"date":"Date","description":"Narration","debit":"Withdrawal","credit":"Deposit"}`)
	case "upi":
		rows, err = parseGenericImportRows(file, `{"date":"Date","description":"Description","amount":"Amount","type":"Transaction Type"}`)
	case "generic", "generic_csv":
		rows, err = parseGenericImportRows(file, mappingJSON)
	default:
		return nil, fmt.Errorf("unsupported import format %q", format)
	}
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, errors.New("CSV contains no valid transactions")
	}
	return rows, nil
}

func parseHDFCImportRows(file []byte) ([]parsedImportRow, error) {
	records, err := readImportCSV(file)
	if err != nil {
		return nil, err
	}

	startLine := 0
	headerFound := false
	for index := 0; index < len(records) && index < 20; index++ {
		lower := strings.ToLower(strings.Join(records[index], ","))
		if strings.Contains(lower, "date") && strings.Contains(lower, "narration") {
			startLine = index + 1
			headerFound = true
			break
		}
	}
	if !headerFound {
		return nil, errors.New("HDFC CSV is missing its date or narration header")
	}

	rows := make([]parsedImportRow, 0)
	for index := startLine; index < len(records); index++ {
		record := records[index]
		if len(record) < 5 {
			continue
		}

		dateStr := strings.TrimSpace(record[0])
		narration := strings.TrimSpace(record[1])
		if narration == "" || strings.Contains(strings.ToLower(dateStr), "statement") {
			continue
		}

		date, err := parseSlashDate(dateStr)
		if err != nil {
			continue
		}

		debit := parseDecimalAmount(recordValue(record, 3))
		credit := parseDecimalAmount(recordValue(record, 4))

		var amountPaise int64
		transactionType := "EXPENSE"
		if credit > 0 {
			amountPaise = credit
			transactionType = "INCOME"
		} else if debit > 0 {
			amountPaise = debit
		} else {
			continue
		}

		rows = append(rows, parsedImportRow{
			RowNumber: int32(index + 1),
			Raw:       strings.Join(record, ","),
			Input: transactionCreateInput{
				AmountPaise:  amountPaise,
				Description:  narration,
				Date:         date,
				Type:         transactionType,
				MerchantRaw:  narration,
				MerchantNorm: merchantnorm.NormalizeMerchant(narration, narration),
				UpiRef:       optionalString(recordPointer(recordValue(record, 5))),
				UpiID:        optionalString(recordPointer(extractUPIVPA(narration))),
			},
		})
	}

	return rows, nil
}

func parseGenericImportRows(file []byte, mappingJSON string) ([]parsedImportRow, error) {
	records, err := readImportCSV(file)
	if err != nil {
		return nil, err
	}
	if len(records) < 2 {
		return nil, errors.New("CSV must contain a header and at least one row")
	}

	mapping := genericCSVMapping{
		Date:        "date",
		Description: "description",
		Amount:      "amount",
	}
	if mappingJSON != "" {
		if err := json.Unmarshal([]byte(mappingJSON), &mapping); err != nil {
			return nil, fmt.Errorf("mapping_json is invalid: %w", err)
		}
	}

	var headerIndex map[string]int
	var startLine int
	for index := 0; index < len(records) && index < 20; index++ {
		headerIndex = columnIndexMap(records[index])
		_, hasDate := headerIndex[strings.ToLower(mapping.Date)]
		_, hasDesc := headerIndex[strings.ToLower(mapping.Description)]
		if hasDate && hasDesc {
			startLine = index + 1
			break
		}
	}

	if startLine == 0 {
		return nil, errors.New("generic CSV is missing the date or description column in header")
	}

	dateIndex := headerIndex[strings.ToLower(mapping.Date)]
	descriptionIndex := headerIndex[strings.ToLower(mapping.Description)]

	amountIndex := findOptionalColumn(headerIndex, mapping.Amount)
	debitIndex := findOptionalColumn(headerIndex, mapping.Debit)
	creditIndex := findOptionalColumn(headerIndex, mapping.Credit)
	typeIndex := findOptionalColumn(headerIndex, mapping.Type)

	rows := make([]parsedImportRow, 0)
	for index := startLine; index < len(records); index++ {
		record := records[index]
		rawDate := recordValue(record, dateIndex)
		rawDescription := recordValue(record, descriptionIndex)
		if rawDate == "" || rawDescription == "" {
			continue
		}

		date, err := parseFlexibleDate(rawDate)
		if err != nil {
			continue
		}

		var amountPaise int64
		transactionType := "EXPENSE"
		if amountIndex >= 0 {
			amount := parseSignedDecimalAmount(recordValue(record, amountIndex))
			if amount == 0 {
				continue
			}
			if typeIndex >= 0 {
				typeStr := strings.ToUpper(recordValue(record, typeIndex))
				if strings.Contains(typeStr, "CREDIT") || strings.Contains(typeStr, "INCOME") {
					transactionType = "INCOME"
				} else {
					transactionType = "EXPENSE"
				}
			} else if amount > 0 {
				transactionType = "INCOME"
			}
			amountPaise = absInt64(amount)
		} else {
			debit := int64(0)
			credit := int64(0)
			if debitIndex >= 0 {
				debit = parseDecimalAmount(recordValue(record, debitIndex))
			}
			if creditIndex >= 0 {
				credit = parseDecimalAmount(recordValue(record, creditIndex))
			}
			if credit > 0 {
				transactionType = "INCOME"
				amountPaise = credit
			} else if debit > 0 {
				amountPaise = debit
			} else {
				continue
			}
		}

		rows = append(rows, parsedImportRow{
			RowNumber: int32(index + 1),
			Raw:       strings.Join(record, ","),
			Input: transactionCreateInput{
				AmountPaise:  amountPaise,
				Description:  rawDescription,
				Date:         date,
				Type:         transactionType,
				MerchantRaw:  rawDescription,
				MerchantNorm: merchantnorm.NormalizeMerchant(rawDescription, rawDescription),
				UpiID:        optionalString(recordPointer(extractUPIVPA(rawDescription))),
			},
		})
	}

	return rows, nil
}

func readImportCSV(file []byte) ([][]string, error) {
	if len(file) > maxImportFileBytes {
		return nil, fmt.Errorf("file exceeds the %d MiB import limit", maxImportFileBytes/(1<<20))
	}

	reader := csv.NewReader(bytes.NewReader(file))
	reader.FieldsPerRecord = -1
	maxRecords := maxImportCSVRows + 20 // allow preamble rows before a bank's header
	records := make([][]string, 0, min(maxRecords, 1024))
	for {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			return records, nil
		}
		if err != nil {
			return nil, err
		}
		if len(records) >= maxRecords {
			return nil, fmt.Errorf("file exceeds the %d row import limit", maxImportCSVRows)
		}
		records = append(records, record)
	}
}

func columnIndexMap(header []string) map[string]int {
	indices := make(map[string]int, len(header))
	for index, column := range header {
		indices[strings.ToLower(strings.TrimSpace(column))] = index
	}
	return indices
}

func findOptionalColumn(indices map[string]int, column string) int {
	if column == "" {
		return -1
	}
	index, ok := indices[strings.ToLower(column)]
	if !ok {
		return -1
	}
	return index
}

func recordValue(record []string, index int) string {
	if index < 0 || index >= len(record) {
		return ""
	}
	return strings.TrimSpace(record[index])
}

func parseDecimalAmount(value string) int64 {
	amount, ok := parseAmountPaise(value, false)
	if !ok {
		return 0
	}
	return amount
}

func parseSignedDecimalAmount(value string) int64 {
	amount, ok := parseAmountPaise(value, true)
	if !ok {
		return 0
	}
	return amount
}

func parseAmountPaise(value string, allowNegative bool) (int64, bool) {
	cleaned := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(value, "₹", ""), ",", ""), " ", "")
	negative := false
	if strings.HasPrefix(cleaned, "(") && strings.HasSuffix(cleaned, ")") {
		if !allowNegative {
			return 0, false
		}
		negative = true
		cleaned = cleaned[1 : len(cleaned)-1]
	}
	if strings.HasPrefix(cleaned, "-") || strings.HasPrefix(cleaned, "+") {
		if cleaned[0] == '-' {
			if !allowNegative || negative {
				return 0, false
			}
			negative = true
		}
		cleaned = cleaned[1:]
	}
	if cleaned == "" || strings.ContainsAny(cleaned, "()+-") {
		return 0, false
	}
	parts := strings.Split(cleaned, ".")
	if len(parts) > 2 {
		return 0, false
	}
	whole := parts[0]
	fraction := ""
	if len(parts) == 2 {
		fraction = parts[1]
	}
	if whole == "" {
		whole = "0"
	}
	if !decimalDigits(whole) || (len(parts) == 2 && (fraction == "" || !decimalDigits(fraction))) || len(fraction) > 2 {
		return 0, false
	}
	if len(fraction) == 1 {
		fraction += "0"
	}
	wholeValue, ok := new(big.Int).SetString(whole, 10)
	if !ok {
		return 0, false
	}
	wholeValue.Mul(wholeValue, big.NewInt(100))
	if fraction != "" {
		fractionValue, ok := new(big.Int).SetString(fraction, 10)
		if !ok {
			return 0, false
		}
		wholeValue.Add(wholeValue, fractionValue)
	}
	if negative {
		wholeValue.Neg(wholeValue)
	}
	if !wholeValue.IsInt64() || wholeValue.Int64() == -1<<63 {
		return 0, false
	}
	return wholeValue.Int64(), true
}

func decimalDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, digit := range value {
		if digit < '0' || digit > '9' {
			return false
		}
	}
	return true
}

func parseSlashDate(value string) (time.Time, error) {
	parts := strings.FieldsFunc(value, func(r rune) bool {
		return r == '/' || r == '-'
	})
	if len(parts) != 3 {
		return time.Time{}, errors.New("invalid date")
	}

	day, err := strconv.Atoi(parts[0])
	if err != nil {
		return time.Time{}, err
	}
	month, err := strconv.Atoi(parts[1])
	if err != nil {
		return time.Time{}, err
	}
	year, err := strconv.Atoi(parts[2])
	if err != nil {
		return time.Time{}, err
	}
	if year < 100 {
		year += 2000
	}
	if year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31 {
		return time.Time{}, errors.New("invalid date")
	}
	parsed := time.Date(year, time.Month(month), day, 0, 0, 0, 0, indiaLocation)
	if parsed.Year() != year || int(parsed.Month()) != month || parsed.Day() != day {
		return time.Time{}, errors.New("invalid date")
	}
	return parsed, nil
}

func parseFlexibleDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, errors.New("invalid date")
	}

	// First preserve explicitly supplied instants and local date-times. Bank
	// exports commonly mix date-only rows with timestamp rows in one format.
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02 15:04:05Z07:00", "2006-01-02 15:04Z07:00", "02/01/2006 15:04:05 -0700"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	for _, layout := range []string{"2006-01-02T15:04:05", "2006-01-02T15:04", "2006-01-02 15:04:05", "2006-01-02 15:04", "02/01/2006 15:04:05", "02/01/2006 15:04"} {
		if parsed, err := time.ParseInLocation(layout, value, indiaLocation); err == nil {
			return parsed, nil
		}
	}

	if len(value) == len("02/01/06") && (strings.Contains(value, "/") || strings.Contains(value, "-")) {
		parts := strings.FieldsFunc(value, func(r rune) bool { return r == '/' || r == '-' })
		if len(parts) == 3 && len(parts[2]) == 2 {
			return parseSlashDate(value)
		}
	}

	layouts := []string{
		"2006-01-02",
		"02/01/2006",
		"02-01-2006",
	}
	for _, layout := range layouts {
		parsed, err := time.ParseInLocation(layout, value, indiaLocation)
		if err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, errors.New("invalid date")
}

func extractUPIVPA(value string) string {
	for _, part := range strings.FieldsFunc(value, func(r rune) bool {
		return r == ' ' || r == '-' || r == '/' || r == ':'
	}) {
		if strings.Contains(part, "@") {
			return part
		}
	}
	return ""
}

func optionalString(value *string) *string {
	if value == nil || *value == "" {
		return nil
	}
	return value
}

func recordPointer(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func absInt64(value int64) int64 {
	if value < 0 {
		return -value
	}
	return value
}
