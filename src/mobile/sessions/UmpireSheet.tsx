import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Sheet } from '../../design-system/feedback/Sheet';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Typography } from '../../design-system/ui/Typography';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useTranslation } from '../../i18n';
import { initialsFromName } from '../../core/initials';
import { listParticipants, setSessionUmpire } from '../../core/sessions/api';
import { listActivities } from '../../core/activities/api';
import { playingNow } from '../../core/sessions/umpire';
import type { Session } from '../../core/api/types';

type Props = {
  visible: boolean;
  session: Session;
  myUserId: string;
  myName: string;
  onClose: () => void;
  /** The Session as it is after the handover. */
  onChanged: (session: Session) => void;
};

type Candidate = { userId: string; name: string; playing: boolean; isMe: boolean };

// DP-023 (Aksi redesign › board 6): an owner/admin picks who umpires the
// Session — any checked-in player, playing or sitting out, or themselves
// ("Me", even when not checked in). It takes effect at once; live matches
// move to the new umpire. Loads its own list each time it opens, so it is
// right wherever it is opened from (the ⋯ menu, or Change on the start
// screen).
export function UmpireSheet({ visible, session, myUserId, myName, onClose, onChanged }: Props) {
  const { t } = useTranslation();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string>(session.umpireUserId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected(session.umpireUserId);
    Promise.all([listParticipants(session.id), listActivities(session.id)])
      .then(([participants, activities]) => {
        const playing = playingNow(activities);
        const list: Candidate[] = participants
          .filter((p) => p.status === 'checked_in' && p.userId)
          .map((p) => ({
            userId: p.userId!,
            name: p.displayName || p.username || '',
            playing: playing.has(p.userId!),
            isMe: p.userId === myUserId,
          }))
          // Sitting out first: they are free to umpire.
          .sort((a, b) => Number(a.playing) - Number(b.playing));
        if (!list.some((c) => c.isMe)) list.push({ userId: myUserId, name: myName, playing: playing.has(myUserId), isMe: true });
        setCandidates(list);
      })
      .catch(() => setCandidates([]));
  }, [visible, session.id, session.umpireUserId, myUserId, myName]);

  const pick = candidates.find((c) => c.userId === selected);
  const changed = selected !== session.umpireUserId;

  async function handleMake() {
    if (!pick || !changed || saving) return;
    setSaving(true);
    try {
      onChanged(await setSessionUmpire(session.id, pick.userId));
      onClose();
    } catch {
      appAlert(t('umpireChangeFailed'), undefined, [{ text: t('ok') }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('umpireSheetTitle')}>
      <View accessibilityRole="radiogroup">
        {candidates.map((c, i) => {
          const on = c.userId === selected;
          const current = c.userId === session.umpireUserId;
          return (
            <Pressable
              key={c.userId}
              onPress={() => setSelected(c.userId)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              className={`flex-row items-center gap-3 min-h-[60px] active:opacity-70 ${i > 0 ? 'border-t border-border dark:border-border-dark' : ''}`}
            >
              <View className="w-10 h-10 rounded-full items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark">
                <Typography variant="body" className="text-sm font-display text-ink dark:text-ink-dark">
                  {initialsFromName(c.name)}
                </Typography>
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-1.5">
                  <Typography variant="body" className="font-semibold flex-shrink" numberOfLines={1}>
                    {c.isMe ? t('umpireMe') : c.name}
                  </Typography>
                  {current ? (
                    <View className="h-5 px-1.5 rounded-md justify-center bg-heat-tint dark:bg-heat-tint-dark">
                      <Typography variant="body" className="text-[11px] leading-4 font-bold text-heat-strong dark:text-heat-strong-dark">
                        {t('umpireCurrent')}
                      </Typography>
                    </View>
                  ) : null}
                </View>
                <Typography variant="body" color="muted" className="text-[13px] leading-[18px]">
                  {c.playing ? t('umpirePlaying') : t('umpireSittingOut')}
                </Typography>
              </View>
              <View
                className={`w-[22px] h-[22px] rounded-full items-center justify-center border-2 ${
                  on ? 'border-heat' : 'border-border-strong dark:border-border-strong-dark'
                }`}
              >
                {on ? <View className="w-3 h-3 rounded-full bg-heat" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Typography variant="body" color="muted" className="text-[13px] leading-[18px]">
        {t('umpireExplainer')}
      </Typography>
      <Button size="lg" className="w-full" isDisabled={!changed || !pick || saving} loading={saving} onPress={handleMake}>
        <ButtonText>{pick?.isMe ? t('umpireMakeMe') : t('umpireMake', pick?.name ?? '')}</ButtonText>
      </Button>
    </Sheet>
  );
}
