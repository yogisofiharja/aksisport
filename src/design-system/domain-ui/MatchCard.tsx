import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from '../../i18n';
import { Icon } from '../ui/Icon';
import { Typography } from '../ui/Typography';

/**
 * A match in a Session's queue (Aksi redesign › MatchCard). Live is the
 * only dark one.
 *
 * - queued: a surface row with the queue number, the matchup and
 *   "Court 2 · queued". `action` holds Start match.
 * - queued + `isMine`: the viewer's own match — 2px heat border, a
 *   "YOUR MATCH · COURT 2" eyebrow in heat-strong and the matchup in Saira.
 * - live: an asphalt card (radius 20) with a "COURT 1 · RACE TO 4" eyebrow
 *   and `action` (Watch, see MatchWatchLink) on the right; then one row per
 *   side: a ball dot on the server, games in a 30×36 box, points in a 44×44
 *   box, the leading side's points in heat. Without `sides` (no live score
 *   loaded) it shows the matchup instead.
 * - completed: a surface row with a "COURT 1 · 07:42" eyebrow and one line
 *   per side with its score, the winner in 700 ink and the other side in
 *   500 ink-muted; a 44px Share button behind a divider on the right
 *   (DP-026).
 *
 * `statusLabel` is what follows the court: "Queued", "Race to 4", "07:42".
 * `action` is a composed element: which button shows, and what it does, is
 * Session logic for the screen (DOMAIN_UI.md).
 */

type MatchStatus = 'queued' | 'live' | 'completed';

export type MatchSide = {
  names: string; // "Budi / Andi"
  games?: number | string;
  points?: number | string; // "30", "AD", or a tiebreak count
  serving?: boolean;
  winner?: boolean;
};

type MatchCardProps = {
  matchup: string; // e.g. "Alice / Bob vs Carol / Dan"
  status: MatchStatus;
  statusLabel: string;
  action?: ReactNode;
  court?: number;
  queueNumber?: number;
  isMine?: boolean;
  /** A name to set in bold inside a queued row's matchup (the viewer's). */
  emphasis?: string;
  sides?: MatchSide[];
  onShare?: () => void;
  onPress?: () => void;
  className?: string;
};

const POINT_ORDER = ['0', '15', '30', '40', 'AD'];

