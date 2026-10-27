package notify

import "testing"

func TestStartsInText(t *testing.T) {
	cases := []struct {
		id      bool
		minutes string
		want    string
	}{
		{false, "120", "in 2 hours"},
		{false, "60", "in 1 hour"},
		{false, "90", "in 1 hour 30 minutes"},
		{false, "45", "in 45 minutes"},
		{false, "1", "in 1 minute"},
		{false, "0", "in 1 minute"},
		{true, "120", "2 jam lagi"},
		{true, "75", "1 jam 15 menit lagi"},
	}
	for _, c := range cases {
		if got := startsInText(c.id, c.minutes); got != c.want {
			t.Errorf("startsInText(%v, %q) = %q, want %q", c.id, c.minutes, got, c.want)
		}
	}
}

func TestStepTwoTexts(t *testing.T) {
	for _, typ := range []string{
		TypeCommunityJoinApproved, TypeSessionJoinRequest, TypeSessionJoinApproved,
		TypePaymentReceipt, TypePaymentConfirmed, TypeSessionReminder, TypeUmpireAssigned,
		TypeCommunityInvite, TypeSessionInvite,
	} {
		for _, locale := range []string{"en", "id"} {
			title, body := Render(locale, Notification{Type: typ, Params: map[string]string{
				"name": "Ana", "club": "Tennis Kemang", "session": "Sunday doubles", "minutes": "120",
			}})
			if title == "Aksi" || body == "" {
				t.Errorf("%s (%s) has no text of its own: %q / %q", typ, locale, title, body)
			}
		}
	}
	_, body := Render("en", Notification{Type: TypeSessionReminder, Params: map[string]string{"session": "Sunday doubles", "minutes": "120"}})
	if body != "Starts in 2 hours." {
		t.Errorf("reminder body = %q", body)
	}
	_, body = Render("id", Notification{Type: TypeUmpireAssigned, Params: map[string]string{"session": "Sabtu Pagi"}})
	if body != "Kamu jadi wasit untuk Sabtu Pagi" {
		t.Errorf("umpire body = %q", body)
	}
	_, body = Render("en", Notification{Type: TypeSessionJoinApproved, Params: map[string]string{"session": "Sunday doubles", "claimed": "1"}})
	if body != "You're in Sunday doubles. See you there!" {
		t.Errorf("free-session approval body = %q", body)
	}
}

func TestCategoryOf(t *testing.T) {
	want := map[string]string{
		TypeCommunityJoinRequest:  CategoryCommunityRequests,
		TypeCommunityJoinApproved: CategoryCommunityRequests,
		TypeSessionJoinRequest:    CategorySessionRequests,
		TypeSessionJoinApproved:   CategorySessionRequests,
		TypePaymentReceipt:        CategoryPayments,
		TypePaymentConfirmed:      CategoryPayments,
		TypeSessionReminder:       CategorySessionReminders,
		TypeUmpireAssigned:        CategorySessionReminders,
		TypeCommunityInvite:       CategoryCommunityRequests,
		TypeSessionInvite:         CategorySessionRequests,
		TypeDirectMessage:         "",
	}
	for typ, category := range want {
		if got := CategoryOf(typ); got != category {
			t.Errorf("CategoryOf(%s) = %q, want %q", typ, got, category)
		}
	}
}
