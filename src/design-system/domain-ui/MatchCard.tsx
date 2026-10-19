import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { HStack } from '../layout/HStack';
import { VStack } from '../layout/VStack';

/**
 * Matches SessionDetailScreen's activity queue row exactly (matchup names,
 * live/queued/completed status, trailing action button). Named MatchCard,
 * not ActivityCard — see ROADMAP.md's Phase 5 scope note.
 *
 * `action` is a composed element (the Start/Watch/Resume button), not a
 * label+onPress pair — which button appears, and what it does, is session
 * business logic that belongs in the screen, not in this rendering-only
 * component (DOMAIN_UI.md: must not manage business logic).
 */

type MatchStatus = 'queued' | 'live' | 'completed';

type MatchCardProps = {
  matchup: string; // e.g. "Alice / Bob vs Carol / Dan"
  status: MatchStatus;
  statusLabel: string; // pre-translated label for queued/completed states
  action?: ReactNode;
  className?: string;
};

export function MatchCard({ matchup, status, statusLabel, action, className = '' }: MatchCardProps) {
  return (
    <Card className={className}>
      <HStack className="justify-between items-center" space="md">
        <VStack space="xs" style={{ flex: 1 }}>
          <Typography variant="label" color="default" numberOfLines={1}>
            {matchup}
          </Typography>
          {status === 'live' ? (
            <HStack space="xs">
              <View className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <Typography variant="overline" className="text-red-500">
                LIVE
              </Typography>
            </HStack>
          ) : (
            <Typography variant="body" color="muted" className="text-xs">
              {statusLabel}
            </Typography>
          )}
        </VStack>
        {action}
      </HStack>
    </Card>
  );
}
