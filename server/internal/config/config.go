package config

import "os"

type Config struct {
	Port            string
	DatabaseURL     string
	FirebaseProject string
	AllowedOrigins  string
}

func Load() Config {
	return Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		FirebaseProject: os.Getenv("FIREBASE_PROJECT_ID"),
		AllowedOrigins:  getEnv("ALLOWED_ORIGINS", "*"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
