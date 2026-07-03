import { useEffect, useRef, useState } from 'react';
import { subscribeToSession, SessionPayload } from '../sessionSync';
import { getPointLabel } from '../scoring';
import { useTranslation } from '../i18n';

type Props = {
  code: string;
};

export function WatchScreen({ code }: Props) {
  const { t } = useTranslation();
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current = subscribeToSession(code, (p) => {
      setConnected(true);
      setPayload(p);
    });
    return () => { unsubRef.current?.(); };
  }, [code]);

  const ms = payload?.matchState;
  const teamASide = payload?.teamASide ?? 'left';
  const leftTeam = teamASide === 'left' ? 'A' : 'B';
  const rightTeam = leftTeam === 'A' ? 'B' : 'A';

  const leftNames = ms?.config.players.filter(p => p.team === leftTeam).map(p => p.name).join(' / ') ?? '';
  const rightNames = ms?.config.players.filter(p => p.team === rightTeam).map(p => p.name).join(' / ') ?? '';
  const leftGames = ms ? ms.games[leftTeam] : 0;
  const rightGames = ms ? ms.games[rightTeam] : 0;
  const leftSets = ms ? ms.sets[leftTeam] : 0;
  const rightSets = ms ? ms.sets[rightTeam] : 0;
  const leftPoint = ms ? getPointLabel(ms, leftTeam) : '0';
  const rightPoint = ms ? getPointLabel(ms, rightTeam) : '0';
  const hasSets = leftSets > 0 || rightSets > 0;
  const leftWins = ms?.winner === leftTeam;
  const rightWins = ms?.winner === rightTeam;
  const isEnded = ms?.isEnded ?? false;

  return (
    <div style={s.root}>
      <div style={s.banner}>
        <span style={s.bannerText}>🎾 PoinYuk</span>
        <span style={s.codeBadge}>{code}</span>
      </div>

      {!connected && (
        <div style={s.waiting}>
          <div style={s.spinner} />
          <p style={s.waitingText}>{t('connecting')}</p>
        </div>
      )}

      {connected && !ms && (
        <div style={s.waiting}>
          <p style={s.waitingText}>{t('waitingForMatch')}</p>
        </div>
      )}

      {ms && (
        <div style={s.court}>
          {/* Set row */}
          {hasSets && (
            <div style={s.setRow}>
              <span style={{ ...s.setNum, ...(leftSets > rightSets ? s.setLead : s.setTrail) }}>{leftSets}</span>
              <span style={s.setLabel}>SET</span>
              <span style={{ ...s.setNum, ...(rightSets > leftSets ? s.setLead : s.setTrail) }}>{rightSets}</span>
            </div>
          )}

          {/* Main scoreboard */}
          <div style={s.board}>
            {/* Left side */}
            <div style={{ ...s.side, backgroundColor: '#1e3a8a' }}>
              <span style={s.pointNum}>{leftPoint}</span>
            </div>

            {/* Centre info */}
            <div style={s.centre}>
              <span style={s.gameNum}>{leftGames}</span>
              <span style={s.gameDash}>–</span>
              <span style={s.gameNum}>{rightGames}</span>
            </div>

            {/* Right side */}
            <div style={{ ...s.side, backgroundColor: '#7f1d1d' }}>
              <span style={s.pointNum}>{rightPoint}</span>
            </div>
          </div>

          {/* Team names */}
          <div style={s.namesRow}>
            <span style={{ ...s.teamName, textAlign: 'left' as const, color: ms.currentServerPlayerId.startsWith(leftTeam) ? '#fde047' : '#e2e8f0' }}>{leftNames}</span>
            <span style={{ ...s.teamName, textAlign: 'right' as const, color: ms.currentServerPlayerId.startsWith(rightTeam) ? '#fde047' : '#e2e8f0' }}>{rightNames}</span>
          </div>

          {isEnded && (
            <div style={s.endBanner}>
              <span style={s.endText}>
                {leftWins ? `${leftNames} ${t('won')}` : rightWins ? `${rightNames} ${t('won')}` : t('matchEnded')}
              </span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    backgroundColor: '#020617',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    userSelect: 'none',
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  bannerText: {
    fontSize: 16,
    fontWeight: 900,
    color: '#fbbf24',
    letterSpacing: 1,
  },
  codeBadge: {
    fontSize: 13,
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: 3,
  },
  waiting: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 40,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #1e293b',
    borderTop: '3px solid #fbbf24',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
  waitingText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
  },
  court: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px 0',
    gap: 12,
  },
  setRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  setNum: {
    fontSize: 'clamp(28px, 5vw, 52px)',
    fontWeight: 900,
    minWidth: 40,
    textAlign: 'center',
  },
  setLead: { color: '#f8fafc' },
  setTrail: { color: '#334155' },
  setLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: '#475569',
    letterSpacing: 3,
  },
  board: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 900,
    height: 'clamp(160px, 30vw, 320px)',
  },
  side: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointNum: {
    fontSize: 'clamp(80px, 18vw, 200px)',
    fontWeight: 900,
    color: '#ffffff',
    lineHeight: 1,
  },
  centre: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: '0 clamp(16px, 3vw, 36px)',
    gap: 10,
    flexShrink: 0,
  },
  gameNum: {
    fontSize: 'clamp(28px, 6vw, 64px)',
    fontWeight: 900,
    color: '#fbbf24',
    minWidth: 'clamp(24px, 4vw, 52px)',
    textAlign: 'center',
  },
  gameDash: {
    fontSize: 'clamp(20px, 4vw, 42px)',
    fontWeight: 700,
    color: '#334155',
  },
  namesRow: {
    display: 'flex',
    width: '100%',
    maxWidth: 900,
    padding: '6px 12px',
    gap: 8,
  },
  teamName: {
    flex: 1,
    fontSize: 'clamp(14px, 2.5vw, 24px)',
    fontWeight: 800,
    color: '#e2e8f0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  endBanner: {
    marginTop: 12,
    backgroundColor: '#fbbf24',
    borderRadius: 12,
    padding: '10px 28px',
  },
  endText: {
    fontSize: 'clamp(16px, 2.5vw, 28px)',
    fontWeight: 900,
    color: '#000',
    letterSpacing: 0.5,
  },
};
