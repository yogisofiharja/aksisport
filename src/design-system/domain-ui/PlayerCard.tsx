import type { ReactNode } from 'react';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { HStack } from '../layout/HStack';
import { VStack } from '../layout/VStack';

/**
 * The shared shape verified across two real screens: ClubMembersScreen's
 * member row (name, role label, promote/remove links) and
 * SessionDetailScreen's participant row (name, check-in status). Both are
 * `bg-white dark:bg-slate-800 rounded-2xl p-4` cards with a name+subtitle
 * on the left and optional trailing content on the right — identical
 * enough to be one component, not two.
 *
 * Named PlayerCard per ROADMAP.md/MULTI_SPORT_ARCHITECTURE.md's preference
 * for sport-neutral domain naming over "Member"/"Participant".
 *
 * `trailing` is a composed element (badge, action links, or nothing) —
 * which actions are available (promote/remove/leave) is club or session
 * membership logic, not this component's concern.
 */

type PlayerCardProps = {
  name: string;
  subtitle?: string; // role label or check-in status
  trailing?: ReactNode;
  className?: string;
};

export function PlayerCard({ name, subtitle, trailing, className = '' }: PlayerCardProps) {
  return (
    <Card className={className}>
      <HStack className="justify-between items-center" space="md">
        <VStack space="xs" style={{ flex: 1 }}>
          <Typography variant="label" color="default" numberOfLines={1}>
            {name}
          </Typography>
          {subtitle && (
            <Typography variant="body" color="muted" className="text-xs">
              {subtitle}
            </Typography>
          )}
        </VStack>
        {trailing}
      </HStack>
    </Card>
  );
}
