package api

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/golang-jwt/jwt/v5"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

func TestBypassAuthAndMockModeAreDisabledInProduction(t *testing.T) {
	t.Setenv("ENV", "production")
	t.Setenv("BYPASS_AUTH", "true")
	t.Setenv("SUPABASE_URL", "https://supabase.example")

	if isMockMode() {
		t.Fatal("mock mode must be disabled in production")
	}

	called := false
	interceptor := NewAuthInterceptor("test-secret")
	_, err := interceptor(func(context.Context, connect.AnyRequest) (connect.AnyResponse, error) {
		called = true
		return nil, nil
	})(context.Background(), connect.NewRequest(&pb.GetProfileRequest{}))
	if connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatalf("code = %v, want %v", connect.CodeOf(err), connect.CodeUnauthenticated)
	}
	if called {
		t.Fatal("request reached handler without credentials")
	}
}

func TestBypassAuthRemainsAvailableOutsideProduction(t *testing.T) {
	t.Setenv("ENV", "development")
	t.Setenv("BYPASS_AUTH", "true")

	if !isMockMode() {
		t.Fatal("mock mode should remain available in development")
	}

	interceptor := NewAuthInterceptor("test-secret")
	_, err := interceptor(func(ctx context.Context, _ connect.AnyRequest) (connect.AnyResponse, error) {
		if got, _ := UserIDFromContext(ctx); got != "00000000-0000-0000-0000-000000000000" {
			t.Fatalf("user ID = %q, want development demo ID", got)
		}
		return nil, nil
	})(context.Background(), connect.NewRequest(&pb.GetProfileRequest{}))
	if err != nil {
		t.Fatalf("development bypass returned error: %v", err)
	}
}

func TestAuthInterceptorRequiresValidHS256Claims(t *testing.T) {
	t.Setenv("ENV", "development")
	t.Setenv("BYPASS_AUTH", "false")
	const secret = "local-test-secret-with-sufficient-entropy"
	const issuer = "https://supabase.example/auth/v1"
	const audience = "authenticated"
	validClaims := func() jwt.MapClaims {
		return jwt.MapClaims{
			"sub": "11111111-1111-4111-8111-111111111111",
			"iss": issuer,
			"aud": audience,
			"exp": time.Now().Add(time.Minute).Unix(),
		}
	}

	t.Run("valid token", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, validClaims())
		serialized, err := token.SignedString([]byte(secret))
		if err != nil {
			t.Fatal(err)
		}
		called := false
		interceptor := newAuthInterceptor(secret, issuer, audience, nil)
		_, err = interceptor(func(ctx context.Context, _ connect.AnyRequest) (connect.AnyResponse, error) {
			called = true
			if got, _ := UserIDFromContext(ctx); got != "11111111-1111-4111-8111-111111111111" {
				t.Fatalf("subject = %q", got)
			}
			return nil, nil
		})(context.Background(), authRequest(serialized))
		if err != nil || !called {
			t.Fatalf("valid token was rejected: called=%v err=%v", called, err)
		}
	})

	tests := []struct {
		name   string
		claims jwt.MapClaims
	}{
		{name: "missing expiration", claims: jwt.MapClaims{"sub": "11111111-1111-4111-8111-111111111111", "iss": issuer, "aud": audience}},
		{name: "wrong issuer", claims: func() jwt.MapClaims { c := validClaims(); c["iss"] = "https://attacker.example"; return c }()},
		{name: "wrong audience", claims: func() jwt.MapClaims { c := validClaims(); c["aud"] = "other"; return c }()},
		{name: "expired", claims: func() jwt.MapClaims { c := validClaims(); c["exp"] = time.Now().Add(-time.Minute).Unix(); return c }()},
		{name: "invalid subject", claims: func() jwt.MapClaims { c := validClaims(); c["sub"] = "not-a-uuid"; return c }()},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, test.claims)
			serialized, err := token.SignedString([]byte(secret))
			if err != nil {
				t.Fatal(err)
			}
			called := false
			_, err = newAuthInterceptor(secret, issuer, audience, nil)(func(context.Context, connect.AnyRequest) (connect.AnyResponse, error) {
				called = true
				return nil, nil
			})(context.Background(), authRequest(serialized))
			if connect.CodeOf(err) != connect.CodeUnauthenticated || called {
				t.Fatalf("invalid claims reached handler: called=%v err=%v", called, err)
			}
		})
	}

	t.Run("algorithm confusion is rejected", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS384, validClaims())
		serialized, err := token.SignedString([]byte(secret))
		if err != nil {
			t.Fatal(err)
		}
		_, err = newAuthInterceptor(secret, issuer, audience, nil)(func(context.Context, connect.AnyRequest) (connect.AnyResponse, error) {
			return nil, nil
		})(context.Background(), authRequest(serialized))
		if connect.CodeOf(err) != connect.CodeUnauthenticated {
			t.Fatalf("HS384 code = %v", connect.CodeOf(err))
		}
	})
}

