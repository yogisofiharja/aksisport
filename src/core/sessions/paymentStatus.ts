import type { Session, SessionParticipant } from '../api/types';

// DP-032: paying is kept apart from the place. `paid` is set once an
// organizer confirms payment. Most players pay first (Waitlist →
// Registered); organizers and Reguler members may get their place first
// and pay after.

// Statuses that hold, or are about to hold, a place — and so owe the price.
const OWES = new Set<SessionParticipant['status']>(['waitlist', 'registered', 'checked_in', 'checked_out']);

// Owes and hasn't paid yet: the waitlist, or someone playing who pays
// after.
export function isAwaitingPayment(p: SessionParticipant) {
  return OWES.has(p.status) && !p.paid;
}
export function hasPaid(p: SessionParticipant) {
  return Boolean(p.paid);
}

// A player's payment status on the Session, or undefined when they have
// none: a free Session; a guest, added by name with no account to pay
// from; and a request not approved yet (or a cancelled one).
export function paymentStatus(p: SessionParticipant, session: Pick<Session, 'priceModel'>): 'paid' | 'awaiting' | undefined {
  if (session.priceModel === 'free' || !p.userId) return undefined;
  if (hasPaid(p)) return 'paid';
  if (isAwaitingPayment(p)) return 'awaiting';
  return undefined;
}

// A receipt waiting for an organizer: the player uploaded proof of payment
// and nobody has confirmed it yet.
export function receiptToCheck(p: SessionParticipant, session: Pick<Session, 'priceModel'>): boolean {
  return paymentStatus(p, session) === 'awaiting' && p.hasReceipt;
}

// Played (or is playing) and hasn't paid or sent a receipt — counted once
// the Session has started (DP-032).
export function unpaidAfterStart(p: SessionParticipant, session: Pick<Session, 'priceModel' | 'lifecycleStatus'>): boolean {
  const started = session.lifecycleStatus === 'in_progress' || session.lifecycleStatus === 'completed';
  return started && p.status !== 'waitlist' && paymentStatus(p, session) === 'awaiting' && !p.hasReceipt;
}

// What waits on an organizer in a Session: members asking for a spot,
// receipts to check, and — once it has started — players who haven't
// paid. `first` is who to open first, in that order, oldest first.
export function organizerToDo(
  participants: SessionParticipant[],
  session: Pick<Session, 'priceModel' | 'lifecycleStatus'>
): { requests: number; receipts: number; unpaid: number; first?: SessionParticipant } {
  const requests = participants.filter((p) => p.status === 'requested' && p.userId);
  const receipts = participants.filter((p) => receiptToCheck(p, session));
  const unpaid = participants.filter((p) => unpaidAfterStart(p, session));
  return { requests: requests.length, receipts: receipts.length, unpaid: unpaid.length, first: requests[0] ?? receipts[0] ?? unpaid[0] };
}
