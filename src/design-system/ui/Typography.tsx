import { Text as RNText, type TextProps } from 'react-native';
import type { TypeRoleToken } from '../foundation/typography';

/**
 * Single component with a `variant` prop, not six separate components —
 * COMPONENT_STANDARDS.md: "Prefer variants instead of duplicate
 * components." (Named `variant`, not `role`, deliberately: React Native's
 * own `TextProps` already defines an accessibility `role` prop — reusing
 * that name would collide with it.)
 *
 * `variant` maps onto foundation/typography.ts's `typeRole` scale,
 * expressed as NativeWind classes (this is a className-context consumer,
 * same reasoning as Page's background — see Page.tsx).
 *
 * `color` covers the four semantic colors with real, evidenced usage across
 * the app: default body text, muted secondary text (the single most
 * repeated raw class pair in the whole codebase), destructive (form
 * errors), and brand (links/emphasis).
 */

const roleClass: Record<TypeRoleToken, string> = {
  display: 'text-4xl font-black',
  heading: 'text-3xl font-black',
  title: 'text-2xl font-black',
  body: 'text-base font-normal',
  label: 'text-sm font-bold',
  caption: 'text-xs font-extrabold tracking-widest uppercase',
};

type TypographyColor = 'default' | 'muted' | 'brand' | 'destructive';

const colorClass: Record<TypographyColor, string> = {
  default: 'text-slate-900 dark:text-slate-50',
  muted: 'text-slate-500 dark:text-slate-400',
  brand: 'text-primary-600',
  destructive: 'text-red-500',
};

type TypographyProps = Omit<TextProps, 'role'> & {
  className?: string;
  variant?: TypeRoleToken;
  color?: TypographyColor;
};

export function Typography({
  className = '',
  variant = 'body',
  color = 'default',
  ...props
}: TypographyProps) {
  return <RNText className={`${roleClass[variant]} ${colorClass[color]} ${className}`} {...props} />;
}
