import { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';

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
  return (
    <View
      style={[
        styles.card,
        tone === 'muted' && styles.cardMuted,
        tone === 'accent' && styles.cardAccent,
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

export function Button({
  label,
  onPress,
  variant = 'default',
  size = 'md',
  disabled,
  style,
}: ButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        buttonVariantStyles[variant],
        size === 'sm' && styles.buttonSm,
        size === 'lg' && styles.buttonLg,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.buttonText, buttonTextStyles[variant], disabled && styles.buttonTextDisabled]}>
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
  if (!onPress) {
    return (
      <View style={[styles.pill, active && styles.pillActive]}>
        <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
      </View>
    );
  }

  return (
    <Pressable style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

type InputProps = TextInputProps & {
  label: string;
};

export function Input({ label, style, ...props }: InputProps) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor="#8b97a6"
        {...props}
      />
    </View>
  );
}

export function DecorativeBackdrop({ children }: { children: ReactNode }) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.blobA} />
      <View style={styles.blobB} />
      <View style={styles.blobC} />
      {children}
    </View>
  );
}

const buttonVariantStyles = StyleSheet.create({
  default: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  secondary: {
    backgroundColor: palette.secondary,
    borderColor: palette.secondary,
  },
  outline: {
    backgroundColor: '#ffffff',
    borderColor: palette.border,
  },
  destructive: {
    backgroundColor: palette.destructive,
    borderColor: palette.destructive,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
});

const buttonTextStyles = StyleSheet.create({
  default: { color: palette.primaryText },
  secondary: { color: palette.secondaryText },
  outline: { color: '#1f2937' },
  destructive: { color: '#ffffff' },
  ghost: { color: palette.mutedForeground },
});

const styles = StyleSheet.create({
  backdrop: Platform.select({
    web: {
      flex: 1,
      backgroundColor: palette.background,
      width: '100vw' as any,
      maxWidth: '100vw' as any,
      overflow: 'hidden' as any,
    },
    default: {
      flex: 1,
      backgroundColor: palette.background,
    },
  }) as any,
  blobA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: '#2563eb',
    opacity: 0.2,
    top: -70,
    left: -50,
  },
  blobB: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: '#dc2626',
    opacity: 0.18,
    top: 100,
    right: -90,
  },
  blobC: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: '#f59e0b',
    opacity: 0.18,
    bottom: -120,
    left: -70,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d5def5',
    padding: 14,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0b0f22',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  cardMuted: {
    backgroundColor: '#f3f6ff',
  },
  cardAccent: {
    backgroundColor: '#fff0d0',
    borderColor: '#ffd97a',
  },
  button: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSm: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  buttonLg: {
    minHeight: 50,
    borderRadius: 14,
  },
  buttonPressed: {
    opacity: 0.86,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  buttonTextDisabled: {
    color: '#5b6470',
  },
  pill: {
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c4d0ee',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#dbeafe',
  },
  pillText: {
    color: palette.foreground,
    fontSize: 13,
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#1e40af',
  },
  inputWrap: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    color: palette.mutedForeground,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#c4d0ee',
    borderRadius: 12,
    minHeight: 44,
    backgroundColor: '#ffffff',
    color: palette.foreground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '500',
  },
});