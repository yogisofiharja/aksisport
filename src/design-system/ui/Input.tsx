import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, type ViewProps } from 'react-native';
import { useColorScheme } from 'nativewind';

/**
 * Promoted from components/ui/input.tsx (already correctly built — the
 * StyleSheet-based padding is a deliberate fix for descender clipping, not
 * incidental, preserved as-is). Adds `isInvalid`, an opt-in border-color
 * change for validation errors — every form screen already shows an error
 * message below the field, but none visually marks the field itself today.
 * Default `isInvalid={false}` means zero visual change for existing
 * patterns; this only activates where a screen opts in.
 */

type InputProps = ViewProps & {
  className?: string;
  variant?: 'outline' | 'rounded';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isInvalid?: boolean;
};

export function Input({ className = '', variant = 'outline', isInvalid = false, style, ...props }: InputProps) {
  const radiusClass = variant === 'rounded' ? 'rounded-full' : 'rounded-2xl';
  const borderClass = isInvalid
    ? 'border border-red-500'
    : 'border border-gray-200 dark:border-slate-600';
  return (
    <View
      className={`${radiusClass} ${borderClass} bg-white dark:bg-slate-800 ${className}`}
      // overflow:visible stops borderRadius from acting as a clip mask on native
      style={[s.wrapper, style]}
      {...props}
    />
  );
}

type InputFieldProps = TextInputProps & { className?: string };

export const InputField = forwardRef<TextInput, InputFieldProps>(function InputField(
  { className = '', style, ...props },
  ref
) {
  const { colorScheme } = useColorScheme();
  return (
    <TextInput
      ref={ref}
      // Only colour/font classes here — no padding classes so StyleSheet wins
      className={`text-gray-900 dark:text-slate-100 text-base font-semibold ${className}`}
      // StyleSheet-based padding guarantees descenders are not clipped
      style={[s.field, style]}
      placeholderTextColor={colorScheme === 'dark' ? '#64748b' : '#9ca3af'}
      {...props}
    />
  );
});

export function InputSlot({ className = '', ...props }: ViewProps & { className?: string }) {
  return <View className={`px-3 justify-center ${className}`} {...props} />;
}

const s = StyleSheet.create({
  wrapper: {
    overflow: 'visible',
  },
  field: {
    paddingHorizontal: 16,
    paddingTop: 12,
    // Extra bottom padding so descenders (y, g, p, j, q) are never clipped
    paddingBottom: 18,
  },
});
