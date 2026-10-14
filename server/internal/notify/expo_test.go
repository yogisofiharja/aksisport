package notify

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExpoPushReportsUnregisteredDevices(t *testing.T) {
	var received []expoMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&received)
		_, _ = w.Write([]byte(`{"data":[{"status":"ok","id":"a"},{"status":"error","details":{"error":"DeviceNotRegistered"}},{"status":"error","details":{"error":"MessageRateExceeded"}}]}`))
	}))
	defer srv.Close()

	e := NewExpoPush("")
	e.endpoint = srv.URL
	gone, err := e.Send(context.Background(), []expoMessage{{To: "t1", Title: "x"}, {To: "t2", Title: "x"}, {To: "t3", Title: "x"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(received) != 3 || received[1].To != "t2" {
		t.Fatalf("unexpected request: %+v", received)
	}
	if len(gone) != 1 || gone[0] != 1 {
		t.Errorf("only the DeviceNotRegistered message should be reported gone, got %v", gone)
	}
}
