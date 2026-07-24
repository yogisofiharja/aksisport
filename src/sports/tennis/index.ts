import type { MatchMode } from './scoringEngine';
import type { SportModule } from '../types';
import { minParticipants } from './rules';

export const tennisSportModule: SportModule = {
  id: 'tennis',
  rules: {
    minParticipants: (mode) => minParticipants(mode as MatchMode),
  },
};
