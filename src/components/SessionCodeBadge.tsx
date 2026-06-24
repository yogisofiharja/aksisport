import Ionicons from '@expo/vector-icons/Ionicons';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  sessionCode: string | null;
};

export function SessionCodeBadge({ sessionCode }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionCode) return;
    setQrDataUrl(null);
    const joinUrl = Platform.OS === 'web'
      ? `${window.location.origin}/?code=${sessionCode}`
      : `https://poinyuk.vercel.app/?code=${sessionCode}`;
    QRCode.toDataURL(joinUrl, { width: 240, margin: 2, color: { dark: '#0f172a', light: '#f8fafc' } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [sessionCode]);

  if (!sessionCode) return null;

  return (
    <>
      <Pressable onPress={() => setShowModal(true)} style={styles.badge}>
        <Ionicons name="qr-code-outline" size={13} color="#b45309" />
        <Text style={styles.badgeText}>Kode sesi: {sessionCode} — tap untuk QR</Text>
      </Pressable>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>Bagikan Kode Sesi</Text>
            <Text style={styles.sub}>Scan QR atau ketik kode untuk bergabung ke sesi ini</Text>
            {qrDataUrl
              ? <Image source={{ uri: qrDataUrl }} style={styles.qrImage} />
              : <View style={styles.qrPlaceholder} />
            }
            <View style={styles.codeRow}>
              <Text style={styles.codeLabel}>Kode</Text>
              <Text style={styles.codeValue}>{sessionCode}</Text>
            </View>
            <Pressable onPress={() => setShowModal(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Tutup</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    gap: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  sub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  codeValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 3,
  },
  closeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
