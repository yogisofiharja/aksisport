package places

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClient(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Goog-Api-Key") != "KEY" || r.URL.Query().Get("key") != "" {
			t.Errorf("key must travel in the header only")
		}
		switch {
		case r.URL.Path == "/places:autocomplete":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["input"] != "gbk" || body["sessionToken"] != "tok" {
				t.Errorf("body %v", body)
			}
			_, _ = w.Write([]byte(`{"suggestions":[{"placePrediction":{"placeId":"P1","structuredFormat":{"mainText":{"text":"GBK Tennis"},"secondaryText":{"text":"Senayan, Jakarta"}}}},{"queryPrediction":{}}]}`))
		case r.URL.Path == "/places/P1":
			if r.Header.Get("X-Goog-FieldMask") != "id" {
				t.Errorf("field mask %q", r.Header.Get("X-Goog-FieldMask"))
			}
			_, _ = w.Write([]byte(`{"id":"P1"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":{"message":"not found"}}`))
		}
	}))
	defer srv.Close()
	c := New("KEY")
	c.base = srv.URL

	got, err := c.Autocomplete(context.Background(), "gbk", "id", "tok")
	if err != nil || len(got) != 1 || got[0] != (Suggestion{"P1", "GBK Tennis", "Senayan, Jakarta"}) {
		t.Fatalf("autocomplete %v %v", got, err)
	}
	if err := c.CheckPlace(context.Background(), "P1", "tok"); err != nil {
		t.Fatal(err)
	}
	if err := c.CheckPlace(context.Background(), "nope", ""); err != ErrNotFound {
		t.Fatalf("unknown place: %v", err)
	}
}
