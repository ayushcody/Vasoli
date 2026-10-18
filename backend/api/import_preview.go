package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

const importPreviewTTL = 15 * time.Minute
const maxImportPreviews = 8

type importPreview struct {
	userID, accountID   pgtype.UUID
	format, contentHash string
	rows                []parsedImportRow
	rejected            []*pb.RejectedStatementRow
	duplicates          map[int32]string
	reconciliation      *pb.ImportReconciliation
	expires             time.Time
}

var importPreviews = struct {
	sync.Mutex
	values map[string]importPreview
}{values: make(map[string]importPreview)}

func (s *ImportService) PreviewStatement(ctx context.Context, req *connect.Request[pb.PreviewStatementRequest]) (*connect.Response[pb.PreviewStatementResponse], error) {
	userID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}
	if s.Pool == nil {
		return nil, ErrorInternal("statement preview is unavailable")
	}
	if len(req.Msg.File) == 0 || len(req.Msg.File) > maxImportFileBytes {
		return nil, ErrorInvalidArgument("file is empty or exceeds the import limit")
	}
	accountID, err := parseUUID(req.Msg.AccountId, "account_id")
	if err != nil {
		return nil, err
	}
	if _, err := s.DB.GetFinancialAccount(ctx, db.GetFinancialAccountParams{ID: accountID, UserID: userID}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("account not found"))
		}
		return nil, ErrorInternal("internal system error")
	}
	rows, rejected, err := parseRowsForPreview(req.Msg.Format, req.Msg.File, req.Msg.GetMappingJson())
	if err != nil {
		return nil, ErrorInvalidArgument(err.Error())
	}
	if len(rows) == 0 && len(rejected) == 0 {
		return nil, ErrorInvalidArgument("statement contains no transaction rows")
	}
	hashInput := []byte(req.Msg.Format + ":" + UUIDToString(accountID) + ":")
	hashInput = append(hashInput, req.Msg.File...)
	hash := sha256.Sum256(hashInput)
	hashText := hex.EncodeToString(hash[:])
	for i := range rows {
		rows[i].Raw = ""
	}
	preview := importPreview{userID: userID, accountID: accountID, format: req.Msg.Format, contentHash: hashText, rows: rows, rejected: rejected, duplicates: make(map[int32]string), expires: time.Now().Add(importPreviewTTL)}
	response := &pb.PreviewStatementResponse{Rejected: rejected}
	var netDelta int64
	for _, row := range rows {
		var ok bool
		if row.Input.Type == "INCOME" {
			netDelta, ok = checkedMoneyAdd(netDelta, row.Input.AmountPaise)
		} else {
			netDelta, ok = checkedMoneyAdd(netDelta, -row.Input.AmountPaise)
		}
		if !ok {
			return nil, ErrorInvalidArgument("statement total exceeds supported range")
		}
		dupe, err := s.DB.FindTransactionDuplicate(ctx, db.FindTransactionDuplicateParams{UserID: userID, Date: pgtype.Timestamptz{Time: row.Input.Date.UTC(), Valid: true}, AmountPaise: row.Input.AmountPaise, Description: row.Input.Description, AccountID: accountID})
		if err == nil {
			id := UUIDToString(dupe)
			preview.duplicates[row.RowNumber] = id
			response.Duplicates = append(response.Duplicates, &pb.DuplicateStatementRow{RowNumber: row.RowNumber, ExistingTransactionId: id})
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrorInternal("internal system error")
		}
		response.Rows = append(response.Rows, &pb.NormalizedStatementRow{RowNumber: row.RowNumber, AmountPaise: row.Input.AmountPaise, Description: row.Input.Description, Date: timestamppb.New(row.Input.Date), Type: row.Input.Type, Merchant: row.Input.MerchantNorm})
	}
	if req.Msg.OpeningBalancePaise != nil || req.Msg.ClosingBalancePaise != nil {
		reconciliation := &pb.ImportReconciliation{CalculatedClosingBalancePaise: netDelta}
		if req.Msg.OpeningBalancePaise != nil {
			reconciliation.OpeningBalancePaise = req.Msg.OpeningBalancePaise
			calculated, ok := checkedMoneyAdd(reconciliation.CalculatedClosingBalancePaise, req.Msg.GetOpeningBalancePaise())
			if !ok {
				return nil, ErrorInvalidArgument("statement reconciliation exceeds supported range")
			}
			reconciliation.CalculatedClosingBalancePaise = calculated
		}
		if req.Msg.ClosingBalancePaise != nil {
			reconciliation.ClosingBalancePaise = req.Msg.ClosingBalancePaise
			difference, ok := checkedMoneyAdd(req.Msg.GetClosingBalancePaise(), -reconciliation.CalculatedClosingBalancePaise)
			if !ok {
				return nil, ErrorInvalidArgument("statement reconciliation exceeds supported range")
			}
			reconciliation.DifferencePaise = &difference
			reconciliation.Matches = difference == 0
		}
		preview.reconciliation = reconciliation
		response.Reconciliation = reconciliation
	}
	token := uuid.NewString()
	importPreviews.Lock()
	for key, item := range importPreviews.values {
		if time.Now().After(item.expires) {
			delete(importPreviews.values, key)
		}
	}
	if len(importPreviews.values) >= maxImportPreviews {
		var oldestKey string
		var oldest time.Time
		for key, item := range importPreviews.values {
			if oldest.IsZero() || item.expires.Before(oldest) {
				oldestKey, oldest = key, item.expires
			}
		}
		delete(importPreviews.values, oldestKey)
	}
	importPreviews.values[token] = preview
	importPreviews.Unlock()
	response.PreviewToken = token
	response.ExpiresAtUnix = preview.expires.Unix()
	return connect.NewResponse(response), nil
}

