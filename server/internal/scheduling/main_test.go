package scheduling

import (
	"os"
	"testing"

	"github.com/yogisofiharja/aksi-server/internal/testdb"
)

// A fresh database for this package's tests, dropped afterwards.
func TestMain(m *testing.M) { os.Exit(testdb.Main(m)) }
