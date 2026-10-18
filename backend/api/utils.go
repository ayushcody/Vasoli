package api

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"connectrpc.com/connect"

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

// Standardized Error Constructors for ConnectRPC
func ErrorUnauthenticated(msg string) error {
	return connect.NewError(connect.CodeUnauthenticated, errors.New(msg))
}

func ErrorInvalidArgument(msg string) error {
	return connect.NewError(connect.CodeInvalidArgument, errors.New(msg))
}

func ErrorNotFound(msg string) error {
	return connect.NewError(connect.CodeNotFound, errors.New(msg))
}

func ErrorPermissionDenied(msg string) error {
	return connect.NewError(connect.CodePermissionDenied, errors.New(msg))
}

func ErrorInternal(msg string) error {
	// We usually want to hide the raw underlying SQL/system error from the client,
	// but the interceptor will log the exact issue if we wrap it properly or just log before returning.
	// We return a safe generic string for Internal.
	return connect.NewError(connect.CodeInternal, errors.New(msg))
}

// logDuration logs the execution time of an operation cleanly
func logDuration(ctx context.Context, operation string, start time.Time) {
	duration := time.Since(start)
	slog.Info("Operation timing",
		"operation", operation,
		"duration", duration,
		"request_id", RequestIDFromContext(ctx),
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
