package notify

import (
	"strconv"
	"strings"
)

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
	case TypeGroupMessage:
		return p("group"), p("name") + ": " + messagePreview(id, p("body"))
	case TypeContactMessage:
		if id {
			return p("name") + " · " + p("session"), messagePreview(id, p("body"))
		}
		return p("name") + " · " + p("session"), messagePreview(id, p("body"))
	case TypeCommunityJoinApproved:
		if id {
			return "Permintaan diterima", "Kamu sekarang anggota " + p("club") + "."
		}
		return "Request approved", "You're now a member of " + p("club") + "."
	case TypeSessionJoinRequest:
		if id {
			return "Permintaan ikut Sesi", p("name") + " ingin ikut " + p("session") + "."
		}
		return "Session join request", p("name") + " asked to join " + p("session") + "."
	case TypeSessionJoinApproved:
		if p("claimed") == "1" { // a free Session: nothing to pay
			if id {
				return "Permintaan diterima", "Kamu ikut " + p("session") + ". Sampai jumpa di sana!"
			}
			return "Request approved", "You're in " + p("session") + ". See you there!"
		}
		if id {
			return "Permintaan diterima", "Kamu disetujui ikut " + p("session") + ". Bayar untuk mengamankan tempatmu."
		}
		return "Request approved", "You're approved for " + p("session") + ". Pay to claim your spot."
	case TypePaymentReceipt:
		if id {
			return "Bukti pembayaran", p("name") + " mengunggah bukti pembayaran untuk " + p("session") + "."
		}
		return "Payment receipt", p("name") + " uploaded a payment receipt for " + p("session") + "."
	case TypePaymentConfirmed:
		if id {
			return "Pembayaran dikonfirmasi", "Tempatmu di " + p("session") + " sudah aman."
		}
		return "Payment confirmed", "Your spot in " + p("session") + " is claimed."
	case TypeSessionReminder:
		if id {
			return p("session"), "Dimulai " + startsInText(true, p("minutes")) + "."
		}
		return p("session"), "Starts " + startsInText(false, p("minutes")) + "."
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

// startsInText: "in 2 hours", "in 1 hour 30 minutes", "in 45 minutes".
func startsInText(id bool, minutesParam string) string {
	minutes, _ := strconv.Atoi(minutesParam)
	if minutes < 1 {
		minutes = 1
	}
	hours, mins := minutes/60, minutes%60
	var parts []string
	if hours > 0 {
		if id {
			parts = append(parts, strconv.Itoa(hours)+" jam")
		} else if hours == 1 {
			parts = append(parts, "1 hour")
		} else {
			parts = append(parts, strconv.Itoa(hours)+" hours")
		}
	}
	if mins > 0 {
		if id {
			parts = append(parts, strconv.Itoa(mins)+" menit")
		} else if mins == 1 {
			parts = append(parts, "1 minute")
		} else {
			parts = append(parts, strconv.Itoa(mins)+" minutes")
		}
	}
	if id {
		return strings.Join(parts, " ") + " lagi"
	}
	return "in " + strings.Join(parts, " ")
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
