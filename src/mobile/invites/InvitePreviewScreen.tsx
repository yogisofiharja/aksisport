import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar } from '../../design-system/layout/AppBar';
import { ActionBar } from '../../design-system/layout/ActionBar';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Typography } from '../../design-system/ui/Typography';
import { ClubCard } from '../../design-system/domain-ui/ClubCard';
import { useTranslation } from '../../i18n';
import { ApiRequestError } from '../../core/api/client';
import { previewInvite } from '../../core/invites/api';
import type { InvitePreview } from '../../core/invites/types';
import { formatSessionWhen } from '../../core/sessions/sessionSchedule';
import { shortCityName } from '../../core/locations/cityName';
import { formatIDR } from '../../core/currency';
import { DetailsTab } from '../sessions/tabs/DetailsTab';
import { priceLabel } from '../sessions/sessionDisplay';
import { InvitedLine } from './InvitedLine';

type Props = {
  token: string;
  // Join: an account first. After signing in the app comes back to this
  // link (restoreIntendedUrl), which opens the real Session or Community.
  onSignUp: () => void;
  onLogIn: () => void;
};

// /i/:token signed out (DP-028, 2026-11-05): the Session's details (or the
// Community's card) before any sign-up, so the friend decides first. Join
// is what asks for an account. Players, matches and chat stay behind
// sign-in.
export function InvitePreviewScreen({ token, onSignUp, onLogIn }: Props) {
  const { t, lang } = useTranslation();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [problem, setProblem] = useState<'revoked' | 'missing' | 'failed' | null>(null);

  useEffect(() => {
    let cancelled = false;
    previewInvite(token)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError && err.code === 'INVITE_REVOKED') setProblem('revoked');
        else if (err instanceof ApiRequestError && err.status === 404) setProblem('missing');
        else setProblem('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (problem) {
    return (
      <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
        <AppBar title="Aksi" />
        <EmptyState
          illustration="no-results"
          title={t(problem === 'revoked' ? 'inviteRevokedTitle' : 'inviteMissingTitle')}
          message={t(problem === 'revoked' ? 'inviteRevoked' : problem === 'missing' ? 'inviteMissing' : 'authGenericError')}
          action={
            <Button variant="outline" onPress={onLogIn}>
              <ButtonText>{t('authLogIn')}</ButtonText>
            </Button>
          }
        />
      </SafeAreaView>
    );
  }

  if (!preview) {
    return (
      <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
        <Loading fullScreen />
      </SafeAreaView>
    );
  }

  const { club, session } = preview;
  const clubRow = (
    <ClubCard
      variant="row"
      name={club.name}
      subline={[
        club.cityName ? shortCityName(club.cityName) : null,
        t(club.visibility === 'private' ? 'clubPrivateBadge' : 'clubPublicBadge'),
        t('clubMemberCount', club.memberCount),
      ]
        .filter(Boolean)
        .join(' · ')}
    />
  );

  const ended = session && (session.lifecycleStatus === 'completed' || session.lifecycleStatus === 'cancelled');
  const spotsLeft = session?.maxParticipants != null ? Math.max(0, session.maxParticipants - session.joinedCount) : undefined;
  const priceText = session
    ? session.priceModel === 'per_person' && session.pricePerPerson != null
      ? formatIDR(session.pricePerPerson)
      : priceLabel(session, t)
    : undefined;
  // An ended Session's link offers the Community instead (DP-028).
  const joinLabel = session && !ended ? t('sessionRequestToJoin') : t('joinCommunity');
  const fact = session && !ended && priceText ? { label: spotsLeft != null ? t('sessionSpotsLeft', spotsLeft) : '', value: priceText } : undefined;

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <AppBar
        title={session ? session.name || session.sport : club.name}
        context={session ? [formatSessionWhen(session, lang, t('sessionSectionToday')), club.name].filter(Boolean).join(' · ') : undefined}
      />
      <InvitedLine
        name={preview.inviterName}
        text={session ? t('inviteInvitedYouToSession', '\u0000') : t('inviteInvitedYou', '\u0000')}
      />
      <ScrollView contentContainerClassName="px-5 pt-4 pb-6">
        {session ? (
          <DetailsTab
            session={session}
            communityRow={clubRow}
            recurringSchedule={null}
            minLevel={preview.skillLevelMin}
            maxLevel={preview.skillLevelMax}
            hasLevelRequirement={Boolean(preview.skillLevelMin || preview.skillLevelMax)}
            organizerName={preview.organizerName || t('sessionHostLabel')}
            isMeOrganizer={false}
            dateText={formatSessionWhen(session, lang, t('sessionSectionToday'))}
            isOwnerOrAdmin={false}
            busy={false}
            myParticipation={null}
            onOpenPlayers={onSignUp}
            onPublish={() => {}}
            onDiscard={() => {}}
          />
        ) : (
          <View className="gap-4">
            {clubRow}
            {club.description ? <Typography color="muted">{club.description}</Typography> : null}
          </View>
        )}
      </ScrollView>
      <View className="flex-row justify-center gap-1 py-3">
        <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('authHaveAccount')}</Text>
        <Pressable onPress={onLogIn} accessibilityRole="link" className="active:opacity-60">
          <Text className="text-sm font-sans-bold text-heat-strong dark:text-heat-strong-dark">{t('authLogInLink')}</Text>
        </Pressable>
      </View>
      <ActionBar fact={fact}>
        <Button size="lg" onPress={onSignUp}>
          <ButtonText>{joinLabel}</ButtonText>
        </Button>
      </ActionBar>
    </SafeAreaView>
  );
}
