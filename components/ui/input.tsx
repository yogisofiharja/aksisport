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
  function InputField({ className = '', style, multiline, ...props }, ref) {
    const { colorScheme } = useColorScheme();
    return (
      <TextInput
        ref={ref}
        multiline={multiline}
        // Single-line fields get a fixed height, vertically centering their
        // one line of text — see s.field's comment for why. Multiline
        // (only the Description field today) keeps growing via padding +
        // numberOfLines instead, top-aligned like a real textarea.
        textAlignVertical={multiline ? 'top' : 'center'}
        // Colour/weight only — sizing lives in the StyleSheet below.
        className={`text-gray-900 dark:text-slate-100 font-semibold ${className}`}
        style={[multiline ? s.fieldMultiline : s.field, style]}
        placeholderTextColor={colorScheme === 'dark' ? '#64748b' : '#9ca3af'}
        // Android renders a native Material underline under an unstyled
        // TextInput, colored/prominent specifically while focused — this
        // box already has its own border (Input's wrapper View), so that
        // underline is redundant, and it sat close enough to the text
        // baseline to visually cut through descenders (g/y/j/p/f) on focus.
        underlineColorAndroid="transparent"
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
    fontSize: 16,
    // Fixed height, not content-derived padding/lineHeight — the actual
    // bug: the field's height was shifting between its empty state and
    // its typed state (reported directly: "when the first letter typed,
    // the height of the input decreased, and the letter looks pulled
    // down"), which is what was clipping descenders — not a padding or
    // lineHeight value that was merely too small. A constant height can't
    // shift with content, so there's nothing left to jump. iOS/Android
    // both vertically center a single line of text within an explicit
    // height by default (textAlignVertical="center" above, for Android).
    height: 52,
  },
  // Description is the one multiline caller — grows with content instead
  // of a fixed height, top-aligned like a normal textarea.
  fieldMultiline: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    // Floor matching the caller's numberOfLines={3} intent — without it,
    // the box shrinks to whatever's actually typed (e.g. down to 1 line
    // once real content is shorter than the 2-line placeholder), which
    // reads as the field "jumping" the moment you start typing. A
    // minHeight (not height) still lets it grow past 3 lines for longer
    // text instead of clipping/scrolling.
    minHeight: 90,
  },
});
