import type { Session, SessionParticipant } from '../api/types';

// Milestone 5 — waitlist (approved, payment not yet confirmed) reads as
// "awaiting"; registered/checked_in/checked_out all mean the slot is
// claimed, i.e. "paid" in this domain's terms. 'requested' participants
// haven't been approved yet at all, so they have no payment status —
// excluded entirely, not shown as either.
export function isAwaitingPayment(p: SessionParticipant) {
  return p.status === 'waitlist';
}
export function hasPaid(p: SessionParticipant) {
  return p.status === 'registered' || p.status === 'checked_in' || p.status === 'checked_out';
}

// A player's payment status on the Session, or undefined when they have
// none: a free Session; the host and guests, who never go through the
// payment step (DP-012 v0.29.0 — organizer-initiated places skip approval
// and payment); and 'requested', not approved yet. Any paid count leaves
// them out too.
export function paymentStatus(
  p: SessionParticipant,
  session: Pick<Session, 'priceModel' | 'createdBy'>
): 'paid' | 'awaiting' | undefined {
  if (session.priceModel === 'free' || !p.userId || p.userId === session.createdBy) return undefined;
  if (isAwaitingPayment(p)) return 'awaiting';
  if (hasPaid(p)) return 'paid';
  return undefined;
}

// A receipt waiting for an organizer: the player uploaded proof of payment
// and nobody has confirmed it yet.
export function receiptToCheck(p: SessionParticipant, session: Pick<Session, 'priceModel' | 'createdBy'>): boolean {
  return paymentStatus(p, session) === 'awaiting' && p.hasReceipt;
}

// What waits on an organizer in a Session: members asking for a spot, and
// receipts to check. `first` is who to open first — requests before
// receipts, oldest first as listed.
export function organizerToDo(
  participants: SessionParticipant[],
  session: Pick<Session, 'priceModel' | 'createdBy'>
): { requests: number; receipts: number; first?: SessionParticipant } {
  const requests = participants.filter((p) => p.status === 'requested' && p.userId);
  const receipts = participants.filter((p) => receiptToCheck(p, session));
  return { requests: requests.length, receipts: receipts.length, first: requests[0] ?? receipts[0] };
}
