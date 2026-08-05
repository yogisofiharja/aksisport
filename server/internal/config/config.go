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
