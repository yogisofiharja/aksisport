import { createContext, useContext, useEffect, useState } from 'react';
import { storageGet, storageSave } from './storage';

export type Lang = 'en' | 'id';

type Dict = Record<string, string | ((...args: any[]) => string)>;

const en: Dict = {
  // App
  heroTagline: 'Track your tennis score',

  // Navigation
  back: 'Back',

  // Landing
  startMatch: 'Start Match',
  startMatchSub: 'Create a session and set up players',
  joinSession: 'Join Session',
  joinSessionSub: 'Scan QR or enter session code',

  // Join view
  joinTitle: 'Join Session',
  joinDesc: 'Enter the 5-letter code from the session owner',
  sessionCodePlaceholder: 'Session code...',

  // Setup — players
  playerList: 'Player List',
  playerNamePlaceholder: 'Player name...',
  playerCount: (n: number) => `${n} ${n === 1 ? 'player' : 'players'}`,
  needMorePlayers: (need: number, mode: string, have: number) =>
    `Need at least ${need} players for ${mode} mode. Currently ${have}.`,

  // Setup — match type
  matchType: 'Match Type',
  single: 'Single (1 vs 1)',
  double: 'Double (2 vs 2)',

  // Setup — match format
  matchFormat: 'Match Format',
  customTab: 'Custom',
  regularTab: 'Regular',
  formatOpen: 'Free Play',
  formatOpenDesc: 'End whenever you want',
  formatFixedGames: 'Fixed Games',
  formatFixedGamesDesc: 'Play a set number of games then stop',
  formatRaceTo: 'Race To',
  formatRaceToDesc: 'First to reach N games wins',
  formatBestOfSetsDesc: 'Standard tennis — first to win N sets',
  regularTabDesc: 'Standard tennis format — first to win N sets',
  totalGames: 'Total Games',
  goldenGame: 'Golden Game on Tie',
  goldenGameDesc: 'Play 1 extra game if scores are tied',
  targetGames: 'Target Games',
  setsToWin: 'Sets to Win',
  superTiebreak: 'Super Tiebreak (deciding set)',
  superTiebreakDesc: 'Replace the final set with a 10-point tiebreak',
  singleDeuce: 'Single Deuce + Sudden Death',
  singleDeuceDesc: 'Second deuce immediately becomes sudden death.',
  continueToLineup: 'Continue to Lineup →',

  // Lineup
  pickPlayers: 'Pick Players',
  left: 'LEFT',
  right: 'RIGHT',
  firstServer: 'First Server',
  randomizeServer: '🎲  Random Server',
  randomizing: '🎲  Randomizing...',
  continueBtn: 'Continue →',
  swapSides: 'Swap Sides',

  // Match
  endMatch: 'End Match',
  endMatchTitle: 'End Match',
  endMatchConfirm: 'Are you sure you want to end the match?',
  endMatchShort: 'End',
  pointLog: 'Point Log',
  noPoints: 'No points yet',
  scanToWatch: 'Scan to watch live',
  game: 'GAME',

  // History / Statistics
  matchHistory: 'History',
  matchHistoryTitle: 'Match History',
  statistics: 'Statistics',
  noStatsYet: 'No statistics yet',
  noMatchesYet: 'Complete at least one match to see player statistics.',
  playerColumn: 'Player',
  wins: 'W',
  losses: 'L',
  matches: 'M',
  winPct: '%',
  won: 'Won',
  noWinner: 'No winner',
  share: 'Share',

  // Final screen
  winnerLabel: 'Winner!',
  matchOver: 'Match Over',
  shareResult: 'Share',
  newMatch: 'New Match',
  viewHistory: 'View History',
  endSession: 'End Session',
  endSessionTitle: 'End Session?',
  endSessionBody: 'All session data will be permanently deleted.',
  endSessionConfirm: 'End session? All saved data will be deleted.',
  cancel: 'Cancel',
  close: 'Close',

  // History
  noHistoryYet: 'No history yet',
  noHistoryDesc: 'Complete your first match — results will be recorded here automatically.',

  // Share / image picker
  shareResultTitle: 'Share Result',
  processing: 'Processing...',
  addPlayer: 'Add Player',
  enterName: 'Enter name...',
  tapToSelect: 'Tap to select',
  shareSessionCode: 'Share Session Code',
  chooseImage: 'Choose Image',
  camera: 'Camera',
  gallery: 'Gallery',
  removePhoto: 'Remove Photo',
  sessionCodeLabel: 'Session Code',
  code: 'Code',
  scanOrTypeCode: 'Scan QR or type code to join this session',

  // Watch screen
  connecting: 'Connecting to session…',
  waitingForMatch: 'Waiting for match to start…',
  matchEnded: 'Match Over',

  // Settings modal
  settingsTitle: 'Settings',
  displayTheme: 'DISPLAY THEME',
  followDevice: 'System',
  light: 'Light',
  dark: 'Dark',
  announcementLang: 'ANNOUNCEMENT LANGUAGE',
  loadingVoices: 'Loading voices…',
  done: 'Done',
  languageSection: 'LANGUAGE',
  english: 'English',
  indonesian: 'Bahasa Indonesia',
};