func TestAuthInterceptorValidatesSupabaseRS256JWKS(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	const kid = "local-test-key"
	keyDocument := map[string]any{"keys": []map[string]string{{
		"kid": kid,
		"kty": "RSA",
		"use": "sig",
		"alg": "RS256",
		"n":   base64.RawURLEncoding.EncodeToString(privateKey.PublicKey.N.Bytes()),
		"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(privateKey.PublicKey.E)).Bytes()),
	}}}
	keyDocumentBytes, err := json.Marshal(keyDocument)
	if err != nil {
		t.Fatal(err)
	}
	const endpoint = "http://local-jwks.test/keys"
	var fetchCount atomic.Int32
	keySet := &jwtKeySet{
		endpoint: endpoint,
		client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.Method != http.MethodGet {
				t.Errorf("JWKS method = %s", r.Method)
			}
			fetchCount.Add(1)
			return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(string(keyDocumentBytes))), Request: r}, nil
		})},
	}
	jwksSets.Store(endpoint, keySet)
	defer jwksSets.Delete(endpoint)
	t.Setenv("SUPABASE_JWKS_URL", endpoint)
	t.Setenv("ENV", "test")
	t.Setenv("BYPASS_AUTH", "false")
	const issuer = "https://supabase.example/auth/v1"
	claims := jwt.MapClaims{
		"sub": "22222222-2222-4222-8222-222222222222",
		"iss": issuer,
		"aud": "authenticated",
		"exp": time.Now().Add(time.Minute).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = kid
	serialized, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatal(err)
	}
	called := false
	_, err = newAuthInterceptor("", issuer, "authenticated", nil)(func(ctx context.Context, _ connect.AnyRequest) (connect.AnyResponse, error) {
		called = true
		if got, _ := UserIDFromContext(ctx); got != "22222222-2222-4222-8222-222222222222" {
			t.Fatalf("subject = %q", got)
		}
		return nil, nil
	})(context.Background(), authRequest(serialized))
	if err != nil || !called {
		t.Fatalf("RS256 token rejected: called=%v err=%v", called, err)
	}

	// An unknown kid forces a refresh so key rotation does not require process restart.
	unknownKidToken := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	unknownKidToken.Header["kid"] = "not-in-jwks"
	unknownSerialized, err := unknownKidToken.SignedString(privateKey)
	if err != nil {
		t.Fatal(err)
	}
	_, err = newAuthInterceptor("", issuer, "authenticated", nil)(func(context.Context, connect.AnyRequest) (connect.AnyResponse, error) {
		return nil, nil
	})(context.Background(), authRequest(unknownSerialized))
	if connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatalf("unknown kid code = %v", connect.CodeOf(err))
	}
	if got := fetchCount.Load(); got != 2 {
		t.Fatalf("JWKS fetches = %d, want initial fetch plus key-rotation refresh", got)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return f(request) }

func authRequest(token string) *connect.Request[pb.GetProfileRequest] {
	request := connect.NewRequest(&pb.GetProfileRequest{})
	request.Header().Set("Authorization", "Bearer "+token)
	return request
}
