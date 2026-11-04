import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from '../../platform/Image';
import { useTranslation } from '../../i18n';
import { Icon } from '../ui/Icon';
import { CloseOnBack } from './useBackToClose';

/**
 * A picture at full size, the whole of it, on black: a payment receipt an
 * organizer has to read, a photo in chat. Closes from the ✕, a tap
 * anywhere, Android back / Escape, and the browser's back button.
 *
 * `headers` carries the bearer token for auth-protected images (see
 * `src/platform/Image`).
 */
type ImageViewerProps = {
  uri: string | null;
  headers?: Record<string, string>;
  onClose: () => void;
};

export function ImageViewer({ uri, headers, onClose }: ImageViewerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onClose}>
      {uri !== null && <CloseOnBack onClose={onClose} />}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('imageViewerClose')}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', paddingTop: insets.top + 56, paddingBottom: insets.bottom + 16, paddingHorizontal: 12 }}
      >
        {uri !== null && <Image source={{ uri, headers }} style={{ flex: 1, width: '100%' }} resizeMode="contain" />}
      </Pressable>
      <View style={{ position: 'absolute', top: insets.top + 8, right: 8 }}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('imageViewerClose')} className="p-3 active:opacity-60">
          <Icon name="close" size="md" color="onDark" />
        </Pressable>
      </View>
    </Modal>
  );
}
