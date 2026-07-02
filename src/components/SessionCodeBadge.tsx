import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  sessionCode: string | null;
};

export function SessionCodeBadge({ sessionCode }: Props) {
  const [showModal, setShowModal] = useState(false);
  const { colorScheme } = useColorScheme();
  const dark = Platform.OS !== 'web' && colorScheme === 'dark';

  if (!sessionCode) return null;

  const joinUrl = Platform.OS === 'web'
    ? `${window.location.origin}/?code=${sessionCode}`
    : `https://poinyuk.vercel.app/?code=${sessionCode}`;

  const badgeBg = dark ? 'rgba(251,191,36,0.12)' : 'rgba(180,83,9,0.1)';
  const badgeBorder = dark ? 'rgba(251,191,36,0.28)' : 'rgba(180,83,9,0.2)';
  const labelColor = dark ? '#fbbf24' : '#92400e';
  const codeColor = dark ? '#fde68a' : '#78350f';
  const iconColor = dark ? '#fbbf24' : '#b45309';

  return (
    <>
      <Pressable
        onPress={() => setShowModal(true)}
        style={[styles.badge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}
      >
        <Ionicons name="qr-code-outline" size={16} color={iconColor} />
        <View style={styles.badgeTextWrap}>
          <Text style={[styles.badgeLabel, { color: labelColor }]}>Kode Sesi</Text>
          <Text style={[styles.badgeCode, { color: codeColor }]}>{sessionCode}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={iconColor} />
      </Pressable>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>Bagikan Kode Sesi</Text>
            <Text style={styles.sub}>Scan QR atau ketik kode untuk bergabung ke sesi ini</Text>
            <View style={styles.qrWrap}>
              <QRCode
                value={joinUrl}
                size={200}
                color="#0f172a"
                backgroundColor="#f8fafc"
              />
            </View>
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
    gap: 8,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  badgeTextWrap: {
    gap: 1,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badgeCode: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
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
  qrWrap: {
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
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
