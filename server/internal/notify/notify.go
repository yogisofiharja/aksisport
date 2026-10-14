// Package notify is DP-018's one way to tell someone something happened:
// features call Service.Send with who and what, and it records the
// notification (for the Notifications page) and pushes it to every device
// those people have registered — browsers through Web Push, phone apps
// through Expo's push service. Delivery is best-effort and never blocks
// or fails the request that caused it.
package notify

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/db"
)

// Notification types — what happened. Each has text in texts.go (pushes)
// and in the client's i18n (the Notifications page).
const (
	TypeCommunityJoinRequest  = "community_join_request"
	TypeCommunityJoinApproved = "community_join_approved"
	TypeSessionJoinRequest    = "session_join_request"
	TypeSessionJoinApproved   = "session_join_approved"
	TypePaymentReceipt        = "payment_receipt"
	TypePaymentConfirmed      = "payment_confirmed"
	TypeSessionReminder       = "session_reminder"

	// Message pushes (DP-021) — pushed only, never recorded: conversations
	// live in Inbox, not on the Notifications page.
	TypeDirectMessage  = "direct_message"
	TypeContactMessage = "contact_message"
	TypeGroupMessage   = "group_message"
)

// Settings categories (DP-018): one switch each in Settings. Turning one
// off stops its pushes; its notifications are still recorded.
const (
	CategoryCommunityRequests = "community_requests"
	CategorySessionRequests   = "session_requests"
	CategoryPayments          = "payments"
	CategorySessionReminders  = "session_reminders"
)

// Categories are every switch, in Settings order.
var Categories = []string{CategoryCommunityRequests, CategorySessionRequests, CategoryPayments, CategorySessionReminders}

// CategoryOf is the switch a notification type falls under; "" for types
// no switch controls (message pushes, DP-021).
func CategoryOf(notificationType string) string {
	switch notificationType {
	case TypeCommunityJoinRequest, TypeCommunityJoinApproved:
		return CategoryCommunityRequests
	case TypeSessionJoinRequest, TypeSessionJoinApproved:
		return CategorySessionRequests
	case TypePaymentReceipt, TypePaymentConfirmed:
		return CategoryPayments
	case TypeSessionReminder:
		return CategorySessionReminders
	}
	return ""
}

// Notification is what to tell people. Params fill the type's text; Path
// is the app address it opens, the same as the web app's URLs.
type Notification struct {
	Type   string
	Params map[string]string
	Path   string
}

type Service struct {
	pool *pgxpool.Pool
	web  *WebPush
	expo *ExpoPush
	// OnRecorded, when set, is told who just got a new notification — the
	// live connection uses it to refresh their bell at once (DP-021).
	OnRecorded func(userIDs []string)
}

func NewService(pool *pgxpool.Pool, web *WebPush, expo *ExpoPush) *Service {
	return &Service{pool: pool, web: web, expo: expo}
}

// WebPublicKey is the VAPID public key browsers subscribe with.
func (s *Service) WebPublicKey() string { return s.web.PublicKey() }

// Send notifies each recipient except `actor` — nobody is told about their
// own action (DP-018). Recording is synchronous, so the Notifications page
// is right as soon as the triggering request returns; pushing happens in
// the background.
func (s *Service) Send(ctx context.Context, recipients []string, actor string, n Notification) {
	var to []string
	seen := map[string]bool{}
	for _, id := range recipients {
		if id != actor && !seen[id] {
			seen[id] = true
			to = append(to, id)
		}
	}
	if len(to) == 0 {
		return
	}
	ids, err := db.InsertNotifications(ctx, s.pool, to, n.Type, n.Params, n.Path)
	if err != nil {
		log.Printf("notify: recording %s: %v", n.Type, err)
		return
	}
	if s.OnRecorded != nil {
		s.OnRecorded(to)
	}
	go s.push(to, ids, n)
}

// PushOnly pushes to the recipients' devices without recording anything
// on the Notifications page — for new messages (DP-021), which Inbox
// already lists. Never blocks.
func (s *Service) PushOnly(recipients []string, n Notification) {
	if len(recipients) == 0 {
		return
	}
	go s.push(recipients, map[string]string{}, n)
}

// pushPayload is what a device receives. The service worker / app shows
// Title and Body and opens Path; ID lets the app mark it read on open.
type pushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Path  string `json:"path"`
	ID    string `json:"id"`
}

func (s *Service) push(userIDs []string, notificationIDs map[string]string, n Notification) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// People who turned this kind off get no push (it is still recorded).
	if category := CategoryOf(n.Type); category != "" {
		off, err := db.UsersWithCategoryOff(ctx, s.pool, userIDs, category)
		if err != nil {
			log.Printf("notify: loading settings: %v", err)
			return
		}
		kept := userIDs[:0:0]
		for _, id := range userIDs {
			if !off[id] {
				kept = append(kept, id)
			}
		}
		userIDs = kept
		if len(userIDs) == 0 {
			return
		}
	}

	subs, err := db.ListPushSubscriptions(ctx, s.pool, userIDs)
	if err != nil {
		log.Printf("notify: loading devices: %v", err)
		return
	}
	var expoMessages []expoMessage
	var expoAddresses []string
	for _, sub := range subs {
		title, body := Render(sub.Locale, n)
		payload := pushPayload{Title: title, Body: body, Path: n.Path, ID: notificationIDs[sub.UserID]}
		switch sub.Kind {
		case "web":
			if sub.P256dh == nil || sub.Auth == nil {
				continue
			}
			encoded, _ := json.Marshal(payload)
			gone, err := s.web.Send(ctx, sub.Address, *sub.P256dh, *sub.Auth, encoded)
			if err != nil {
				log.Printf("notify: web push: %v", err)
			}
			if gone {
				s.forget(ctx, sub.Address)
			}
		case "expo":
			expoMessages = append(expoMessages, expoMessage{
				To: sub.Address, Title: title, Body: body, Sound: "default",
				Data: map[string]string{"path": n.Path, "id": payload.ID},
			})
			expoAddresses = append(expoAddresses, sub.Address)
		}
	}
	if len(expoMessages) > 0 {
		gone, err := s.expo.Send(ctx, expoMessages)
		if err != nil {
			log.Printf("notify: expo push: %v", err)
		}
		for _, i := range gone {
			s.forget(ctx, expoAddresses[i])
		}
	}
}

func (s *Service) forget(ctx context.Context, address string) {
	if err := db.ForgetPushAddress(ctx, s.pool, address); err != nil {
		log.Printf("notify: forgetting a gone device: %v", err)
	}
}
