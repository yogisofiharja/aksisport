import { Text, View } from 'react-native';

/**
 * What is about to be created, read back before it is (Aksi redesign ›
 * Check your session / schedule): a small tag (DRAFT, WEEKLY), the name in
 * Saira italic, then label–value rows split by hairlines, the value right-
 * aligned and wrapping. Rows with no value are left out by the caller.
 */

type SummaryCardProps = {
  tag: string;
  title: string;
  rows: { label: string; value: string }[];
};

export function SummaryCard({ tag, title, rows }: SummaryCardProps) {
  return (
    <View className="p-4 rounded-xl bg-surface dark:bg-surface-dark border border-border dark:border-border-dark">
      <View className="self-start px-2 py-0.5 rounded bg-surface-sunken dark:bg-surface-sunken-dark">
        <Text className="text-[11px] leading-4 font-sans-bold tracking-[0.66px] text-ink-muted dark:text-ink-muted-dark">{tag}</Text>
      </View>
      <Text accessibilityRole="header" className="mt-2 mb-3 text-[26px] leading-[30px] font-display-hero text-ink dark:text-ink-dark">
        {title}
      </Text>
      {rows.map((row) => (
        <View key={row.label} className="flex-row justify-between gap-4 py-2.5 border-t border-border dark:border-border-dark">
          <Text className="text-sm leading-5 font-sans text-ink-muted dark:text-ink-muted-dark">{row.label}</Text>
          <Text className="flex-1 text-right text-sm leading-5 font-sans-semibold text-ink dark:text-ink-dark">{row.value}</Text>
        </View>
      ))}
    </View>
  );
}
