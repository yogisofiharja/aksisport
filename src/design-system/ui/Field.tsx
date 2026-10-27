import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Typography } from './Typography';
import { Icon } from './Icon';
import { Switch } from './Switch';

/**
 * A form field (Aksi Sport › Input): a 14px/600 label over the control,
 * then one line under it — the hint in ink-muted, or the error in danger
 * red, which replaces the hint. Errors sit at the field they belong to,
 * never in a banner or an alert. `status` is a quiet positive line in
 * success ("Username available").
 *
 * `Field` wraps any control (an `Input`, a `Segmented`, a `Stepper`);
 * `SelectField` is the input-shaped button that opens a picker (Date,
 * Time, Duration, From/To); `SwitchField` is a setting row with its hint.
 */

type FieldProps = {
  label?: string;
  hint?: string;
  error?: string | null;
  status?: string | null;
  children: ReactNode;
  className?: string;
};

export function Field({ label, hint, error, status, children, className = '' }: FieldProps) {
  return (
    <View className={`gap-1.5 ${className}`}>
      {label ? <Typography variant="label">{label}</Typography> : null}
      {children}
      <FieldNote hint={hint} error={error} status={status} />
    </View>
  );
}

function FieldNote({ hint, error, status }: { hint?: string; error?: string | null; status?: string | null }) {
  if (error) {
    return (
      <Text accessibilityLiveRegion="polite" className="text-xs leading-4 font-sans-semibold text-danger dark:text-danger-dark">
        {error}
      </Text>
    );
  }
  if (status) {
    return (
      <View className="flex-row items-center gap-1.5">
        <Icon name="checkmark" size="xs" color="success" />
        <Text className="text-xs leading-4 font-sans-semibold text-success dark:text-success-dark">{status}</Text>
      </View>
    );
  }
  if (hint) {
    return <Text className="text-xs leading-4 font-sans-medium text-ink-muted dark:text-ink-muted-dark">{hint}</Text>;
  }
  return null;
}

type SelectFieldProps = {
  label?: string;
  value: string;
  onPress?: () => void;
  error?: string | null;
  hint?: string;
  /** Read-only: no chevron, not tappable (Sport while editing). */
  disabled?: boolean;
  accessibilityLabel?: string;
  className?: string;
};

export function SelectField({ label, value, onPress, error, hint, disabled, accessibilityLabel, className = '' }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      <Pressable
        onPress={onPress}
        disabled={disabled || !onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (label ? `${label}: ${value}` : value)}
        className={`h-12 flex-row items-center justify-between gap-1 pl-3.5 pr-2.5 rounded-lg bg-surface dark:bg-surface-dark active:opacity-70 ${
          error ? 'border border-danger dark:border-danger-dark' : 'border border-border-strong dark:border-border-strong-dark'
        }`}
      >
        <Text numberOfLines={1} className="flex-1 text-base font-sans text-ink dark:text-ink-dark">
          {value}
        </Text>
        {disabled ? null : <Icon name="chevron-down" size="xs" color="muted" />}
      </Pressable>
    </Field>
  );
}

type SwitchFieldProps = {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

export function SwitchField({ label, hint, value, onValueChange, disabled }: SwitchFieldProps) {
  return (
    <View className="flex-row items-center gap-3 min-h-12">
      <View className="flex-1">
        <Text className="text-[15px] leading-5 font-sans-semibold text-ink dark:text-ink-dark">{label}</Text>
        {hint ? (
          <Text className="mt-0.5 text-xs leading-4 font-sans-medium text-ink-muted dark:text-ink-muted-dark">{hint}</Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} accessibilityLabel={label} />
    </View>
  );
}

/** A form section's title: Saira italic over a hairline ("How matches are played"). */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-4 pt-4 border-t border-border dark:border-border-dark">
      <Text className="text-xl leading-6 font-display text-ink dark:text-ink-dark">{title}</Text>
      {children}
    </View>
  );
}
