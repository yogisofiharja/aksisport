package mail

import (
	"strings"
	"testing"
)

func TestCodeMessagesCarryTheCodeInSubjectAndBody(t *testing.T) {
	for name, msg := range map[string]Message{
		"verification": VerificationMessage("a@b.co", "042917"),
		"reset":        PasswordResetMessage("a@b.co", "042917"),
	} {
		if msg.To != "a@b.co" {
			t.Errorf("%s: to = %q", name, msg.To)
		}
		if !strings.Contains(msg.Subject, "042917") || !strings.Contains(msg.Body, "042917") {
			t.Errorf("%s: code missing from subject or body", name)
		}
	}
}

func TestEmailChangedGoesToTheOldAddressAndNamesBoth(t *testing.T) {
	msg := EmailChangedMessage("old@example.com", "new@example.com")
	if msg.To != "old@example.com" {
		t.Errorf("must be sent to the replaced address, got %q", msg.To)
	}
	if !strings.Contains(msg.Body, "old@example.com") || !strings.Contains(msg.Body, "new@example.com") {
		t.Error("body should name both the old and the new address")
	}
}

func TestPasswordChangedHasNoCode(t *testing.T) {
	msg := PasswordChangedMessage("a@b.co")
	if msg.To != "a@b.co" || msg.Subject == "" || msg.Body == "" {
		t.Errorf("unexpected message: %+v", msg)
	}
}
