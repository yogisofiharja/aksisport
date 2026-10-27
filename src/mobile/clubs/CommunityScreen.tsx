import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TabBarView } from '../../design-system/layout/TabBar';
import { Icon } from '../../design-system/ui/Icon';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { listJoinRequests, listMembers } from '../../core/clubs/api';
import { getClubChat } from '../../core/messages/groups';
import { useLiveEvents } from '../../core/live/live';
import { CommunityHomeTab } from './CommunityHomeTab';
import { ClubChatScreen } from './ClubChatScreen';
import { CommunityMembersTab } from './CommunityMembersTab';
import { CommunitySessionsTab } from './CommunitySessionsTab';

export type CommunityTab = 'home' | 'sessions' | 'chat' | 'members';
export type SessionsView = 'upcoming' | 'past' | 'drafts';

export type CommunityScreenProps = {
  clubId: string;
  initialTab?: CommunityTab;
  initialSessionsView?: SessionsView;
  /** Back from any tab: out of the Community, to the main Home. */
  onExit: () => void;
  /** Back from a non-member's preview or a missing Community: where they came from. */
  onBack: () => void;
  /** The tab changed (the route remembers it, so a reload lands there). */
  onTabChange?: (tab: CommunityTab) => void;
  onOpenSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onOpenRecurringSchedules: () => void;
  onOpenClubSettings: () => void;
  onOpenReports: () => void;
  /** After the caller has left this Community. */
  onLeft: () => void;
};

const ICONS: Record<CommunityTab, 'home-outline' | 'calendar-outline' | 'chatbubble-outline' | 'people-outline'> = {
  home: 'home-outline',
  sessions: 'calendar-outline',
  chat: 'chatbubble-outline',
  members: 'people-outline',
};

// A Community for its members (IA v1.1.0 › Community Navigation): four
// tabs, Home · Sessions · Chat · Members, the same for every role;
// organizer-only actions appear inside them. The tabs live in this one
// screen rather than a navigator of their own, so switching tabs never
// builds up history: back from any of them leaves the Community. Settings
// is in Home's ⋯ menu, not a tab.
//
// The tab bar's counts: unread Community chat messages (DP-021), and for
// owners/admins the join requests waiting (DP-017).
export function CommunityScreen(props: CommunityScreenProps) {
  const { clubId, onExit } = props;
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [tab, setTab] = useState<CommunityTab>(props.initialTab ?? 'home');
  const [chatUnread, setChatUnread] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  const loadCounts = useCallback(async () => {
    const members = await listMembers(clubId).catch(() => []);
    const organizer = members.some((m) => m.userId === profile?.id && (m.role === 'owner' || m.role === 'admin'));
    setPendingRequests(organizer ? (await listJoinRequests(clubId).catch(() => [])).length : 0);
    setChatUnread((await getClubChat(clubId).catch(() => ({ unreadCount: 0 }))).unreadCount);
  }, [clubId, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  // A new Community chat message from someone else adds to the count,
  // unless the chat is the tab being read.
  useLiveEvents((e) => {
    if (tab === 'chat') return;
    if (e.type === 'message.created' && e.data?.kind === 'club' && e.data?.clubId === clubId && e.data?.message?.senderId !== profile?.id) {
      setChatUnread((n) => n + 1);
    }
  });

  function select(next: CommunityTab) {
    if (next === tab) return;
    setTab(next);
    props.onTabChange?.(next);
    if (next === 'chat') setChatUnread(0);
    // Leaving a tab where something was read or decided refreshes the counts.
    else loadCounts();
  }

  const labels: Record<CommunityTab, string> = {
    home: t('communityTabHome'),
    sessions: t('communityTabSessions'),
    chat: t('communityTabChat'),
    members: t('communityTabMembers'),
  };
  const badges: Partial<Record<CommunityTab, number>> = { chat: chatUnread, members: pendingRequests };

  // Each tab's screen sits above the tab bar, which pads the bottom inset.
  const edges = ['top', 'left', 'right'] as const;

  return (
    <View className="flex-1 bg-ground dark:bg-ground-dark">
      <View className="flex-1">
        {tab === 'home' && (
          <CommunityHomeTab
            clubId={clubId}
            edges={[...edges]}
            onBack={onExit}
            onOpenMembers={() => select('members')}
            onOpenSession={props.onOpenSession}
            onOpenClubSettings={props.onOpenClubSettings}
            onOpenReports={props.onOpenReports}
            onLeft={props.onLeft}
          />
        )}
        {tab === 'sessions' && (
          <CommunitySessionsTab
            clubId={clubId}
            edges={[...edges]}
            initialView={props.initialSessionsView}
            onBack={onExit}
            onOpenSession={props.onOpenSession}
            onCreateSession={props.onCreateSession}
            onOpenRecurringSchedules={props.onOpenRecurringSchedules}
          />
        )}
        {tab === 'chat' && <ClubChatScreen clubId={clubId} edges={[...edges]} onBack={onExit} />}
        {tab === 'members' && <CommunityMembersTab clubId={clubId} edges={[...edges]} onBack={onExit} onChanged={loadCounts} />}
      </View>
      <TabBarView
        items={(['home', 'sessions', 'chat', 'members'] as const).map((key) => ({
          key,
          label: labels[key],
          focused: tab === key,
          badge: badges[key],
          icon: (focused) => <Icon name={ICONS[key]} color={focused ? 'secondary' : 'muted'} />,
          onPress: () => select(key),
        }))}
      />
    </View>
  );
}
