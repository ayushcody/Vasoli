package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestEmailNotificationsDisabledAreNotReportedAsSent(t *testing.T) {
	t.Setenv("ENABLE_EMAIL_NOTIFICATIONS", "false")
	result := sendReminderEmail(dueReminder{UserEmail: "person@example.test", Title: "Bill due"})
	if result.status != "DISABLED" {
		t.Fatalf("status = %q, want DISABLED", result.status)
	}
	if result.err != nil {
		t.Fatalf("disabled delivery returned error: %v", result.err)
	}
}

func TestMissingSMTPIsSafeRetryableFailure(t *testing.T) {
	t.Setenv("ENABLE_EMAIL_NOTIFICATIONS", "true")
	t.Setenv("SMTP_ADDR", "")
	t.Setenv("SMTP_USERNAME", "")
	t.Setenv("SMTP_PASSWORD", "")
	t.Setenv("SMTP_FROM", "")
	t.Setenv("GMAIL_USER", "")
	t.Setenv("GMAIL_APP_PASSWORD", "")

	result := sendReminderEmail(dueReminder{UserEmail: "person@example.test", Title: "Bill due"})
	if result.status != "FAILED" || result.err == nil {
		t.Fatalf("result = %+v, want known pre-send failure", result)
	}
}

func TestReminderHeadersRejectNewlines(t *testing.T) {
	t.Setenv("ENABLE_EMAIL_NOTIFICATIONS", "true")
	t.Setenv("SMTP_ADDR", "127.0.0.1:1025")
	t.Setenv("SMTP_FROM", "notifications@vasoli.local")
	result := sendReminderEmail(dueReminder{UserEmail: "person@example.test", Title: "Bill due\r\nBcc: attacker@example.test"})
	if result.status != "DISABLED" {
		t.Fatalf("status = %q, want DISABLED", result.status)
	}
}

func TestStopIsIdempotent(t *testing.T) {
	worker := &NotificationWorker{
		Ticker: time.NewTicker(time.Minute),
		Done:   make(chan struct{}),
	}
	worker.Stop()
	worker.Stop()
}

