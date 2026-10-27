import { Pressable, Text, View } from 'react-native';

/**
 * A small whole number changed one step at a time (Aksi Sport › Input):
 * − value + in one outlined 48px box, each button 44×44, the value in
 * Saira. Target games, open days ahead. The ends are disabled at `min`
 * and `max`.
 */

type StepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** What the number is, for screen readers ("Target games"). */
  label: string;
  decreaseLabel?: string;
  increaseLabel?: string;
};

export function Stepper({ value, min, max, onChange, label, decreaseLabel = 'Fewer', increaseLabel = 'More' }: StepperProps) {
  const canDecrease = value > min;
  const canIncrease = value < max;
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment' && canIncrease) onChange(value + 1);
        if (e.nativeEvent.actionName === 'decrement' && canDecrease) onChange(value - 1);
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      className="flex-row items-center rounded-lg border border-border-strong dark:border-border-strong-dark bg-surface dark:bg-surface-dark"
    >
      <StepButton symbol="−" label={decreaseLabel} disabled={!canDecrease} onPress={() => onChange(value - 1)} />
      <Text className="min-w-8 text-center text-xl font-display text-ink dark:text-ink-dark" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <StepButton symbol="+" label={increaseLabel} disabled={!canIncrease} onPress={() => onChange(value + 1)} />
    </View>
  );
}

function StepButton({ symbol, label, disabled, onPress }: { symbol: string; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="w-11 h-11 items-center justify-center active:opacity-60"
      style={disabled ? { opacity: 0.3 } : undefined}
    >
      <Text className="text-[22px] text-ink dark:text-ink-dark">{symbol}</Text>
    </Pressable>
  );
}
