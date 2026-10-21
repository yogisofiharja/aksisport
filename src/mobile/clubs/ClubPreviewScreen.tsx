import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Card } from '../../design-system/ui/Card';
import { Badge } from '../../design-system/ui/Badge';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useTranslation } from '../../i18n';
import { authHeader } from '../../core/api/client';
import { cancelJoinRequest, clubAvatarUrl, joinClub } from '../../core/clubs/api';
import { initialsFromName } from '../../core/initials';
import { clubLink, shareLink } from '../../platform/shareLink';
import { offerPush } from '../../core/notifications/offerPush';
import type { ClubPreview } from '../../core/api/types';
import { AppBar } from '../../design-system/layout/AppBar';

type Props = {
  club: ClubPreview;
  onBack: () => void;
  // Called with the Community as it stands after joining, requesting, or
  // cancelling — the parent swaps to the member home once viewerRole is set.
  onChanged: (club: ClubPreview) => void;
};

// What someone who is not a member sees of a Community (DP-017): enough
// to recognise it and decide — name, picture, description, location, size,
// public or private — and the one action that fits: join a public
// Community, or ask to join a private one. Reached from Explore's results
// and from a shared link. Sessions, members and chats are not here; they
// are for members.
export function ClubPreviewScreen({ club, onBack, onChanged }: Props) {
  const { t, lang } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const isPrivate = club.visibility === 'private';

  async function handleJoin() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await joinClub(club.id);
      onChanged(updated);
      // DP-018: a good moment to ask — they now have something to hear
      // about (a decision on their request, the Community's sessions).
      offerPush(lang, t);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelRequest() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await cancelJoinRequest(club.id);
      onChanged({ ...club, viewerRequestPending: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    const outcome = await shareLink(clubLink(club.id), club.name);
    if (outcome === 'copied') appAlert(t('clubLinkCopiedTitle'), t('clubLinkCopiedDesc'));
    else if (outcome === 'failed') appAlert(t('clubLinkShareFailed'), clubLink(club.id), [{ text: t('ok') }]);
  }

  return (
    <ScrollPage
      appBar={<AppBar onBack={onBack} actions={[{ icon: 'share-outline', label: t('clubShareLink'), onPress: handleShare }]} />}
    >

      <VStack space="md" style={{ alignItems: 'center' }}>
        <View className="w-24 h-24 rounded-full items-center justify-center overflow-hidden bg-surface-sunken dark:bg-surface-sunken-dark border-2 border-border dark:border-border-dark">
          {club.hasAvatar ? (
            <Image source={{ uri: clubAvatarUrl(club.id), headers: imageHeaders }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Typography variant="body" className="text-2xl font-extrabold text-ink-muted dark:text-ink-muted-dark">
              {initialsFromName(club.name)}
            </Typography>
          )}
        </View>
        <Typography variant="heading" style={{ textAlign: 'center' }}>
          {club.name}
        </Typography>
        <Badge action="muted" text={isPrivate ? t('clubPrivateBadge') : t('clubPublicBadge')} />
      </VStack>

      <Card>
        <VStack space="sm">
          <HStack space="sm" className="items-center">
            <Icon name="location-outline" size="sm" color="muted" />
            <Typography variant="body" color={club.cityName ? 'default' : 'muted'} style={{ flex: 1 }}>
              {club.cityName ?? t('clubLocationNotSet')}
            </Typography>
          </HStack>
          <HStack space="sm" className="items-center">
            <Icon name="people-outline" size="sm" color="muted" />
            <Typography variant="body">{t('clubMemberCount', club.memberCount)}</Typography>
          </HStack>
        </VStack>
      </Card>

      {club.description ? (
        <Typography variant="body" color="muted">
          {club.description}
        </Typography>
      ) : null}

      {error && (
        <Typography variant="body" color="destructive">
          {error}
        </Typography>
      )}

      {club.viewerRequestPending ? (
        <VStack space="md">
          <Card>
            <VStack space="xs">
              <Typography variant="body" className="font-bold">
                {t('clubRequestPendingTitle')}
              </Typography>
              <Typography variant="body" color="muted">
                {t('clubRequestPendingDesc')}
              </Typography>
            </VStack>
          </Card>
          <Button variant="outline" size="xl" className="w-full" onPress={handleCancelRequest} isDisabled={busy}>
            <ButtonText variant="outline">
              {t('clubCancelRequest')}
            </ButtonText>
          </Button>
        </VStack>
      ) : (
        <VStack space="sm">
          <Button size="xl" className="w-full" onPress={handleJoin} isDisabled={busy}>
            <ButtonText>{isPrivate ? t('clubRequestToJoin') : t('clubJoin')}</ButtonText>
          </Button>
          <Typography variant="body" color="muted" className="text-sm" style={{ textAlign: 'center' }}>
            {isPrivate ? t('clubPrivateJoinHint') : t('clubPublicJoinHint')}
          </Typography>
        </VStack>
      )}
    </ScrollPage>
  );
}
