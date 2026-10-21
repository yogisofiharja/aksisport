import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import { createElement, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  useWindowDimensions,
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
import { appAlert } from '../design-system/feedback/appAlert';
import { color } from '../design-system/foundation/colors';
import { renderShareCard } from './shareCardCanvas';
import { useTranslation } from '../i18n';
import { CloseOnBack } from '../design-system/feedback/useBackToClose';

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

const UI_CHROME = 260;

// The card's text scales with the card, which is smaller on a phone:
// the score to the card's width, and player names down to whatever fits
// their half of the row (never cut off with "…").
function cardTextSizes(cardW: number, names: string[]) {
  const k = Math.min(1, cardW / 300);
  const columnW = (cardW - 40 - 36) / 2; // card padding, "VS" in the middle
  const longest = Math.max(1, ...names.map((n) => n.length));
  const nameSize = Math.max(9, Math.min(17 * k, Math.floor(columnW / (longest * 0.74))));
  return { nameSize, vsSize: Math.round(13 * k), scoreSize: Math.round(Math.min(68, cardW * 0.22)), brandSize: Math.round(14 * k) };
}

export function NativeShareModal({ data, onClose }: Props) {
  const cardRef = useRef<View>(null);
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const CARD_H = Math.min(Math.round((Math.min(SCREEN_W, 560) - 64) * 16 / 9), SCREEN_H - UI_CHROME);
  const CARD_W = Math.round(CARD_H * 9 / 16);
  const [webFailed, setWebFailed] = useState(false);
  // Web, where the image can't go to the share sheet: shown full screen to
  // press and hold (Save to Photos / Share on a phone), or download.
  const [savePreviewUrl, setSavePreviewUrl] = useState<string | null>(null);
  const [bgUri, setBgUri] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const { t } = useTranslation();
  // Web: the card is turned into an image file ahead of time, so Share can
  // open the phone's share sheet straight from the tap (browsers, Safari
  // above all, only allow that right after a tap — not after a slow
  // capture).
  const [webFile, setWebFile] = useState<File | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !data) return;
    setWebFile(null);
    setWebFailed(false);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        // Drawn on a canvas (shareCardCanvas), not copied off the screen:
        // view-shot can't find the element on web, and html2canvas drops
        // the gradient and text.
        const parts = data.matchup.split(' vs ');
        const blob = await renderShareCard({
          teamA: (parts[0] ?? '').split(' / '),
          teamB: (parts[1] ?? '').split(' / '),
          score: data.score,
          breakdown: data.breakdown,
          backgroundUri: bgUri,
        });
        if (!cancelled) setWebFile(new File([blob], 'aksi-match.jpg', { type: 'image/jpeg' }));
      } catch (e) {
        console.warn('NativeShareModal: preparing image failed', e);
        if (!cancelled) setWebFailed(true);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data, bgUri]);

  useEffect(() => () => {
    if (savePreviewUrl) URL.revokeObjectURL(savePreviewUrl);
  }, [savePreviewUrl]);

  if (!data) return null;

  const matchupParts = data.matchup.split(' vs ');
  const teamAName = matchupParts[0] ?? '';
  const teamBName = matchupParts[1] ?? '';
  const teamAPlayers = teamAName.split(' / ');
  const teamBPlayers = teamBName.split(' / ');
  const sizes = cardTextSizes(CARD_W, [...teamAPlayers, ...teamBPlayers].map((p) => p.toUpperCase()));

  function handleCameraPress() {
    const options = bgUri
      ? [t('cancel'), t('camera'), t('gallery'), t('removePhoto')]
      : [t('cancel'), t('camera'), t('gallery')];

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
      // appAlert, not Alert.alert: the latter does nothing in a browser.
      appAlert(t('chooseImage'), undefined, [
        { text: t('camera'), onPress: () => pickImage('camera') },
        { text: t('gallery'), onPress: () => pickImage('gallery') },
        ...(bgUri ? [{ text: t('removePhoto'), style: 'destructive' as const, onPress: () => setBgUri(null) }] : []),
        { text: t('cancel'), style: 'cancel' },
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

  // Web: share the prepared image through the browser's share sheet, or
  // download it where sharing files isn't supported (e.g. desktop, or a
  // page not served over https).
  async function handleShareWeb() {
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (!webFile) {
      // The image couldn't be made: share the result as text instead.
      try {
        if (nav.share) await nav.share({ text: data!.message });
        else {
          await nav.clipboard.writeText(data!.message);
          appAlert(t('shareCopied'));
        }
      } catch {
        // closed the share sheet, or clipboard blocked
      }
      return;
    }
    try {
      if (nav.share && nav.canShare?.({ files: [webFile] })) {
        await nav.share({ files: [webFile], text: data!.message });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return; // closed the share sheet
    }
    // No share sheet for images here (e.g. a computer, or a phone on a page
    // that isn't https): show the image to press and hold, or download.
    setSavePreviewUrl(URL.createObjectURL(webFile));
  }

  function downloadWebFile() {
    if (!webFile) return;
    const url = URL.createObjectURL(webFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = webFile.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleShare() {
    if (Platform.OS === 'web') {
      handleShareWeb();
      return;
    }
    setIsSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.95 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: t('shareResultTitle') });
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
      <CloseOnBack onClose={onClose} />
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={s.sheet}>

          <View style={s.header}>
            <Text style={s.headerTitle}>{t('shareResultTitle')}</Text>
            {/* One way out: "Close" as text, top right (as every Aksi sheet). */}
            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7} accessibilityRole="button" hitSlop={8}>
              <Text style={s.closeText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.previewWrap}>

            {/* Card — only this captured by view-shot */}
            <View ref={cardRef} style={[s.card, { width: CARD_W, height: CARD_H, paddingBottom: Math.round(CARD_H * (300 / 1920)) }]}>

              {/* Background photo or solid dark */}
              {bgUri ? (
                <ImageBackground source={{ uri: bgUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, s.defaultBg]} />
              )}

              {/* Gradient: transparent top → solid dark bottom half (matches web version) */}
              {/* A little bigger than the card on every side (the card clips
                  it), so no sub-pixel edge of the photo is left undarkened. */}
              <Svg style={{ position: 'absolute', top: -2, left: -2 }} width={CARD_W + 4} height={CARD_H + 4}>
                <Defs>
                  <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0.35" stopColor="rgba(0,0,0,0)" stopOpacity="0" />
                    <Stop offset="0.65" stopColor="#000000" stopOpacity="0.6" />
                    <Stop offset="1" stopColor="#000000" stopOpacity="0.92" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width={CARD_W + 4} height={CARD_H + 4} fill="url(#grad)" />
              </Svg>

              {/* Bottom text block */}
              <View style={s.bottomBlock}>

                {/* Teams — UPPERCASE, side by side with VS in center */}
                <View style={s.teamsRow}>
                  <View style={s.teamCol}>
                    {teamAPlayers.map((p, i) => (
                      <Text key={i} style={[s.playerName, s.playerLeft, { fontSize: sizes.nameSize }]} numberOfLines={1}>
                        {p.toUpperCase()}
                      </Text>
                    ))}
                  </View>
                  <Text style={[s.vsText, { fontSize: sizes.vsSize }]}>VS</Text>
                  <View style={s.teamCol}>
                    {teamBPlayers.map((p, i) => (
                      <Text key={i} style={[s.playerName, s.playerRight, { fontSize: sizes.nameSize }]} numberOfLines={1}>
                        {p.toUpperCase()}
                      </Text>
                    ))}
                  </View>
                </View>

                {/* Score */}
                <Text style={[s.score, { fontSize: sizes.scoreSize, lineHeight: Math.round(sizes.scoreSize * 1.1) }]}>{data.score}</Text>
                {data.breakdown ? <Text style={s.breakdown}>{data.breakdown}</Text> : null}

                {/* Brand */}
                <View style={s.brandRow}>
                  <Text style={[s.brand, { fontSize: sizes.brandSize }]}>AKSI</Text>
                  <Ionicons name="tennisball" size={15} color="#fde047" />
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
            style={[s.shareBtn, (isSharing || (Platform.OS === 'web' && !webFile && !webFailed)) && s.shareBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleShare}
            disabled={isSharing || (Platform.OS === 'web' && !webFile && !webFailed)}
          >
            <Ionicons name="share-outline" size={20} color={color.onHeat.light} />
            <Text style={s.shareBtnText}>{isSharing || (Platform.OS === 'web' && !webFile && !webFailed) ? t('processing') : `${t('share')} →`}</Text>
          </TouchableOpacity>

        </SafeAreaView>
      </View>

      {/* Web, without a share sheet for images: the finished image, to press
          and hold (Save to Photos / Share on a phone) or download. */}
      {Platform.OS === 'web' && savePreviewUrl && (
        <View style={s.saveOverlay}>
          {createElement('img', {
            src: savePreviewUrl,
            alt: data.matchup,
            style: { maxWidth: '100%', maxHeight: '68vh', borderRadius: 16, display: 'block' },
          })}
          <Text style={s.saveHint}>{t('shareSaveHint')}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={s.saveBtn} activeOpacity={0.85} onPress={downloadWebFile}>
              <Ionicons name="download-outline" size={18} color={color.onHeat.light} />
              <Text style={s.saveBtnText}>{t('shareDownload')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, s.saveBtnQuiet]} activeOpacity={0.85} onPress={() => setSavePreviewUrl(null)}>
              <Text style={[s.saveBtnText, s.saveBtnQuietText]}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  closeText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: color.onAsphalt.light,
  },
  previewWrap: {
    alignItems: 'center',
    marginBottom: 28,
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
    color: '#ffffff',
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
    backgroundColor: color.heat.light,
    borderRadius: 8,
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
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: color.onHeat.light,
  },
  saveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2,6,23,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  saveHint: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 320,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: color.heat.light,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  saveBtnQuiet: { backgroundColor: color.asphalt.dark },
  saveBtnQuietText: { color: color.onAsphalt.dark },
  saveBtnText: { color: color.onHeat.light, fontSize: 15, fontFamily: 'PlusJakartaSans-SemiBold' },
});
