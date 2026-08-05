import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Card } from '../../design-system/ui/Card';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { listMySkillLevels, listSkillLevels, setMySkillLevel } from '../../core/skillLevels/api';
import { listSportIds } from '../../sports/registry';
import type { SkillLevel, UserSkillLevel } from '../../core/api/types';

type Props = {
  onOpenSettings: () => void;
};

// DP-008: only the sport name is translated — level names are data-driven
// from the API, no per-level i18n keys.
function sportLabel(sport: string, t: (key: string) => string) {
  return sport === 'tennis' ? t('sportTennis') : sport;
}

export function MeScreen({ onOpenSettings }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const sports = listSportIds();
  const [myLevels, setMyLevels] = useState<UserSkillLevel[]>([]);
  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [levelsBySport, setLevelsBySport] = useState<Record<string, SkillLevel[]>>({});
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listMySkillLevels()
        .then(setMyLevels)
        .catch(() => {
          // keep stale state; user can retry via pull-to-refresh elsewhere
        });
    }, [])
  );

  async function handleToggleEdit(sport: string) {
    if (expandedSport === sport) {
      setExpandedSport(null);
      return;
    }
    setExpandedSport(sport);
    if (!levelsBySport[sport]) {
      const levels = await listSkillLevels(sport);
      setLevelsBySport((prev) => ({ ...prev, [sport]: levels }));
    }
  }

  async function handlePick(sport: string, skillLevelId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await setMySkillLevel(sport, skillLevelId);
      setMyLevels((prev) => [updated, ...prev.filter((l) => l.sport !== sport)]);
      setExpandedSport(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollPage gap="lg">
      <HStack className="justify-between items-center">
        <VStack space="xs">
          <Typography variant="display">{profile?.displayName || profile?.username}</Typography>
          {profile?.displayName && (
            <Typography variant="body" color="muted">
              @{profile.username}
            </Typography>
          )}
        </VStack>
        <Pressable className="p-2 -mr-2 active:opacity-60" onPress={onOpenSettings}>
          <Icon name="settings-outline" size="lg" />
        </Pressable>
      </HStack>

      <VStack space="sm">
        <Typography variant="caption" color="muted">
          {t('meSportsTitle')}
        </Typography>
        <VStack space="md">
          {sports.map((sport) => {
            const mine = myLevels.find((l) => l.sport === sport);
            const expanded = expandedSport === sport;
            return (
              <Card key={sport}>
                <VStack space="sm">
                  <Typography variant="title">{sportLabel(sport, t)}</Typography>
                  <HStack className="justify-between items-center">
                    <Typography variant="body" color={mine ? 'default' : 'muted'}>
                      {mine ? mine.skillLevelName : t('skillLevelNotSet')}
                    </Typography>
                    <Pressable className="p-2 -mr-2 active:opacity-60" onPress={() => handleToggleEdit(sport)} hitSlop={8}>
                      <Icon name="create-outline" size="sm" color="secondary" />
                    </Pressable>
                  </HStack>
                  {expanded && (
                    <HStack className="gap-2 flex-wrap">
                      {(levelsBySport[sport] ?? []).map((level) => {
                        const selected = mine?.skillLevelId === level.id;
                        return (
                          <Pressable
                            key={level.id}
                            disabled={busy}
                            className={`px-3 py-2 rounded-full ${selected ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            onPress={() => handlePick(sport, level.id)}
                          >
                            <Typography variant="body" className={selected ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-300'}>
                              {level.name}
                            </Typography>
                          </Pressable>
                        );
                      })}
                    </HStack>
                  )}
                </VStack>
              </Card>
            );
          })}
        </VStack>
      </VStack>
    </ScrollPage>
  );
}
