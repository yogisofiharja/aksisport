export type MatchMode = 'single' | 'double';

export type DeuceMode = 'standard' | 'singleDeuceSuddenDeath';

export type MatchFormat =
  | { type: 'open' }
  | { type: 'fixed-games'; totalGames: number; goldenGameOnTie: boolean }
  | { type: 'race-to'; raceTo: number }
  | { type: 'best-of-sets'; setsToWin: number; superTiebreak: boolean };

export type Team = 'A' | 'B';

export type Player = {
  id: string;
  name: string;
  team: Team;
};

export type MatchConfig = {
  mode: MatchMode;
  deuceMode: DeuceMode;
  players: Player[];
  serviceOrderPlayerIds?: string[];
  matchFormat: MatchFormat;
};

export type TiebreakState = {
  target: number;
  pointsPlayed: number;
};

export type MatchState = {
  config: MatchConfig;
  points: {
    A: number;
    B: number;
  };
  games: {
    A: number;
    B: number;
  };
  sets: {
    A: number;
    B: number;
  };
  completedSets: Array<{ A: number; B: number }>;
  deuceCount: number;
  currentServerPlayerId: string;
  tiebreak: TiebreakState | null;
  isEnded: boolean;
  winner: Team | null;
  endReason: 'manual' | 'auto' | 'none';
};

const POINT_LABELS = ['0', '15', '30', '40'];

export function createInitialState(config: MatchConfig): MatchState {
  const order = getServiceOrder(config);
  const currentServerPlayerId = order[0] ?? config.players[0].id;

  return {
    config,
    points: { A: 0, B: 0 },
    games: { A: 0, B: 0 },
    sets: { A: 0, B: 0 },
    completedSets: [],
    deuceCount: 0,
    currentServerPlayerId,
    tiebreak: null,
    isEnded: false,
    winner: null,
    endReason: 'none',
  };
}

export function getPointLabel(state: MatchState, team: Team): string {
  // Tiebreak: raw integer counts, no deuce labels
  if (state.tiebreak) {
    return String(state.points[team]);
  }

  const ownPoints = state.points[team];
  const otherTeam: Team = team === 'A' ? 'B' : 'A';
  const otherPoints = state.points[otherTeam];

  if (state.config.deuceMode === 'singleDeuceSuddenDeath') {
    if (state.deuceCount >= 2 && ownPoints >= 3 && otherPoints >= 3) {
      return 'SD';
    }
  }

  if (ownPoints >= 3 && otherPoints >= 3) {
    if (ownPoints === otherPoints) {
      return 'D';
    }

    if (ownPoints === otherPoints + 1) {
      return 'AD';
    }

    return '-';
  }

  return POINT_LABELS[Math.min(ownPoints, 3)];
}

