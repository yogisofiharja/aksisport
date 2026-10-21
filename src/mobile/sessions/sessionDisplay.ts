import type { ComponentProps } from 'react';
import type { SessionCard } from '../../design-system/domain-ui/SessionCard';
import type { BadgeAction } from '../../design-system/ui/Badge';
import { formatIDR } from '../../core/currency';
import { formatSessionWhen } from '../../core/sessions/sessionSchedule';
import type { Session } from '../../core/api/types';

type T = (key: string, ...args: any[]) => string;

// Milestone 2: branches on the server-resolved lifecycleStatus, not raw
// status — 'open' no longer collapses into a single "Open" label,
// Recruiting/Ready/Full (DP-001's derived sub-states) get their own copy.
export function statusLabel(status: Session['lifecycleStatus'], t: T) {
  if (status === 'draft') return t('sessionStatusDraft');
  if (status === 'cancelled') return t('sessionStatusCancelled');
  if (status === 'in_progress') return t('sessionStatusInProgress');
  if (status === 'completed') return t('sessionStatusCompleted');
  if (status === 'recruiting') return t('sessionStatusRecruiting');
  if (status === 'ready') return t('sessionStatusReady');
  return t('sessionStatusFull');
}

// One StatusPill per lifecycle status (Aksi Sport): heat only for Live.
export function sessionStatusColor(status: Session['lifecycleStatus']): BadgeAction {
  if (status === 'draft') return 'draft';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'in_progress') return 'live';
  if (status === 'completed') return 'completed';
  if (status === 'recruiting') return 'recruiting';
  if (status === 'ready') return 'ready';
  return 'full';
}

export function sportLabel(sport: string, t: T): string {
  return sport === 'tennis' ? t('sportTennis') : sport;
}

export function activityTypeLabel(id: string, t: T): string {
  if (id === 'single') return t('activityTypeSingle');
  if (id === 'double') return t('activityTypeDouble');
  if (id === 'class') return t('activityTypeClass');
  return id;
}

export function priceLabel(session: Pick<Session, 'priceModel' | 'pricePerPerson'>, t: T): string | undefined {
  if (session.priceModel === 'free') return t('sessionPriceFreeDisplay');
  if (session.priceModel === 'per_person') {
    return session.pricePerPerson != null ? t('sessionPricePerPersonDisplay', formatIDR(session.pricePerPerson)) : undefined;
  }
  if (session.priceModel === 'split_bill') return t('sessionPriceModelSplitBill');
  return undefined;
}

type SessionCardProps = ComponentProps<typeof SessionCard>;

function startTime(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Home's "Right now" (Aksi redesign › Home). The live Session as the hero
// card: "Community · venue".
export function sessionHeroProps(session: Session, t: T, clubName: string): Omit<SessionCardProps, 'onPress' | 'className'> {
  return {
    variant: 'hero',
    title: session.name || sportLabel(session.sport, t),
    subtitle: [clubName, session.location].filter(Boolean).join(' · '),
    status: t('activityStatusLive'),
    statusAction: 'live',
  };
}

// Every other Session there as a compact row: the day block, then
// "19:00 · venue · Community" and the status pill.
export function sessionRowProps(
  session: Session,
  t: T,
  lang: 'en' | 'id',
  clubName: string,
  now: Date = new Date()
): Omit<SessionCardProps, 'onPress' | 'className'> {
  const start = session.startsAt ? new Date(session.startsAt) : undefined;
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  return {
    variant: 'row',
    title: session.name || sportLabel(session.sport, t),
    subtitle: [start ? startTime(start) : undefined, session.location, clubName].filter(Boolean).join(' · '),
    day: start
      ? {
          weekday: start.toLocaleDateString(locale, { weekday: 'short' }).replace('.', ''),
          date: String(start.getDate()),
          today: start.toDateString() === now.toDateString(),
        }
      : undefined,
    status: statusLabel(session.lifecycleStatus, t),
    statusAction: sessionStatusColor(session.lifecycleStatus),
  };
}

// Everything a SessionCard shows, from a Session as the list endpoints
// return it — one mapping for every screen that lists Sessions. `subtitle`
// defaults to the venue; cross-Community lists pass their own (the
// Community's name, or name · venue).
export function sessionCardProps(
  session: Session,
  t: T,
  lang: 'en' | 'id',
  subtitle: string | undefined = session.location
): Omit<SessionCardProps, 'onPress' | 'className'> {
  const live = session.lifecycleStatus === 'in_progress';
  return {
    title: session.name || sportLabel(session.sport, t),
    subtitle,
    dateTime: formatSessionWhen(session, lang, t('sessionSectionToday')),
    status: live ? t('activityStatusLive') : statusLabel(session.lifecycleStatus, t),
    statusAction: sessionStatusColor(session.lifecycleStatus),
    joinedCount: session.joinedCount,
    maxParticipants: session.maxParticipants,
    sport: sportLabel(session.sport, t),
    activityType: session.activityType ? activityTypeLabel(session.activityType, t) : undefined,
    priceLabel: priceLabel(session, t),
    isRecurring: Boolean(session.recurringScheduleId),
  };
}
