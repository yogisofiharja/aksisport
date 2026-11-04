import type {
  AttendanceCounts,
  Session,
  SessionParticipant,
} from "../api/types";

// DP-029. Mirrors server/internal/db/attendance.go.
export const ATTENDANCE_CORRECTION_DAYS = 7;

// Whether attended / no-show can still be corrected on this Session.
export function canCorrectAttendance(
  session: Pick<Session, "status" | "startsAt" | "durationMinutes">,
  now = new Date(),
): boolean {
  if (session.status !== "completed" || !session.startsAt) return false;
  const end =
    new Date(session.startsAt).getTime() +
    (session.durationMinutes ?? 0) * 60_000;
  return now.getTime() < end + ATTENDANCE_CORRECTION_DAYS * 24 * 3_600_000;
}

// A confirmed player who never checked in is a no-show once the Session
// is completed; Players shows them as one.
export function shownStatus(
  p: SessionParticipant,
  session: Pick<Session, "status">,
): SessionParticipant["status"] {
  return session.status === "completed" && p.status === "registered"
    ? "no_show"
    : p.status;
}

// Which correction an organizer can make for this player, if any.
export function attendanceCorrection(
  p: SessionParticipant,
  session: Pick<Session, "status">,
): "markAttended" | "markNoShow" | null {
  const status = shownStatus(p, session);
  if (status === "no_show") return "markAttended";
  if (status === "checked_in" || status === "checked_out") return "markNoShow";
  return null;
}

export function hasAttendance(c: AttendanceCounts): boolean {
  return c.attended + c.noShows + c.lateCancels > 0;
}
