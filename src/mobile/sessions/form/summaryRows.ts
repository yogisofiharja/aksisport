import { formatIDR } from '../../../core/currency';
import type { SessionFormValues } from '../../../core/sessions/sessionForm';
import type { SkillLevel } from '../../../core/api/types';
import { activityTypeLabel, sportLabel } from '../sessionDisplay';

type T = (key: string, ...args: any[]) => string;

// The check screens' row values (Aksi redesign › Check your session /
// schedule), read back from the form: "Tennis · Doubles", "8 · you are
// playing", "Race to 4 · single deuce", "Beginner–Intermediate ·
// guidance", "Rp 50.000 per person".

export function activityValue(v: SessionFormValues, t: T): string {
  return [sportLabel(v.sport, t), v.activityType ? activityTypeLabel(v.activityType, t) : null].filter(Boolean).join(' · ');
}

export function playersValue(v: SessionFormValues, t: T): string {
  const count = v.maxParticipants.trim() || t('sessionPreviewCapacityUnlimited');
  return v.hostPlaying ? `${count} · ${t('checkYouArePlaying')}` : count;
}

export function matchFormatValue(v: SessionFormValues, t: T): string {
  const f = v.matchFormat;
  const parts: string[] = [];
  if (f.type === 'fixed-games') {
    parts.push(t('checkFormatFixed', f.totalGames));
    if (f.goldenGameOnTie) parts.push(t('checkGoldenGame'));
  } else if (f.type === 'race-to') {
    parts.push(t('checkFormatRaceTo', f.raceTo));
  } else if (f.type === 'best-of-sets') {
    parts.push(t('checkFormatSets', f.setsToWin * 2 - 1));
    if (f.setsToWin > 1 && f.superTiebreak) parts.push(t('checkSuperTiebreak'));
  } else {
    parts.push(t('formatOpen'));
  }
  if (v.singleDeuce) parts.push(t('checkSingleDeuce'));
  return parts.join(' · ');
}

export function skillValue(v: SessionFormValues, levels: SkillLevel[], t: T): string {
  if (!v.requireSkillLevel) return t('checkAnyLevel');
  const name = (id?: string) => levels.find((l) => l.id === id)?.name ?? t('skillLevelNotSet');
  const mode = t(v.skillLevelEnforcement === 'strict' ? 'skillLevelEnforcementStrict' : 'skillLevelEnforcementGuidance').toLowerCase();
  return `${name(v.skillLevelMinId)}–${name(v.skillLevelMaxId)} · ${mode}`;
}

export function priceValue(v: SessionFormValues, t: T): string {
  if (v.priceModel === 'per_person') return t('sessionPricePerPersonDisplay', formatIDR(Number(v.pricePerPerson)));
  if (v.priceModel === 'split_bill') return t('checkPriceSplit', formatIDR(Number(v.totalPrice)));
  return t('sessionPriceFreeDisplay');
}
