package api

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/mail"
	"net/smtp"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"vasoli-backend/internal/db"
)

type NotificationWorker struct {
	DB     *db.Queries // Retained for source compatibility; delivery state uses Pool.
	Pool   *pgxpool.Pool
	Ticker *time.Ticker
	Done   chan struct{}
	once   sync.Once
}

type dueReminder struct {
	ID        pgtype.UUID
	UserID    pgtype.UUID
	Title     string
	DueAt     time.Time
	UserEmail string
	Email     bool
	InApp     bool
	Push      bool
	LeadDays  int32
}

type claimedDelivery struct {
	ID           pgtype.UUID
	ClaimToken   pgtype.UUID
	AttemptCount int32
}

type deliveryResult struct {
	status string
	err    error
}

func StartNotificationWorker(ctx context.Context, dbQueries *db.Queries) *NotificationWorker {
	return StartNotificationWorkerWithPool(ctx, dbQueries, nil)
}

func StartNotificationWorkerWithPool(ctx context.Context, dbQueries *db.Queries, pool *pgxpool.Pool) *NotificationWorker {
	worker := &NotificationWorker{
		DB:     dbQueries,
		Pool:   pool,
		Ticker: time.NewTicker(time.Minute),
		Done:   make(chan struct{}),
	}
	go worker.run(ctx)
	return worker
}

func (w *NotificationWorker) Stop() {
	w.once.Do(func() {
		if w.Ticker != nil {
			w.Ticker.Stop()
		}
		if w.Done != nil {
			close(w.Done)
		}
	})
}

func (w *NotificationWorker) run(ctx context.Context) {
	slog.Info("notification worker started")
	defer slog.Info("notification worker stopped")
	w.processDueNotifications(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-w.Done:
			return
		case <-w.Ticker.C:
			w.processDueNotifications(ctx)
		}
	}
}

func (w *NotificationWorker) processDueNotifications(ctx context.Context) {
	if w.Pool == nil {
		slog.Warn("notification worker has no database pool; deliveries are disabled")
		return
	}
	rows, err := w.Pool.Query(ctx, `
		SELECT r.id, r.user_id, r.title, r.due_at, u.email,
		       r.channel_email AND COALESCE(np.email_enabled, false),
		       r.channel_in_app AND COALESCE(np.in_app_enabled, true),
		       r.channel_push AND COALESCE(np.push_enabled, false),
		       GREATEST(COALESCE(np.lead_days, 3), 0)
		FROM reminders r
		JOIN users u ON u.id = r.user_id
		LEFT JOIN notification_preferences np ON np.user_id = r.user_id
		WHERE r.status = 'PENDING'
		  AND (r.snoozed_until IS NULL OR r.snoozed_until <= NOW())
		  AND r.due_at - (GREATEST(COALESCE(np.lead_days, 3), 0) * INTERVAL '1 day') <= NOW()
		ORDER BY r.due_at, r.id
		LIMIT 500`)
	if err != nil {
		slog.Error("notification worker failed to load due reminders", "error", safeLogError(err))
		return
	}
	var due []dueReminder
	for rows.Next() {
		var reminder dueReminder
		if err := rows.Scan(&reminder.ID, &reminder.UserID, &reminder.Title, &reminder.DueAt, &reminder.UserEmail,
			&reminder.Email, &reminder.InApp, &reminder.Push, &reminder.LeadDays); err != nil {
			rows.Close()
			slog.Error("notification worker failed to decode due reminder", "error", safeLogError(err))
			return
		}
		due = append(due, reminder)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		slog.Error("notification worker failed while reading due reminders", "error", safeLogError(err))
		return
	}
	rows.Close()

	for _, reminder := range due {
		if err := ctx.Err(); err != nil {
			return
		}
		if reminder.Email {
			w.deliver(ctx, reminder, "EMAIL")
		}
		if reminder.InApp {
			w.deliver(ctx, reminder, "IN_APP")
		}
		if reminder.Push {
			// Push delivery is not implemented. Record it as disabled rather than sent.
			w.deliver(ctx, reminder, "PUSH")
		}
	}
}

