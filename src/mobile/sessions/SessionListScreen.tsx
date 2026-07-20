import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { listSessions } from '../../core/sessions/api';
import type { Session } from '../../core/api/types';

type Props = {
  clubId: string;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
  onCreateSession: () => void;
};

function statusLabel(status: Session['status'], t: (key: string) => string) {
  if (status === 'in_progress') return t('sessionStatusInProgress');
  if (status === 'completed') return t('sessionStatusCompleted');
  return t('sessionStatusOpen');
}

export function SessionListScreen({ clubId, onBack, onOpenSession, onCreateSession }: Props) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setSessions(await listSessions(clubId));
    } catch {
      // keep stale list; user can pull to refresh
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <ScrollView
        contentContainerClassName="px-5 pt-4 pb-6 gap-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} />
        </Pressable>

        <Heading size="2xl">{t('sessionListTitle')}</Heading>

        {loading && sessions.length === 0 ? (
          <Box className="items-center py-10">
            <ActivityIndicator size="large" />
          </Box>
        ) : sessions.length === 0 ? (
          <Text className="text-slate-500 dark:text-slate-400">{t('sessionEmptyState')}</Text>
        ) : (
          <VStack className="gap-3">
            {sessions.map((session) => (
              <Pressable
                key={session.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 active:opacity-70"
                onPress={() => onOpenSession(session.id)}
              >
                <HStack className="justify-between items-center">
                  <VStack className="gap-1 flex-1">
                    <Text className="text-lg font-bold text-slate-900 dark:text-white">
                      {session.name || session.sport}
                    </Text>
                    {session.location && <Text className="text-sm text-slate-400">{session.location}</Text>}
                  </VStack>
                  <Box className="bg-slate-100 dark:bg-slate-700 rounded-full px-3 py-1">
                    <Text className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {statusLabel(session.status, t)}
                    </Text>
                  </Box>
                </HStack>
              </Pressable>
            ))}
          </VStack>
        )}

        <Button action="secondary" size="xl" className="w-full rounded-2xl bg-blue-600" onPress={onCreateSession}>
          <ButtonText className="text-white text-lg">{t('sessionCreate')}</ButtonText>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
