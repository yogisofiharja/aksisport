import { createContext, useContext, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { color } from '../foundation/colors';
import { useColorScheme } from 'nativewind';
import { withFontFamily } from './fontClass';

/**
 * Aksi Sport Button (design system › Button):
 * - solid primary: the one main action on a screen — `heat` fill with an
 *   ink (`on-heat`) label, never white (white on heat is 3.6:1).
 * - solid secondary: a strong second action, often organizer-only —
 *   `asphalt` fill.
 * - outline: neutral actions (Share, Edit) — `border-strong` outline, ink
 *   label; with action="negative", a danger outline for destructive entry
 *   points.
 * - ghost: low-weight actions — `heat-strong` text.
 * - solid negative: the confirm inside a destructive Dialog.
 *
 * Heights 32 (sm, inside cards only) / 44 (md, default) / 52 (lg, xl:
 * sticky bottom CTA).
 *
 * ButtonText reads its Button's variant, action and size from context, so
 * `<Button variant="outline"><ButtonText>Edit</ButtonText></Button>` gets
 * the right label colour without repeating the props. Explicit props on
 * ButtonText still win.
 *
 * Icons are passed as elements, not name strings — COMPONENT_STANDARDS.md:
 * `<Button leftIcon={<Icon name="plus" />} />`, not a built-in icon prop.
 */

type Variant = 'solid' | 'outline' | 'ghost';
type Action = 'primary' | 'secondary' | 'negative';
type Size = 'sm' | 'md' | 'lg' | 'xl';

type ButtonProps = PressableProps & {
  className?: string;
  variant?: Variant;
  action?: Action;
  size?: Size;
  isDisabled?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
};

const ButtonContext = createContext<{ variant: Variant; action: Action; size: Size }>({
  variant: 'solid',
  action: 'primary',
  size: 'md',
});

const baseClass = 'rounded-lg items-center justify-center flex-row gap-2';

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3',
  md: 'h-11 px-4',
  lg: 'h-[52px] px-5',
  xl: 'h-[52px] px-5',
};

const variantClasses: Record<Variant, Record<Action, string>> = {
  solid: {
    primary: 'bg-heat active:bg-heat-strong',
    secondary: 'bg-asphalt dark:bg-asphalt-dark active:opacity-80',
    negative: 'bg-danger dark:bg-danger-dark active:opacity-80',
  },
  outline: {
    primary: 'border border-border-strong dark:border-border-strong-dark active:bg-surface-sunken dark:active:bg-surface-sunken-dark',
    secondary: 'border border-border-strong dark:border-border-strong-dark active:bg-surface-sunken dark:active:bg-surface-sunken-dark',
    negative: 'border border-danger dark:border-danger-dark active:bg-danger-tint dark:active:bg-danger-tint-dark',
  },
  ghost: {
    primary: 'active:opacity-60',
    secondary: 'active:opacity-60',
    negative: 'active:opacity-60',
  },
};

const labelClasses: Record<Variant, Record<Action, string>> = {
  solid: {
    primary: 'text-on-heat',
    secondary: 'text-on-asphalt',
    negative: 'text-on-asphalt dark:text-on-heat',
  },
  outline: {
    primary: 'text-ink dark:text-ink-dark',
    secondary: 'text-ink dark:text-ink-dark',
    negative: 'text-danger dark:text-danger-dark',
  },
  ghost: {
    primary: 'text-heat-strong dark:text-heat-strong-dark',
    secondary: 'text-heat-strong dark:text-heat-strong-dark',
    negative: 'text-danger dark:text-danger-dark',
  },
};

const labelSize: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-[15px]',
  lg: 'text-base',
  xl: 'text-base',
};

// The spinner takes a colour value, not a class: the same tokens as the label.
function spinnerColor(variant: Variant, action: Action, mode: 'light' | 'dark'): string {
  if (variant === 'solid') {
    if (action === 'primary') return color.onHeat[mode];
    if (action === 'secondary') return color.onAsphalt[mode];
    return mode === 'dark' ? color.onHeat[mode] : color.onAsphalt[mode];
  }
  if (action === 'negative') return color.danger[mode];
  return variant === 'ghost' ? color.heatStrong[mode] : color.ink[mode];
}

export function Button({
  className = '',
  variant = 'solid',
  action = 'primary',
  size = 'md',
  isDisabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  children,
  ...props
}: ButtonProps) {
  const { colorScheme } = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  // `disabled` (React Native's own prop) and `isDisabled` both disable and
  // fade the button.
  const disabled = isDisabled || loading || !!props.disabled;

  return (
    <ButtonContext.Provider value={{ variant, action, size }}>
      <Pressable
        className={`${baseClass} ${variantClasses[variant][action]} ${sizeClasses[size]} ${disabled ? 'opacity-40' : ''} ${className}`}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: loading }}
        {...props}
      >
        {loading ? (
          <ActivityIndicator color={spinnerColor(variant, action, mode)} />
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </Pressable>
    </ButtonContext.Provider>
  );
}

type ButtonTextProps = { className?: string; children?: ReactNode; variant?: Variant; action?: Action };

export function ButtonText({ className = '', variant, action, children }: ButtonTextProps) {
  const button = useContext(ButtonContext);
  const v = variant ?? button.variant;
  const a = action ?? button.action;
  return (
    <Text className={withFontFamily(`font-sans-semibold ${labelSize[button.size]} ${labelClasses[v][a]} ${className}`)}>
      {children}
    </Text>
  );
}
