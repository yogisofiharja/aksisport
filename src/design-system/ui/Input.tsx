import { createContext, forwardRef, useContext, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, type ViewProps } from 'react-native';
import { useColorScheme } from 'nativewind';
import { color } from '../foundation/colors';

/**
 * Text input (Aksi Sport › Input): a 48px control with a `border-strong`
 * outline and 8px corners. Focus turns the outline `heat`; `isInvalid`
 * turns it `danger` (the screen shows the hint below). Text is 16px: on
 * the web build, iOS Safari zooms into anything smaller.
 *
 * `<Input>` is the box, `<InputField>` the text field inside it (with
 * optional `<InputSlot>`s for an icon or a prefix such as `Rp`); the box
 * reads the field's focus through context.
 *
 * The field's height is fixed, not derived from padding: a content-derived
 * height shifted when the first letter was typed and clipped descenders.
 * Multiline fields (Notes) are a fixed 90px and scroll inside.
 */

type InputProps = ViewProps & {
  className?: string;
  variant?: 'outline' | 'rounded';
  /** @deprecated Every input is 48px now; kept so callers compile. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isInvalid?: boolean;
};

const FocusContext = createContext<(focused: boolean) => void>(() => {});

export function Input({ className = '', variant = 'outline', isInvalid = false, size: _size, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const radiusClass = variant === 'rounded' ? 'rounded-full' : 'rounded-lg';
  const borderClass = isInvalid
    ? 'border border-danger dark:border-danger-dark'
    : focused
      ? 'border border-heat'
      : 'border border-border-strong dark:border-border-strong-dark';
  return (
    <FocusContext.Provider value={setFocused}>
      <View
        className={`flex-row ${radiusClass} ${borderClass} bg-surface dark:bg-surface-dark ${className}`}
        // overflow:visible stops borderRadius from acting as a clip mask on native
        style={[s.wrapper, style]}
        {...props}
      />
    </FocusContext.Provider>
  );
}

type InputFieldProps = TextInputProps & { className?: string };

export const InputField = forwardRef<TextInput, InputFieldProps>(function InputField(
  { className = '', style, multiline, onFocus, onBlur, ...props },
  ref
) {
  const { colorScheme } = useColorScheme();
  const setFocused = useContext(FocusContext);
  return (
    <TextInput
      ref={ref}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      // Colour/weight only — sizing lives in the StyleSheet below.
      className={`flex-1 text-ink dark:text-ink-dark font-sans ${className}`}
      style={[multiline ? s.fieldMultiline : s.field, style]}
      placeholderTextColor={color.inkMuted[colorScheme === 'dark' ? 'dark' : 'light']}
      // Android draws its own focused underline under an unstyled
      // TextInput; the box already has a border.
      underlineColorAndroid="transparent"
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
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
  // 46 + the 1px border on each side = 48.
  field: {
    paddingHorizontal: 14,
    fontSize: 16,
    height: 46,
  },
  fieldMultiline: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    height: 90,
  },
});
