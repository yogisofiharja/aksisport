import { useRef, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { color } from '../foundation/colors';
import { nextCodeValue } from './codeInputValue';

/**
 * A one-time code as separate digit boxes (Aksi Sport › Input): six 56px
 * boxes with the digit in Saira. Typing moves to the next box, Backspace
 * on an empty box goes back one, and pasting — or the phone's one-time-
 * code autofill, which fills the first box — spreads the digits across
 * every box from there. The focused box is outlined in heat, an invalid
 * code in danger.
 *
 * `value` is the whole code as a string of digits; `onComplete` fires
 * when the last digit lands.
 */

type CodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  isInvalid?: boolean;
  /** "Digit" — each box is read as "Digit 1 of 6". */
  digitLabel?: string;
  autoFocus?: boolean;
};

export function CodeInput({ value, onChange, onComplete, length = 6, isInvalid = false, digitLabel = 'Digit', autoFocus }: CodeInputProps) {
  const { colorScheme } = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const refs = useRef<(TextInput | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  function setFrom(index: number, typed: string) {
    const next = nextCodeValue(value, index, typed, value[index] ?? '', length);
    onChange(next);
    if (next.length <= index) return; // the box was cleared
    refs.current[Math.min(next.length, length - 1)]?.focus();
    if (next.length === length) onComplete?.(next);
  }

  return (
    <View className="flex-row gap-2">
      {digits.map((digit, i) => (
        <TextInput
          key={i}
          ref={(r) => {
            refs.current[i] = r;
          }}
          value={digit}
          onChangeText={(text) => setFrom(i, text)}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Backspace' && !digit && i > 0) {
              onChange(value.slice(0, i - 1));
              refs.current[i - 1]?.focus();
            }
          }}
          onFocus={() => setFocused(i)}
          onBlur={() => setFocused((f) => (f === i ? null : f))}
          autoFocus={autoFocus && i === 0}
          keyboardType="number-pad"
          inputMode="numeric"
          // The first box takes the autofilled code; setFrom spreads it.
          textContentType={i === 0 ? 'oneTimeCode' : 'none'}
          autoComplete={i === 0 ? (Platform.OS === 'android' ? 'sms-otp' : 'one-time-code') : 'off'}
          // Room for a whole pasted code in any box, which is then spread out.
          maxLength={length + 1}
          selectTextOnFocus
          accessibilityLabel={`${digitLabel} ${i + 1}`}
          underlineColorAndroid="transparent"
          className="flex-1 min-w-0 h-14 rounded-lg bg-surface dark:bg-surface-dark text-center text-2xl font-display text-ink dark:text-ink-dark"
          style={{
            borderWidth: focused === i ? 2 : 1,
            borderColor: isInvalid ? color.danger[mode] : focused === i ? color.heat.light : color.borderStrong[mode],
            fontVariant: ['tabular-nums'],
          }}
        />
      ))}
    </View>
  );
}
