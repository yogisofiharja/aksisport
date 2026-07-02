import { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { useColorScheme } from 'nativewind';

// Kept for components outside this file that reference palette values directly
export const palette = {
  background: '#0f1021',
  backgroundMuted: '#1a1c33',
  foreground: '#1f2937',
  mutedForeground: '#58657a',
  card: '#ffffff',
  border: '#263054',
  primary: '#d97706',
  primaryText: '#ffffff',
  secondary: '#64748b',
  secondaryText: '#ffffff',
  accent: '#ffd000',
  accentSoft: '#fff5c2',
  destructive: '#c02828',
  destructiveSoft: '#fee2e2',
  success: '#0f9b8e',
};

type CardProps = ViewProps & {
  tone?: 'default' | 'muted' | 'accent';
};

export function Card({ tone = 'default', style, children, ...rest }: CardProps) {
  const toneClass =
    tone === 'accent' ? 'bg-[#fff0d0] border-[#ffd97a]' :
    tone === 'muted'  ? 'bg-[#f3f6ff] border-[#d5def5]' :
                        'bg-white border-[#d5def5]';

  return (
    <View
      className={`rounded-2xl border p-[14px] gap-[10px] ${toneClass}`}
      style={[
        Platform.OS === 'ios' && {
          shadowColor: '#0b0f22',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        },
        Platform.OS === 'android' && { elevation: 2 },
        Platform.OS === 'web' && { boxShadow: '0px 3px 8px rgba(11,15,34,0.06)' } as any,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const variantBgClass: Record<string, string> = {
  default:     'bg-primary border-primary',
  secondary:   'bg-secondary border-secondary',
  outline:     'bg-white border-[#263054]',
  destructive: 'bg-destructive border-destructive',
  ghost:       'bg-transparent border-transparent',
};

const variantTextClass: Record<string, string> = {
  default:     'text-white',
  secondary:   'text-white',
  outline:     'text-foreground',
  destructive: 'text-white',
  ghost:       'text-muted',
};

export function Button({ label, onPress, variant = 'default', size = 'md', disabled, style }: ButtonProps) {
  return (
    <Pressable
      className={[
        'min-h-[42px] px-[14px] rounded-xl border items-center justify-center',
        variantBgClass[variant],
        size === 'sm' ? 'min-h-[36px] px-3' : '',
        size === 'lg' ? 'min-h-[50px] rounded-[14px]' : '',
        disabled ? 'opacity-50' : '',
      ].join(' ')}
      style={({ pressed }) => [
        pressed && !disabled && { opacity: 0.86 },
        style as StyleProp<ViewStyle>,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        className={[
          'text-sm font-extrabold tracking-[0.2px]',
          variantTextClass[variant],
          disabled ? 'text-[#5b6470]' : '',
        ].join(' ')}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type PillProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export function Pill({ label, active, onPress }: PillProps) {
  const containerClass = [
    'px-3 min-h-[36px] rounded-full border items-center justify-center',
    active ? 'border-blue-700 bg-blue-100' : 'border-[#c4d0ee] bg-white',
  ].join(' ');

  const textClass = [
    'text-[13px] font-bold',
    active ? 'text-[#1e40af]' : 'text-foreground',
  ].join(' ');

  if (!onPress) {
    return (
      <View className={containerClass}>
        <Text className={textClass}>{label}</Text>
      </View>
    );
  }

  return (
    <Pressable className={containerClass} onPress={onPress}>
      <Text className={textClass}>{label}</Text>
    </Pressable>
  );
}

type InputProps = TextInputProps & {
  label: string;
};

export function Input({ label, style, ...props }: InputProps) {
  return (
    <View className="gap-[6px]">
      <Text className="text-xs text-muted font-bold uppercase tracking-[0.5px]">
        {label}
      </Text>
      <TextInput
        className="border border-[#c4d0ee] rounded-xl min-h-[44px] bg-white text-foreground px-3 py-[10px] text-[15px] font-medium"
        placeholderTextColor="#8b97a6"
        style={style}
        {...props}
      />
    </View>
  );
}

export function DecorativeBackdrop({ children }: { children: ReactNode }) {
  const { colorScheme } = useColorScheme();
  if (Platform.OS !== 'web') {
    const bg = colorScheme === 'dark' ? '#0f172a' : '#f8fafc';
    return <View style={{ flex: 1, backgroundColor: bg }}>{children}</View>;
  }
  return (
    <View
      className="flex-1 bg-background overflow-hidden"
      style={{ width: '100vw' as any, maxWidth: '100vw' as any }}
    >
      <View className="absolute w-[220px] h-[220px] rounded-full bg-blue-600 opacity-20" style={{ top: -70, left: -50 }} />
      <View className="absolute w-[220px] h-[220px] rounded-full bg-red-600 opacity-[0.18]" style={{ top: 100, right: -90 }} />
      <View className="absolute w-[260px] h-[260px] rounded-full bg-amber-500 opacity-[0.18]" style={{ bottom: -120, left: -70 }} />
      {children}
    </View>
  );
}
