import { describe, expect, it } from 'vitest';
import { deriveSessionStatus } from './deriveStatus';
import type { Session, SessionParticipant } from '../api/types';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    clubId: 'c1',
    sport: 'tennis',
    courtCount: 1,
    status: 'open',
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    hostPlaying: true,
    joinedCount: 0,
    ...overrides,
  };
}

function makeParticipant(status: SessionParticipant['status']): SessionParticipant {
  return {
    id: Math.random().toString(),
    sessionId: 's1',
    userId: Math.random().toString(),
    status,
    joinedAt: '2026-01-01T00:00:00Z',
  };
}

describe('deriveSessionStatus', () => {
  it('passes through draft/in_progress/completed/cancelled unchanged', () => {
    for (const status of ['draft', 'in_progress', 'completed', 'cancelled'] as const) {
      expect(deriveSessionStatus(makeSession({ status }), [])).toBe(status);
    }
  });

  it('is recruiting when below the sport minimum', () => {
    const session = makeSession();
    const participants = [makeParticipant('registered')];
    expect(deriveSessionStatus(session, participants)).toBe('recruiting');
  });

  it('is ready once the sport minimum is met, with no max set', () => {
    const session = makeSession();
    const participants = [makeParticipant('registered'), makeParticipant('checked_in')];
    expect(deriveSessionStatus(session, participants)).toBe('ready');
  });

  it('never reaches full when maxParticipants is null — uncapped session', () => {
    const session = makeSession({ maxParticipants: undefined });
    const participants = Array.from({ length: 50 }, () => makeParticipant('checked_in'));
    expect(deriveSessionStatus(session, participants)).toBe('ready');
  });

  it('is full once joined count reaches maxParticipants', () => {
    const session = makeSession({ maxParticipants: 4 });
    const participants = [
      makeParticipant('registered'),
      makeParticipant('checked_in'),
      makeParticipant('checked_in'),
      makeParticipant('checked_out'),
    ];
    expect(deriveSessionStatus(session, participants)).toBe('full');
  });

  it('excludes cancelled and no_show from the joined count', () => {
    const session = makeSession({ maxParticipants: 2 });
    const participants = [makeParticipant('registered'), makeParticipant('cancelled'), makeParticipant('no_show')];
    // Only 1 of 3 rows actually counts as joined — below both min (2) and max (2).
    expect(deriveSessionStatus(session, participants)).toBe('recruiting');
  });

  it('falls back to a minimum of 1 for an unrecognized sport', () => {
    const session = makeSession({ sport: 'basketball' });
    expect(deriveSessionStatus(session, [])).toBe('recruiting');
    expect(deriveSessionStatus(session, [makeParticipant('registered')])).toBe('ready');
  });
});
