import { useCallback, useState } from 'react';
import { Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Card } from '../../design-system/ui/Card';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useTranslation } from '../../i18n';
import { dismissReport, listClubReports, removeReportedMessage } from '../../core/safety/api';
import { PlayerProfileSheet } from '../profiles/PlayerProfileSheet';
import type { ClubReport } from '../../core/api/types';
import { AppBar } from '../../design-system/layout/AppBar';

type Props = {
  clubId: string;
  onBack: () => void;
};

// A Community's open reports, for its owner and admins (DP-021): who
// reported whom, why, and the message as it was. A message posted in one
// of this Community's Sessions can be removed; any report can be
// dismissed. Either takes it off this list.
export function ClubReportsScreen({ clubId, onBack }: Props) {
  const { t, lang } = useTranslation();
  const [reports, setReports] = useState<ClubReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReports(await listClubReports(clubId));
    } catch {
      // stays stale; pull to refresh
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function where(r: ClubReport) {
    const m = r.message;
    if (!m) return t('reportAboutPerson');
    if (m.conversationKind === 'direct') return t('reportInDirectMessage');
    if (m.conversationKind === 'session_contact') return t('reportInContact', m.sessionName ?? '');
    return t('reportInSessionChat', m.sessionName ?? '');
  }

  async function act(r: ClubReport, action: 'remove' | 'dismiss') {
    try {
      if (action === 'remove') await removeReportedMessage(clubId, r.id);
      else await dismissReport(clubId, r.id);
      setReports((prev) => prev.filter((x) => x.id !== r.id));
    } catch {
      appAlert(t('reportActionFailed'));
      load();
    }
  }

  function confirmRemove(r: ClubReport) {
    appAlert(t('reportRemoveConfirmTitle'), t('reportRemoveConfirmBody'), [
      { text: t('clubCancel'), style: 'cancel' },
      { text: t('reportRemoveMessage'), style: 'destructive', onPress: () => act(r, 'remove') },
    ]);
  }

  return (
    <ScrollPage
      gap="lg"
      appBar={<AppBar title={t('clubReportsTitle')} onBack={onBack} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >

      {loading && reports.length === 0 ? (
        <Loading />
      ) : reports.length === 0 ? (
        <EmptyState message={t('clubReportsEmpty')} />
      ) : (
        <VStack space="md">
          {reports.map((r) => {
            const reported = r.reportedDisplayName || r.reportedUsername;
            const reporter = r.reporterDisplayName || r.reporterUsername;
            return (
              <Card key={r.id}>
                <VStack space="sm">
                  <HStack className="justify-between items-baseline" space="sm">
                    <Pressable onPress={() => setProfileUserId(r.reportedUserId)} style={{ flex: 1 }}>
                      <Typography variant="body" className="font-bold" numberOfLines={1}>
                        {reported}
                      </Typography>
                    </Pressable>
                    <Typography variant="body" color="muted" className="text-xs">
                      {new Date(r.createdAt).toLocaleDateString(lang, { day: 'numeric', month: 'short' })}
                    </Typography>
                  </HStack>
                  <Typography variant="body" color="muted" className="text-sm">
                    {where(r)} · {t('reportBy', reporter)}
                  </Typography>
                  {r.message && (
                    <VStack className="rounded-xl bg-surface-sunken dark:bg-surface-sunken-dark px-3 py-2">
                      <Typography variant="body" className={r.message.removed ? 'italic text-ink-muted dark:text-ink-muted-dark' : ''}>
                        {r.message.body || (r.message.hasImage ? t('inboxPhoto') : '')}
                      </Typography>
                      {r.message.removed && (
                        <Typography variant="body" color="muted" className="text-xs">
                          {t('reportAlreadyRemoved')}
                        </Typography>
                      )}
                    </VStack>
                  )}
                  <Typography variant="body">
                    <Typography variant="body" className="font-bold">
                      {t('reportReasonLabel')}{' '}
                    </Typography>
                    {r.reason}
                  </Typography>
                  <HStack space="sm">
                    {r.message?.canRemove && (
                      <Button size="sm" action="negative" className="flex-1" onPress={() => confirmRemove(r)}>
                        <ButtonText action="negative">{t('reportRemoveMessage')}</ButtonText>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="flex-1" onPress={() => act(r, 'dismiss')}>
                      <ButtonText variant="outline">
                        {t('reportDismiss')}
                      </ButtonText>
                    </Button>
                  </HStack>
                </VStack>
              </Card>
            );
          })}
        </VStack>
      )}
      <PlayerProfileSheet userId={profileUserId} onClose={() => setProfileUserId(null)} />
    </ScrollPage>
  );
}
