package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LifecycleHandler struct {
	Pool           *pgxpool.Pool
	SupabaseURL    string
	ServiceRoleKey string
	AuthHTTPClient *http.Client
}

type lifecycleResponse struct {
	RequestID string `json:"requestId"`
	Status    string `json:"status"`
	Retryable bool   `json:"retryable"`
}

type deletionRequestBody struct {
	IdempotencyKey string `json:"idempotencyKey"`
	Confirm        string `json:"confirm"`
}

type accountExport struct {
	SchemaVersion int                        `json:"schemaVersion"`
	ExportedAt    time.Time                  `json:"exportedAt"`
	User          map[string]any             `json:"user"`
	Data          map[string]json.RawMessage `json:"data"`
}

type deletionRecord struct {
	ID          pgtype.UUID
	Status      string
	Attempts    int32
	LeaseUntil  pgtype.Timestamptz
	CompletedAt pgtype.Timestamptz
}

// NewLifecycleHandler creates strict, bearer-authenticated account lifecycle endpoints.
// The HTTP routes are mounted by the server at /lifecycle/.
func NewLifecycleHandler(pool *pgxpool.Pool) http.Handler {
	return &LifecycleHandler{
		Pool:           pool,
		SupabaseURL:    strings.TrimRight(strings.TrimSpace(getEnv("SUPABASE_URL")), "/"),
		ServiceRoleKey: strings.TrimSpace(getEnv("SUPABASE_SERVICE_ROLE_KEY")),
		AuthHTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (h *LifecycleHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store, private")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if h.Pool == nil {
		writeLifecycleError(w, http.StatusServiceUnavailable, "unavailable", "Account lifecycle service is unavailable.")
		return
	}
	userID, email, err := AuthenticatedIdentityFromRequest(r)
	if err != nil {
		writeLifecycleError(w, http.StatusUnauthorized, "unauthorized", "Sign in to continue.")
		return
	}

	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/lifecycle"), "/")
	switch {
	case path == "export" && r.Method == http.MethodPost:
		h.export(w, r, userID, email)
	case path == "delete" && r.Method == http.MethodPost:
		h.delete(w, r, userID)
	case strings.HasPrefix(path, "delete/") && r.Method == http.MethodGet:
		h.deletionStatus(w, r, userID, strings.TrimPrefix(path, "delete/"))
	default:
		w.Header().Set("Allow", "GET, POST")
		writeLifecycleError(w, http.StatusNotFound, "not_found", "Lifecycle route not found.")
	}
}

func (h *LifecycleHandler) export(w http.ResponseWriter, r *http.Request, userID, email string) {
	var pending bool
	if err := h.Pool.QueryRow(r.Context(), `SELECT EXISTS (
		SELECT 1 FROM account_deletion_requests WHERE user_id=$1 AND status IN ('PENDING','DELETING_DATA','DELETING_AUTH')
	)`, userID).Scan(&pending); err != nil {
		writeLifecycleError(w, http.StatusServiceUnavailable, "unavailable", "Account data is temporarily unavailable.")
		return
	}
	if pending {
		writeLifecycleError(w, http.StatusConflict, "deletion_pending", "Account deletion is in progress.")
		return
	}

	user := map[string]any{"id": userID, "email": email}
	var dbUserID, dbEmail, dbName, dbAvatar string
	var dbCreatedAt time.Time
	if err := h.Pool.QueryRow(r.Context(), `SELECT id, email, name, avatar_url, created_at FROM users WHERE id=$1`, userID).Scan(
		&dbUserID, &dbEmail, &dbName, &dbAvatar, &dbCreatedAt,
	); err == nil {
		user = map[string]any{"id": dbUserID, "email": dbEmail, "name": dbName, "avatarUrl": dbAvatar, "createdAt": dbCreatedAt}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		writeLifecycleError(w, http.StatusServiceUnavailable, "unavailable", "Account data is temporarily unavailable.")
		return
	}

	queries := map[string]string{
		"transactions":            `SELECT * FROM transactions WHERE user_id=$1 ORDER BY date, id`,
		"budgets":                 `SELECT * FROM budgets WHERE user_id=$1 ORDER BY created_at, id`,
		"goals":                   `SELECT * FROM goals WHERE user_id=$1 ORDER BY created_at, id`,
		"goalContributions":       `SELECT c.* FROM goal_contributions c JOIN goals g ON g.id=c.goal_id WHERE g.user_id=$1 ORDER BY c.created_at, c.id`,
		"receipts":                `SELECT * FROM receipts WHERE user_id=$1 ORDER BY created_at, id`,
		"recurringRules":          `SELECT * FROM recurring_rules WHERE user_id=$1 ORDER BY created_at, id`,
		"reminders":               `SELECT * FROM reminders WHERE user_id=$1 ORDER BY created_at, id`,
		"accounts":                `SELECT * FROM financial_accounts WHERE user_id=$1 ORDER BY created_at, id`,
		"liabilities":             `SELECT * FROM liabilities WHERE user_id=$1 ORDER BY created_at, id`,
		"categories":              `SELECT * FROM categories WHERE user_id=$1 OR (user_id IS NULL AND is_default=true) ORDER BY name, id`,
		"categoryRules":           `SELECT * FROM category_rules WHERE user_id=$1 ORDER BY merchant_norm`,
		"notificationPreferences": `SELECT * FROM notification_preferences WHERE user_id=$1`,
		"achievements":            `SELECT a.*, ua.awarded_at FROM user_achievements ua JOIN achievements a ON a.id=ua.achievement_id WHERE ua.user_id=$1 ORDER BY ua.awarded_at, a.code`,
		"merchantAliases":         `SELECT * FROM merchant_aliases WHERE user_id=$1 ORDER BY raw_pattern`,
		"importBatches":           `SELECT * FROM import_batches WHERE user_id=$1 ORDER BY created_at, id`,
		"providerConnections":     `SELECT * FROM provider_connections WHERE user_id=$1 ORDER BY created_at, id`,
		"paydayPlan":              `SELECT * FROM payday_plans WHERE user_id=$1`,
		"paydayActionStates":      `SELECT * FROM payday_action_states WHERE user_id=$1 ORDER BY action_id`,
		"recurringPayments":       `SELECT * FROM recurring_payments WHERE user_id=$1 ORDER BY occurrence_date, id`,
		"transferGroups":          `SELECT * FROM transfer_groups WHERE user_id=$1 ORDER BY created_at, id`,
		"importCommitIdempotency": `SELECT * FROM import_commit_idempotency WHERE user_id=$1 ORDER BY created_at, idempotency_key`,
		"reminderNotifications":   `SELECT * FROM reminder_notifications WHERE user_id=$1 ORDER BY created_at, id`,
		"marcoThreads":            `SELECT * FROM marco_threads WHERE "userId"=$1 ORDER BY "createdAt", id`,
		"marcoMessages":           `SELECT m.* FROM marco_messages m JOIN marco_threads t ON t.id=m."threadId" WHERE t."userId"=$1 ORDER BY m."createdAt", m.id`,
	}
	data := make(map[string]json.RawMessage, len(queries))
	for name, query := range queries {
		rows, err := queryAsJSON(r.Context(), h.Pool, query, userID)
		if err != nil {
			writeLifecycleError(w, http.StatusServiceUnavailable, "unavailable", "Account data is temporarily unavailable.")
			return
		}
		data[name] = rows
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="vasoli-account-export.json"`)
	_ = json.NewEncoder(w).Encode(accountExport{SchemaVersion: 1, ExportedAt: time.Now().UTC(), User: user, Data: data})
}

func queryAsJSON(ctx context.Context, pool *pgxpool.Pool, query, userID string) (json.RawMessage, error) {
	rows, err := pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	fields := rows.FieldDescriptions()
	items := make([]map[string]any, 0)
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, err
		}
		item := make(map[string]any, len(fields))
		for i, field := range fields {
			value := values[i]
			if bytes, ok := value.([]byte); ok {
				var raw json.RawMessage
				if json.Valid(bytes) {
					raw = append(json.RawMessage(nil), bytes...)
					value = raw
				} else {
					value = string(bytes)
				}
			}
			item[string(field.Name)] = value
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(items)
	return json.RawMessage(encoded), err
}

func (h *LifecycleHandler) delete(w http.ResponseWriter, r *http.Request, userID string) {
	var body deletionRequestBody
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&body); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		writeLifecycleError(w, http.StatusBadRequest, "invalid_request", "Deletion request is invalid.")
		return
	}
	if body.Confirm != "DELETE" {
		writeLifecycleError(w, http.StatusBadRequest, "confirmation_required", "Type DELETE to confirm account deletion.")
		return
	}
	idempotencyKey, err := uuid.Parse(body.IdempotencyKey)
	if err != nil {
		writeLifecycleError(w, http.StatusBadRequest, "invalid_request", "A valid idempotency key is required.")
		return
	}
	if h.ServiceRoleKey == "" || h.SupabaseURL == "" {
		writeLifecycleError(w, http.StatusServiceUnavailable, "unavailable", "Account deletion is not configured.")
		return
	}
	if err := validateAdminEndpoint(h.SupabaseURL); err != nil {
		writeLifecycleError(w, http.StatusServiceUnavailable, "unavailable", "Account deletion is not configured.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	record, active, err := h.beginDeletion(ctx, userID, idempotencyKey)
	if err != nil {
		writeLifecycleError(w, http.StatusServiceUnavailable, "unavailable", "Account deletion could not be started.")
		return
	}
	if record.Status == "COMPLETED" {
		writeLifecycleResponse(w, http.StatusOK, lifecycleResponse{RequestID: UUIDToString(record.ID), Status: record.Status, Retryable: false})
		return
	}
	if active {
		writeLifecycleResponse(w, http.StatusAccepted, lifecycleResponse{RequestID: UUIDToString(record.ID), Status: record.Status, Retryable: false})
		return
	}

	if err := h.deleteUserData(ctx, userID); err != nil {
		_ = h.setDeletionStatus(ctx, record.ID, "FAILED", "Account data removal failed.", false)
		writeLifecycleResponse(w, http.StatusServiceUnavailable, lifecycleResponse{RequestID: UUIDToString(record.ID), Status: "FAILED", Retryable: true})
		return
	}
	if err := h.setDeletionStatus(ctx, record.ID, "DELETING_AUTH", "", false); err != nil {
		writeLifecycleError(w, http.StatusServiceUnavailable, "unavailable", "Account deletion is still processing.")
		return
	}
	if err := h.deleteSupabaseAuthUser(ctx, userID); err != nil {
		_ = h.setDeletionStatus(ctx, record.ID, "FAILED", "Authentication account removal failed.", false)
		writeLifecycleResponse(w, http.StatusServiceUnavailable, lifecycleResponse{RequestID: UUIDToString(record.ID), Status: "FAILED", Retryable: true})
		return
	}
	if err := h.setDeletionStatus(ctx, record.ID, "COMPLETED", "", true); err != nil {
		writeLifecycleError(w, http.StatusServiceUnavailable, "unavailable", "Account data was removed; completion status could not be saved.")
		return
	}
	writeLifecycleResponse(w, http.StatusOK, lifecycleResponse{RequestID: UUIDToString(record.ID), Status: "COMPLETED", Retryable: false})
}

func (h *LifecycleHandler) beginDeletion(ctx context.Context, userID string, key uuid.UUID) (deletionRecord, bool, error) {
	tx, err := h.Pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return deletionRecord{}, false, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `INSERT INTO account_deletion_requests (user_id,idempotency_key,status) VALUES ($1,$2,'PENDING') ON CONFLICT (user_id,idempotency_key) DO NOTHING`, userID, key); err != nil {
		return deletionRecord{}, false, err
	}
	var record deletionRecord
	if err := tx.QueryRow(ctx, `SELECT id,status,attempts,lease_until,completed_at FROM account_deletion_requests WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE`, userID, key).Scan(&record.ID, &record.Status, &record.Attempts, &record.LeaseUntil, &record.CompletedAt); err != nil {
		return deletionRecord{}, false, err
	}
	if record.Status == "COMPLETED" {
		return record, false, tx.Commit(ctx)
	}
	if record.LeaseUntil.Valid && record.LeaseUntil.Time.After(time.Now().UTC()) && (record.Status == "PENDING" || record.Status == "DELETING_DATA" || record.Status == "DELETING_AUTH") {
		return record, true, tx.Commit(ctx)
	}
	if _, err := tx.Exec(ctx, `UPDATE account_deletion_requests SET status='DELETING_DATA', attempts=attempts+1, lease_until=NOW()+INTERVAL '10 minutes', last_error=NULL, updated_at=NOW() WHERE id=$1`, record.ID); err != nil {
		return deletionRecord{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return deletionRecord{}, false, err
	}
	record.Status = "DELETING_DATA"
	return record, false, nil
}

func (h *LifecycleHandler) deleteUserData(ctx context.Context, userID string) error {
	tx, err := h.Pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// transfer_groups deliberately restrict account deletion, so remove these first.
	if _, err := tx.Exec(ctx, `DELETE FROM transfer_groups WHERE user_id=$1`, userID); err != nil {
		return err
	}
	// Deleting goals cascades into payday_plans.selected_goal_id (ON DELETE SET NULL).
	// The plan ownership trigger rejects that intermediate update because the goal
	// is being removed, so remove the per-user plan before cascading user records.
	if _, err := tx.Exec(ctx, `DELETE FROM payday_plans WHERE user_id=$1`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE id=$1`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (h *LifecycleHandler) deleteSupabaseAuthUser(ctx context.Context, userID string) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodDelete, h.SupabaseURL+"/auth/v1/admin/users/"+url.PathEscape(userID), nil)
	if err != nil {
		return err
	}
	request.Header.Set("apikey", h.ServiceRoleKey)
	request.Header.Set("Authorization", "Bearer "+h.ServiceRoleKey)
	client := h.AuthHTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNoContent || response.StatusCode == http.StatusOK || response.StatusCode == http.StatusNotFound {
		return nil
	}
	return fmt.Errorf("Supabase Auth returned status %d", response.StatusCode)
}

func (h *LifecycleHandler) setDeletionStatus(ctx context.Context, id pgtype.UUID, status, safeError string, completed bool) error {
	var completedAt any
	if completed {
		completedAt = time.Now().UTC()
	}
	_, err := h.Pool.Exec(ctx, `UPDATE account_deletion_requests SET status=$2,last_error=NULLIF($3,''),lease_until=NULL,completed_at=$4,updated_at=NOW() WHERE id=$1`, id, status, safeError, completedAt)
	return err
}

func (h *LifecycleHandler) deletionStatus(w http.ResponseWriter, r *http.Request, userID, requestID string) {
	id, err := uuid.Parse(requestID)
	if err != nil {
		writeLifecycleError(w, http.StatusBadRequest, "invalid_request", "Deletion request id is invalid.")
		return
	}
	var record deletionRecord
	err = h.Pool.QueryRow(r.Context(), `SELECT id,status,attempts,lease_until,completed_at FROM account_deletion_requests WHERE id=$1 AND user_id=$2`, id, userID).Scan(&record.ID, &record.Status, &record.Attempts, &record.LeaseUntil, &record.CompletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		writeLifecycleError(w, http.StatusNotFound, "not_found", "Deletion request not found.")
		return
	}
	if err != nil {
		writeLifecycleError(w, http.StatusServiceUnavailable, "unavailable", "Deletion status is temporarily unavailable.")
		return
	}
	retryable := record.Status == "FAILED" || ((record.Status == "PENDING" || record.Status == "DELETING_DATA" || record.Status == "DELETING_AUTH") && (!record.LeaseUntil.Valid || !record.LeaseUntil.Time.After(time.Now().UTC())))
	writeLifecycleResponse(w, http.StatusOK, lifecycleResponse{RequestID: UUIDToString(record.ID), Status: record.Status, Retryable: retryable})
}

func validateAdminEndpoint(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return errors.New("invalid Supabase URL")
	}
	if parsed.Scheme == "https" || parsed.Hostname() == "localhost" || parsed.Hostname() == "127.0.0.1" || parsed.Hostname() == "::1" {
		return nil
	}
	return errors.New("Supabase URL must use HTTPS")
}

func writeLifecycleResponse(w http.ResponseWriter, status int, body lifecycleResponse) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeLifecycleError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"code": code, "message": message}})
}

func getEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}
