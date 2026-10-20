import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Badge, type BadgeAction } from '../../design-system/ui/Badge';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Chip, CountBadge } from '../../design-system/ui/Chip';
import { Input, InputField } from '../../design-system/ui/Input';
import { Segmented } from '../../design-system/ui/Segmented';
import { Switch } from '../../design-system/ui/Switch';
import { Typography } from '../../design-system/ui/Typography';
import { Dialog } from '../../design-system/feedback/Dialog';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { Illustration, type IllustrationName } from '../../design-system/feedback/Illustration';
import { Progress } from '../../design-system/feedback/Progress';
import { Sheet } from '../../design-system/feedback/Sheet';
import { appAlert, toast } from '../../design-system/feedback/appAlert';
import { ActionBar } from '../../design-system/layout/ActionBar';
import { AppBar } from '../../design-system/layout/AppBar';
import { IconButton } from '../../design-system/ui/IconButton';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { ClubCard } from '../../design-system/domain-ui/ClubCard';
import { RecurringScheduleCard } from '../../design-system/domain-ui/RecurringScheduleCard';
import { PlayerCard } from '../../design-system/domain-ui/PlayerCard';
import { MatchCard, MatchWatchLink } from '../../design-system/domain-ui/MatchCard';

// Development only (registered in MainStack under __DEV__, at
// /dev/components): every design-system component on one page, in the
// current theme, for review and screenshots. Not translated on purpose.

const STATUSES: BadgeAction[] = ['draft', 'recruiting', 'ready', 'full', 'live', 'completed', 'cancelled'];
const LOGO = require('../../../assets/icon.png');
const noop = () => {};

const TAGS: BadgeAction[] = ['success', 'heat', 'error', 'info', 'muted'];
const ART: IllustrationName[] = [
  'no-sessions',
  'no-messages',
  'no-results',
  'no-notifications',
  'offline',
  'success',
  'pending',
  'match-won',
  'no-members',
];

function Caption({ children }: { children: string }) {
  return (
    <Typography variant="caption" color="muted" className="-mb-1">
      {children}
    </Typography>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Typography variant="overline" color="muted">
        {title}
      </Typography>
      {children}
    </View>
  );
}

