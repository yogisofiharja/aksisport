package notify

import "strings"

// Render is a notification's push text in a device's language ("en" or
// "id"; anything else falls back to English). The Notifications page
// renders the same types from the client's own i18n — keep the two in
// step (src/i18n.tsx, notif* keys).
func Render(locale string, n Notification) (title, body string) {
	p := func(key string) string { return n.Params[key] }
	id := strings.HasPrefix(locale, "id")
	switch n.Type {
	case TypeDirectMessage:
		return p("name"), messagePreview(id, p("body"))
	case TypeContactMessage:
		if id {
			return p("name") + " · " + p("session"), messagePreview(id, p("body"))
		}
		return p("name") + " · " + p("session"), messagePreview(id, p("body"))
	case TypeCommunityJoinRequest:
		if id {
			return "Permintaan bergabung", p("name") + " ingin bergabung dengan " + p("club") + "."
		}
		return "Join request", p("name") + " asked to join " + p("club") + "."
	}
	if id {
		return "Aksi", "Ada pemberitahuan baru."
	}
	return "Aksi", "You have a new notification."
}

// messagePreview is a message's text, shortened for a lock screen; a
// photo with no text says so.
func messagePreview(id bool, body string) string {
	body = strings.TrimSpace(body)
	if body == "" {
		if id {
			return "Mengirim foto"
		}
		return "Sent a photo"
	}
	if r := []rune(body); len(r) > 120 {
		return string(r[:117]) + "..."
	}
	return body
}