func (w *NotificationWorker) deliver(ctx context.Context, reminder dueReminder, channel string) {
	delivery, err := w.claimDelivery(ctx, reminder, channel)
	if err != nil {
		slog.Error("notification delivery claim failed", "reminder_id", UUIDToString(reminder.ID), "channel", channel, "error", safeLogError(err))
		return
	}
	if delivery == nil {
		return
	}
	result := deliveryResult{status: "SENT"}
	switch channel {
	case "EMAIL":
		result = sendReminderEmail(reminder)
	case "IN_APP":
		// The row itself is the in-app notification and is now available to the client.
	case "PUSH":
		result.status = "DISABLED"
	default:
		result.status = "DISABLED"
	}
	if err := w.finishDelivery(ctx, *delivery, result); err != nil {
		slog.Error("notification delivery state update failed", "reminder_id", UUIDToString(reminder.ID), "channel", channel, "error", safeLogError(err))
		return
	}
	if result.err != nil {
		slog.Error("notification delivery failed", "reminder_id", UUIDToString(reminder.ID), "channel", channel, "status", result.status)
	}
}

func (w *NotificationWorker) claimDelivery(ctx context.Context, reminder dueReminder, channel string) (*claimedDelivery, error) {
	scheduledFor := reminder.DueAt.Add(-time.Duration(reminder.LeadDays) * 24 * time.Hour)
	var id pgtype.UUID
	err := w.Pool.QueryRow(ctx, `
		INSERT INTO reminder_notifications (reminder_id, user_id, channel, scheduled_for, status)
		VALUES ($1, $2, $3, $4, 'PENDING')
		ON CONFLICT (reminder_id, channel) DO NOTHING
		RETURNING id`, reminder.ID, reminder.UserID, channel, scheduledFor).Scan(&id)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		if err := w.Pool.QueryRow(ctx, `SELECT id FROM reminder_notifications WHERE reminder_id=$1 AND channel=$2`, reminder.ID, channel).Scan(&id); err != nil {
			return nil, err
		}
	}
	// A process may have crashed after the remote provider accepted delivery
	// but before SENT was persisted. An expired lease therefore has an unknown
	// outcome and must be terminal for automatic delivery.
	_, err = w.Pool.Exec(ctx, `
		UPDATE reminder_notifications
		SET status='UNCERTAIN', failed_at=NOW(),
		    error_message='Delivery claim expired; automatic retry suppressed',
		    next_attempt_at=NULL, claim_token=NULL, claim_until=NULL
		WHERE id=$1 AND status='CLAIMED' AND claim_until < NOW()`, id)
	if err != nil {
		return nil, err
	}
	var claimToken pgtype.UUID
	if err := claimToken.Scan(uuid.NewString()); err != nil {
		return nil, err
	}
	var attemptCount int32
	err = w.Pool.QueryRow(ctx, `
		UPDATE reminder_notifications
		SET status='CLAIMED', claim_token=$2, claim_until=NOW() + INTERVAL '2 minutes',
		    attempt_count=attempt_count+1, failed_at=NULL, error_message=NULL
		WHERE id=$1
		  AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
		  AND (status='PENDING' OR (status='FAILED' AND next_attempt_at <= NOW()))
		RETURNING attempt_count`, id, claimToken).Scan(&attemptCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &claimedDelivery{ID: id, ClaimToken: claimToken, AttemptCount: attemptCount}, nil
}

func (w *NotificationWorker) finishDelivery(ctx context.Context, claim claimedDelivery, result deliveryResult) error {
	var retryAt any
	var failureAt any
	var sentAt any
	var safeError any
	switch result.status {
	case "SENT":
		sentAt = time.Now().UTC()
	case "FAILED":
		failureAt = time.Now().UTC()
		safeError = "delivery failed before SMTP acceptance"
		if result.err != nil {
			safeError = result.err.Error()
		}
		if claim.AttemptCount < 5 {
			delay := time.Duration(1<<min(int(claim.AttemptCount)-1, 8)) * time.Minute
			retryAt = time.Now().UTC().Add(delay)
		}
	case "UNCERTAIN":
		failureAt = time.Now().UTC()
		safeError = "SMTP outcome uncertain; automatic retry suppressed"
	case "DISABLED":
		safeError = "channel delivery is disabled or not configured"
	default:
		return fmt.Errorf("invalid notification delivery status")
	}
	_, err := w.Pool.Exec(ctx, `
		UPDATE reminder_notifications
		SET status=$3, sent_at=$4, failed_at=$5, error_message=$6,
		    next_attempt_at=$7, claim_token=NULL, claim_until=NULL
		WHERE id=$1 AND claim_token=$2 AND status='CLAIMED'`,
		claim.ID, claim.ClaimToken, result.status, sentAt, failureAt, safeError, retryAt)
	return err
}

