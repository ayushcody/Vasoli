package api

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"connectrpc.com/connect"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type contextKey string

const (
	UserIDKey        contextKey = "user_id"
	UserEmailKey     contextKey = "user_email"
	defaultJWTIssuer            = "authenticated"
)

type jwtKeySet struct {
	mu        sync.Mutex
	endpoint  string
	keys      map[string]any
	expiresAt time.Time
	client    *http.Client
}

type jwksDocument struct {
	Keys []struct {
		KID string `json:"kid"`
		KTY string `json:"kty"`
		Use string `json:"use"`
		Alg string `json:"alg"`
		N   string `json:"n"`
		E   string `json:"e"`
		Crv string `json:"crv"`
		X   string `json:"x"`
		Y   string `json:"y"`
	} `json:"keys"`
}

var jwksSets sync.Map // map[string]*jwtKeySet

// NewAuthInterceptor validates signed Supabase JWTs. HS256 is accepted only when
// an explicit SUPABASE_JWT_SECRET is configured; RS256 and ES256 use Supabase JWKS.
func NewAuthInterceptor(jwtSecret string) connect.UnaryInterceptorFunc {
	return newAuthInterceptor(jwtSecret, authIssuer(), strings.TrimSpace(os.Getenv("SUPABASE_JWT_AUDIENCE")), nil)
}

func NewAuthInterceptorWithPool(jwtSecret string, pool *pgxpool.Pool) connect.UnaryInterceptorFunc {
	return newAuthInterceptor(jwtSecret, authIssuer(), strings.TrimSpace(os.Getenv("SUPABASE_JWT_AUDIENCE")), pool)
}

func newAuthInterceptor(jwtSecret, issuer, audience string, pool *pgxpool.Pool) connect.UnaryInterceptorFunc {
	if audience == "" {
		audience = "authenticated"
	}
	jwksURL := authJWKSURL()
	keySet := keySetFor(jwksURL)

	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			authHeader := strings.TrimSpace(req.Header().Get("Authorization"))
			bypassAuth := strings.EqualFold(os.Getenv("BYPASS_AUTH"), "true") && !isProduction()
			if authHeader == "" {
				if bypassAuth {
					ctx = context.WithValue(ctx, UserIDKey, "00000000-0000-0000-0000-000000000000")
					ctx = context.WithValue(ctx, UserEmailKey, "demo@vasoli.app")
					return next(ctx, req)
				}
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authorization header"))
			}

			parts := strings.Fields(authHeader)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("invalid authorization header format"))
			}

			claims, err := validateJWT(ctx, parts[1], jwtSecret, issuer, audience, keySet)
			if err != nil {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("invalid or expired bearer token"))
			}

			subject, ok := claims["sub"].(string)
			if !ok || uuid.Validate(subject) != nil {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("token has invalid subject"))
			}
			ctx = context.WithValue(ctx, UserIDKey, subject)
			if email, ok := claims["email"].(string); ok {
				ctx = context.WithValue(ctx, UserEmailKey, email)
			}
			if pool != nil {
				var deletionPending bool
				if err := pool.QueryRow(ctx, `
					SELECT EXISTS (
						SELECT 1 FROM account_deletion_requests
						WHERE user_id=$1 AND status IN ('PENDING','DELETING_DATA','DELETING_AUTH')
					)`, subject).Scan(&deletionPending); err != nil {
					return nil, connect.NewError(connect.CodeUnavailable, errors.New("account status is temporarily unavailable"))
				}
				if deletionPending {
					return nil, connect.NewError(connect.CodePermissionDenied, errors.New("account deletion is in progress"))
				}
			}
			return next(ctx, req)
		}
	}
}

// AuthenticatedIdentityFromRequest validates the same strict bearer JWT used by
// the Connect interceptor and returns its authenticated identity to HTTP handlers.
func AuthenticatedIdentityFromRequest(r *http.Request) (string, string, error) {
	parts := strings.Fields(strings.TrimSpace(r.Header.Get("Authorization")))
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
		return "", "", errors.New("missing or invalid bearer token")
	}
	claims, err := validateJWT(
		r.Context(),
		parts[1],
		strings.TrimSpace(os.Getenv("SUPABASE_JWT_SECRET")),
		authIssuer(),
		strings.TrimSpace(os.Getenv("SUPABASE_JWT_AUDIENCE")),
		keySetFor(authJWKSURL()),
	)
	if err != nil {
		return "", "", err
	}
	subject, ok := claims["sub"].(string)
	if !ok || uuid.Validate(subject) != nil {
		return "", "", errors.New("token has invalid subject")
	}
	email, _ := claims["email"].(string)
	return subject, email, nil
}

