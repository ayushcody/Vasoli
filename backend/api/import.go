package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
	"vasoli-backend/internal/merchantnorm"
)

type ImportService struct {
	DB *db.Queries
}

type genericCSVMapping struct {
	Date        string `json:"date"`
	Description string `json:"description"`
	Debit       string `json:"debit"`
	Credit      string `json:"credit"`
	Amount      string `json:"amount"`
}

type parsedImportRow struct {
	RowNumber int32
	Raw       string
	Input     transactionCreateInput
}

func (s *ImportService) ImportStatement(ctx context.Context, req *connect.Request[pb.ImportStatementRequest]) (*connect.Response[pb.ImportStatementResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}
	if len(req.Msg.File) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("file is required"))
	}

	hash := sha256.Sum256(req.Msg.File)
	hashStr := hex.EncodeToString(hash[:])

	batch, err := s.DB.CreateImportBatch(ctx, db.CreateImportBatchParams{
		UserID:       userUUID,
		FileHash:     hashStr,
		BankFormat:   req.Msg.Format,
		ParsedCount:  0,
		CreatedCount: 0,
		MatchedCount: 0,
		FailedCount:  0,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeAlreadyExists, err)
	}

	rows, err := parseImportRows(req.Msg.Format, req.Msg.File, req.Msg.GetMappingJson())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	failedRows := make([]*pb.FailedImportRow, 0)
	var createdCount int32
	var matchedCount int32

	for _, row := range rows {
		if _, err := s.DB.FindTransactionDuplicate(ctx, db.FindTransactionDuplicateParams{
			UserID:      userUUID,
			Date:        pgtype.Timestamptz{Time: row.Input.Date.UTC(), Valid: true},
			AmountPaise: row.Input.AmountPaise,
			Description: row.Input.Description,
		}); err == nil {
			matchedCount++
			continue
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeInternal, err)
		}

		row.Input.ImportBatchID = batch.ID
		row.Input.Provenance = "IMPORT"
		if _, err := createTransactionRecord(ctx, s.DB, userUUID, row.Input); err != nil {
			reason := err.Error()
			var connectErr *connect.Error
			if errors.As(err, &connectErr) {
				reason = connectErr.Message()
			}
			failedRows = append(failedRows, &pb.FailedImportRow{
				RowNumber: row.RowNumber,
				Raw:       row.Raw,
				Reason:    reason,
			})
			continue
		}

		createdCount++
	}

	updatedBatch, err := s.DB.UpdateImportBatchCounts(ctx, db.UpdateImportBatchCountsParams{
		ID:           batch.ID,
		UserID:       userUUID,
		ParsedCount:  int32(len(rows)),
		CreatedCount: createdCount,
		MatchedCount: matchedCount,
		FailedCount:  int32(len(failedRows)),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.ImportStatementResponse{
		BatchId:      UUIDToString(updatedBatch.ID),
		ParsedCount:  updatedBatch.ParsedCount,
		CreatedCount: updatedBatch.CreatedCount,
		MatchedCount: updatedBatch.MatchedCount,
		FailedCount:  updatedBatch.FailedCount,
		FailedRows:   failedRows,
	}), nil
}

func parseImportRows(format string, file []byte, mappingJSON string) ([]parsedImportRow, error) {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "hdfc", "hdfc_statement":
		return parseHDFCImportRows(file)
	case "generic", "generic_csv":
		return parseGenericImportRows(file, mappingJSON)
	default:
		return nil, fmt.Errorf("unsupported import format %q", format)
	}
}

func parseHDFCImportRows(file []byte) ([]parsedImportRow, error) {
	reader := csv.NewReader(bytes.NewReader(file))
	reader.FieldsPerRecord = -1

	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	startLine := 0
	for index := 0; index < len(records) && index < 20; index++ {
		lower := strings.ToLower(strings.Join(records[index], ","))
		if strings.Contains(lower, "date") && strings.Contains(lower, "narration") {
			startLine = index + 1
			break
		}
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
	reader := csv.NewReader(bytes.NewReader(file))
	reader.FieldsPerRecord = -1

	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(records) < 2 {
		return nil, nil
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

	headerIndex := columnIndexMap(records[0])
	dateIndex, ok := headerIndex[strings.ToLower(mapping.Date)]
	if !ok {
		return nil, errors.New("generic CSV is missing the date column")
	}
	descriptionIndex, ok := headerIndex[strings.ToLower(mapping.Description)]
	if !ok {
		return nil, errors.New("generic CSV is missing the description column")
	}

	amountIndex := findOptionalColumn(headerIndex, mapping.Amount)
	debitIndex := findOptionalColumn(headerIndex, mapping.Debit)
	creditIndex := findOptionalColumn(headerIndex, mapping.Credit)

	rows := make([]parsedImportRow, 0)
	for index := 1; index < len(records); index++ {
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
			if amount > 0 {
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
	cleaned := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(value, "₹", ""), ",", ""), " ", "")
	if cleaned == "" {
		return 0
	}
	parsed, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0
	}
	return int64(parsed * 100)
}

func parseSignedDecimalAmount(value string) int64 {
	cleaned := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(value, "₹", ""), ",", ""), " ", "")
	cleaned = strings.ReplaceAll(cleaned, "(", "-")
	cleaned = strings.ReplaceAll(cleaned, ")", "")
	if cleaned == "" {
		return 0
	}
	parsed, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0
	}
	return int64(parsed * 100)
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

	return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC), nil
}

func parseFlexibleDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, errors.New("invalid date")
	}

	layouts := []string{
		"2006-01-02",
		"02/01/2006",
		"02/01/06",
		"02-01-2006",
		"02-01-06",
	}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return parsed.UTC(), nil
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
