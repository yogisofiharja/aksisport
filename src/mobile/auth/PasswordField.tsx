import { useState } from 'react';
import type { TextInputProps } from 'react-native';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { Icon } from '../../design-system/ui/Icon';
import { useTranslation } from '../../i18n';

// A password input with a show/hide toggle. Hidden by default; the eye
// icon reveals what was typed so a mistyped password can be spotted
// before submitting — there is no password recovery to fall back on.
export function PasswordField(props: Omit<TextInputProps, 'secureTextEntry'>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <Input className="flex-row items-center">
      <InputField
        {...props}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        className="flex-1"
      />
      <Pressable
        className="px-3 self-stretch justify-center active:opacity-60"
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={t(visible ? 'authHidePassword' : 'authShowPassword')}
        hitSlop={6}
      >
        <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size="sm" color="muted" />
      </Pressable>
    </Input>
  );
}