export function addPoint(state: MatchState, team: Team): MatchState {
  if (state.isEnded) {
    return state;
  }

  const nextState: MatchState = {
    ...state,
    points: { ...state.points },
    games: { ...state.games },
    sets: { ...state.sets },
    completedSets: [...(state.completedSets ?? [])],
    tiebreak: state.tiebreak ? { ...state.tiebreak } : null,
  };

  // ── TIEBREAK MODE ─────────────────────────────────────────────────────────
  if (nextState.tiebreak) {
    nextState.points[team] += 1;
    const { target, pointsPlayed } = nextState.tiebreak;
    const { A, B } = nextState.points;

    const tbWinner: Team | null =
      (A >= target || B >= target) && Math.abs(A - B) >= 2
        ? A > B ? 'A' : 'B'
        : null;

    if (!tbWinner) {
      // Service rotates after the 1st tiebreak point, then every 2 points.
      const newPP = pointsPlayed + 1;
      nextState.tiebreak = { target, pointsPlayed: newPP };
      if (newPP % 2 === 1) {
        nextState.currentServerPlayerId = getNextServerId(nextState);
      }
      return nextState;
    }

    // Tiebreak won: award the deciding game, complete the set.
    nextState.tiebreak = null;
    nextState.games[tbWinner] += 1;
    nextState.points = { A: 0, B: 0 };
    nextState.deuceCount = 0;
    nextState.currentServerPlayerId = getNextServerId(nextState);
    nextState.completedSets = [...nextState.completedSets, { ...nextState.games }];
    nextState.sets[tbWinner] += 1;
    nextState.games = { A: 0, B: 0 };

    const fmtTb = nextState.config.matchFormat ?? { type: 'open' };
    if (fmtTb.type === 'best-of-sets') {
      if (nextState.sets[tbWinner] >= fmtTb.setsToWin) {
        nextState.isEnded = true;
        nextState.winner = tbWinner;
        nextState.endReason = 'auto';
      } else if (
        fmtTb.superTiebreak &&
        nextState.sets.A === fmtTb.setsToWin - 1 &&
        nextState.sets.B === fmtTb.setsToWin - 1
      ) {
        nextState.tiebreak = { target: 10, pointsPlayed: 0 };
      }
    }
    return nextState;
  }

  // ── NORMAL GAME MODE ──────────────────────────────────────────────────────
  const wasDeuce = isDeuce(nextState.points);
  nextState.points[team] += 1;
  const isNowDeuce = isDeuce(nextState.points);

  if (!wasDeuce && isNowDeuce) {
    nextState.deuceCount += 1;
  }

  const pointWinner = getPointWinner(nextState);
  if (!pointWinner) {
    return nextState;
  }

  // A completed game resets point score and rotates the server.
  nextState.games[pointWinner] += 1;
  nextState.points = { A: 0, B: 0 };
  nextState.deuceCount = 0;
  nextState.currentServerPlayerId = getNextServerId(nextState);

  const fmt = nextState.config.matchFormat ?? { type: 'open' };

  if (fmt.type === 'race-to') {
    if (nextState.games[pointWinner] >= fmt.raceTo) {
      nextState.isEnded = true;
      nextState.winner = pointWinner;
      nextState.endReason = 'auto';
    }
    return nextState;
  }

  if (fmt.type === 'fixed-games') {
    const totalPlayed = nextState.games.A + nextState.games.B;
    if (totalPlayed >= fmt.totalGames) {
      const tied = nextState.games.A === nextState.games.B;
      const pastLimit = totalPlayed > fmt.totalGames;
      if (!tied || !fmt.goldenGameOnTie || pastLimit) {
        nextState.isEnded = true;
        nextState.winner =
          nextState.games.A > nextState.games.B ? 'A' :
          nextState.games.B > nextState.games.A ? 'B' :
          null;
        nextState.endReason = 'auto';
      }
    }
    return nextState;
  }

  if (fmt.type === 'best-of-sets') {
    const gA = nextState.games.A;
    const gB = nextState.games.B;
    const loser: Team = pointWinner === 'A' ? 'B' : 'A';

    // 6-6 triggers a tiebreak (target 7, win by 2).
    if (gA === 6 && gB === 6) {
      nextState.tiebreak = { target: 7, pointsPlayed: 0 };
      return nextState;
    }

    // Set won: ≥6 games with a 2-game lead.
    if (nextState.games[pointWinner] >= 6 && nextState.games[pointWinner] - nextState.games[loser] >= 2) {
      nextState.completedSets = [...nextState.completedSets, { ...nextState.games }];
      nextState.sets[pointWinner] += 1;
      nextState.games = { A: 0, B: 0 };

      if (nextState.sets[pointWinner] >= fmt.setsToWin) {
        nextState.isEnded = true;
        nextState.winner = pointWinner;
        nextState.endReason = 'auto';
      } else if (
        fmt.superTiebreak &&
        nextState.sets.A === fmt.setsToWin - 1 &&
        nextState.sets.B === fmt.setsToWin - 1
      ) {
        // Deciding set replaced by a super tiebreak (first to 10).
        nextState.tiebreak = { target: 10, pointsPlayed: 0 };
      }
    }
    return nextState;
  }

  // Custom formats (open, fixed-games, race-to): games accumulate freely, no set completion.
  return nextState;
}

export function endMatchNow(state: MatchState): MatchState {
  if (state.isEnded) {
    return state;
  }

  const winner = decideManualWinner(state);

  return {
    ...state,
    isEnded: true,
    winner,
    endReason: 'manual',
  };
}

export function getServerName(state: MatchState): string {
  const server = state.config.players.find((p) => p.id === state.currentServerPlayerId);
  return server ? server.name : '-';
}

function getPointWinner(state: MatchState): Team | null {
  const a = state.points.A;
  const b = state.points.B;

  if (state.config.deuceMode === 'singleDeuceSuddenDeath' && state.deuceCount >= 2) {
    // In this mode, sudden death starts only after deuce happens again.
    if (a !== b) {
      return a > b ? 'A' : 'B';
    }

    return null;
  }

  if (a >= 4 || b >= 4) {
    if (Math.abs(a - b) >= 2) {
      return a > b ? 'A' : 'B';
    }
  }

  return null;
}

function isDeuce(points: { A: number; B: number }): boolean {
  return points.A >= 3 && points.B >= 3 && points.A === points.B;
}

function getNextServerId(state: MatchState): string {
  // Service order is explicitly stored so it can follow tennis doubles rotation.
  const order = getServiceOrder(state.config);
  const currentIndex = order.indexOf(state.currentServerPlayerId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (safeIndex + 1) % order.length;
  return order[nextIndex];
}

function getServiceOrder(config: MatchConfig): string[] {
  if (config.serviceOrderPlayerIds && config.serviceOrderPlayerIds.length > 0) {
    return config.serviceOrderPlayerIds;
  }

  return config.players.map((p) => p.id);
}

function decideManualWinner(state: MatchState): Team | null {
  if (state.sets.A > state.sets.B) return 'A';
  if (state.sets.B > state.sets.A) return 'B';
  if (state.games.A > state.games.B) return 'A';
  if (state.games.B > state.games.A) return 'B';
  // If a tiebreak is in progress, the player with more tiebreak points is ahead.
  if (state.tiebreak) {
    if (state.points.A > state.points.B) return 'A';
    if (state.points.B > state.points.A) return 'B';
  }
  return null;
}
