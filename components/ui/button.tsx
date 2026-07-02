import { Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'solid' | 'outline' | 'ghost';
type Action = 'primary' | 'secondary' | 'negative';
type Size = 'sm' | 'md' | 'lg' | 'xl';

type ButtonProps = PressableProps & {
  className?: string;
  variant?: Variant;
  action?: Action;
  size?: Size;
  isDisabled?: boolean;
};

const baseClass = 'rounded-2xl items-center justify-center flex-row';

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

export function Button({
  className = '',
  variant = 'solid',
  action = 'primary',
  size = 'md',
  isDisabled = false,
  children,
  ...props
}: ButtonProps) {
  const varClass = variantClasses[variant][action];
  const sizeClass = sizeClasses[size];
  return (
    <Pressable
      className={`${baseClass} ${varClass} ${sizeClass} ${isDisabled ? 'opacity-40' : ''} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {children}
    </Pressable>
  );
}

type ButtonTextProps = { className?: string; children?: React.ReactNode; variant?: Variant; action?: Action };

export function ButtonText({ className = '', variant = 'solid', action = 'primary', children }: ButtonTextProps) {
  const colorMap: Record<Variant, Record<Action, string>> = {
    solid: { primary: 'text-white', secondary: 'text-white', negative: 'text-white' },
    outline: { primary: 'text-primary-600', secondary: 'text-blue-600', negative: 'text-red-600' },
    ghost: { primary: 'text-primary-600', secondary: 'text-blue-600', negative: 'text-red-600' },
  };
  return (
    <Text className={`font-black text-base ${colorMap[variant][action]} ${className}`}>{children}</Text>
  );
}
