import { apiFetch } from '../api/client';
import type { SkillLevel, UserSkillLevel } from '../api/types';

// DP-008: the Level Scale is owned by the Sport Module (DP-ARCH-002),
// scoped per sport.
export function listSkillLevels(sport: string): Promise<SkillLevel[]> {
  return apiFetch(`/v1/skill-levels?sport=${encodeURIComponent(sport)}`);
}

export function listMySkillLevels(): Promise<UserSkillLevel[]> {
  return apiFetch('/v1/me/skill-levels');
}

// Self-reported only — players may update their own level at any time.
export function setMySkillLevel(sport: string, skillLevelId: string): Promise<UserSkillLevel> {
  return apiFetch(`/v1/me/skill-levels/${encodeURIComponent(sport)}`, {
    method: 'PUT',
    body: JSON.stringify({ skillLevelId }),
  });
}
