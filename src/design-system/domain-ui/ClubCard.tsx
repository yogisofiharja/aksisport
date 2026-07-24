import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { VStack } from '../layout/VStack';

/**
 * Matches ClubListScreen's existing club row (name + role label, pressable).
 * DOMAIN_UI.md: renders only, never fetches or navigates — `onPress` is a
 * plain callback, the screen decides what happens.
 *
 * Typography here uses `className` overrides on top of `variant="body"`,
 * not `title`/`label` — checked against the literal migration source
 * during Phase 6: the original name is `text-lg font-bold` (18px/700), not
 * `title`'s `text-2xl font-black` (24px/900); the subtitle is
 * `text-sm text-slate-400` (regular weight), not `label`'s
 * `text-sm font-bold`. An earlier version of this component used those
 * variants directly, based on what sounded semantically right rather than
 * a check against the actual classes — caught here, before this component
 * was used in a real screen for the first time.
 */

type ClubCardProps = {
  name: string;
  subtitle?: string; // role label, e.g. "Owner" / "Admin" / "Member"
  onPress?: () => void;
  className?: string;
};

export function ClubCard({ name, subtitle, onPress, className = '' }: ClubCardProps) {
  return (
    <Card pressable={Boolean(onPress)} onPress={onPress} className={className}>
      <VStack space="xs">
        <Typography variant="body" color="default" className="text-lg font-bold" numberOfLines={1}>
          {name}
        </Typography>
        {subtitle && (
          <Typography variant="body" color="muted" className="text-sm">
            {subtitle}
          </Typography>
        )}
      </VStack>
    </Card>
  );
}
