import { Text as RNText, type TextProps } from 'react-native';
import type { TypeRoleToken } from '../foundation/typography';
import { hasTextColor, withFontFamily } from './fontClass';

/**
 * Single component with a `variant` prop, not seven separate components —
 * COMPONENT_STANDARDS.md: "Prefer variants instead of duplicate
 * components." (Named `variant`, not `role`, deliberately: React Native's
 * own `TextProps` already defines an accessibility `role` prop — reusing
 * that name would collide with it.)
 *
 * `variant` maps onto foundation/typography.ts's `typeRole` scale,
 * expressed as NativeWind classes: Saira (`font-display`) for `display`,
 * `heading` and `title`, Plus Jakarta Sans for the rest. `display` is the
 * italic hero line (a celebration, a big number), not a screen title —
 * screen titles are `heading`. `overline` is the uppercase eyebrow above a
 * section.
 */

const roleClass: Record<TypeRoleToken, string> = {
  display: 'text-[48px] leading-[48px] font-display-hero',
  heading: 'text-[30px] leading-[34px] font-display',
  title: 'text-xl leading-[26px] font-display',
  body: 'text-[15px] leading-[22px] font-sans',
  label: 'text-sm font-sans-semibold',
  caption: 'text-xs font-sans-medium',
  overline: 'text-[11px] leading-4 font-sans-bold tracking-[0.9px] uppercase',
};

type TypographyColor = 'default' | 'muted' | 'brand' | 'secondary' | 'destructive';

const colorClass: Record<TypographyColor, string> = {
  default: 'text-ink dark:text-ink-dark',
  muted: 'text-ink-muted dark:text-ink-muted-dark',
  // Brand as text (links, selected labels) is heat-strong: plain heat is
  // too light to read on ground or surface.
  brand: 'text-heat-strong dark:text-heat-strong-dark',
  // Same accent; kept as its own name for existing callers.
  secondary: 'text-heat-strong dark:text-heat-strong-dark',
  destructive: 'text-danger dark:text-danger-dark',
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
  // A text colour in className replaces the `color` prop's classes
  // entirely, so its light value isn't beaten by the default's `dark:` one.
  const colorClasses = hasTextColor(className) ? '' : colorClass[color];
  return <RNText className={withFontFamily(`${roleClass[variant]} ${colorClasses} ${className}`)} {...props} />;
}
