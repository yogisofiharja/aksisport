// Package testdb gives the server's database tests a place of their own
// inside the dev database: each test binary (one per package) creates a
// fresh schema, aksi_test_<random>, applies every migration in it, runs
// its tests there and drops the schema with everything in it. The tests'
// connections only see that schema (search_path), so they can never read
// or change the dev tables, and nothing is left behind.
//
// It needs TEST_DATABASE_URL: the dev database (make test-db passes
// server/.env's DATABASE_URL), as a role allowed to create schemas in it.
// Without it, database tests are skipped.
//
//	func TestMain(m *testing.M) { os.Exit(testdb.Main(m)) }
//
//	func TestSomething(t *testing.T) {
//		pool := testdb.Pool(t)
//		...
//	}
package testdb

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"
	neturl "net/url"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// The test binary's own schema; nil when TEST_DATABASE_URL isn't set.
var pool *pgxpool.Pool

// Main creates and migrates the test schema, runs the package's tests and
// drops the schema. Use it as the package's TestMain.
func Main(m *testing.M) int {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		return m.Run() // database tests skip themselves
	}
	ctx := context.Background()

	admin, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		log.Fatalf("testdb: connecting to TEST_DATABASE_URL: %v", err)
	}
	defer admin.Close(ctx)

	suffix := make([]byte, 6)
	_, _ = rand.Read(suffix)
	name := "aksi_test_" + hex.EncodeToString(suffix)
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{name}.Sanitize()); err != nil {
		log.Fatalf("testdb: creating schema %s: %v", name, err)
	}
	defer func() {
		if pool != nil {
			pool.Close()
		}
		if _, err := admin.Exec(ctx, "DROP SCHEMA IF EXISTS "+pgx.Identifier{name}.Sanitize()+" CASCADE"); err != nil {
			log.Printf("testdb: dropping schema %s: %v", name, err)
		}
	}()

	url, err := inSchema(databaseURL, name)
	if err != nil {
		log.Fatalf("testdb: TEST_DATABASE_URL: %v", err)
	}

	if err := migrateUp(url); err != nil {
		log.Fatalf("testdb: migrating %s: %v", name, err)
	}
	pool, err = pgxpool.New(ctx, url)
	if err != nil {
		log.Fatalf("testdb: %v", err)
	}
	return m.Run()
}

// Pool connects to the test schema, or skips the test when there is none.
func Pool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	if pool == nil {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	return pool
}

// inSchema is databaseURL with search_path set to the test schema, then
// public — where the database's extensions (pgcrypto, citext) live — so
// tables are created and read in the test schema only.
func inSchema(databaseURL, schema string) (string, error) {
	u, err := neturl.Parse(databaseURL)
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("search_path", schema+",public")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// migrateUp applies every migration in server/migrations to the test
// schema (its own schema_migrations table included), as the server does at
// start-up (db.RunMigrations — not imported here, so the db
// package's own tests can use this one).
func migrateUp(url string) error {
	m, err := migrate.New("file://"+migrationsDir(), url)
	if err != nil {
		return err
	}
	defer m.Close()
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}

// migrationsDir is server/migrations, found from this file's location so
// it works from any package's test directory.
func migrationsDir() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..", "migrations")
}
