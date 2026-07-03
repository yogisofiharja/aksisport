import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/ui/text';
import { getTTSPreferences, saveTTSPreferences } from '../tts';
import type { ThemePreference } from '../theme';
import { useTheme } from '../theme';
import { useTranslation, type Lang } from '../i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const SUPPORTED_LANGS = ['en-US', 'en-GB'] as const;
type SupportedLang = typeof SUPPORTED_LANGS[number];

const LANG_DISPLAY: Record<SupportedLang, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
};

const SAMPLE_TEXT = 'Fifteen — love. Game, set, match!';

const ALLOWED_VOICE_NAMES: Record<SupportedLang, string[]> = {
  'en-US': ['Samantha', 'Ava', 'Allison'],
  'en-GB': ['Daniel', 'Arthur', 'Serena'],
};

function selectCuratedVoices(voices: Speech.Voice[], lang: SupportedLang): Speech.Voice[] {
  const allowed = ALLOWED_VOICE_NAMES[lang];
  return voices.filter(v => allowed.some(name => v.name.toLowerCase().includes(name.toLowerCase())));
}

export function SettingsModal({ visible, onClose }: Props) {
  const { preference, setPreference, isDark } = useTheme();
  const { t, lang, setLang } = useTranslation();

  const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
    { value: 'system', label: t('followDevice'), icon: 'phone-portrait-outline' },
    { value: 'light', label: t('light'), icon: 'sunny-outline' },
    { value: 'dark', label: t('dark'), icon: 'moon-outline' },
  ];
  const [allVoices, setAllVoices] = useState<Speech.Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [selectedLang, setSelectedLang] = useState<SupportedLang>('en-US');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const { voiceIdentifier, language } = getTTSPreferences();
    setSelectedVoiceId(voiceIdentifier);
    if (language && (SUPPORTED_LANGS as readonly string[]).includes(language)) {
      setSelectedLang(language as SupportedLang);
    }
    setLoadingVoices(true);
    Speech.getAvailableVoicesAsync()
      .then(all => {
        const english = all.filter(v =>
          SUPPORTED_LANGS.some(l => v.language === l || v.language.startsWith(l + '-')),
        );
        setAllVoices(english);
      })
      .catch(() => {})
      .finally(() => setLoadingVoices(false));
  }, [visible]);

  const rawVoicesForLang = allVoices.filter(v =>
    v.language === selectedLang || v.language.startsWith(selectedLang + '-'),
  );
  const voicesForLang = selectCuratedVoices(rawVoicesForLang, selectedLang);

  function handleSelectTheme(p: ThemePreference) {
    Haptics.selectionAsync();
    setPreference(p);
  }

  function handleSelectLang(lang: SupportedLang) {
    Haptics.selectionAsync();
    setSelectedLang(lang);
    const voices = selectCuratedVoices(
      allVoices.filter(v => v.language === lang || v.language.startsWith(lang + '-')),
      lang,
    );
    const hasCurrentVoice = voices.some(v => v.identifier === selectedVoiceId);
    if (!hasCurrentVoice) {
      setSelectedVoiceId(null);
      saveTTSPreferences(null, lang);
    } else {
      saveTTSPreferences(selectedVoiceId, lang);
    }
  }

  function playVoiceSample(voice: Speech.Voice) {
    Speech.stop();
    setPlayingId(voice.identifier);
    Speech.speak(SAMPLE_TEXT, {
      voice: voice.identifier,
      language: voice.language,
      rate: 1.0,
      onDone: () => setPlayingId(null),
      onStopped: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  }

  function handleSelectVoice(voice: Speech.Voice) {
    Haptics.selectionAsync();
    setSelectedVoiceId(voice.identifier);
    saveTTSPreferences(voice.identifier, voice.language);
    playVoiceSample(voice);
  }

  function handlePlayPreview(voice: Speech.Voice) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playVoiceSample(voice);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50 dark:bg-black/70" onPress={onClose}>
        <Pressable className="bg-white dark:bg-slate-800 rounded-t-3xl px-6 pt-6 pb-10 gap-4" onPress={() => {}}>
          <View className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 self-center mb-1" />
          <Text className="text-[20px] font-black text-slate-900 dark:text-slate-50">{t('settingsTitle')}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 560 }}>

            {/* UI Language */}
            <Text className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-widest mb-2.5">{t('languageSection')}</Text>
            <View className="flex-row gap-2.5 mb-5">
              {(['en', 'id'] as Lang[]).map(l => {
                const sel = lang === l;
                return (
                  <Pressable
                    key={l}
                    onPress={() => { Haptics.selectionAsync(); setLang(l); }}
                    className={`flex-1 py-3 rounded-xl border-[1.5px] items-center ${sel ? 'bg-amber-600 border-amber-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                  >
                    <Text className={`text-[14px] font-bold ${sel ? 'text-white' : 'text-slate-900 dark:text-slate-50'}`}>
                      {l === 'en' ? t('english') : t('indonesian')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Theme */}
            <Text className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-widest mb-2.5">{t('displayTheme')}</Text>
            <View className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {THEME_OPTIONS.map((opt, i) => {
                const sel = preference === opt.value;
                return (
                  <View key={opt.value}>
                    <Pressable
                      className={`flex-row items-center gap-3.5 px-4 py-3.5 ${sel ? 'bg-amber-50 dark:bg-amber-900/15' : ''}`}
                      onPress={() => handleSelectTheme(opt.value)}
                    >
                      <View className={`w-[38px] h-[38px] rounded-xl items-center justify-center ${sel ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-white dark:bg-slate-800'}`}>
                        <Ionicons name={opt.icon as any} size={20} color={sel ? '#d97706' : (isDark ? '#94a3b8' : '#64748b')} />
                      </View>
                      <Text className={`flex-1 text-[15px] font-extrabold ${sel ? 'text-amber-600' : 'text-slate-900 dark:text-slate-50'}`}>{opt.label}</Text>
                      {sel && <Ionicons name="checkmark-circle" size={22} color="#d97706" />}
                    </Pressable>
                    {i < THEME_OPTIONS.length - 1 && <View className="h-px bg-slate-200 dark:border-slate-700 ml-4" />}
                  </View>
                );
              })}
            </View>

            {/* TTS language */}
            <Text className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-widest mt-5 mb-2.5">{t('announcementLang')}</Text>
            <View className="flex-row gap-2.5">
              {SUPPORTED_LANGS.map(lang => {
                const sel = selectedLang === lang;
                return (
                  <Pressable
                    key={lang}
                    onPress={() => handleSelectLang(lang)}
                    className={`flex-1 py-3 rounded-xl border-[1.5px] items-center ${sel ? 'bg-amber-600 border-amber-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                  >
                    <Text className={`text-[14px] font-bold ${sel ? 'text-white' : 'text-slate-900 dark:text-slate-50'}`}>
                      {LANG_DISPLAY[lang]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Voices */}
            {loadingVoices ? (
              <View className="flex-row items-center gap-2.5 py-3 mt-4">
                <ActivityIndicator size="small" color="#d97706" />
                <Text className="text-[14px] text-slate-400 dark:text-slate-500">{t('loadingVoices')}</Text>
              </View>
            ) : voicesForLang.length > 0 && (
              <>
                <Text className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-widest mt-5 mb-2.5">
                  PILIH SUARA — {LANG_DISPLAY[selectedLang].toUpperCase()}
                </Text>
                <View className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {voicesForLang.map((v, i) => {
                    const sel = selectedVoiceId === v.identifier;
                    const playing = playingId === v.identifier;
                    const enhanced = v.quality === Speech.VoiceQuality.Enhanced;
                    return (
                      <View key={v.identifier}>
                        <Pressable
                          className={`flex-row items-center gap-3.5 px-4 py-3.5 ${sel ? 'bg-amber-50 dark:bg-amber-900/15' : ''}`}
                          onPress={() => handleSelectVoice(v)}
                        >
                          <Text className={`flex-1 text-[15px] font-extrabold ${sel ? 'text-amber-600' : 'text-slate-900 dark:text-slate-50'}`} numberOfLines={1}>
                            {v.name}{enhanced ? '  ✦' : ''}
                          </Text>
                          <Pressable
                            onPress={() => handlePlayPreview(v)}
                            className={`w-[30px] h-[30px] rounded-full items-center justify-center ${playing ? 'bg-amber-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            hitSlop={8}
                          >
                            <Ionicons name={playing ? 'pause' : 'play'} size={14} color={playing ? '#fff' : (isDark ? '#94a3b8' : '#64748b')} />
                          </Pressable>
                          {sel && <Ionicons name="checkmark-circle" size={22} color="#d97706" style={{ marginLeft: 6 }} />}
                        </Pressable>
                        {i < voicesForLang.length - 1 && <View className="h-px bg-slate-200 dark:bg-slate-700 ml-4" />}
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <View style={{ height: 8 }} />
          </ScrollView>

          <Pressable
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[14px] py-3.5 items-center mt-1"
            onPress={onClose}
          >
            <Text className="text-[15px] font-bold text-slate-900 dark:text-slate-50">{t('done')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