func sendReminderEmail(reminder dueReminder) deliveryResult {
	if !strings.EqualFold(strings.TrimSpace(os.Getenv("ENABLE_EMAIL_NOTIFICATIONS")), "true") {
		return deliveryResult{status: "DISABLED"}
	}
	address := strings.TrimSpace(os.Getenv("SMTP_ADDR"))
	username := strings.TrimSpace(os.Getenv("SMTP_USERNAME"))
	password := os.Getenv("SMTP_PASSWORD")
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	if address == "" {
		if gmailUser := strings.TrimSpace(os.Getenv("GMAIL_USER")); gmailUser != "" {
			address, username, password = "smtp.gmail.com:587", gmailUser, os.Getenv("GMAIL_APP_PASSWORD")
		}
	}
	if address == "" || from == "" || (username != "" && password == "") {
		return deliveryResult{status: "FAILED", err: errors.New("SMTP is not configured")}
	}
	to, err := mail.ParseAddress(strings.TrimSpace(reminder.UserEmail))
	if err != nil || to.Address != reminder.UserEmail {
		return deliveryResult{status: "DISABLED", err: errors.New("invalid recipient address")}
	}
	fromAddress, err := mail.ParseAddress(from)
	if err != nil || fromAddress.Address != from {
		return deliveryResult{status: "DISABLED", err: errors.New("invalid sender address")}
	}
	if strings.ContainsAny(reminder.Title, "\r\n") {
		return deliveryResult{status: "DISABLED", err: errors.New("invalid reminder title")}
	}
	message := []byte(fmt.Sprintf("To: %s\r\nFrom: %s\r\nSubject: Vasoli Reminder: %s\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHi there,\r\n\r\nThis is a reminder for: %s\r\nDue date: %s\r\n\r\nOpen Vasoli to view details.\r\n",
		to.String(), fromAddress.String(), reminder.Title, reminder.Title, reminder.DueAt.UTC().Format(time.RFC1123Z)))

	connection, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		return deliveryResult{status: "FAILED", err: errors.New("SMTP connection failed before delivery")}
	}
	defer connection.Close()
	_ = connection.SetDeadline(time.Now().Add(15 * time.Second))
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return deliveryResult{status: "DISABLED", err: errors.New("invalid SMTP address")}
	}
	client, err := smtp.NewClient(connection, host)
	if err != nil {
		return deliveryResult{status: "FAILED", err: errors.New("SMTP handshake failed before delivery")}
	}
	defer client.Close()
	localSMTP := host == "localhost" || host == "127.0.0.1" || host == "::1"
	if !localSMTP {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			return deliveryResult{status: "FAILED", err: errors.New("SMTP server does not support required TLS")}
		}
		if err := client.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
			return deliveryResult{status: "FAILED", err: errors.New("SMTP TLS negotiation failed")}
		}
	}
	if username != "" {
		auth := smtp.PlainAuth("", username, password, host)
		if err := client.Auth(auth); err != nil {
			return deliveryResult{status: "FAILED", err: errors.New("SMTP authentication failed before delivery")}
		}
	}
	if err := client.Mail(fromAddress.Address); err != nil {
		return deliveryResult{status: "FAILED", err: errors.New("SMTP sender rejected before delivery")}
	}
	if err := client.Rcpt(to.Address); err != nil {
		return deliveryResult{status: "FAILED", err: errors.New("SMTP recipient rejected before delivery")}
	}
	data, err := client.Data()
	if err != nil {
		return deliveryResult{status: "FAILED", err: errors.New("SMTP server rejected message before content transfer")}
	}
	if _, err := data.Write(message); err != nil {
		_ = data.Close()
		return deliveryResult{status: "UNCERTAIN", err: errors.New("SMTP outcome uncertain")}
	}
	if err := data.Close(); err != nil {
		return deliveryResult{status: "UNCERTAIN", err: errors.New("SMTP outcome uncertain")}
	}
	if err := client.Quit(); err != nil {
		// A completed DATA command can already be accepted even when QUIT fails.
		return deliveryResult{status: "SENT"}
	}
	return deliveryResult{status: "SENT"}
}

func safeLogError(err error) string {
	if err == nil {
		return "unknown error"
	}
	return "operation failed"
}