// This opt-in integration test uses a separately configured test database only.
// It never falls back to the app's DATABASE_URL or any local runtime env file.
func TestNotificationClaimsAreExclusiveAcrossWorkers(t *testing.T) {
	databaseURL := os.Getenv("VASOLI_TEST_DATABASE_URL")
	supabaseURL := os.Getenv("VASOLI_TEST_SUPABASE_URL")
	serviceKey := os.Getenv("VASOLI_TEST_SERVICE_ROLE_KEY")
	if databaseURL == "" || supabaseURL == "" || serviceKey == "" {
		t.Skip("set VASOLI_TEST_DATABASE_URL and local Supabase test credentials")
	}
	parsed, err := url.Parse(supabaseURL)
	if err != nil || parsed.Scheme != "http" || (parsed.Hostname() != "127.0.0.1" && parsed.Hostname() != "localhost" && parsed.Hostname() != "::1") {
		t.Fatal("notification integration test only permits a local Supabase URL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	defer pool.Close()

	userID, reminderID := uuid.New(), uuid.New()
	email := fmt.Sprintf("notification-claim-%s@vasoli.local", userID)
	userID, err = createNotificationTestAuthUser(ctx, supabaseURL, serviceKey, email)
	if err != nil {
		t.Fatalf("create local auth fixture: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, userID)
		deleteNotificationTestAuthUser(userID, supabaseURL, serviceKey)
	}()
	if _, err := pool.Exec(ctx, `INSERT INTO users (id,email) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email`, userID, email); err != nil {
		t.Fatalf("insert fixture user: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO reminders (id,user_id,title,reminder_type,due_at,channel_in_app) VALUES ($1,$2,'Claim test','CUSTOM',NOW(),true)`, reminderID, userID); err != nil {
		t.Fatalf("insert fixture reminder: %v", err)
	}

	reminder := dueReminder{ID: pgtype.UUID{Bytes: reminderID, Valid: true}, UserID: pgtype.UUID{Bytes: userID, Valid: true}, Title: "Claim test", DueAt: time.Now().UTC(), UserEmail: email, InApp: true}
	worker := &NotificationWorker{Pool: pool}
	results := make(chan *claimedDelivery, 2)
	errors := make(chan error, 2)
	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			claim, err := worker.claimDelivery(ctx, reminder, "IN_APP")
			if err != nil {
				errors <- err
				return
			}
			results <- claim
		}()
	}
	wg.Wait()
	close(results)
	close(errors)
	for err := range errors {
		t.Fatalf("claim notification: %v", err)
	}
	claims := 0
	var first *claimedDelivery
	for claim := range results {
		if claim != nil {
			claims++
			first = claim
		}
	}
	if claims != 1 {
		t.Fatalf("concurrent claims = %d, want exactly one", claims)
	}

	if _, err := pool.Exec(ctx, `UPDATE reminder_notifications SET claim_until=NOW()-INTERVAL '1 second' WHERE id=$1`, first.ID); err != nil {
		t.Fatalf("expire claim lease: %v", err)
	}
	reclaimed, err := worker.claimDelivery(ctx, reminder, "IN_APP")
	if err != nil || reclaimed != nil {
		t.Fatalf("expired uncertain lease must not be reclaimed: claim=%v err=%v", reclaimed, err)
	}
	var status string
	var claimToken, claimUntil any
	var attemptCount int32
	if err := pool.QueryRow(ctx, `SELECT status,claim_token,claim_until,attempt_count FROM reminder_notifications WHERE id=$1`, first.ID).Scan(&status, &claimToken, &claimUntil, &attemptCount); err != nil {
		t.Fatalf("read expired notification state: %v", err)
	}
	if status != "UNCERTAIN" || claimToken != nil || claimUntil != nil || attemptCount != 1 {
		t.Fatalf("expired notification state = status %q, token %v, lease %v, attempts %d; want UNCERTAIN, cleared claim, one attempt", status, claimToken, claimUntil, attemptCount)
	}
}

// TestLocalMailpitDelivery opt-in verifies real SMTP delivery only against a
// loopback Mailpit instance; it cannot target an external recipient or server.
func TestLocalMailpitDelivery(t *testing.T) {
	mailpitURL := strings.TrimRight(os.Getenv("VASOLI_TEST_MAILPIT_URL"), "/")
	if mailpitURL == "" {
		t.Skip("set VASOLI_TEST_MAILPIT_URL to verify local SMTP delivery")
	}
	parsed, err := url.Parse(mailpitURL)
	if err != nil || parsed.Scheme != "http" || (parsed.Hostname() != "127.0.0.1" && parsed.Hostname() != "localhost" && parsed.Hostname() != "::1") {
		t.Fatal("Mailpit delivery test only permits a local HTTP endpoint")
	}
	smtpAddress := os.Getenv("SMTP_ADDR")
	smtpHost, _, err := net.SplitHostPort(smtpAddress)
	if err != nil || (smtpHost != "127.0.0.1" && smtpHost != "localhost" && smtpHost != "::1") {
		t.Fatal("Mailpit delivery test only permits a loopback SMTP server")
	}
	if strings.TrimSpace(os.Getenv("SMTP_FROM")) == "" {
		t.Fatal("SMTP_FROM is required for local Mailpit test")
	}

	marker := uuid.NewString()
	recipient := "vasoli-mailpit-" + marker + "@example.test"
	t.Setenv("ENABLE_EMAIL_NOTIFICATIONS", "true")
	result := sendReminderEmail(dueReminder{UserEmail: recipient, Title: "Local Mailpit " + marker, DueAt: time.Now().UTC()})
	if result.status != "SENT" {
		t.Fatalf("local SMTP result status = %q, want SENT", result.status)
	}

	client := &http.Client{Timeout: 2 * time.Second}
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		response, err := client.Get(mailpitURL + "/api/v1/messages?limit=100")
		if err == nil {
			var inbox struct {
				Messages []struct {
					Subject string `json:"Subject"`
					To      []struct {
						Address string `json:"Address"`
					} `json:"To"`
				} `json:"messages"`
			}
			decodeErr := json.NewDecoder(response.Body).Decode(&inbox)
			response.Body.Close()
			if response.StatusCode == http.StatusOK && decodeErr == nil {
				for _, message := range inbox.Messages {
					if message.Subject != "Vasoli Reminder: Local Mailpit "+marker {
						continue
					}
					for _, to := range message.To {
						if to.Address == recipient {
							return
						}
					}
				}
			}
		}
		time.Sleep(200 * time.Millisecond)
	}
	t.Fatal("Mailpit did not receive the uniquely addressed reminder")
}

func createNotificationTestAuthUser(ctx context.Context, baseURL, serviceKey, email string) (uuid.UUID, error) {
	password := uuid.NewString() + "-Nf3!"
	body, _ := json.Marshal(map[string]any{"email": email, "password": password, "email_confirm": true})
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(baseURL, "/")+"/auth/v1/admin/users", strings.NewReader(string(body)))
	if err != nil {
		return uuid.Nil, err
	}
	request.Header.Set("apikey", serviceKey)
	request.Header.Set("Authorization", "Bearer "+serviceKey)
	request.Header.Set("Content-Type", "application/json")
	response, err := (&http.Client{Timeout: 5 * time.Second}).Do(request)
	if err != nil {
		return uuid.Nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK && response.StatusCode != http.StatusCreated {
		return uuid.Nil, fmt.Errorf("local auth fixture returned status %d", response.StatusCode)
	}
	var user struct {
		ID uuid.UUID `json:"id"`
	}
	if err := json.NewDecoder(response.Body).Decode(&user); err != nil {
		return uuid.Nil, err
	}
	if user.ID == uuid.Nil {
		return uuid.Nil, fmt.Errorf("local auth fixture has no id")
	}
	return user.ID, nil
}

func deleteNotificationTestAuthUser(id uuid.UUID, baseURL, serviceKey string) {
	request, err := http.NewRequest(http.MethodDelete, strings.TrimRight(baseURL, "/")+"/auth/v1/admin/users/"+id.String(), nil)
	if err != nil {
		return
	}
	request.Header.Set("apikey", serviceKey)
	request.Header.Set("Authorization", "Bearer "+serviceKey)
	response, err := (&http.Client{Timeout: 5 * time.Second}).Do(request)
	if err == nil {
		_ = response.Body.Close()
	}
}
