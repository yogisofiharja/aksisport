import type { ReactNode } from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { Stack } from './Stack';
import { HStack } from './HStack';

/**
 * Groups related information — LAYOUT_SYSTEM.md: "Optional title, optional
 * description, content, optional actions."
 *
 * Deliberately unstyled beyond spacing/typography: no card background,
 * border, or radius. That's Card's job (a Phase 4 UI Component that doesn't
 * exist yet) — LAYOUT_SYSTEM.md is explicit that cards define internal
 * spacing only, and Section sits above that distinction. A future Card can
 * wrap a Section, or vice versa, without this component assuming which.
 *
 * The title styling (uppercase, tracking-wide, muted) matches the app's
 * existing "eyebrow label" pattern, repeated verbatim across ~6 screens
 * today (e.g. SessionDetailScreen's "PARTICIPANTS"/"ACTIVITY QUEUE" labels).
 */

type SectionProps = ViewProps & {
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
};

export function Section({ className = '', title, description, actions, children, ...props }: SectionProps) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <View className={className} {...props}>
      <Stack space="sm">
        {hasHeader && (
          <HStack className="justify-between items-center" space="md">
            <Stack space="xs" style={{ flex: 1 }}>
              {title && (
                <Text className="text-xs font-extrabold text-ink-faint dark:text-ink-faint-dark tracking-widest uppercase">
                  {title}
                </Text>
              )}
              {description && (
                <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{description}</Text>
              )}
            </Stack>
            {actions}
          </HStack>
        )}
        {children}
      </Stack>
    </View>
  );
}