export function ComponentGalleryScreen({ onBack }: { onBack: () => void }) {
  const { preference, setPreference } = useTheme();
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [filter, setFilter] = useState('all');
  const [segment, setSegment] = useState<'upcoming' | 'past' | 'drafts'>('upcoming');
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 28, paddingBottom: 40 }}>
        <View className="flex-row items-center justify-between">
          <Typography variant="heading">Components</Typography>
          <Button variant="ghost" size="sm" onPress={onBack}>
            <ButtonText>Back</ButtonText>
          </Button>
        </View>
        <Segmented
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'Device' },
          ]}
          value={preference}
          onChange={setPreference}
        />

        <Section title="Status pills">
          <View className="flex-row flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Badge key={s} action={s} text={s[0].toUpperCase() + s.slice(1)} />
            ))}
          </View>
          <View className="flex-row flex-wrap gap-2">
            {TAGS.map((s) => (
              <Badge key={s} action={s} text={s} />
            ))}
          </View>
        </Section>

        <Section title="SessionCard">
          <Caption>In progress</Caption>
          <SessionCard
            title="Sabtu Pagi Doubles"
            dateTime="Today · 07:00–09:00"
            status="Live"
            statusAction="live"
            sport="Tennis"
            activityType="Doubles"
            subtitle="Lapangan Tenis Senayan"
            joinedCount={8}
            maxParticipants={12}
            onPress={noop}
          />
          <Caption>Recruiting · recurring · per person</Caption>
          <SessionCard
            title="Rabu Malam Social"
            dateTime="Wed 22 Oct · 19:00"
            isRecurring
            status="Recruiting"
            statusAction="recruiting"
            sport="Tennis"
            activityType="Doubles"
            subtitle="Senayan"
            priceLabel="Rp 50.000 per person"
            joinedCount={6}
            maxParticipants={12}
            onPress={noop}
          />
          <Caption>Ready · free</Caption>
          <SessionCard
            title="Sabtu Pagi Doubles"
            dateTime="Sat 25 Oct · 07:00"
            isRecurring
            status="Ready"
            statusAction="ready"
            sport="Tennis"
            activityType="Doubles"
            subtitle="Senayan"
            priceLabel="Free"
            joinedCount={8}
            maxParticipants={12}
            onPress={noop}
          />
          <Caption>Full · split bill</Caption>
          <SessionCard
            title="Minggu Sore Singles"
            dateTime="Sun 26 Oct · 16:00"
            status="Full"
            statusAction="full"
            sport="Tennis"
            activityType="Singles"
            subtitle="Senayan"
            priceLabel="Split bill"
            joinedCount={4}
            maxParticipants={4}
            onPress={noop}
          />
          <Caption>No player limit</Caption>
          <SessionCard
            title="Morning drills"
            dateTime="Thu 23 Oct · 06:00"
            status="Recruiting"
            statusAction="recruiting"
            sport="Tennis"
            activityType="Class"
            subtitle="Senayan"
            priceLabel="Free"
            joinedCount={5}
            onPress={noop}
          />
          <Caption>Draft</Caption>
          <SessionCard
            title="Turnamen kecil"
            dateTime="Sat 1 Nov · 07:00"
            status="Draft"
            statusAction="draft"
            sport="Tennis"
            activityType="Doubles"
            subtitle="Senayan"
            priceLabel="Free"
            joinedCount={0}
            maxParticipants={8}
            onPress={noop}
          />
          <Caption>Completed</Caption>
          <SessionCard
            title="Sabtu Pagi Doubles"
            dateTime="Sat 18 Oct · 07:00"
            status="Completed"
            statusAction="completed"
            sport="Tennis"
            activityType="Doubles"
            subtitle="Senayan"
            joinedCount={10}
            maxParticipants={12}
            onPress={noop}
          />
          <Caption>Cancelled</Caption>
          <SessionCard
            title="Rabu Malam Social"
            dateTime="Wed 15 Oct · 19:00"
            status="Cancelled"
            statusAction="cancelled"
            sport="Tennis"
            activityType="Doubles"
            subtitle="Senayan"
            onPress={noop}
          />
        </Section>

        <Section title="ClubCard">
          <Caption>Tile (Home): image, initials</Caption>
          <View className="flex-row gap-2.5">
            <ClubCard variant="tile" name="AKSI" hasAvatar avatarSource={LOGO} roleLabel="Owner" cityName="Jakarta Selatan" onPress={noop} />
            <ClubCard variant="tile" name="Senayan Tennis Club" roleLabel="Member" cityName="Jakarta Pusat" onPress={noop} />
          </View>
          <Caption>Row (Explore): open, requested, joined</Caption>
          <ClubCard name="Senayan Tennis Club" cityName="Jakarta Pusat" memberCount={42} onPress={noop} />
          <ClubCard
            name="Bintaro Tennis"
            cityName="Tangerang Selatan"
            memberCount={18}
            isPrivate
            viewerRequestPending
            onPress={noop}
          />
          <ClubCard name="AKSI" hasAvatar avatarSource={LOGO} cityName="Jakarta Selatan" memberCount={24} viewerRole="owner" onPress={noop} />
        </Section>

        <Section title="RecurringScheduleCard">
          <RecurringScheduleCard title="Sabtu Pagi Doubles" subtitle="Every Sat · 07:00–09:00" statusLabel="Active" isPaused={false} onPress={noop} />
          <RecurringScheduleCard title="Rabu Malam Social" subtitle="Every Wed · 19:00–21:00" statusLabel="Paused" isPaused onPress={noop} />
        </Section>

        <Section title="PlayerCard">
          <Caption>Members tab</Caption>
          <PlayerCard name="Yogi Harja" subtitle="@yogiharja" isOnline trailing={<Chip label="Owner" strong />} />
          <PlayerCard
            name="Dimas Arya"
            subtitle="@dimas"
            trailing={
              <View className="flex-row items-center">
                <Chip label="Admin" className="self-center" />
                <IconButton icon="ellipsis-horizontal" label="More" size="md" onPress={noop} />
              </View>
            }
          />
          <PlayerCard
            name="Rina Sari"
            subtitle="@rinasari · asked to join"
            isOnline
            trailing={
              <Button size="sm">
                <ButtonText>Approve</ButtonText>
              </Button>
            }
          />
          <Caption>Players tab (session)</Caption>
          <PlayerCard name="Yogi Harja" subtitle="Checked in · host" isOnline trailing={<Badge action="ready" text="Paid" caps />} />
          <PlayerCard
            name="Budi Wijaya"
            subtitle="Registered"
            trailing={
              <View className="flex-row items-center">
                <Badge action="draft" text="Awaiting" caps className="self-center" />
                <IconButton icon="ellipsis-horizontal" label="More" size="md" onPress={noop} />
              </View>
            }
          />
          <PlayerCard name="Andre (guest)" subtitle="Guest · checked in" isGuest trailing={<Badge action="ready" text="Paid" caps />} />
        </Section>

        <Section title="MatchCard">
          <Caption>Queued</Caption>
          <MatchCard
            status="queued"
            queueNumber={2}
            court={2}
            matchup="Budi & Sari vs Andi & Tomi"
            statusLabel="queued"
            action={
              <Button size="sm">
                <ButtonText>Start match</ButtonText>
              </Button>
            }
          />
          <Caption>Queued, without a court</Caption>
          <MatchCard status="queued" queueNumber={3} matchup="Dimas & Rani vs Kevin & Lia" statusLabel="Queued" />
          <Caption>Your match</Caption>
          <MatchCard
            status="queued"
            isMine
            court={2}
            matchup="You & Kevin vs Dimas & Rani"
            sides={[{ names: 'You & Kevin' }, { names: 'Dimas & Rani' }]}
            statusLabel="Queued"
          />
          <Caption>Live</Caption>
          <MatchCard
            status="live"
            court={1}
            statusLabel="Race to 4"
            matchup="Budi / Andi vs Sari / Tomi"
            sides={[
              { names: 'Budi / Andi', games: 3, points: 30, serving: true },
              { names: 'Sari / Tomi', games: 2, points: 15 },
            ]}
            action={<MatchWatchLink label="Watch" onPress={noop} />}
          />
          <Caption>Live, no score loaded</Caption>
          <MatchCard
            status="live"
            statusLabel="Race to 4"
            matchup="Budi / Andi vs Sari / Tomi"
            action={<MatchWatchLink label="Watch" onPress={noop} />}
          />
          <Caption>Finished</Caption>
          <MatchCard
            status="completed"
            court={1}
            statusLabel="07:42"
            matchup="Budi / Andi vs Sari / Tomi"
            sides={[
              { names: 'Budi / Andi', games: 4, winner: true },
              { names: 'Sari / Tomi', games: 2 },
            ]}
            onShare={noop}
            onPress={noop}
          />
        </Section>

        <Section title="AppBar">
          <Caption>Root</Caption>
          <View className="rounded-xl overflow-hidden border border-border dark:border-border-dark">
            <AppBar
              variant="root"
              dateLine="Monday 20 Oct"
              title="Hi, Yogi"
              actions={[{ icon: 'notifications-outline', label: 'Notifications', onPress: noop }]}
            />
          </View>
          <Caption>Stack</Caption>
          <View className="rounded-xl overflow-hidden border border-border dark:border-border-dark">
            <AppBar
              title="Sabtu Pagi Doubles"
              context="Senayan Tennis Club"
              onBack={noop}
              actions={[{ icon: 'share-outline', label: 'Share', onPress: noop }]}
              onMore={noop}
            />
          </View>
          <Caption>Stack, large title (community tabs)</Caption>
          <View className="rounded-xl overflow-hidden border border-border dark:border-border-dark">
            <AppBar onBack={noop} onMore={noop} largeTitle="Sessions" />
          </View>
          <Caption>Form</Caption>
          <View className="rounded-xl overflow-hidden border border-border dark:border-border-dark">
            <AppBar variant="form" title="New session" context="Senayan Tennis Club" onClose={noop} />
          </View>
          <Caption>Dark (live scoring)</Caption>
          <View className="rounded-xl overflow-hidden">
            <AppBar tone="dark" title="Court 1" context="Race to 4 · you are umpire" onBack={noop} onMore={noop} />
          </View>
        </Section>

        <Section title="Chips and counts">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {['all', 'tennis', 'padel', 'pickleball'].map((f) => (
              <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} selected={filter === f} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>
          <View className="flex-row items-center gap-3">
            <Chip label="Intermediate" />
            <Chip label="Admin" className="self-center" />
            <CountBadge count={3} />
            <CountBadge count={128} />
            <CountBadge count={12} muted />
          </View>
        </Section>

        <Section title="Segmented">
          <Segmented
            options={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'past', label: 'Past' },
              { value: 'drafts', label: 'Drafts' },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </Section>

        <Section title="Input">
          <Input>
            <InputField placeholder="e.g. Sunday Doubles" />
          </Input>
          <Input isInvalid>
            <InputField defaultValue="ab" />
          </Input>
          <Typography variant="caption" color="destructive">
            Use at least 3 characters.
          </Typography>
        </Section>

        <Section title="Switch">
          <View className="flex-row items-center justify-between">
            <Typography>Session reminders</Typography>
            <Switch value={on} onValueChange={setOn} />
          </View>
          <View className="flex-row items-center justify-between">
            <Typography>Payments</Typography>
            <Switch value={off} onValueChange={setOff} />
          </View>
        </Section>

        <Section title="Buttons">
          <Button size="lg">
            <ButtonText>Join session</ButtonText>
          </Button>
          <View className="flex-row gap-2">
            <Button action="secondary" className="flex-1">
              <ButtonText>Generate</ButtonText>
            </Button>
            <Button variant="outline" className="flex-1">
              <ButtonText>Share</ButtonText>
            </Button>
          </View>
          <View className="flex-row gap-2">
            <Button variant="ghost" className="flex-1">
              <ButtonText>See all</ButtonText>
            </Button>
            <Button variant="outline" action="negative" className="flex-1">
              <ButtonText>Leave</ButtonText>
            </Button>
          </View>
        </Section>

        <Section title="Progress">
          <Progress label="Spots filled" value={6} max={8} />
          <Progress label="Matches played (live)" value={3} max={8} tone="live" />
          <Progress label="Paid" value={4} max={6} tone="success" />
        </Section>

        <Section title="Overlays and toasts">
          <View className="flex-row flex-wrap gap-2">
            <Button variant="outline" size="sm" onPress={() => setDialog(true)}>
              <ButtonText>Dialog</ButtonText>
            </Button>
            <Button variant="outline" size="sm" onPress={() => setSheet(true)}>
              <ButtonText>Sheet</ButtonText>
            </Button>
            <Button variant="outline" size="sm" onPress={() => toast('Message deleted', { action: { label: 'Undo', onPress: () => {} } })}>
              <ButtonText>Toast</ButtonText>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() =>
                appAlert('Add a photo', undefined, [
                  { text: 'Take photo', onPress: () => {} },
                  { text: 'Choose from library', onPress: () => {} },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            >
              <ButtonText>Alert as sheet</ButtonText>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => appAlert('Copy this link to share the community', 'https://app.aksisport.com/c/09bd7307', [{ text: 'OK' }])}
            >
              <ButtonText>Notice</ButtonText>
            </Button>
          </View>
        </Section>

        <Section title="Illustrations">
          <View className="flex-row flex-wrap gap-3">
            {ART.map((name) => (
              <View key={name} className="items-center gap-1 rounded-xl bg-surface dark:bg-surface-dark border border-border dark:border-border-dark p-3">
                <Illustration name={name} width={90} />
                <Typography variant="caption" color="muted">
                  {name}
                </Typography>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Empty state">
          <View className="rounded-xl bg-surface dark:bg-surface-dark border border-border dark:border-border-dark">
            <EmptyState
              illustration="no-sessions"
              title="No sessions yet"
              message="Create the first one and invite your Community."
              action={
                <Button>
                  <ButtonText>Create session</ButtonText>
                </Button>
              }
            />
          </View>
        </Section>
      </ScrollView>

      <ActionBar fact={{ label: 'Per person', value: 'Rp 75.000' }}>
        <Button size="lg">
          <ButtonText>Request to join</ButtonText>
        </Button>
      </ActionBar>

      <Dialog
        visible={dialog}
        title="Cancel this session?"
        description="All 5 players will be notified."
        cancelLabel="Keep session"
        confirmLabel="Cancel session"
        onCancel={() => setDialog(false)}
        onConfirm={() => setDialog(false)}
      />
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Session options" description="Choose what to do with this Session.">
        <Button variant="outline" size="lg" className="w-full" onPress={() => setSheet(false)}>
          <ButtonText>Edit</ButtonText>
        </Button>
        <Button variant="outline" size="lg" className="w-full" onPress={() => setSheet(false)}>
          <ButtonText>Duplicate</ButtonText>
        </Button>
      </Sheet>
    </SafeAreaView>
  );
}
