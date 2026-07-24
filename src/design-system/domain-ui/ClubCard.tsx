import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { VStack } from '../layout/VStack';

/**
 * Matches ClubListScreen's existing club row exactly (name + role label,
 * pressable). DOMAIN_UI.md: renders only, never fetches or navigates —
 * `onPress` is a plain callback, the screen decides what happens.
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
        <Typography variant="title" numberOfLines={1}>
          {name}
        </Typography>
        {subtitle && (
          <Typography variant="label" color="muted">
            {subtitle}
          </Typography>
        )}
      </VStack>
    </Card>
  );
}
