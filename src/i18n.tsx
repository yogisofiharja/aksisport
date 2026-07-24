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
  holdToEndHint: 'Press and hold to end match',
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

  // Auth
  authSignUpTitle: 'Create your account',
  authLoginTitle: 'Welcome back',
  authUsername: 'Username',
  authUsernamePlaceholder: 'lowercase, numbers, underscore',
  authPassword: 'Password',
  authConfirmPassword: 'Confirm password',
  authUsernameChecking: 'Checking availability…',
  authUsernameAvailable: 'Username available',
  authUsernameTaken: 'Username already taken',
  authUsernameInvalid: '3-20 chars: lowercase letters, numbers, underscore',
  authPasswordMismatch: 'Passwords do not match',
  authSignUp: 'Sign Up',
  authLogIn: 'Log In',
  authNoAccount: "Don't have an account?",
  authHaveAccount: 'Already have an account?',
  authCreateAccount: 'Create one',
  authLogInLink: 'Log in',
  authCompleteProfileTitle: 'Finish setting up',
  authCompleteProfileDesc: 'Your account was created but your profile setup did not finish. Tap continue to finish.',
  authContinue: 'Continue',
  authGenericError: 'Something went wrong. Please try again.',

  // Clubs
  clubListTitle: 'Your Clubs',
  clubEmptyState: 'No clubs yet — create one or join with a code.',
  clubCreate: 'Create Club',
  clubJoin: 'Join with Code',
  clubNamePlaceholder: 'Club name',
  clubDescriptionPlaceholder: 'Description (optional)',
  clubCreateSubmit: 'Create',
  clubJoinTitle: 'Join a Club',
  clubJoinDesc: 'Enter the 5-letter invite code from the club owner',
  clubJoinCodePlaceholder: 'A B C D E',
  clubJoinSubmit: 'Join',
  clubMembersTitle: 'Members',
  clubInviteCodeLabel: 'Invite Code',
  clubRegenerateCode: 'Regenerate',
  clubAddMember: 'Add by username',
  clubAddMemberPlaceholder: 'username',
  clubAdd: 'Add',
  clubRoleOwner: 'Owner',
  clubRoleAdmin: 'Admin',
  clubRoleMember: 'Member',
  clubPromote: 'Make Admin',
  clubDemote: 'Make Member',
  clubRemove: 'Remove',
  clubLeaveClub: 'Leave Club',
  clubDeleteClub: 'Delete Club',
  clubDeleteConfirmTitle: 'Delete this club?',
  clubDeleteConfirmDesc: 'This removes the club and all its members. This cannot be undone.',
  clubCancel: 'Cancel',
  clubConfirm: 'Confirm',

  // Sessions
  sessionListTitle: 'Sessions',
  sessionEmptyState: 'No sessions yet — create one to get playing.',
  sessionCreate: 'Create Session',
  sessionNamePlaceholder: 'Session name (optional)',
  sessionLocationPlaceholder: 'Location (optional)',
  sessionCreateSubmit: 'Create',
  sessionStatusOpen: 'Open',
  sessionStatusInProgress: 'In Progress',
  sessionStatusCompleted: 'Completed',
  sessionParticipantsTitle: 'Participants',
  sessionCheckIn: 'Check In',
  sessionCheckedIn: 'Checked in',
  sessionRegistered: 'Registered',
  sessionAddGuest: 'Add guest',
  sessionAddGuestPlaceholder: 'Guest name',
  sessionAdd: 'Add',
  sessionYou: 'You',

  // Activities (matches within a session)
  activityQueueTitle: 'Matches',
  activityEmptyQueue: 'No matches yet — add one to get started.',
  activityAdd: 'Add Match',
  activityAddTitle: 'Add Match',
  activityPickParticipants: 'Pick Participants',
  activityNeedParticipants: (need: number, mode: string, have: number) =>
    `Need ${need} checked-in participants for ${mode} mode. Picked ${have}.`,
  activityCreate: 'Add to Queue',
  activityStatusQueued: 'Queued',
  activityStatusLive: 'Live',
  activityStatusCompleted: 'Completed',
  activityStart: 'Start',
  activityWatch: 'Watch',
  activityResume: 'Resume',
  activityLoading: 'Starting match…',
  activityLoadError: 'Could not load this match. Please go back and try again.',
  activityLiveUnavailable: "Live viewing isn't available right now.",
  activityNoCheckedIn: 'No one is checked in yet — check in first.',
  liveMatchBadge: 'LIVE',
  scoredBy: (name: string) => `Scored by ${name}`,
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
  holdToEndHint: 'Tekan dan tahan untuk mengakhiri pertandingan',
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

  // Auth
  authSignUpTitle: 'Buat akunmu',
  authLoginTitle: 'Selamat datang kembali',
  authUsername: 'Username',
  authUsernamePlaceholder: 'huruf kecil, angka, underscore',
  authPassword: 'Kata sandi',
  authConfirmPassword: 'Konfirmasi kata sandi',
  authUsernameChecking: 'Memeriksa ketersediaan…',
  authUsernameAvailable: 'Username tersedia',
  authUsernameTaken: 'Username sudah dipakai',
  authUsernameInvalid: '3-20 karakter: huruf kecil, angka, underscore',
  authPasswordMismatch: 'Kata sandi tidak cocok',
  authSignUp: 'Daftar',
  authLogIn: 'Masuk',
  authNoAccount: 'Belum punya akun?',
  authHaveAccount: 'Sudah punya akun?',
  authCreateAccount: 'Buat akun',
  authLogInLink: 'Masuk',
  authCompleteProfileTitle: 'Selesaikan pengaturan',
  authCompleteProfileDesc: 'Akunmu sudah dibuat tapi pengaturan profil belum selesai. Ketuk lanjutkan untuk menyelesaikannya.',
  authContinue: 'Lanjutkan',
  authGenericError: 'Terjadi kesalahan. Silakan coba lagi.',

  // Clubs
  clubListTitle: 'Klub Kamu',
  clubEmptyState: 'Belum ada klub — buat satu atau gabung pakai kode.',
  clubCreate: 'Buat Klub',
  clubJoin: 'Gabung dengan Kode',
  clubNamePlaceholder: 'Nama klub',
  clubDescriptionPlaceholder: 'Deskripsi (opsional)',
  clubCreateSubmit: 'Buat',
  clubJoinTitle: 'Gabung Klub',
  clubJoinDesc: 'Masukkan kode undangan 5 huruf dari pemilik klub',
  clubJoinCodePlaceholder: 'A B C D E',
  clubJoinSubmit: 'Gabung',
  clubMembersTitle: 'Anggota',
  clubInviteCodeLabel: 'Kode Undangan',
  clubRegenerateCode: 'Perbarui',
  clubAddMember: 'Tambah dengan username',
  clubAddMemberPlaceholder: 'username',
  clubAdd: 'Tambah',
  clubRoleOwner: 'Pemilik',
  clubRoleAdmin: 'Admin',
  clubRoleMember: 'Anggota',
  clubPromote: 'Jadikan Admin',
  clubDemote: 'Jadikan Anggota',
  clubRemove: 'Hapus',
  clubLeaveClub: 'Keluar Klub',
  clubDeleteClub: 'Hapus Klub',
  clubDeleteConfirmTitle: 'Hapus klub ini?',
  clubDeleteConfirmDesc: 'Ini akan menghapus klub beserta semua anggotanya. Tindakan ini tidak dapat dibatalkan.',
  clubCancel: 'Batal',
  clubConfirm: 'Konfirmasi',

  // Sessions
  sessionListTitle: 'Sesi',
  sessionEmptyState: 'Belum ada sesi — buat satu untuk mulai main.',
  sessionCreate: 'Buat Sesi',
  sessionNamePlaceholder: 'Nama sesi (opsional)',
  sessionLocationPlaceholder: 'Lokasi (opsional)',
  sessionCreateSubmit: 'Buat',
  sessionStatusOpen: 'Terbuka',
  sessionStatusInProgress: 'Berlangsung',
  sessionStatusCompleted: 'Selesai',
  sessionParticipantsTitle: 'Peserta',
  sessionCheckIn: 'Check In',
  sessionCheckedIn: 'Sudah check-in',
  sessionRegistered: 'Terdaftar',
  sessionAddGuest: 'Tambah tamu',
  sessionAddGuestPlaceholder: 'Nama tamu',
  sessionAdd: 'Tambah',
  sessionYou: 'Kamu',

  // Activities (pertandingan dalam sesi)
  activityQueueTitle: 'Pertandingan',
  activityEmptyQueue: 'Belum ada pertandingan — tambahkan satu untuk mulai.',
  activityAdd: 'Tambah Pertandingan',
  activityAddTitle: 'Tambah Pertandingan',
  activityPickParticipants: 'Pilih Peserta',
  activityNeedParticipants: (need: number, mode: string, have: number) =>
    `Butuh ${need} peserta yang sudah check-in untuk mode ${mode}. Terpilih ${have}.`,
  activityCreate: 'Tambah ke Antrean',
  activityStatusQueued: 'Antre',
  activityStatusLive: 'Berlangsung',
  activityStatusCompleted: 'Selesai',
  activityStart: 'Mulai',
  activityWatch: 'Tonton',
  activityResume: 'Lanjutkan',
  activityLoading: 'Memulai pertandingan…',
  activityLoadError: 'Tidak dapat memuat pertandingan ini. Silakan kembali dan coba lagi.',
  activityLiveUnavailable: 'Menonton langsung tidak tersedia saat ini.',
  activityNoCheckedIn: 'Belum ada yang check-in — check in dulu.',
  liveMatchBadge: 'LANGSUNG',
  scoredBy: (name: string) => `Dinilai oleh ${name}`,
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
