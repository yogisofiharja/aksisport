import { Pressable, Text, View } from 'react-native';
import { IconButton } from '../ui/IconButton';

/**
 * One of the viewer's sports (Aksi redesign › Me › My sports): the sport
 * as an overline, the level in Saira, and "23 matches · 14 won · 61%".
 * `featured` (the first sport) is the asphalt card with the wins in ball;
 * the rest are surface cards. Two to a row.
 *
 * Renders only (DOMAIN_UI.md): every string is passed in formatted;
 * `onPress` opens the sport's page, `onEditLevel` adds a pencil.
 */

type SportCardProps = {
  sport: string;
  level: string;
  /** "23 matches" */
  matches?: string;
  /** "14 won" */
  wins?: string;
  /** "61%" */
  winRate?: string;
  featured?: boolean;
  editLabel?: string;
  onEditLevel?: () => void;
  onPress?: () => void;
  className?: string;
};

export function SportCard({ sport, level, matches, wins, winRate, featured = false, editLabel, onEditLevel, onPress, className = '' }: SportCardProps) {
  const frame = featured
    ? 'bg-asphalt dark:bg-asphalt-dark'
    : 'bg-surface dark:bg-surface-dark border border-border dark:border-border-dark';
  const muted = featured ? 'text-ink-muted-dark' : 'text-ink-muted dark:text-ink-muted-dark';
  const ink = featured ? 'text-on-asphalt' : 'text-ink dark:text-ink-dark';
  const won = featured ? 'text-ball' : muted;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={`flex-1 min-w-0 rounded-xl p-3.5 gap-1.5 ${frame} ${onPress ? 'active:opacity-80' : ''} ${className}`}
    >
      <View className="flex-row items-center justify-between">
        <Text className={`text-[11px] leading-4 font-sans-bold tracking-[0.9px] uppercase ${muted}`}>{sport}</Text>
        {onEditLevel ? (
          <IconButton icon="create-outline" label={editLabel ?? level} size="md" onDark={featured} onPress={onEditLevel} className="-my-3 -mr-3" />
        ) : null}
      </View>
      <Text numberOfLines={1} className={`font-display text-2xl leading-[26px] ${ink}`}>
        {level}
      </Text>
      {matches ? (
        <Text className={`text-xs leading-4 font-sans ${muted}`} style={{ fontVariant: ['tabular-nums'] }}>
          {matches}
          {wins ? (
            <>
              {' · '}
              <Text className={won}>{wins}</Text>
            </>
          ) : null}
          {winRate ? ` · ${winRate}` : null}
        </Text>
      ) : null}
    </Pressable>
  );
}
