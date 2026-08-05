import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Card } from '../../design-system/ui/Card';
import { Loading } from '../../design-system/feedback/Loading';
import { useTranslation } from '../../i18n';
import { listMySkillLevels, listSkillLevels, setMySkillLevel } from '../../core/skillLevels/api';
import { listSportIds } from '../../sports/registry';
import type { SkillLevel, UserSkillLevel } from '../../core/api/types';

type Props = {
  onBack: () => void;
};

// DP-008: only the sport name is translated (sportTennis etc. already
// exist for other screens) — level names are data-driven from the API,
// no per-level i18n keys.
function sportLabel(sport: string, t: (key: string) => string) {
  return sport === 'tennis' ? t('sportTennis') : sport;
}

export function SkillLevelsScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const sports = listSportIds();
  const [myLevels, setMyLevels] = useState<UserSkillLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [levelsBySport, setLevelsBySport] = useState<Record<string, SkillLevel[]>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setMyLevels(await listMySkillLevels());
    } catch {
      // keep stale state; user can back out and retry
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleExpand(sport: string) {
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

  if (loading) {
    return (
      <ScrollPage>
        <Loading fullScreen />
      </ScrollPage>
    );
  }

  return (
    <ScrollPage gap="lg">
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>

      <Typography variant="display">{t('skillLevelsTitle')}</Typography>
      <Typography variant="body" color="muted">
        {t('skillLevelsSubtitle')}
      </Typography>

      <VStack space="md">
        {sports.map((sport) => {
          const mine = myLevels.find((l) => l.sport === sport);
          const expanded = expandedSport === sport;
          return (
            <VStack key={sport} space="sm">
              <Card pressable onPress={() => handleExpand(sport)}>
                <HStack className="justify-between items-center" space="md">
                  <Typography variant="body" className="text-lg font-bold">
                    {sportLabel(sport, t)}
                  </Typography>
                  <Typography variant="body" color={mine ? 'default' : 'muted'}>
                    {mine ? mine.skillLevelName : t('skillLevelNotSet')}
                  </Typography>
                </HStack>
              </Card>
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
          );
        })}
      </VStack>
    </ScrollPage>
  );
}
