import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

/**
 * Variant/action/size model matches the existing components/ui/button.tsx
 * exactly (already correctly built, per the design-system audit) — same
 * class maps, so this is a promotion, not a redesign. Adds two things that
 * component didn't have: `loading` and icon slots, both explicitly named in
 * the original Design System brief and in UI_REVIEW_CHECKLIST.md
 * ("Supports loading state (if applicable)").
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

const baseClass = 'rounded-2xl items-center justify-center flex-row gap-2';

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2',
  md: 'px-5 py-3',
  lg: 'px-6 py-4',
  xl: 'px-6 py-[18px]',
};

const variantClasses: Record<Variant, Record<Action, string>> = {
  solid: {
    primary: 'bg-primary-600',
    secondary: 'bg-blue-600',
    negative: 'bg-red-600',
  },
  outline: {
    primary: 'border-2 border-primary-600 bg-transparent',
    secondary: 'border-2 border-blue-600 bg-transparent',
    negative: 'border-2 border-red-600 bg-transparent',
  },
  ghost: {
    primary: 'bg-transparent',
    secondary: 'bg-transparent',
    negative: 'bg-transparent',
  },
};

const spinnerColor: Record<Variant, Record<Action, string>> = {
  solid: { primary: '#ffffff', secondary: '#ffffff', negative: '#ffffff' },
  outline: { primary: '#d97706', secondary: '#2563eb', negative: '#dc2626' },
  ghost: { primary: '#d97706', secondary: '#2563eb', negative: '#dc2626' },
};

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
  const varClass = variantClasses[variant][action];
  const sizeClass = sizeClasses[size];
  const disabled = isDisabled || loading;

  return (
    <Pressable
      className={`${baseClass} ${varClass} ${sizeClass} ${disabled ? 'opacity-40' : ''} ${className}`}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor[variant][action]} />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

type ButtonTextProps = { className?: string; children?: ReactNode; variant?: Variant; action?: Action };

export function ButtonText({ className = '', variant = 'solid', action = 'primary', children }: ButtonTextProps) {
  const colorMap: Record<Variant, Record<Action, string>> = {
    solid: { primary: 'text-white', secondary: 'text-white', negative: 'text-white' },
    outline: { primary: 'text-primary-600', secondary: 'text-blue-600', negative: 'text-red-600' },
    ghost: { primary: 'text-primary-600', secondary: 'text-blue-600', negative: 'text-red-600' },
  };
  return <Text className={`font-black text-base ${colorMap[variant][action]} ${className}`}>{children}</Text>;
}