// AuthenticateRPCMiddleware places the validated identity in the HTTP request
// context before Connect dispatches unary or server-streaming RPCs. This is
// required because Connect unary interceptors do not run for server streams.
func AuthenticateRPCMiddleware(next http.Handler, pool *pgxpool.Pool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, email, err := AuthenticatedIdentityFromRequest(r)
		if err != nil {
			if strings.EqualFold(os.Getenv("BYPASS_AUTH"), "true") && !isProduction() && strings.TrimSpace(r.Header.Get("Authorization")) == "" {
				userID, email = "00000000-0000-0000-0000-000000000000", "demo@vasoli.app"
			} else {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
		}
		if pool != nil {
			var pending bool
			if err := pool.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM account_deletion_requests WHERE user_id=$1 AND status IN ('PENDING','DELETING_DATA','DELETING_AUTH'))`, userID).Scan(&pending); err != nil {
				http.Error(w, "temporarily unavailable", http.StatusServiceUnavailable)
				return
			}
			if pending {
				http.Error(w, "account deletion is in progress", http.StatusForbidden)
				return
			}
		}
		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		ctx = context.WithValue(ctx, UserEmailKey, email)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func validateJWT(ctx context.Context, rawToken, jwtSecret, issuer, audience string, keySet *jwtKeySet) (jwt.MapClaims, error) {
	if issuer == "" {
		return nil, errors.New("JWT issuer is not configured")
	}
	if audience == "" {
		audience = defaultJWTIssuer
	}
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg(), jwt.SigningMethodRS256.Alg(), jwt.SigningMethodES256.Alg()}),
		jwt.WithExpirationRequired(),
		jwt.WithIssuer(issuer),
		jwt.WithAudience(audience),
		jwt.WithLeeway(30*time.Second),
	)
	claims := jwt.MapClaims{}
	token, err := parser.ParseWithClaims(rawToken, claims, func(token *jwt.Token) (any, error) {
		switch token.Method.Alg() {
		case jwt.SigningMethodHS256.Alg():
			if jwtSecret == "" {
				return nil, errors.New("HS256 is not configured")
			}
			return []byte(jwtSecret), nil
		case jwt.SigningMethodRS256.Alg(), jwt.SigningMethodES256.Alg():
			if keySet == nil {
				return nil, errors.New("JWKS is not configured")
			}
			kid, _ := token.Header["kid"].(string)
			if kid == "" {
				return nil, errors.New("JWT signing key id is missing")
			}
			return keySet.key(ctx, kid, token.Method.Alg())
		default:
			return nil, fmt.Errorf("unsupported signing algorithm %q", token.Method.Alg())
		}
	})
	if err != nil || token == nil || !token.Valid {
		return nil, errors.New("invalid JWT")
	}
	return claims, nil
}

func authIssuer() string {
	if issuer := strings.TrimSpace(os.Getenv("SUPABASE_JWT_ISSUER")); issuer != "" {
		return issuer
	}
	if projectURL := strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/"); projectURL != "" {
		return projectURL + "/auth/v1"
	}
	return ""
}

func authJWKSURL() string {
	if configured := strings.TrimSpace(os.Getenv("SUPABASE_JWKS_URL")); configured != "" {
		return configured
	}
	if projectURL := strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/"); projectURL != "" {
		return projectURL + "/auth/v1/.well-known/jwks.json"
	}
	return ""
}

func keySetFor(endpoint string) *jwtKeySet {
	if endpoint == "" {
		return nil
	}
	if raw, ok := jwksSets.Load(endpoint); ok {
		return raw.(*jwtKeySet)
	}
	parsed, err := url.Parse(endpoint)
	if err != nil || (parsed.Scheme != "https" && parsed.Hostname() != "localhost" && parsed.Hostname() != "127.0.0.1" && parsed.Hostname() != "::1") || parsed.Host == "" {
		return nil
	}
	set := &jwtKeySet{
		endpoint: endpoint,
		client:   &http.Client{Timeout: 3 * time.Second},
	}
	actual, _ := jwksSets.LoadOrStore(endpoint, set)
	return actual.(*jwtKeySet)
}

func (s *jwtKeySet) key(ctx context.Context, kid, algorithm string) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if time.Now().Before(s.expiresAt) {
		if key := s.keys[kid]; key != nil {
			return keyForAlgorithm(key, algorithm)
		}
	}
	if err := s.refresh(ctx); err != nil {
		return nil, err
	}
	key := s.keys[kid]
	if key == nil {
		return nil, errors.New("JWT signing key was not found")
	}
	return keyForAlgorithm(key, algorithm)
}

func keyForAlgorithm(key any, algorithm string) (any, error) {
	switch algorithm {
	case jwt.SigningMethodRS256.Alg():
		if _, ok := key.(*rsa.PublicKey); !ok {
			return nil, errors.New("JWKS key type does not match RS256")
		}
	case jwt.SigningMethodES256.Alg():
		if _, ok := key.(*ecdsa.PublicKey); !ok {
			return nil, errors.New("JWKS key type does not match ES256")
		}
	default:
		return nil, errors.New("unsupported JWKS signing algorithm")
	}
	return key, nil
}

func (s *jwtKeySet) refresh(ctx context.Context) error {
	return s.refreshJWKS(ctx, s.endpoint)
}

// UserIDFromContext extracts the authenticated subject from request context.
func UserIDFromContext(ctx context.Context) (string, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return "", errors.New("user ID not found in context")
	}
	return userID, nil
}

func UserEmailFromContext(ctx context.Context) string {
	email, _ := ctx.Value(UserEmailKey).(string)
	return email
}

func (s *jwtKeySet) refreshJWKS(ctx context.Context, endpoint string) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	response, err := s.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("JWKS endpoint returned status %d", response.StatusCode)
	}
	var document jwksDocument
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&document); err != nil {
		return err
	}
	keys := make(map[string]any, len(document.Keys))
	for _, jwk := range document.Keys {
		if jwk.KID == "" || (jwk.Use != "" && jwk.Use != "sig") {
			continue
		}
		if (jwk.KTY == "RSA" && jwk.Alg != "" && jwk.Alg != jwt.SigningMethodRS256.Alg()) ||
			(jwk.KTY == "EC" && jwk.Alg != "" && jwk.Alg != jwt.SigningMethodES256.Alg()) {
			continue
		}
		key, err := parseJWK(jwk)
		if err == nil {
			keys[jwk.KID] = key
		}
	}
	if len(keys) == 0 {
		return errors.New("JWKS response contains no supported signing keys")
	}
	s.keys = keys
	s.expiresAt = time.Now().Add(15 * time.Minute)
	return nil
}

func parseJWK(jwk struct {
	KID string `json:"kid"`
	KTY string `json:"kty"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}) (any, error) {
	switch jwk.KTY {
	case "RSA":
		n, err := base64.RawURLEncoding.DecodeString(jwk.N)
		if err != nil {
			return nil, err
		}
		e, err := base64.RawURLEncoding.DecodeString(jwk.E)
		if err != nil {
			return nil, err
		}
		exponent := 0
		for _, b := range e {
			exponent = exponent<<8 | int(b)
		}
		if exponent < 3 || exponent%2 == 0 {
			return nil, errors.New("invalid RSA exponent")
		}
		modulus := new(big.Int).SetBytes(n)
		if modulus.BitLen() < 2048 {
			return nil, errors.New("RSA key is too small")
		}
		return &rsa.PublicKey{N: modulus, E: exponent}, nil
	case "EC":
		if jwk.Crv != "P-256" {
			return nil, errors.New("unsupported EC curve")
		}
		xBytes, err := base64.RawURLEncoding.DecodeString(jwk.X)
		if err != nil {
			return nil, err
		}
		yBytes, err := base64.RawURLEncoding.DecodeString(jwk.Y)
		if err != nil {
			return nil, err
		}
		key := &ecdsa.PublicKey{Curve: elliptic.P256(), X: new(big.Int).SetBytes(xBytes), Y: new(big.Int).SetBytes(yBytes)}
		if !key.Curve.IsOnCurve(key.X, key.Y) {
			return nil, errors.New("invalid EC public key")
		}
		return key, nil
	default:
		return nil, errors.New("unsupported JWKS key type")
	}
}
