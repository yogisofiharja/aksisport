import { describe, expect, it } from 'vitest';
import { templatePayload, timeRange, validateSessionForm, type SessionFormValues } from './sessionForm';

const now = new Date(2026, 9, 20, 10, 0);

const base: SessionFormValues = {
  sport: 'tennis',
  activityType: 'double',
  name: 'Sabtu pagi doubles',
  location: 'Senayan',
  description: '',
  maxParticipants: '',
  hostPlaying: true,
  isRecurring: false,
  date: new Date(2026, 9, 24),
  time: new Date(2026, 9, 24, 7, 0),
  durationHours: 2,
  weekday: 6,
  leadDays: 3,
  timezone: 'Asia/Jakarta',
  requireSkillLevel: false,
  priceModel: 'free',
  pricePerPerson: '',
  totalPrice: '',
  matchFormat: { type: 'open' },
  singleDeuce: true,
};

describe('validateSessionForm', () => {
  it('passes a complete form', () => {
    expect(validateSessionForm(base, now)).toEqual({});
  });

  it('puts each problem on its own field', () => {
    const errors = validateSessionForm(
      { ...base, activityType: undefined, name: ' ', location: '', maxParticipants: '0', priceModel: 'per_person', pricePerPerson: '' },
      now
    );
    expect(errors).toEqual({
      activityType: 'sessionActivityTypeRequired',
      name: 'sessionNameRequired',
      location: 'sessionLocationRequired',
      maxParticipants: 'sessionMaxParticipantsInvalid',
      price: 'sessionPricePerPersonInvalid',
    });
  });

  it('rejects a start in the past only for a one-off session', () => {
    const past = { ...base, date: new Date(2026, 9, 19), time: new Date(2026, 9, 19, 7, 0) };
    expect(validateSessionForm(past, now)).toEqual({ date: 'sessionStartsAtPast' });
    expect(validateSessionForm({ ...past, isRecurring: true }, now)).toEqual({});
  });

  it('needs the whole skill level range once it is required', () => {
    expect(validateSessionForm({ ...base, requireSkillLevel: true, skillLevelMinId: 'a' }, now)).toEqual({
      skillLevel: 'skillLevelRangeRequired',
    });
  });

  it('needs a total for a split bill', () => {
    expect(validateSessionForm({ ...base, priceModel: 'split_bill', totalPrice: 'abc' }, now)).toEqual({
      price: 'sessionTotalPriceInvalid',
    });
  });
});

describe('templatePayload', () => {
  it('trims text, parses numbers and keeps only the active price', () => {
    const payload = templatePayload({
      ...base,
      name: ' Sabtu ',
      maxParticipants: '8',
      priceModel: 'per_person',
      pricePerPerson: '50000',
      totalPrice: '400000',
    });
    expect(payload).toMatchObject({ name: 'Sabtu', maxParticipants: 8, pricePerPerson: 50000, totalPrice: undefined });
    expect(payload).not.toHaveProperty('skillLevelMinId');
  });
});

describe('timeRange', () => {
  it('adds the duration and wraps past midnight', () => {
    expect(timeRange(new Date(2026, 9, 24, 7, 0), 2)).toBe('07:00–09:00');
    expect(timeRange(new Date(2026, 9, 24, 23, 0), 2)).toBe('23:00–01:00');
  });
});
