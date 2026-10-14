package notify

import (
	"context"
	"log"
	"strconv"
	"time"

	"github.com/yogisofiharja/aksi-server/internal/db"
)

// ReminderLead is how long before a Session starts its reminder goes out
// (DP-018 #7).
const ReminderLead = 2 * time.Hour

// SendDueReminders tells everyone who has claimed a spot (registered or
// checked in) that their Session starts soon. Each Session is reminded
// once; one published less than two hours ahead is reminded right away,
// with the real time left.
func (s *Service) SendDueReminders(ctx context.Context) {
	due, err := db.ClaimDueReminders(ctx, s.pool, ReminderLead)
	if err != nil {
		log.Printf("notify: session reminders: %v", err)
		return
	}
	for _, r := range due {
		s.Send(ctx, r.UserIDs, "", Notification{
			Type:   TypeSessionReminder,
			Params: map[string]string{"session": r.Name, "minutes": strconv.Itoa(r.MinutesUntil)},
			Path:   "/sessions/" + r.SessionID,
		})
	}
}
