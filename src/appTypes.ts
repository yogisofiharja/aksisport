import { MatchMode, MatchState } from './scoring';

export type TeamASide = 'left' | 'right';

export type SetupForm = {
  mode: MatchMode;
  singleDeuceSuddenDeath: boolean;
  players: string[];
};

export type LineupResult = {
  teamANames: string[];
  teamBNames: string[];
  firstServerName: string;
  teamASide: TeamASide;
};

export type TeamNames = {
  A: string;
  B: string;
};

export type MatchRecord = {
  id: string;
  completedAt: number;
  teams: { A: string[]; B: string[] };
  games: { A: number; B: number };
  sets: { A: number; B: number };
  completedSets: Array<{ A: number; B: number }>;
  winner: 'A' | 'B' | null;
  mode: 'single' | 'double';
};

export type PersistedAppState = {
  version: 1;
  setup: SetupForm;
  teamASide: TeamASide;
  matchState: MatchState | null;
  history: MatchState[];
  backgroundPhotoDataUrl: string | null;
  playerPlayCounts: Record<string, number>;
  matchHistory?: MatchRecord[];
  sessionCode?: string | null;
};
