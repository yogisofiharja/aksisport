import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Dimensions,
  ImageBackground,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { pickImageAsDataUrl } from '../imagePicker';

export type NativeShareData = {
  matchup: string;
  score: string;
  breakdown?: string;
  message: string;
  winnerName?: string;
};

type Props = {
  data: NativeShareData | null;
  onClose: () => void;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const UI_CHROME = 260;
const CARD_H = Math.min(Math.round((SCREEN_W - 64) * 16 / 9), SCREEN_H - UI_CHROME);
const CARD_W = Math.round(CARD_H * 9 / 16);

export function NativeShareModal({ data, onClose }: Props) {
  const cardRef = useRef<View>(null);
  const [bgUri, setBgUri] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  if (!data) return null;

  const matchupParts = data.matchup.split(' vs ');
  const teamAName = matchupParts[0] ?? '';
  const teamBName = matchupParts[1] ?? '';
  const teamAPlayers = teamAName.split(' / ');
  const teamBPlayers = teamBName.split(' / ');

  function handleCameraPress() {
    const options = bgUri
      ? ['Batal', 'Kamera', 'Galeri', 'Hapus Foto']
      : ['Batal', 'Kamera', 'Galeri'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, destructiveButtonIndex: bgUri ? 3 : undefined },
        (i) => {
          if (i === 1) pickImage('camera');
          else if (i === 2) pickImage('gallery');
          else if (i === 3 && bgUri) setBgUri(null);
        }
      );
    } else {
      Alert.alert('Pilih Gambar', undefined, [
        { text: 'Kamera', onPress: () => pickImage('camera') },
        { text: 'Galeri', onPress: () => pickImage('gallery') },
        ...(bgUri ? [{ text: 'Hapus Foto', style: 'destructive' as const, onPress: () => setBgUri(null) }] : []),
        { text: 'Batal', style: 'cancel' },
      ]);
    }
  }

  async function pickImage(source: 'camera' | 'gallery') {
    try {
      const result = await pickImageAsDataUrl(source);
      if (result) setBgUri(result);
    } catch (e) {
      console.warn('NativeShareModal: image pick failed', e);
    }
  }

  async function handleShare() {
    setIsSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.95 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Bagikan Hasil' });
      } else {
        await Share.share({ message: data!.message });
      }
    } catch {
      await Share.share({ message: data!.message });
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={s.sheet}>

          <View style={s.header}>
            <Text style={s.headerTitle}>Bagikan Hasil</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={s.previewWrap}>

            {/* Card — only this captured by view-shot */}
            <View ref={cardRef} style={[s.card, { width: CARD_W, height: CARD_H }]}>

              {/* Background photo or solid dark */}
              {bgUri ? (
                <ImageBackground source={{ uri: bgUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, s.defaultBg]} />
              )}

              {/* Gradient: transparent top → solid dark bottom half (matches web version) */}
              <Svg style={StyleSheet.absoluteFillObject} width={CARD_W} height={CARD_H}>
                <Defs>
                  <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0.35" stopColor="rgba(0,0,0,0)" stopOpacity="0" />
                    <Stop offset="0.65" stopColor="#000000" stopOpacity="0.6" />
                    <Stop offset="1" stopColor="#000000" stopOpacity="0.92" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width={CARD_W} height={CARD_H} fill="url(#grad)" />
              </Svg>

              {/* Bottom text block */}
              <View style={s.bottomBlock}>

                {/* Teams — UPPERCASE, side by side with VS in center */}
                <View style={s.teamsRow}>
                  <View style={s.teamCol}>
                    {teamAPlayers.map((p, i) => (
                      <Text key={i} style={[s.playerName, s.playerLeft]} numberOfLines={1}>
                        {p.toUpperCase()}
                      </Text>
                    ))}
                  </View>
                  <Text style={s.vsText}>VS</Text>
                  <View style={s.teamCol}>
                    {teamBPlayers.map((p, i) => (
                      <Text key={i} style={[s.playerName, s.playerRight]} numberOfLines={1}>
                        {p.toUpperCase()}
                      </Text>
                    ))}
                  </View>
                </View>

                {/* Score */}
                <Text style={s.score}>{data.score}</Text>
                {data.breakdown ? <Text style={s.breakdown}>{data.breakdown}</Text> : null}

                {/* PoinYuk brand */}
                <View style={s.brandRow}>
                  <Text style={s.brand}>PoinYuk</Text>
                  <Ionicons name="tennisball" size={15} color="#f59e0b" />
                </View>
              </View>
            </View>

            {/* Camera overlay — outside cardRef, won't appear in shared image */}
            <TouchableOpacity
              style={[s.cameraOverlay, { width: CARD_W, height: CARD_H }]}
              activeOpacity={0.85}
              onPress={handleCameraPress}
            >
              <View style={s.cameraIconCircle}>
                <Ionicons name="camera" size={36} color="rgba(255,255,255,0.85)" />
              </View>
            </TouchableOpacity>

          </View>

          <TouchableOpacity
            style={[s.shareBtn, isSharing && s.shareBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleShare}
            disabled={isSharing}
          >
            <Ionicons name="share-outline" size={20} color="#ffffff" />
            <Text style={s.shareBtnText}>{isSharing ? 'Memproses...' : 'Bagikan →'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.closeLink} onPress={onClose}>
            <Text style={s.closeLinkText}>Tutup</Text>
          </TouchableOpacity>

        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#f1f5f9',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  previewWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 16 },
      android: { elevation: 12 },
      web: { boxShadow: '0px 8px 16px rgba(0,0,0,0.6)' } as any,
    }),
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  defaultBg: {
    backgroundColor: '#0c1933',
  },

  // All content at bottom
  bottomBlock: {
    gap: 6,
  },

  // Teams row with VS in center
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  teamCol: {
    flex: 1,
    gap: 1,
  },
  playerName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  playerLeft: {
    textAlign: 'right',
  },
  playerRight: {
    textAlign: 'left',
  },
  vsText: {
    fontSize: 13,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.5)',
    marginHorizontal: 10,
    letterSpacing: 1,
  },

  // Score
  score: {
    fontSize: 68,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 74,
    letterSpacing: -1,
  },
  breakdown: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 4,
  },
  brand: {
    fontSize: 14,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 1,
  },

  // Camera overlay sits over card but outside cardRef
  cameraOverlay: {
    position: 'absolute',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  shareBtn: {
    backgroundColor: '#d97706',
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  shareBtnDisabled: { opacity: 0.6 },
  shareBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  closeLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    textDecorationLine: 'underline',
  },
});
