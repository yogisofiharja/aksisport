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
	"github.com/yogisofiharja/aksi-server/internal/firebaseadmin"
	"github.com/yogisofiharja/aksi-server/internal/httpapi"
	"github.com/yogisofiharja/aksi-server/internal/live"
	"github.com/yogisofiharja/aksi-server/internal/mail"
	"github.com/yogisofiharja/aksi-server/internal/notify"
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

	// DP-015 account email goes out through Resend when its key is set;
	// otherwise each message (code included) is written to this log, which
	// is all local development needs.
	var mailer mail.Mailer = mail.LogMailer{}
	switch {
	case cfg.ResendAPIKey == "":
		log.Print("mail: RESEND_API_KEY is not set — confirmation and reset codes are written to this log")
	case cfg.MailFrom == "":
		mailer = mail.NewResendMailer(cfg.ResendAPIKey, "")
		log.Printf("mail: sending through Resend from its test sender (%s) — this only delivers to the Resend account owner's address; set MAIL_FROM to a verified-domain address for real users", mail.ResendFallbackFrom)
	default:
		mailer = mail.NewResendMailer(cfg.ResendAPIKey, cfg.MailFrom)
		log.Printf("mail: sending through Resend from %s", cfg.MailFrom)
	}

	// A typed-nil *PasswordSetter inside the interface would not compare
	// equal to nil, so the interface is only assigned on success.
	var passwords httpapi.PasswordSetter
	if cfg.FirebaseServiceAccountFile == "" {
		log.Print("password recovery: disabled (FIREBASE_SERVICE_ACCOUNT_FILE is not set)")
	} else if setter, err := firebaseadmin.NewPasswordSetterFromFile(cfg.FirebaseServiceAccountFile); err != nil {
		log.Printf("password recovery: disabled (%v)", err)
	} else {
		passwords = setter
	}

	// DP-023: without these, an umpire handed a match mid-play can't write
	// its live score until the match is reopened from the start; and
	// DP-027 saves overdue matches as Unfinished with the server's last
	// state instead of their live score.
	var liveMatches httpapi.LiveMatches
	var liveScores scheduling.LiveScores
	if cfg.FirebaseServiceAccountFile == "" || cfg.FirebaseDatabaseURL == "" {
		log.Print("live matches: no admin access (FIREBASE_SERVICE_ACCOUNT_FILE or FIREBASE_DATABASE_URL is not set)")
	} else if lm, err := firebaseadmin.NewLiveMatchesFromFile(cfg.FirebaseServiceAccountFile, cfg.FirebaseDatabaseURL); err != nil {
		log.Printf("live matches: no admin access (%v)", err)
	} else {
		liveMatches, liveScores = lm, lm
	}

	// DP-018. The Web Push key pair is generated on first start and kept
	// in the database: browsers bind their subscriptions to it.
	vapidPublic, vapidPrivate, err := db.GetOrCreateServerKeys(ctx, pool, "vapid_public_key", "vapid_private_key", notify.GenerateVAPIDKeys)
	if err != nil {
		log.Fatalf("loading web push keys: %v", err)
	}
	db.MatchEarlyStart = cfg.MatchEarlyStart
	hub := live.NewHub()
	notifier := notify.NewService(pool,
		notify.NewWebPush(vapidPublic, vapidPrivate, cfg.VAPIDSubject),
		notify.NewExpoPush(cfg.ExpoAccessToken),
	)

	// A new notification refreshes the recipient's bell at once (DP-021).
	notifier.OnRecorded = func(userIDs []string) {
		hub.Publish(userIDs, live.Event{Type: "notification.created"})
	}

	router := httpapi.NewRouter(httpapi.Deps{
		Pool:           pool,
		Verifier:       verifier,
		AllowedOrigins: cfg.AllowedOrigins,
		Mailer:         mailer,
		Passwords:      passwords,
		LiveMatches:    liveMatches,
		Notifier:       notifier,
		Hub:            hub,
		ClientIP: httpapi.ClientIPResolver{
			Header:         cfg.ClientIPHeader,
			TrustedProxies: httpapi.ParseTrustedProxies(cfg.TrustedProxies),
		},
	})

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

	// DP-007 generation + DP-009 auto-start/auto-transition. Same
	// in-process ticker rather than separate job/cron processes — this
	// repo has no second deployment target today, and all three are
	// idempotent/safe under any interval, including missed ticks (see
	// GenerateDueSessions, AutoStartDueSessions, and
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
				if err := scheduling.AutoStartDueSessions(ctx, pool); err != nil {
					log.Printf("session auto-start: %v", err)
				}
				if err := scheduling.AutoTransitionElapsedSessions(ctx, pool); err != nil {
					log.Printf("session auto-transition: %v", err)
				}
				if n, err := scheduling.UnfinishOverdueMatches(ctx, pool, liveScores); err != nil {
					log.Printf("overdue live matches: %v", err)
				} else if n > 0 {
					log.Printf("overdue live matches: %d saved as unfinished", n)
				}
			}
		}
	}()

	// DP-018 #7: Session reminders, checked every minute so they go out
	// close to two hours before.
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				notifier.SendDueReminders(ctx)
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
