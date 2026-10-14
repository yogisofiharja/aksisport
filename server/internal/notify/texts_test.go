package notify

import (
	"strings"
	"testing"
)

func TestRenderCommunityJoinRequest(t *testing.T) {
	n := Notification{Type: TypeCommunityJoinRequest, Params: map[string]string{"name": "Budi", "club": "Aksi Tennis"}}
	title, body := Render("en", n)
	if title == "" || !strings.Contains(body, "Budi") || !strings.Contains(body, "Aksi Tennis") {
		t.Errorf("en: %q / %q", title, body)
	}
	_, idBody := Render("id", n)
	if idBody == body || !strings.Contains(idBody, "Budi") {
		t.Errorf("id should be its own text naming the person, got %q", idBody)
	}
}

func TestRenderUnknownTypeStillSaysSomething(t *testing.T) {
	title, body := Render("en", Notification{Type: "something_new"})
	if title == "" || body == "" {
		t.Error("an unknown type must still produce a readable push")
	}
}
