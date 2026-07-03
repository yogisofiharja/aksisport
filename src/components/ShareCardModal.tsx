import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './ui';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../i18n';

type ShareCardModalProps = {
  visible: boolean;
  imageDataUrl: string | null;
  onShare: () => void;
  onChangeBackground: (source: 'gallery' | 'camera') => void;
  onClose: () => void;
};

export function ShareCardModal({
  visible,
  imageDataUrl,
  onShare,
  onChangeBackground,
  onClose,
}: ShareCardModalProps) {
  const { t } = useTranslation();

  if (!visible || !imageDataUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.previewWrapper}>
            <Image
              source={{ uri: imageDataUrl }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <Pressable
              style={styles.cameraOverlay}
              onPress={() => onChangeBackground('gallery')}
            >
              <Ionicons name="camera" size={48} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </View>

          <View style={styles.actionBar}>
            <Button label={t('share')} onPress={onShare} style={styles.shareBtn} />
            <Pressable onPress={onClose} style={styles.dismissBtn}>
              <Text style={styles.dismissText}>{t('close')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    maxWidth: 500,
    width: '100%',
    padding: 10,
    gap: 8,
  },
  previewWrapper: {
    position: 'relative',
    flex: 1,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  cameraOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  actionBar: {
    gap: 8,
    paddingTop: 6,
    paddingBottom: 2,
  },
  shareBtn: {
    flex: 1,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textDecorationLine: 'underline',
  },
});