const id: Dict = {
  // App
  heroTagline: 'Catat skor tenis-mu',

  // Navigation
  back: 'Kembali',

  // Landing
  startMatch: 'Mulai Pertandingan',
  startMatchSub: 'Buat sesi dan atur pemain',
  joinSession: 'Gabung Sesi',
  joinSessionSub: 'Scan QR atau masukkan kode sesi',

  // Join view
  joinTitle: 'Gabung Sesi',
  joinDesc: 'Masukkan kode 5 huruf dari pemilik sesi',
  sessionCodePlaceholder: 'Kode sesi...',

  // Setup — players
  playerList: 'Daftar Pemain',
  playerNamePlaceholder: 'Nama pemain...',
  playerCount: (n: number) => `${n} pemain`,
  needMorePlayers: (need: number, mode: string, have: number) =>
    `Butuh minimal ${need} pemain untuk mode ${mode}. Baru ada ${have}.`,

  // Setup — match type
  matchType: 'Jenis Pertandingan',
  single: 'Single (1 vs 1)',
  double: 'Double (2 vs 2)',

  // Setup — match format
  matchFormat: 'Format Pertandingan',
  customTab: 'Custom',
  regularTab: 'Regular',
  formatOpen: 'Bebas',
  formatOpenDesc: 'Akhiri kapan saja',
  formatFixedGames: 'Total Game',
  formatFixedGamesDesc: 'Main sejumlah game lalu berhenti',
  formatRaceTo: 'Kejar Target',
  formatRaceToDesc: 'Pertama capai N game menang',
  formatBestOfSetsDesc: 'Pertama menang N set (tenis standar)',
  regularTabDesc: 'Format tenis standar — pertama menang N set',
  totalGames: 'Jumlah Game',
  goldenGame: 'Golden Game saat seri',
  goldenGameDesc: 'Main 1 game tambahan jika skor sama',
  targetGames: 'Target Game',
  setsToWin: 'Set untuk Menang',
  superTiebreak: 'Super Tiebreak (set penentu)',
  superTiebreakDesc: 'Ganti set terakhir dengan tiebreak 10 poin',
  singleDeuce: 'Single Deuce + Sudden Death',
  singleDeuceDesc: 'Deuce kedua langsung menjadi sudden death.',
  continueToLineup: 'Lanjut ke Lineup →',

  // Lineup
  pickPlayers: 'Pilih Pemain',
  left: 'KIRI',
  right: 'KANAN',
  firstServer: 'Server Pertama',
  randomizeServer: '🎲  Acak Server',
  randomizing: '🎲  Mengacak...',
  continueBtn: 'Lanjut →',
  swapSides: 'Tukar Tempat',

  // Match
  endMatch: 'Akhiri Match',
  endMatchTitle: 'Akhiri Match',
  endMatchConfirm: 'Yakin ingin mengakhiri pertandingan?',
  endMatchShort: 'Akhiri',
  pointLog: 'Riwayat Poin',
  noPoints: 'Belum ada poin',
  scanToWatch: 'Scan untuk menonton langsung',
  game: 'GAME',

  // History / Statistics
  matchHistory: 'Riwayat',
  matchHistoryTitle: 'Riwayat Pertandingan',
  statistics: 'Statistik',
  noStatsYet: 'Belum ada statistik',
  noMatchesYet: 'Selesaikan setidaknya satu pertandingan untuk melihat statistik pemain.',
  playerColumn: 'Pemain',
  wins: 'M',
  losses: 'K',
  matches: 'P',
  winPct: '%',
  won: 'Menang',
  noWinner: 'Tidak ada pemenang',
  share: 'Bagikan',

  // Final screen
  winnerLabel: 'Menang!',
  matchOver: 'Pertandingan Selesai',
  shareResult: 'Bagikan',
  newMatch: 'Match Baru',
  viewHistory: 'Lihat Riwayat',
  endSession: 'Akhiri Sesi',
  endSessionTitle: 'Akhiri Sesi?',
  endSessionBody: 'Semua data sesi akan dihapus permanen.',
  endSessionConfirm: 'Akhiri sesi? Semua data tersimpan akan dihapus.',
  cancel: 'Batal',
  close: 'Tutup',

  // History
  noHistoryYet: 'Belum ada riwayat',
  noHistoryDesc: 'Selesaikan pertandingan pertamamu — hasilnya akan otomatis tercatat di sini.',

  // Share / image picker
  shareResultTitle: 'Bagikan Hasil',
  processing: 'Memproses...',
  addPlayer: 'Tambah Pemain',
  enterName: 'Masukkan nama...',
  tapToSelect: 'Ketuk untuk pilih',
  shareSessionCode: 'Bagikan Kode Sesi',
  chooseImage: 'Pilih Gambar',
  camera: 'Kamera',
  gallery: 'Galeri',
  removePhoto: 'Hapus Foto',
  sessionCodeLabel: 'Kode Sesi',
  code: 'Kode',
  scanOrTypeCode: 'Scan QR atau ketik kode untuk bergabung ke sesi ini',

  // Watch screen
  connecting: 'Menghubungkan ke sesi…',
  waitingForMatch: 'Menunggu pertandingan dimulai…',
  matchEnded: 'Pertandingan Selesai',

  // Settings modal
  settingsTitle: 'Pengaturan',
  displayTheme: 'TEMA TAMPILAN',
  followDevice: 'Ikuti Perangkat',
  light: 'Terang',
  dark: 'Gelap',
  announcementLang: 'BAHASA PENGUMUMAN',
  loadingVoices: 'Memuat suara…',
  done: 'Selesai',
  languageSection: 'BAHASA ANTARMUKA',
  english: 'English',
  indonesian: 'Bahasa Indonesia',
};

const dicts: Record<Lang, Dict> = { en, id };

type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, ...args: any[]) => string;
};

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

const STORAGE_KEY = 'app_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    storageGet(STORAGE_KEY).then(saved => {
      if (saved === 'en' || saved === 'id') setLangState(saved);
    });
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    storageSave(STORAGE_KEY, l);
  }

  function t(key: string, ...args: any[]): string {
    const dict = dicts[lang];
    const val = dict[key];
    if (typeof val === 'function') return val(...args);
    if (typeof val === 'string') return val;
    // fallback to English
    const fallback = en[key];
    if (typeof fallback === 'function') return fallback(...args);
    if (typeof fallback === 'string') return fallback;
    return key;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LangContext);
}

export function useTranslation() {
  const { t, lang, setLang } = useContext(LangContext);
  return { t, lang, setLang };
}
