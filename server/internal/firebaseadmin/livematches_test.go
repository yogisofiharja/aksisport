package firebaseadmin

import (
	"context"
	"os"
	"testing"
)

// Talks to a real Realtime Database when FIREBASE_SERVICE_ACCOUNT_FILE and
// FIREBASE_DATABASE_URL are set: signs in and reads a match that has no
// live copy, which must be left alone without an error.
func TestSetScorerSkipsMissingLiveCopy(t *testing.T) {
	file, dbURL := os.Getenv("FIREBASE_SERVICE_ACCOUNT_FILE"), os.Getenv("FIREBASE_DATABASE_URL")
	if file == "" || dbURL == "" {
		t.Skip("FIREBASE_SERVICE_ACCOUNT_FILE or FIREBASE_DATABASE_URL is not set")
	}
	lm, err := NewLiveMatchesFromFile(file, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	if err := lm.SetScorer(context.Background(), "no-such-activity-test", "nobody"); err != nil {
		t.Fatal(err)
	}
}
