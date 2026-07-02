import React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, type ViewProps } from 'react-native';
import { useColorScheme } from 'nativewind';

type InputProps = ViewProps & { className?: string; variant?: 'outline' | 'rounded'; size?: 'sm' | 'md' | 'lg' | 'xl' };

export function Input({ className = '', variant = 'outline', style, ...props }: InputProps) {
  const varClass = variant === 'rounded'
    ? 'rounded-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800'
    : 'rounded-2xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800';
  return (
    <View
      className={`${varClass} ${className}`}
      // overflow:visible stops borderRadius from acting as a clip mask on native
      style={[s.wrapper, style]}
      {...props}
    />
  );
}

type InputFieldProps = TextInputProps & { className?: string };

export const InputField = React.forwardRef<TextInput, InputFieldProps>(
  function InputField({ className = '', style, ...props }, ref) {
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
  }
);

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
