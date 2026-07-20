package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"

	"github.com/yogisofiharja/aksi-server/internal/config"
	"github.com/yogisofiharja/aksi-server/internal/db"
)

// Forward-only: there is no "down" command. To remove a table/column,
// write a new migration file that drops it — never rely on reversing
// a previous migration.
func main() {
	_ = godotenv.Load()

	if len(os.Args) < 2 || os.Args[1] != "up" {
		fmt.Println("usage: migrate up")
		os.Exit(1)
	}

	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	if err := db.RunMigrations("file://migrations", cfg.DatabaseURL); err != nil {
		log.Fatalf("migration up failed: %v", err)
	}
	log.Println("migration up complete")
}
