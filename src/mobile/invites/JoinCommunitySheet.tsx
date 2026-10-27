import { Image, Pressable, Text, View } from 'react-native';
import { Sheet } from '../../design-system/feedback/Sheet';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Typography } from '../../design-system/ui/Typography';
import { useTranslation } from '../../i18n';
import { initialsFromName } from '../../core/initials';
import { shortCityName } from '../../core/locations/cityName';
import type { ClubPreview } from '../../core/api/types';

type Props = {
  visible: boolean;
  club: ClubPreview;
  sessionName: string;
  avatarSource?: { uri: string; headers: Record<string, string> };
  busy: boolean;
  onJoin: () => void;
  onNotNow: () => void;
};

// After the Session (DP-028; Aksi redesign › Join the community?): offered
// once to a Session-only participant opening a Session they played in.
// Join for a public Community; for a private one, Request — or Join
// straight in with an owner/admin's invite.
export function JoinCommunitySheet({ visible, club, sessionName, avatarSource, busy, onJoin, onNotNow }: Props) {
  const { t } = useTranslation();
  const isPrivate = club.visibility === 'private';
  const label = isPrivate && !club.invite?.straightIn ? t('clubRequestToJoin') : t('joinCommunity');
  const subline = [
    club.cityName ? shortCityName(club.cityName) : null,
    t(isPrivate ? 'clubPrivateBadge' : 'clubPublicBadge'),
    t('clubMemberCount', club.memberCount),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Sheet visible={visible} onClose={onNotNow} closeLabel={false}>
      <View className="items-center gap-2.5 px-2 pt-1">
        <View className="w-14 h-14 rounded-[14px] overflow-hidden items-center justify-center bg-heat-tint dark:bg-heat-tint-dark">
          {avatarSource ? (
            <Image source={avatarSource} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text className="font-display text-[22px] text-heat-strong dark:text-heat-strong-dark">{initialsFromName(club.name)}</Text>
          )}
        </View>
        <Text accessibilityRole="header" className="text-[26px] leading-[30px] font-display-hero text-center text-ink dark:text-ink-dark">
          {t('joinCommunityTitle', club.name)}
        </Text>
        <Typography variant="body" color="muted" className="text-center">
          {t('joinCommunityBody', sessionName)}
        </Typography>
        <Typography variant="caption" color="muted" className="text-center text-[13px]">
          {subline}
        </Typography>
      </View>
      <View className="gap-2.5 pt-6">
        <Button size="lg" loading={busy} isDisabled={busy} onPress={onJoin}>
          <ButtonText>{label}</ButtonText>
        </Button>
        <Pressable onPress={onNotNow} accessibilityRole="button" className="self-center p-2 active:opacity-60">
          <Text className="text-[15px] font-sans-semibold text-ink dark:text-ink-dark">{t('inviteNotNow')}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
