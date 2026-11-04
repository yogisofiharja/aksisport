// Package places talks to Google's Places API (New) for DP-031 venue
// search. Results are shown to the organizer and never stored, except a
// picked place's ID — the only Places content Google lets us keep
// indefinitely.
package places

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const apiBase = "https://places.googleapis.com/v1"

// ErrNotFound: Google doesn't know the place ID.
var ErrNotFound = errors.New("place not found")

type Suggestion struct {
	PlaceID string `json:"placeId"`
	Name    string `json:"name"`
	Address string `json:"address"`
}

// Searcher is what the API needs; a fake stands in for it in tests.
type Searcher interface {
	// Autocomplete suggests places for typed text, in Indonesia.
	// sessionToken groups one picking session's requests for billing.
	Autocomplete(ctx context.Context, input, lang, sessionToken string) ([]Suggestion, error)
	// CheckPlace confirms a place ID exists. It asks for the ID field
	// only, which Google doesn't charge for, and closes the session.
	CheckPlace(ctx context.Context, placeID, sessionToken string) error
}

type Client struct {
	key    string
	base   string
	client *http.Client
}

func New(key string) *Client {
	return &Client{key: key, base: apiBase, client: &http.Client{Timeout: 8 * time.Second}}
}

func (c *Client) Autocomplete(ctx context.Context, input, lang, sessionToken string) ([]Suggestion, error) {
	body := map[string]any{
		"input":               input,
		"includedRegionCodes": []string{"id"},
		"languageCode":        lang,
	}
	if sessionToken != "" {
		body["sessionToken"] = sessionToken
	}
	payload, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/places:autocomplete", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	var out struct {
		Suggestions []struct {
			PlacePrediction *struct {
				PlaceID          string `json:"placeId"`
				StructuredFormat struct {
					MainText      struct{ Text string } `json:"mainText"`
					SecondaryText struct{ Text string } `json:"secondaryText"`
				} `json:"structuredFormat"`
			} `json:"placePrediction"`
		} `json:"suggestions"`
	}
	if err := c.do(req, &out); err != nil {
		return nil, err
	}
	list := []Suggestion{}
	for _, s := range out.Suggestions {
		if p := s.PlacePrediction; p != nil && p.PlaceID != "" {
			list = append(list, Suggestion{PlaceID: p.PlaceID, Name: p.StructuredFormat.MainText.Text, Address: p.StructuredFormat.SecondaryText.Text})
		}
	}
	return list, nil
}

func (c *Client) CheckPlace(ctx context.Context, placeID, sessionToken string) error {
	u := c.base + "/places/" + url.PathEscape(placeID)
	if sessionToken != "" {
		u += "?sessionToken=" + url.QueryEscape(sessionToken)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Goog-FieldMask", "id")
	err = c.do(req, &struct{}{})
	var se *statusError
	if errors.As(err, &se) && (se.code == http.StatusNotFound || se.code == http.StatusBadRequest) {
		return ErrNotFound
	}
	return err
}

type statusError struct {
	code    int
	message string
}

func (e *statusError) Error() string { return fmt.Sprintf("places: %d %s", e.code, e.message) }

// do sends with the key in a header (never in the URL, so it can't end
// up in an error message or a log).
func (c *Client) do(req *http.Request, out any) error {
	req.Header.Set("X-Goog-Api-Key", c.key)
	resp, err := c.client.Do(req)
	if err != nil {
		var uerr *url.Error
		if errors.As(err, &uerr) {
			err = uerr.Err
		}
		return fmt.Errorf("places: %v", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		var e struct {
			Error struct{ Message string } `json:"error"`
		}
		_ = json.Unmarshal(raw, &e)
		return &statusError{code: resp.StatusCode, message: strings.TrimSpace(e.Error.Message)}
	}
	return json.Unmarshal(raw, out)
}
