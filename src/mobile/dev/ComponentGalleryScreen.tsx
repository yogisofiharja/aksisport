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

// Development only (registered in MainStack under __DEV__, at
// /dev/components): every design-system component on one page, in the
// current theme, for review and screenshots. Not translated on purpose.

const STATUSES: BadgeAction[] = ['draft', 'recruiting', 'ready', 'full', 'live', 'completed', 'cancelled'];
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

        <Section title="Chips and counts">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {['all', 'tennis', 'padel', 'pickleball'].map((f) => (
              <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} selected={filter === f} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>
          <View className="flex-row items-center gap-3">
            <Chip label="Intermediate" />
            <Chip label="Admin" />
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
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Session" description="Choose what to do with this Session.">
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
