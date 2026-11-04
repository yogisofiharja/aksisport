package alert

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time          { return c.t }
func (c *fakeClock) advance(d time.Duration) { c.t = c.t.Add(d) }

func newTestTelegram() (*Telegram, *[]string, *fakeClock) {
	var sent []string
	clock := &fakeClock{t: time.Date(2026, 11, 4, 9, 0, 0, 0, time.UTC)}
	t := newTelegram("staging", func(text string) error {
		sent = append(sent, text)
		return nil
	}, clock.now)
	return t, &sent, clock
}

func TestRepeatsAreGrouped(t *testing.T) {
	tg, sent, clock := newTestTelegram()

	tg.handle("k", "boom 1")
	tg.handle("k", "boom 2")
	tg.handle("k", "boom 3")
	tg.handle("other", "different")
	if len(*sent) != 2 {
		t.Fatalf("sent %q, want the first of each error only", *sent)
	}
	if (*sent)[0] != "[staging] boom 1" {
		t.Fatalf("first message %q", (*sent)[0])
	}

	// The burst stops; the next flush after the window reports the count.
	clock.advance(5 * time.Minute)
	tg.flush()
	if len(*sent) != 2 {
		t.Fatal("flushed before the window closed")
	}
	clock.advance(6 * time.Minute)
	tg.flush()
	if len(*sent) != 3 || !strings.Contains((*sent)[2], "Repeated 2 more times") || !strings.Contains((*sent)[2], "boom 3") {
		t.Fatalf("summary %q", *sent)
	}

	// Next occurrence after a quiet window goes out at once.
	clock.advance(11 * time.Minute)
	tg.handle("k", "boom 4")
	if len(*sent) != 4 || (*sent)[3] != "[staging] boom 4" {
		t.Fatalf("after quiet window: %q", *sent)
	}
}

func TestRepeatCountRidesOnNextAlert(t *testing.T) {
	tg, sent, clock := newTestTelegram()
	tg.handle("k", "a")
	tg.handle("k", "b")
	clock.advance(repeatWindow)
	tg.handle("k", "c") // window closed before a flush ran
	if len(*sent) != 2 || !strings.Contains((*sent)[1], "(+1 more like this") {
		t.Fatalf("sent %q", *sent)
	}
}

func TestLongMessagesAreCut(t *testing.T) {
	tg, sent, _ := newTestTelegram()
	tg.handle("k", strings.Repeat("x", 10000))
	if got := len((*sent)[0]); got > maxMessageLen+20 {
		t.Fatalf("message length %d", got)
	}
}

func TestDroppedAlertsAreCounted(t *testing.T) {
	tg, sent, _ := newTestTelegram()
	for i := 0; i < queueSize+3; i++ {
		tg.Report("k", "x") // no sender running: the queue fills up
	}
	tg.handle("other", "y")
	if !strings.Contains((*sent)[0], "(3 alerts dropped") {
		t.Fatalf("sent %q", *sent)
	}
}

func TestCloseSendsWhatIsQueued(t *testing.T) {
	var sent []string
	tg := newTelegram("", func(text string) error { sent = append(sent, text); return nil }, time.Now)
	tg.start()
	tg.Report("a", "one")
	tg.Report("b", "two")
	tg.Close()
	if len(sent) != 2 {
		t.Fatalf("sent %q", sent)
	}
}

func TestSendTelegram(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/botTOKEN/sendMessage" {
			t.Errorf("path %s", r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		if got["chat_id"] == "bad" {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"ok":false,"description":"Bad Request: chat not found"}`))
			return
		}
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	if err := sendTelegram(srv.Client(), srv.URL+"/botTOKEN/sendMessage", "123", "hello"); err != nil {
		t.Fatal(err)
	}
	if got["chat_id"] != "123" || got["text"] != "hello" {
		t.Fatalf("payload %v", got)
	}

	err := sendTelegram(srv.Client(), srv.URL+"/botTOKEN/sendMessage", "bad", "hello")
	if err == nil || !strings.Contains(err.Error(), "chat not found") {
		t.Fatalf("err %v", err)
	}
}

func TestSendErrorsNeverShowTheToken(t *testing.T) {
	client := &http.Client{Timeout: time.Second}
	err := sendTelegram(client, "http://127.0.0.1:1/botSECRET123/sendMessage", "1", "x")
	if err == nil {
		t.Fatal("expected a connection error")
	}
	if strings.Contains(err.Error(), "SECRET123") {
		t.Fatalf("token leaked in %q", err)
	}
}

func TestErrorfWithoutReporterOnlyLogs(t *testing.T) {
	SetReporter(nil)
	Errorf("nothing to report %d", 1) // must not panic

	rec := &recorder{}
	SetReporter(rec)
	t.Cleanup(func() { SetReporter(nil) })
	Errorf("session %s failed", "abc")
	Errorf("session %s failed", "def")
	if len(rec.keys) != 2 || rec.keys[0] != "session %s failed" || rec.texts[1] != "session def failed" {
		t.Fatalf("got %v %v", rec.keys, rec.texts)
	}
}

type recorder struct{ keys, texts []string }

func (r *recorder) Report(key, text string) {
	r.keys = append(r.keys, key)
	r.texts = append(r.texts, text)
}
