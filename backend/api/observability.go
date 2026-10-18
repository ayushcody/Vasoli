package api

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"regexp"
)

var emailRegex = regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)

func maskPII(input string) string {
	return emailRegex.ReplaceAllString(input, "[REDACTED_EMAIL]")
}

func NewLoggingInterceptor() connect.Interceptor {
	return connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			start := time.Now()

			res, err := next(ctx, req)

			duration := time.Since(start)
			userID, _ := UserIDFromContext(ctx)
			reqID := RequestIDFromContext(ctx)

			if err != nil {
				connectErr := connect.CodeOf(err)
				slog.Error("rpc method failed",
					slog.String("method", req.Spec().Procedure),
					slog.String("code", connectErr.String()),
					slog.Duration("duration", duration),
					slog.String("user_id", userID),
					slog.String("request_id", reqID),
					// Provider/database error bodies can contain financial payloads; log only the safe code.
				)
			} else {
				// We don't need to log every success in production, but keeping it for debug is nice.
				// For now, logging successes as debug, but slow requests as warnings.
				if duration > 500*time.Millisecond {
					slog.Warn("rpc method slow",
						slog.String("method", req.Spec().Procedure),
						slog.Duration("duration", duration),
						slog.String("user_id", userID),
						slog.String("request_id", reqID),
					)
				}
			}

			return res, err
		}
	})
}

func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("x-request-id")
		if len(requestID) > 128 || !regexp.MustCompile(`^[a-zA-Z0-9_-]+$`).MatchString(requestID) {
			requestID = uuid.NewString()
		}

		w.Header().Set("x-request-id", requestID)
		next.ServeHTTP(w, r.WithContext(WithRequestID(r.Context(), requestID)))
	})
}
