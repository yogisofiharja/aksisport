import { Platform, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import DateTimePicker from '../../../platform/DateTimePicker';
import { Sheet } from '../../../design-system/feedback/Sheet';
import { ListGroup, ListRow } from '../../../design-system/ui/List';
import { Icon } from '../../../design-system/ui/Icon';
import { useTranslation } from '../../../i18n';

// The pickers behind the form's SelectFields (Date, Time, Duration,
// From/To, Sport). On Android a date or time opens the system dialog
// directly; on iOS and the web it opens in a Sheet — the calendar picks
// and closes, the time wheel / dropdowns close with Done.

type DateTimeSheetProps = {
  visible: boolean;
  mode: 'date' | 'time';
  title: string;
  value: Date;
  onChange: (next: Date) => void;
  onClose: () => void;
};

export function DateTimeSheet({ visible, mode, title, value, onChange, onClose }: DateTimeSheetProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const themeVariant = colorScheme === 'dark' ? 'dark' : 'light';

  if (Platform.OS === 'android') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="default"
        onChange={(event: { type?: string } | unknown, selected?: Date) => {
          onClose();
          if ((event as { type?: string })?.type !== 'dismissed' && selected) onChange(selected);
        }}
      />
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={t('recurringScheduleTimeDone')}>
      <View className={Platform.OS === 'ios' ? 'items-center' : ''}>
        <DateTimePicker
          value={value}
          mode={mode}
          display={mode === 'date' ? 'inline' : 'spinner'}
          themeVariant={themeVariant}
          onChange={(_: unknown, selected?: Date) => {
            if (!selected) return;
            onChange(selected);
            // A day is one tap; a time is adjusted until Done.
            if (mode === 'date') onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

type OptionSheetProps<T extends string | number> = {
  visible: boolean;
  title: string;
  options: { value: T; label: string }[];
  value?: T;
  onSelect: (value: T) => void;
  onClose: () => void;
};

export function OptionSheet<T extends string | number>({ visible, title, options, value, onSelect, onClose }: OptionSheetProps<T>) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ListGroup>
        {options.map((option) => (
          <ListRow
            key={String(option.value)}
            title={option.label}
            strong={option.value === value}
            trailing={option.value === value ? <Icon name="checkmark" size="md" color="brand" /> : undefined}
            onPress={() => {
              onSelect(option.value);
              onClose();
            }}
          />
        ))}
      </ListGroup>
    </Sheet>
  );
}
