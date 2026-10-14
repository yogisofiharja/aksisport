package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port            string
	DatabaseURL     string
	FirebaseProject string
	AllowedOrigins  string
	// FirebaseServiceAccountFile: path to a Firebase service account key
	// (JSON). Only password recovery (DP-015) needs it; unset, everything
	// else works and recovery reports itself unavailable.
	FirebaseServiceAccountFile string
	// ResendAPIKey selects Resend as the mail provider (DP-015). Unset,
	// mail is written to the server log instead of being sent.
	ResendAPIKey string
	// MailFrom is the sender, e.g. "Aksi <no-reply@aksisport.com>" — the
	// domain must be verified with the provider. Unset, Resend's shared
	// test sender is used, which only delivers to the Resend account
	// owner's own address.
	MailFrom string
	// ClientIPHeader names the header carrying a visitor's real address
	// when the API sits behind a proxy — "CF-Connecting-IP" behind
	// Cloudflare. Unset (local development): the TCP peer is the client.
	ClientIPHeader string
	// TrustedProxies: the peers whose ClientIPHeader is believed — the
	// local Caddy, by default.
	TrustedProxies string
	// VAPIDSubject (DP-018) identifies this server to browser push
	// services — a mailto: or https: URL they can use to reach the
	// operator.
	VAPIDSubject string
	// ExpoAccessToken is optional — only if the Expo project turns on
	// enhanced push security.
	ExpoAccessToken string
	// RecurringScheduleGenerationInterval: how often the background ticker
	// runs — DP-007 due-occurrence generation and DP-009 elapsed-Session
	// auto-transition both ride the same tick. Generation lead time is
	// specified in whole days, so this resolution only needs to be finer
	// than that — 15 minutes is comfortably sufficient for both.
	RecurringScheduleGenerationInterval time.Duration
	// MatchEarlyStart (DP-022): how long before a Session's start time its
	// matches may be started. 10 minutes in live use; raise it on local or
	// staging to test matches without waiting for a Session to start.
	MatchEarlyStart time.Duration
}

func Load() Config {
	return Config{
		Port:                                getEnv("PORT", "8080"),
		DatabaseURL:                         os.Getenv("DATABASE_URL"),
		FirebaseProject:                     os.Getenv("FIREBASE_PROJECT_ID"),
		AllowedOrigins:                      getEnv("ALLOWED_ORIGINS", "*"),
		FirebaseServiceAccountFile:          os.Getenv("FIREBASE_SERVICE_ACCOUNT_FILE"),
		ResendAPIKey:                        os.Getenv("RESEND_API_KEY"),
		MailFrom:                            os.Getenv("MAIL_FROM"),
		ClientIPHeader:                      os.Getenv("CLIENT_IP_HEADER"),
		TrustedProxies:                      getEnv("TRUSTED_PROXIES", "127.0.0.1,::1"),
		VAPIDSubject:                        getEnv("VAPID_SUBJECT", "https://app.aksisport.com"),
		ExpoAccessToken:                     os.Getenv("EXPO_ACCESS_TOKEN"),
		RecurringScheduleGenerationInterval: getEnvMinutes("RECURRING_SCHEDULE_GENERATION_INTERVAL_MINUTES", 15),
		MatchEarlyStart:                     getEnvMinutes("MATCH_EARLY_START_MINUTES", 10),
	}
}

func getEnvMinutes(key string, fallbackMinutes int) time.Duration {
	if v := os.Getenv(key); v != "" {
		if minutes, err := strconv.Atoi(v); err == nil && minutes > 0 {
			return time.Duration(minutes) * time.Minute
		}
	}
	return time.Duration(fallbackMinutes) * time.Minute
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
