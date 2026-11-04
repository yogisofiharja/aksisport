package alert

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	telegramAPI = "https://api.telegram.org"
	// Telegram rejects messages over 4096 characters.
	maxMessageLen = 3800
	// The same error is pushed at most once per window; repeats inside it
	// are counted and reported as one summary when the window closes.
	repeatWindow = 10 * time.Minute
	queueSize    = 64
)

// Telegram pushes alerts to one Telegram chat through a bot.
//
// Report only queues; one goroutine sends, so a slow or unreachable
// Telegram never holds up a request. When the queue is full, alerts are
// dropped and the drop is counted in the next message that does go out.
type Telegram struct {
	label string
	send  func(text string) error
	now   func() time.Time

	queue chan queued
	done  chan struct{}
	wg    sync.WaitGroup
	once  sync.Once

	// Owned by the sending goroutine (and by tests that drive handle/flush
	// directly, with no goroutine running).
	seen map[string]*repeat

	dropMu  sync.Mutex
	dropped int
}

type queued struct{ key, text string }

type repeat struct {
	lastSent   time.Time
	suppressed int
	sample     string
}

// NewTelegram starts a reporter for the bot token and chat. label names
// the environment ("staging", "production") at the top of every message,
// so alerts from different servers in one chat can be told apart.
func NewTelegram(token, chatID, label string) *Telegram {
	client := &http.Client{Timeout: 10 * time.Second}
	endpoint := fmt.Sprintf("%s/bot%s/sendMessage", telegramAPI, token)
	t := newTelegram(label, func(text string) error {
		return sendTelegram(client, endpoint, chatID, text)
	}, time.Now)
	t.start()
	return t
}

func newTelegram(label string, send func(string) error, now func() time.Time) *Telegram {
	return &Telegram{
		label: label,
		send:  send,
		now:   now,
		queue: make(chan queued, queueSize),
		done:  make(chan struct{}),
		seen:  map[string]*repeat{},
	}
}

func (t *Telegram) start() {
	t.wg.Add(1)
	go func() {
		defer t.wg.Done()
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case q := <-t.queue:
				t.handle(q.key, q.text)
			case <-ticker.C:
				t.flush()
			case <-t.done:
				// Send what is already queued, then stop.
				for {
					select {
					case q := <-t.queue:
						t.handle(q.key, q.text)
					default:
						return
					}
				}
			}
		}
	}()
}

// Report queues an alert. It never blocks.
func (t *Telegram) Report(key, text string) {
	select {
	case t.queue <- queued{key, text}:
	default:
		t.dropMu.Lock()
		t.dropped++
		t.dropMu.Unlock()
	}
}

// Notice sends a message right away, outside the repeat grouping — the
// start-up line that shows alerts are wired up.
func (t *Telegram) Notice(text string) {
	t.Report("notice\x00"+text, text)
}

// Close sends whatever is queued and stops the sender. Safe to call
// more than once.
func (t *Telegram) Close() {
	t.once.Do(func() { close(t.done) })
	t.wg.Wait()
}

func (t *Telegram) handle(key, text string) {
	now := t.now()
	r := t.seen[key]
	if r != nil && now.Sub(r.lastSent) < repeatWindow {
		r.suppressed++
		r.sample = text
		return
	}
	if r != nil && r.suppressed > 0 {
		text += fmt.Sprintf("\n\n(+%d more like this since the last alert)", r.suppressed)
	}
	t.seen[key] = &repeat{lastSent: now}
	t.deliver(text)
}

// flush reports repeats whose window has closed, so a burst that stops
// is still counted, and forgets errors not seen for a while.
func (t *Telegram) flush() {
	now := t.now()
	for key, r := range t.seen {
		age := now.Sub(r.lastSent)
		switch {
		case r.suppressed > 0 && age >= repeatWindow:
			t.deliver(fmt.Sprintf("Repeated %d more times in the last %d min. Latest:\n%s",
				r.suppressed, int(age.Minutes()), r.sample))
			r.lastSent, r.suppressed, r.sample = now, 0, ""
		case r.suppressed == 0 && age >= time.Hour:
			delete(t.seen, key)
		}
	}
}

func (t *Telegram) deliver(text string) {
	t.dropMu.Lock()
	dropped := t.dropped
	t.dropped = 0
	t.dropMu.Unlock()
	if dropped > 0 {
		text += fmt.Sprintf("\n\n(%d alerts dropped: too many at once)", dropped)
	}
	if t.label != "" {
		text = "[" + t.label + "] " + text
	}
	if len(text) > maxMessageLen {
		text = text[:maxMessageLen] + "\n…(cut)"
	}
	if err := t.send(text); err != nil {
		log.Printf("alert: telegram: %v", err)
	}
}

// sendTelegram posts one plain-text message. Errors never carry the
// request URL: it contains the bot token.
func sendTelegram(client *http.Client, endpoint, chatID, text string) error {
	payload, err := json.Marshal(map[string]any{
		"chat_id":                  chatID,
		"text":                     text,
		"disable_web_page_preview": true,
	})
	if err != nil {
		return err
	}
	resp, err := client.Post(endpoint, "application/json", bytes.NewReader(payload))
	if err != nil {
		var uerr *url.Error
		if errors.As(err, &uerr) {
			err = uerr.Err
		}
		return fmt.Errorf("sending failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		// Telegram explains itself in "description", e.g. "chat not found".
		var body struct {
			Description string `json:"description"`
		}
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		_ = json.Unmarshal(raw, &body)
		return fmt.Errorf("sending failed: %d %s", resp.StatusCode, strings.TrimSpace(body.Description))
	}
	return nil
}