function pointRank(points: MatchSide['points']): number | undefined {
  if (points == null) return undefined;
  const s = String(points).toUpperCase();
  const i = POINT_ORDER.indexOf(s);
  if (i >= 0) return i;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// The side ahead on points in the current game, or -1 when level.
function leadingSide(sides: MatchSide[]): number {
  const [a, b] = sides.map((s) => pointRank(s.points));
  if (a == null || b == null || a === b) return -1;
  return a > b ? 0 : 1;
}

const tabular = { fontVariant: ['tabular-nums' as const] };

export function MatchCard({
  matchup,
  status,
  statusLabel,
  action,
  court,
  queueNumber,
  isMine = false,
  emphasis,
  sides,
  onShare,
  onPress,
  className = '',
}: MatchCardProps) {
  const { t } = useTranslation();
  const courtLabel = court != null ? t('cardCourt', court) : undefined;
  const pair = sides && sides.length === 2 ? sides : undefined;
  const pressProps = {
    onPress,
    disabled: !onPress,
    accessibilityRole: onPress ? ('button' as const) : undefined,
  };

  if (status === 'live') {
    const lead = pair ? leadingSide(pair) : -1;
    return (
      <Pressable {...pressProps} className={`bg-asphalt dark:bg-asphalt-dark rounded-[20px] p-4 gap-3 ${className}`}>
        <View className="flex-row items-center justify-between gap-2">
          <Typography variant="overline" className="text-on-asphalt opacity-80 flex-shrink" numberOfLines={1}>
            {[courtLabel, statusLabel].filter(Boolean).join(' · ')}
          </Typography>
          {action}
        </View>
        {pair ? (
          pair.map((side, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <View className="flex-1 flex-row items-center gap-2 min-w-0">
                <View
                  className={`w-2.5 h-2.5 rounded-full ${side.serving ? 'bg-ball' : ''}`}
                  accessible={side.serving}
                  accessibilityLabel={side.serving ? t('cardServing') : undefined}
                />
                <Typography variant="body" className="text-on-asphalt font-semibold flex-shrink" numberOfLines={1}>
                  {side.names}
                </Typography>
              </View>
              <View className="w-[30px] h-9 rounded items-center justify-center bg-on-asphalt/10">
                <Text className="font-display text-lg text-on-asphalt" style={tabular}>
                  {side.games ?? 0}
                </Text>
              </View>
              <View className={`w-11 h-11 rounded items-center justify-center ${lead === i ? 'bg-heat' : 'bg-on-asphalt/10'}`}>
                <Text className={`font-display text-[22px] ${lead === i ? 'text-on-heat' : 'text-on-asphalt'}`} style={tabular}>
                  {side.points ?? 0}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Typography variant="body" className="text-on-asphalt font-semibold">
            {matchup}
          </Typography>
        )}
      </Pressable>
    );
  }

  const frame = `bg-surface dark:bg-surface-dark rounded-xl ${
    isMine && status === 'queued' ? 'border-2 border-heat' : 'border border-border dark:border-border-dark'
  } ${onPress ? 'active:opacity-70' : ''}`;

  if (status === 'completed') {
    return (
      <Pressable {...pressProps} className={`flex-row items-center gap-3 px-3.5 py-3 ${frame} ${className}`}>
        <View className="flex-1 min-w-0">
          <Typography variant="overline" color="muted" className="mb-0.5" numberOfLines={1}>
            {[courtLabel, statusLabel].filter(Boolean).join(' · ')}
          </Typography>
          {pair ? (
            pair.map((side, i) => (
              <View key={i} className="flex-row items-center justify-between gap-2">
                <Typography
                  variant="body"
                  className={`flex-shrink ${side.winner ? 'font-bold' : 'font-medium text-ink-muted dark:text-ink-muted-dark'}`}
                  numberOfLines={1}
                  accessibilityLabel={side.winner ? `${side.names}, ${t('cardWinner')}` : undefined}
                >
                  {side.names}
                </Typography>
                {side.games != null ? (
                  <Text
                    className={`font-display text-lg leading-[22px] ${
                      side.winner ? 'text-ink dark:text-ink-dark' : 'text-ink-muted dark:text-ink-muted-dark'
                    }`}
                    style={tabular}
                  >
                    {side.games}
                  </Text>
                ) : null}
              </View>
            ))
          ) : (
            <Typography variant="body" className="font-semibold" numberOfLines={2}>
              {matchup}
            </Typography>
          )}
        </View>
        {onShare ? (
          <Pressable
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel={t('share')}
            className="w-11 h-11 items-center justify-center border-l border-border dark:border-border-dark active:opacity-70"
          >
            <Icon name="share-outline" size="md" />
          </Pressable>
        ) : null}
        {action}
      </Pressable>
    );
  }

  // queued
  if (isMine) {
    const [a, b] = pair ? [pair[0].names, pair[1].names] : [matchup, undefined];
    return (
      <Pressable {...pressProps} className={`px-4 py-3.5 gap-2.5 ${frame} ${className}`}>
        <View className="flex-row items-center justify-between gap-2">
          <Typography variant="overline" color="brand" numberOfLines={1} className="flex-shrink">
            {[t('cardYourMatch'), courtLabel].filter(Boolean).join(' · ')}
          </Typography>
          {action}
        </View>
        <Text className="font-display text-lg leading-6 text-ink dark:text-ink-dark">
          {a}
          {b ? (
            <>
              <Text className="font-sans-semibold text-ink-muted dark:text-ink-muted-dark">{` ${t('activityVersus')} `}</Text>
              {b}
            </>
          ) : null}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable {...pressProps} className={`flex-row items-center gap-3 px-3.5 py-3 ${frame} ${className}`}>
      {queueNumber != null ? (
        <Text className="font-display text-sm w-[18px] text-ink-muted dark:text-ink-muted-dark" style={tabular}>
          {queueNumber}
        </Text>
      ) : null}
      <View className="flex-1 min-w-0">
        <Typography variant="body" className="font-semibold" numberOfLines={2}>
          {withEmphasis(pair ? `${pair[0].names} ${t('activityVersus')} ${pair[1].names}` : matchup, emphasis)}
        </Typography>
        <Typography variant="body" color="muted" className="text-[13px] leading-[18px]" numberOfLines={1}>
          {[courtLabel, statusLabel].filter(Boolean).join(' · ')}
        </Typography>
      </View>
      {action}
    </Pressable>
  );
}

// Sets each occurrence of `emphasis` in bold, the rest as is.
function withEmphasis(text: string, emphasis?: string): ReactNode {
  if (!emphasis || !text.includes(emphasis)) return text;
  return text.split(emphasis).flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <Text key={i} className="font-sans-bold">
            {emphasis}
          </Text>,
          part,
        ]
  );
}

/** The Watch / Resume link on a live MatchCard: heat on asphalt. */
export function MatchWatchLink({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={12} className="active:opacity-70">
      <Text className="text-[13px] font-sans-bold text-heat-on-asphalt">{label}</Text>
    </Pressable>
  );
}
