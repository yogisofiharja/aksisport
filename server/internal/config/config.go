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
	// RecurringScheduleGenerationInterval: how often the background ticker
	// runs — DP-007 due-occurrence generation and DP-009 elapsed-Session
	// auto-transition both ride the same tick. Generation lead time is
	// specified in whole days, so this resolution only needs to be finer
	// than that — 15 minutes is comfortably sufficient for both.
	RecurringScheduleGenerationInterval time.Duration
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
		RecurringScheduleGenerationInterval: getEnvMinutes("RECURRING_SCHEDULE_GENERATION_INTERVAL_MINUTES", 15),
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
