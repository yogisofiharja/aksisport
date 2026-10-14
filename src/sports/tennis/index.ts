import type { MatchMode } from './scoringEngine';
import type { SportModule } from '../types';
import { minParticipants } from './rules';
import { formatTennisResult } from './resultSummary';

export const tennisSportModule: SportModule = {
  id: 'tennis',
  rules: {
    minParticipants: (mode) => minParticipants(mode as MatchMode),
  },
  activityTypes: ['single', 'double', 'class'],
  formatResult: formatTennisResult,
};
