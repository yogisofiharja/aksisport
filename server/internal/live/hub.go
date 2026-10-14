// Package live keeps one WebSocket per open app and pushes events down it
// the moment they happen (DP-021): new messages, typing, read receipts,
// new notifications. Clients that aren't connected miss nothing — every
// event mirrors state the REST API already serves, and the app re-fetches
// whenever it reconnects.
//
// Connections are tracked in this process's memory, which is right while
// the API runs as one process per environment. Running several would need
// a Broker that relays Publish between them (e.g. Postgres LISTEN/NOTIFY);
// Hub is the only thing that would change.
package live

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// Event is what a client receives: {"type": ..., "data": ...}.
type Event struct {
	Type string `json:"type"`
	Data any    `json:"data,omitempty"`
}

const (
	sendBuffer = 32
	// Cloudflare closes idle WebSockets after ~100s; a ping well inside
	// that keeps the connection — and the proxy — awake.
	pingEvery    = 25 * time.Second
	writeTimeout = 10 * time.Second
)

type client struct {
	userID string
	send   chan []byte
}

type Hub struct {
	mu    sync.RWMutex
	conns map[string]map[*client]struct{}
}

func NewHub() *Hub {
	return &Hub{conns: map[string]map[*client]struct{}{}}
}

// Publish sends an event to every open connection of each user. A
// connection too far behind to take it is skipped rather than blocking
// everyone else; it catches up when its app re-fetches.
func (h *Hub) Publish(userIDs []string, e Event) {
	payload, err := json.Marshal(e)
	if err != nil {
		log.Printf("live: encoding %s: %v", e.Type, err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, id := range userIDs {
		for c := range h.conns[id] {
			select {
			case c.send <- payload:
			default:
			}
		}
	}
}

// IsConnected reports whether the user has Aksi open somewhere right now.
func (h *Hub) IsConnected(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.conns[userID]) > 0
}

func (h *Hub) add(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.conns[c.userID] == nil {
		h.conns[c.userID] = map[*client]struct{}{}
	}
	h.conns[c.userID][c] = struct{}{}
}

func (h *Hub) remove(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.conns[c.userID], c)
	if len(h.conns[c.userID]) == 0 {
		delete(h.conns, c.userID)
	}
}

// Serve runs one accepted connection for userID until it closes. Each text
// message the client sends is handed to onMessage.
func (h *Hub) Serve(ctx context.Context, conn *websocket.Conn, userID string, onMessage func(raw []byte)) {
	c := &client{userID: userID, send: make(chan []byte, sendBuffer)}
	h.add(c)
	defer h.remove(c)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	conn.SetReadLimit(4096)

	go func() {
		defer cancel()
		ticker := time.NewTicker(pingEvery)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case payload := <-c.send:
				writeCtx, done := context.WithTimeout(ctx, writeTimeout)
				err := conn.Write(writeCtx, websocket.MessageText, payload)
				done()
				if err != nil {
					return
				}
			case <-ticker.C:
				pingCtx, done := context.WithTimeout(ctx, writeTimeout)
				err := conn.Ping(pingCtx)
				done()
				if err != nil {
					return
				}
			}
		}
	}()

	for {
		kind, data, err := conn.Read(ctx)
		if err != nil {
			conn.CloseNow()
			return
		}
		if kind == websocket.MessageText && onMessage != nil {
			onMessage(data)
		}
	}
}
