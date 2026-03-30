package api

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgtype"
)

type requestIDContextKey struct{}

// WithRequestID stores the current request ID in context so handlers and interceptors
// can emit correlated logs.
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, requestIDContextKey{}, requestID)
}

func RequestIDFromContext(ctx context.Context) string {
	requestID, _ := ctx.Value(requestIDContextKey{}).(string)
	return requestID
}

func LogRPCError(ctx context.Context, method string, err error) {
	userID, _ := UserIDFromContext(ctx)
	slog.Error("rpc handler error",
		"method", method,
		"user_id", userID,
		"request_id", RequestIDFromContext(ctx),
		"error", err,
	)
}

// UUIDToString converts a pgtype.UUID to a standard string representation
func UUIDToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	b := u.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// StringToUUID converts a string representation to a pgtype.UUID (naively, no validation)
func StringToUUID(s string) pgtype.UUID {
	var u pgtype.UUID
	err := u.Scan(s)
	if err != nil {
		u.Valid = false
	}
	return u
}
