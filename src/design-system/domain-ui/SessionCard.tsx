import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Typography } from '../ui/Typography';
import { HStack } from '../layout/HStack';
import { VStack } from '../layout/VStack';

/**
 * Matches SessionListScreen's existing session row (title, optional
 * location, status pill). The status pill stays a neutral
 * `Badge action="muted"` regardless of status value — the app doesn't
 * currently color-code by status (open/in_progress/completed all render
 * identically today), so this doesn't invent new visual semantics.
 *
 * Typography uses `className` overrides on `variant="body"`, not
 * `title`/`label` — same bug as ClubCard had, same fix, caught in the same
 * pass: the original title is `text-lg font-bold` (18px/700), not
 * `title`'s `text-2xl font-black`; the subtitle is `text-sm text-slate-400`
 * (regular weight), not `label`'s `text-sm font-bold`.
 */

type SessionCardProps = {
  title: string;
  subtitle?: string; // location
  status?: string;
  onPress?: () => void;
  className?: string;
};

export function SessionCard({ title, subtitle, status, onPress, className = '' }: SessionCardProps) {
  return (
    <Card pressable={Boolean(onPress)} onPress={onPress} className={className}>
      <HStack className="justify-between items-center" space="md">
        <VStack space="xs" style={{ flex: 1 }}>
          <Typography variant="body" color="default" className="text-lg font-bold" numberOfLines={1}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body" color="muted" className="text-sm">
              {subtitle}
            </Typography>
          )}
        </VStack>
        {status && <Badge action="muted" text={status} />}
      </HStack>
    </Card>
  );
}
