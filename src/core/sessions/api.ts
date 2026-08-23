import { apiFetch, apiUrl } from '../api/client';
import type { Session, SessionMessage, SessionParticipant, SessionStatus, SkillLevelEnforcement } from '../api/types';

export function createSession(
  clubId: string,
  sport: string,
  options?: {
    name?: string;
    location?: string;
    description?: string;
    courtCount?: number;
    maxParticipants?: number;
    defaultMatchFormat?: unknown;
    defaultSingleDeuce?: boolean;
    activityType?: string;
    startsAt?: string;
    durationMinutes?: number;
    skillLevelMinId?: string;
    skillLevelMaxId?: string;
    skillLevelEnforcement?: SkillLevelEnforcement;
    hostPlaying?: boolean;
  }
): Promise<Session> {
  return apiFetch(`/v1/clubs/${clubId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ sport, ...options }),
  });
}

export function listSessions(clubId: string): Promise<Session[]> {
  return apiFetch(`/v1/clubs/${clubId}/sessions`);
}

export function getSession(sessionId: string): Promise<Session> {
  return apiFetch(`/v1/sessions/${sessionId}`);
}

export function updateSession(
  sessionId: string,
  updates: {
    name?: string;
    location?: string;
    description?: string;
    status?: SessionStatus;
    maxParticipants?: number;
    defaultMatchFormat?: unknown;
    defaultSingleDeuce?: boolean;
    activityType?: string;
    startsAt?: string;
    durationMinutes?: number;
    skillLevelMinId?: string;
    skillLevelMaxId?: string;
    skillLevelEnforcement?: SkillLevelEnforcement;
    hostPlaying?: boolean;
  }
): Promise<Session> {
  return apiFetch(`/v1/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// DP-001: named wrappers over the same generic PATCH updateSession already
// uses — no new routes, the server validates the transition itself
// (draft->open->in_progress->completed, cancelled from any non-terminal
// state). Named here for call-site clarity, same reasoning as checkIn
// already being a named wrapper rather than a raw PATCH call.
export function publishSession(sessionId: string): Promise<Session> {
  return updateSession(sessionId, { status: 'open' });
}

// No manual "start" or "complete" wrapper — both In Progress and
// Completed are reached only via DP-009's auto-start/auto-transition
// (starts_at arriving, then starts_at+duration_minutes elapsing), never
// an organizer UI action. See docs/current/lifecycle-session.md.

export function cancelSession(sessionId: string): Promise<Session> {
  return updateSession(sessionId, { status: 'cancelled' });
}

// "Discard" — hard-deletes a Draft Session (Milestone 2). Draft-only,
// enforced server-side; a published Session only has cancelSession as
// its terminal action, never a hard delete.
export function discardDraftSession(sessionId: string): Promise<void> {
  return apiFetch(`/v1/sessions/${sessionId}`, { method: 'DELETE' });
}

export function listParticipants(sessionId: string): Promise<SessionParticipant[]> {
  return apiFetch(`/v1/sessions/${sessionId}/participants`);
}

// DP-002 Join Approval: this is the "request to join" action — creates a
// 'requested' row, not an immediate join. See approveParticipant/
// confirmParticipantPayment for the rest of the chain.
export function registerForSession(sessionId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/register`, { method: 'POST' });
}

// Owner/admin approves a 'requested' join request, moving it to
// 'waitlist' (approved, slot not yet claimed).
export function approveParticipant(sessionId: string, userId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants/${userId}/approve`, { method: 'POST' });
}

// Owner/admin confirms payment was received (outside the app — no
// payment gateway), moving a 'waitlist' participant to 'registered'.
export function confirmParticipantPayment(sessionId: string, userId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants/${userId}/confirm-payment`, { method: 'POST' });
}

// Milestone 5 — self-service only, attaches to the caller's own
// participant row. Same base64 content/size convention as DP-011 Chat
// images. Overwrites any previous receipt.
export function uploadPaymentReceipt(sessionId: string, image: { base64: string; contentType: string }): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/receipt`, {
    method: 'POST',
    body: JSON.stringify({ imageBase64: image.base64, imageContentType: image.contentType }),
  });
}

// Not fetched via apiFetch — a URL for an `<Image>` source (with
// authHeader() as its request headers). The server only serves these
// bytes to the uploading participant themselves or an owner/admin.
export function participantReceiptUrl(sessionId: string, participantId: string): string {
  return apiUrl(`/v1/sessions/${sessionId}/participants/${participantId}/receipt`);
}

// Owner/admin removes a participant entirely (e.g. declining a join
// request) — a hard delete, unlike Cancel/NoShow. Accepts either a
// member's userId or a guest's own participant id — the server matches
// on either column, since guests have no userId.
export function deleteParticipant(sessionId: string, participantIdOrUserId: string): Promise<void> {
  return apiFetch(`/v1/sessions/${sessionId}/participants/${participantIdOrUserId}`, { method: 'DELETE' });
}

export function checkIn(sessionId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/checkin`, { method: 'POST' });
}

// Owner/admin adds an existing club member directly to the roster as
// 'registered' — used by SessionDetailScreen's participant-placeholder
// "Member" option. Available any time the Session is published; not a
// check-in action, so no Check-In Window restriction (unlike
// checkInParticipantById below).
export function addRegisteredParticipant(sessionId: string, userId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants/${userId}/add`, { method: 'POST' });
}

// Owner/admin checks in an already-'registered' participant (member or
// guest) by their participant row id — the only action that actually
// moves someone to 'checked_in', separate from adding them to the
// roster. Works for guests too, unlike a user-id-keyed check-in would.
export function checkInParticipantById(sessionId: string, participantId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/checkin/${participantId}`, { method: 'POST' });
}

// DP-002: self-service, mirrors checkIn exactly — acts on the caller.
export function checkOut(sessionId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/checkout`, { method: 'POST' });
}

export function cancelParticipation(sessionId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/cancel`, { method: 'POST' });
}

// DP-002: owner/admin only — marking someone else's absence isn't self-service.
export function markNoShow(sessionId: string, userId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants/${userId}/no-show`, { method: 'POST' });
}

// Owner/admin names a guest who will be attending — lands as 'registered'
// (roster-building, not a check-in action), same as addRegisteredParticipant.
// Checking them in is checkInParticipantById above, once the Check-In
// Window opens — a guest has no user id to key a user-based check-in on.
export function addGuestParticipant(sessionId: string, guestName: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ guestName }),
  });
}

// DP-011 Session Chat.
export function listSessionMessages(sessionId: string): Promise<SessionMessage[]> {
  return apiFetch(`/v1/sessions/${sessionId}/messages`);
}

// image, if provided, is the raw base64 payload (no "data:...;base64,"
// prefix) plus its content type — the server whitelists jpeg/png/webp
// and caps it at 5MB decoded. At least one of body/image must be set;
// the server rejects an entirely empty message.
export function sendSessionMessage(
  sessionId: string,
  options: { body?: string; image?: { base64: string; contentType: string } }
): Promise<SessionMessage> {
  return apiFetch(`/v1/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      body: options.body,
      imageBase64: options.image?.base64,
      imageContentType: options.image?.contentType,
    }),
  });
}

// Not fetched via apiFetch — this is a URL for an `<Image>` source (with
// authHeader() as its request headers), not a JSON response to parse.
export function sessionMessageImageUrl(sessionId: string, messageId: string): string {
  return apiUrl(`/v1/sessions/${sessionId}/messages/${messageId}/image`);
}
