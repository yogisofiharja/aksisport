package live

import (
	"encoding/json"
	"testing"
)

func TestPublishReachesOnlyTheNamedUsers(t *testing.T) {
	h := NewHub()
	alice := &client{userID: "alice", send: make(chan []byte, 4)}
	alicePhone := &client{userID: "alice", send: make(chan []byte, 4)}
	bob := &client{userID: "bob", send: make(chan []byte, 4)}
	h.add(alice)
	h.add(alicePhone)
	h.add(bob)

	h.Publish([]string{"alice"}, Event{Type: "message.created", Data: map[string]string{"id": "m1"}})

	for _, c := range []*client{alice, alicePhone} {
		select {
		case raw := <-c.send:
			var e Event
			if err := json.Unmarshal(raw, &e); err != nil || e.Type != "message.created" {
				t.Fatalf("unexpected payload %s", raw)
			}
		default:
			t.Fatal("every connection of alice should receive the event")
		}
	}
	select {
	case <-bob.send:
		t.Fatal("bob was not addressed")
	default:
	}
}

func TestIsConnectedFollowsConnections(t *testing.T) {
	h := NewHub()
	c := &client{userID: "alice", send: make(chan []byte, 1)}
	if h.IsConnected("alice") {
		t.Fatal("nobody connected yet")
	}
	h.add(c)
	if !h.IsConnected("alice") {
		t.Fatal("alice is connected")
	}
	h.remove(c)
	if h.IsConnected("alice") {
		t.Fatal("alice disconnected")
	}
}

func TestASlowConnectionDoesNotBlockOthers(t *testing.T) {
	h := NewHub()
	stuck := &client{userID: "alice", send: make(chan []byte)} // nobody reads it
	ok := &client{userID: "bob", send: make(chan []byte, 1)}
	h.add(stuck)
	h.add(ok)
	h.Publish([]string{"alice", "bob"}, Event{Type: "typing"})
	select {
	case <-ok.send:
	default:
		t.Fatal("bob must still get the event")
	}
}
