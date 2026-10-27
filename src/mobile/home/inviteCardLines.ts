import { formatIDR } from '../../core/currency';
import { formatSessionWhen } from '../../core/sessions/sessionSchedule';
import type { InvitationCard } from '../../core/invites/types';

type T = (key: string, ...args: any[]) => string;

// The two lines under an invitation's title on Home (DP-028): for a
// Session, "Sat 31 Oct · 07:00 · <place>" then "<Community> · <price>";
// for a Community, just its name line is the title, so nothing more.
export function inviteCardLines(invite: InvitationCard, t: T, lang: 'en' | 'id'): string[] {
  if (invite.targetType !== 'session') return [];
  const when = invite.startsAt
    ? formatSessionWhen({ startsAt: invite.startsAt, durationMinutes: invite.durationMinutes, lifecycleStatus: 'recruiting' }, lang, t('sessionSectionToday'))
    : undefined;
  const price =
    invite.priceModel === 'per_person' && invite.pricePerPerson != null
      ? formatIDR(invite.pricePerPerson)
      : invite.priceModel === 'split_bill'
        ? t('sessionPriceModelSplitBill')
        : t('sessionPriceFreeDisplay');
  return [[when, invite.location].filter(Boolean).join(' · '), [invite.clubName, price].join(' · ')].filter(Boolean);
}