func (s *ImportService) CommitStatementImport(ctx context.Context, req *connect.Request[pb.CommitStatementImportRequest]) (*connect.Response[pb.CommitStatementImportResponse], error) {
	userID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, ErrorUnauthenticated(err.Error())
	}
	if s.Pool == nil {
		return nil, ErrorInternal("statement commit is unavailable")
	}
	if strings.TrimSpace(req.Msg.IdempotencyKey) == "" || len(req.Msg.IdempotencyKey) > 128 {
		return nil, ErrorInvalidArgument("idempotency_key is required and must be at most 128 characters")
	}
	previewUUID, err := parseUUID(req.Msg.PreviewToken, "preview_token")
	if err != nil {
		return nil, ErrorInvalidArgument("preview_token is invalid")
	}
	skipNumbers := append([]int32(nil), req.Msg.SkipRowNumbers...)
	for i := 1; i < len(skipNumbers); i++ {
		for j := i; j > 0 && skipNumbers[j] < skipNumbers[j-1]; j-- {
			skipNumbers[j], skipNumbers[j-1] = skipNumbers[j-1], skipNumbers[j]
		}
	}
	for i := 1; i < len(skipNumbers); i++ {
		if skipNumbers[i] == skipNumbers[i-1] {
			return nil, ErrorInvalidArgument("skip row numbers must be unique")
		}
	}
	choicesHash := sha256.Sum256([]byte(fmt.Sprint(skipNumbers)))
	choicesText := hex.EncodeToString(choicesHash[:])
	// A completed commit can be replayed after process restart without retaining statement data.
	var replayBatch pgtype.UUID
	var replayChoices string
	var replayCreated, replayDuplicates, replaySkipped int32
	replayErr := s.Pool.QueryRow(ctx, `SELECT batch_id,choices_hash,created_count,duplicate_count,skipped_count FROM import_commit_idempotency WHERE user_id=$1 AND preview_token=$2`, userID, previewUUID).Scan(&replayBatch, &replayChoices, &replayCreated, &replayDuplicates, &replaySkipped)
	if replayErr == nil {
		if replayChoices != choicesText {
			return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("preview was already committed with different skip choices"))
		}
		return connect.NewResponse(&pb.CommitStatementImportResponse{BatchId: UUIDToString(replayBatch), CreatedCount: replayCreated, DuplicateCount: replayDuplicates, SkippedCount: replaySkipped}), nil
	}
	if !errors.Is(replayErr, pgx.ErrNoRows) {
		return nil, ErrorInternal("internal system error")
	}
	importPreviews.Lock()
	preview, ok := importPreviews.values[req.Msg.PreviewToken]
	importPreviews.Unlock()
	if !ok || time.Now().After(preview.expires) || !uuidEqual(preview.userID, userID) {
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("preview expired or unavailable; preview the statement again"))
	}
	choices := make(map[int32]bool, len(req.Msg.SkipRowNumbers))
	for _, rowNumber := range req.Msg.SkipRowNumbers {
		if _, exists := choices[rowNumber]; exists {
			return nil, ErrorInvalidArgument("skip row numbers must be unique")
		}
		choices[rowNumber] = true
	}
	for number := range choices {
		found := false
		for _, row := range preview.rows {
			if row.RowNumber == number {
				found = true
				break
			}
		}
		if !found {
			for _, row := range preview.rejected {
				if row.RowNumber == number {
					found = true
					break
				}
			}
		}
		if !found {
			return nil, ErrorInvalidArgument("skip row number is not present in this preview")
		}
	}
	for _, row := range preview.rejected {
		if !choices[row.RowNumber] {
			return nil, ErrorInvalidArgument("every rejected row must be explicitly skipped")
		}
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, ErrorInternal("internal system error")
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))`, UUIDToString(userID), UUIDToString(preview.accountID)+":"+req.Msg.IdempotencyKey); err != nil {
		return nil, ErrorInternal("internal system error")
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))`, UUIDToString(userID), "preview:"+UUIDToString(previewUUID)); err != nil {
		return nil, ErrorInternal("internal system error")
	}
	var tokenBatch pgtype.UUID
	var tokenChoices string
	var tokenCreated, tokenDuplicates, tokenSkipped int32
	tokenErr := tx.QueryRow(ctx, `SELECT batch_id,choices_hash,created_count,duplicate_count,skipped_count FROM import_commit_idempotency WHERE user_id=$1 AND preview_token=$2`, userID, previewUUID).Scan(&tokenBatch, &tokenChoices, &tokenCreated, &tokenDuplicates, &tokenSkipped)
	if tokenErr == nil {
		if tokenChoices != choicesText {
			return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("preview was already committed with different skip choices"))
		}
		return connect.NewResponse(&pb.CommitStatementImportResponse{BatchId: UUIDToString(tokenBatch), CreatedCount: tokenCreated, DuplicateCount: tokenDuplicates, SkippedCount: tokenSkipped}), nil
	}
	if !errors.Is(tokenErr, pgx.ErrNoRows) {
		return nil, ErrorInternal("internal system error")
	}
	var priorBatch pgtype.UUID
	var priorHash, priorChoices string
	var priorCreated int32
	var priorDupes int32
	var priorSkipped int32
	err = tx.QueryRow(ctx, `SELECT batch_id, content_hash, choices_hash, created_count, duplicate_count, skipped_count FROM import_commit_idempotency WHERE user_id=$1 AND account_id=$2 AND idempotency_key=$3`, userID, preview.accountID, req.Msg.IdempotencyKey).Scan(&priorBatch, &priorHash, &priorChoices, &priorCreated, &priorDupes, &priorSkipped)
	if err == nil {
		if priorHash != preview.contentHash || priorChoices != choicesText {
			return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("idempotency key was already used with different import choices"))
		}
		return connect.NewResponse(&pb.CommitStatementImportResponse{BatchId: UUIDToString(priorBatch), CreatedCount: priorCreated, DuplicateCount: priorDupes, SkippedCount: priorSkipped}), nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrorInternal("internal system error")
	}
	queries := db.New(tx)
	batch, err := queries.CreateImportBatch(ctx, db.CreateImportBatchParams{UserID: userID, FileHash: preview.contentHash, BankFormat: preview.format})
	if err != nil {
		return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("this statement was already imported; use the existing transactions or choose a new statement"))
	}
	var created, duplicates int32
	skipped := int32(len(preview.rejected))
	for _, row := range preview.rows {
		if choices[row.RowNumber] {
			skipped++
			if _, duplicate := preview.duplicates[row.RowNumber]; duplicate {
				duplicates++
			}
			continue
		}
		row.Input.AccountID = preview.accountID
		row.Input.ImportBatchID = batch.ID
		row.Input.Provenance = "IMPORT"
		if _, err := createTransactionRecord(ctx, queries, userID, row.Input); err != nil {
			return nil, err
		}
		created++
	}
	if _, err := queries.UpdateImportBatchCounts(ctx, db.UpdateImportBatchCountsParams{ID: batch.ID, UserID: userID, ParsedCount: int32(len(preview.rows) + len(preview.rejected)), CreatedCount: created, MatchedCount: duplicates, FailedCount: int32(len(preview.rejected))}); err != nil {
		return nil, ErrorInternal("internal system error")
	}
	var reconciliationDifference any
	if preview.reconciliation != nil && preview.reconciliation.ClosingBalancePaise != nil {
		reconciliationDifference = preview.reconciliation.GetDifferencePaise()
	}
	if _, err := tx.Exec(ctx, `INSERT INTO import_commit_idempotency(user_id, account_id, idempotency_key, content_hash, choices_hash, preview_token, batch_id, created_count, duplicate_count, skipped_count, reconciliation_difference_paise) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, userID, preview.accountID, req.Msg.IdempotencyKey, preview.contentHash, choicesText, previewUUID, batch.ID, created, duplicates, skipped, reconciliationDifference); err != nil {
		return nil, ErrorInternal("internal system error")
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, ErrorInternal("internal system error")
	}
	return connect.NewResponse(&pb.CommitStatementImportResponse{BatchId: UUIDToString(batch.ID), CreatedCount: created, DuplicateCount: duplicates, SkippedCount: skipped}), nil
}

func uuidEqual(a, b pgtype.UUID) bool { return a.Valid && b.Valid && a.Bytes == b.Bytes }

func checkedMoneyAdd(a, b int64) (int64, bool) {
	const maxInt64 = int64(^uint64(0) >> 1)
	const minInt64 = -maxInt64 - 1
	if b > 0 && a > maxInt64-b {
		return 0, false
	}
	if b < 0 && a < minInt64-b {
		return 0, false
	}
	return a + b, true
}

func parseRowsForPreview(format string, file []byte, mappingJSON string) ([]parsedImportRow, []*pb.RejectedStatementRow, error) {
	rows, parseErr := parseImportRows(format, file, mappingJSON)
	if parseErr != nil && parseErr.Error() != "CSV contains no valid transactions" {
		return nil, nil, parseErr
	}
	records, err := readImportCSV(file)
	if err != nil {
		return nil, nil, err
	}
	lowerFormat := strings.ToLower(strings.TrimSpace(format))
	headerLine := -1
	for i := 0; i < len(records) && i < 20; i++ {
		index := columnIndexMap(records[i])
		if lowerFormat == "hdfc" || lowerFormat == "hdfc_statement" {
			line := strings.ToLower(strings.Join(records[i], ","))
			if strings.Contains(line, "date") && strings.Contains(line, "narration") {
				headerLine = i
				break
			}
			continue
		}
		mapping := genericCSVMapping{Date: "date", Description: "description", Amount: "amount"}
		if mappingJSON != "" {
			if err := json.Unmarshal([]byte(mappingJSON), &mapping); err != nil {
				return nil, nil, fmt.Errorf("mapping_json is invalid: %w", err)
			}
		}
		if _, ok := index[strings.ToLower(mapping.Date)]; !ok {
			continue
		}
		if _, ok := index[strings.ToLower(mapping.Description)]; ok {
			headerLine = i
			break
		}
	}
	if headerLine < 0 {
		return nil, nil, errors.New("CSV is missing a recognizable header")
	}
	valid := make(map[int32]bool, len(rows))
	for _, row := range rows {
		valid[row.RowNumber] = true
	}
	rejected := make([]*pb.RejectedStatementRow, 0)
	for i := headerLine + 1; i < len(records); i++ {
		record := records[i]
		nonempty := false
		for _, field := range record {
			if strings.TrimSpace(field) != "" {
				nonempty = true
				break
			}
		}
		if !nonempty {
			continue
		}
		rowNumber := int32(i + 1)
		if !valid[rowNumber] {
			rejected = append(rejected, &pb.RejectedStatementRow{RowNumber: rowNumber, Reason: "Could not normalize this row; check its date, description, and amount."})
		}
	}
	return rows, rejected, nil
}
