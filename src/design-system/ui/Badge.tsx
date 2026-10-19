import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Text, View } from 'react-native';

/**
 * Status pills and tags (Aksi Sport › StatusPill, Chip).
 *
 * Lifecycle statuses carry a dot and follow the StatusPill table: draft
 * (sunken), recruiting (info), ready (success), full (asphalt), live (heat,
 * pulsing dot), completed (outline), cancelled (danger). Heat is reserved
 * for Live, so a screen with one heat pill shows where the action is. The
 * label is always there; colour is never the only signal.
 *
 * The plain tones (success, heat, error, info, muted) are tags without a
 * dot: Joined, Private, Won, In range.
 */

export type LifecycleStatus = 'draft' | 'recruiting' | 'ready' | 'full' | 'live' | 'completed' | 'cancelled';
type Tone = 'success' | 'heat' | 'error' | 'info' | 'muted';
type Action = Tone | LifecycleStatus;

const actionClasses: Record<Action, { bg: string; text: string; dot?: string }> = {
  // Tags
  success: { bg: 'bg-success-tint dark:bg-success-tint-dark', text: 'text-success dark:text-success-dark' },
  // Something to notice (a no-show, out of range): quiet brand. The palette
  // has no warning colour.
  heat: { bg: 'bg-heat-tint dark:bg-heat-tint-dark', text: 'text-heat-strong dark:text-heat-strong-dark' },
  error: { bg: 'bg-danger-tint dark:bg-danger-tint-dark', text: 'text-danger dark:text-danger-dark' },
  info: { bg: 'bg-info-tint dark:bg-info-tint-dark', text: 'text-info dark:text-info-dark' },
  muted: { bg: 'bg-surface-sunken dark:bg-surface-sunken-dark', text: 'text-ink-muted dark:text-ink-muted-dark' },
  // Lifecycle (with a dot)
  draft: {
    bg: 'bg-surface-sunken dark:bg-surface-sunken-dark',
    text: 'text-ink-muted dark:text-ink-muted-dark',
    dot: 'bg-ink-muted dark:bg-ink-muted-dark',
  },
  recruiting: { bg: 'bg-info-tint dark:bg-info-tint-dark', text: 'text-info dark:text-info-dark', dot: 'bg-info dark:bg-info-dark' },
  ready: {
    bg: 'bg-success-tint dark:bg-success-tint-dark',
    text: 'text-success dark:text-success-dark',
    dot: 'bg-success dark:bg-success-dark',
  },
  full: { bg: 'bg-asphalt dark:bg-asphalt-dark', text: 'text-on-asphalt', dot: 'bg-on-asphalt' },
  live: { bg: 'bg-heat', text: 'text-on-heat', dot: 'bg-on-heat' },
  completed: {
    bg: 'border border-border dark:border-border-dark',
    text: 'text-ink-muted dark:text-ink-muted-dark',
    dot: 'bg-ink-faint dark:bg-ink-faint-dark',
  },
  cancelled: {
    bg: 'bg-danger-tint dark:bg-danger-tint-dark',
    text: 'text-danger dark:text-danger-dark',
    dot: 'bg-danger dark:bg-danger-dark',
  },
};

export type BadgeAction = Action;

// The Live dot breathes; it holds still when the person asks for reduced
// motion.
function PulsingDot({ className }: { className: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce || cancelled) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          ])
        );
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);
  // Classes on a plain View inside: Animated.View doesn't take NativeWind classes.
  return (
    <Animated.View style={{ opacity }}>
      <View className={`w-1.5 h-1.5 rounded-full ${className}`} />
    </Animated.View>
  );
}

type BadgeProps = { action?: Action; text: string; className?: string };

export function Badge({ action = 'muted', text, className = '' }: BadgeProps) {
  const { bg, text: textClass, dot } = actionClasses[action];
  return (
    <View className={`${bg} flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${className}`}>
      {dot && (action === 'live' ? <PulsingDot className={dot} /> : <View className={`w-1.5 h-1.5 rounded-full ${dot}`} />)}
      <Text className={`${textClass} text-xs font-sans-bold`}>{text}</Text>
    </View>
  );
}
