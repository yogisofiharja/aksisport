package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	"github.com/yogisofiharja/aksi-server/internal/config"
	"github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/httpapi"
	"github.com/yogisofiharja/aksi-server/internal/scheduling"
)

func main() {
	// Loads .env into the process environment if present — no-op (and no
	// error) when absent, e.g. in production where env vars are injected directly.
	_ = godotenv.Load()

	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if cfg.FirebaseProject == "" {
		log.Fatal("FIREBASE_PROJECT_ID is required")
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := db.RunMigrations("file://migrations", cfg.DatabaseURL); err != nil {
		log.Fatalf("running migrations: %v", err)
	}

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connecting to postgres: %v", err)
	}
	defer pool.Close()

	verifier, err := authjwt.NewVerifier(ctx, cfg.FirebaseProject)
	if err != nil {
		log.Fatalf("setting up firebase token verifier: %v", err)
	}

	router := httpapi.NewRouter(pool, verifier, cfg.AllowedOrigins)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		log.Printf("aksi-server listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// DP-007 generation + DP-009 auto-transition. Same in-process ticker
	// rather than separate job/cron processes — this repo has no second
	// deployment target today, and both are idempotent/safe under any
	// interval, including missed ticks (see GenerateDueSessions and
	// AutoTransitionElapsedSessions).
	go func() {
		ticker := time.NewTicker(cfg.RecurringScheduleGenerationInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := scheduling.GenerateDueSessions(ctx, pool); err != nil {
					log.Printf("recurring schedule generation: %v", err)
				}
				if err := scheduling.AutoTransitionElapsedSessions(ctx, pool); err != nil {
					log.Printf("session auto-transition: %v", err)
				}
			}
		}
	}()

	<-ctx.Done()
	log.Println("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
}
