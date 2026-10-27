import type { PriceModel, SkillLevelEnforcement } from '../api/types';
import type { MatchFormat } from '../../sports/tennis/scoringEngine';

// The create / edit Session form's values, shared by the form, the two
// check screens and the save calls (Aksi redesign › Create a session).
// Numbers typed by the organizer stay strings until validated, so an
// empty field means "not set" rather than 0.
export type SessionFormValues = {
  sport: string;
  activityType?: string;
  name: string;
  location: string;
  description: string;
  maxParticipants: string;
  hostPlaying: boolean;
  isRecurring: boolean;
  // Ad-hoc: a specific date. Recurring: a weekday instead (0 = Sunday).
  date: Date;
  time: Date;
  durationHours: number;
  weekday: number;
  // Recurring: days before each Session that it is generated (opens).
  leadDays: number;
  timezone: string;
  requireSkillLevel: boolean;
  skillLevelMinId?: string;
  skillLevelMaxId?: string;
  skillLevelEnforcement?: SkillLevelEnforcement;
  priceModel: PriceModel;
  pricePerPerson: string;
  totalPrice: string;
  matchFormat: MatchFormat;
  singleDeuce: boolean;
};

export type SessionFormField = 'activityType' | 'name' | 'location' | 'date' | 'maxParticipants' | 'skillLevel' | 'price';

/** Field → i18n key of the message shown under it. */
export type SessionFormErrors = Partial<Record<SessionFormField, string>>;

// Display order, so the form can scroll to the first problem.
export const SESSION_FORM_FIELDS: SessionFormField[] = ['activityType', 'name', 'location', 'date', 'maxParticipants', 'skillLevel', 'price'];

export function combinedStartsAt(date: Date, time: Date): Date {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}

function positiveInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const n = Number.parseInt(trimmed, 10);
  return n >= 1 ? n : undefined;
}

// Every problem at once, keyed by the field it belongs to. A recurring
// schedule has no literal date, so the past check only applies to an
// ad-hoc Session (create and edit alike).
export function validateSessionForm(v: SessionFormValues, now: Date = new Date()): SessionFormErrors {
  const errors: SessionFormErrors = {};
  if (!v.activityType) errors.activityType = 'sessionActivityTypeRequired';
  if (!v.name.trim()) errors.name = 'sessionNameRequired';
  if (!v.location.trim()) errors.location = 'sessionLocationRequired';
  if (!v.isRecurring && combinedStartsAt(v.date, v.time).getTime() < now.getTime()) errors.date = 'sessionStartsAtPast';
  if (v.maxParticipants.trim() && positiveInt(v.maxParticipants) === undefined) errors.maxParticipants = 'sessionMaxParticipantsInvalid';
  if (v.requireSkillLevel && (!v.skillLevelMinId || !v.skillLevelMaxId || !v.skillLevelEnforcement)) {
    errors.skillLevel = 'skillLevelRangeRequired';
  }
  if (v.priceModel === 'per_person' && positiveInt(v.pricePerPerson) === undefined) errors.price = 'sessionPricePerPersonInvalid';
  if (v.priceModel === 'split_bill' && positiveInt(v.totalPrice) === undefined) errors.price = 'sessionTotalPriceInvalid';
  return errors;
}

// What a Session and a Schedule template share, from values that passed
// validateSessionForm.
export function templatePayload(v: SessionFormValues) {
  return {
    name: v.name.trim(),
    location: v.location.trim(),
    description: v.description.trim() || undefined,
    maxParticipants: positiveInt(v.maxParticipants),
    activityType: v.activityType,
    hostPlaying: v.hostPlaying,
    priceModel: v.priceModel,
    pricePerPerson: v.priceModel === 'per_person' ? positiveInt(v.pricePerPerson) : undefined,
    totalPrice: v.priceModel === 'split_bill' ? positiveInt(v.totalPrice) : undefined,
    defaultMatchFormat: v.matchFormat,
    defaultSingleDeuce: v.singleDeuce,
    ...(v.requireSkillLevel
      ? { skillLevelMinId: v.skillLevelMinId, skillLevelMaxId: v.skillLevelMaxId, skillLevelEnforcement: v.skillLevelEnforcement }
      : {}),
  };
}

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "Sat 24 Oct", in the app's language.
export function shortDate(d: Date, lang: 'en' | 'id'): string {
  return d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

// "07:00–09:00", wrapping past midnight.
export function timeRange(time: Date, durationHours: number): string {
  const end = new Date(time);
  end.setHours(end.getHours() + durationHours);
  return `${hhmm(time)}–${hhmm(end)}`;
}
