import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useState } from 'react';
import { Pressable, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { TeamNames, TeamASide } from '../appTypes';
import { getPointLabel, MatchState, Team } from '../scoring';

type Props = {
  matchState: MatchState;
  teamNames: TeamNames;
  teamASide: TeamASide;
  hasUndo: boolean;
  voiceEnabled: boolean;
  sessionCode?: string | null;
  onAddPoint: (team: Team) => void;
  onUndo: () => void;
  onEndMatch: () => void;
  onToggleVoice: () => void;
};

export function MobileMatchScreen({
  matchState,
  teamNames,
  teamASide,
  hasUndo,
  voiceEnabled,
  sessionCode,
  onAddPoint,
  onUndo,
  onEndMatch,
  onToggleVoice,
}: Props) {
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [scoreBoxHalfW, setScoreBoxHalfW] = useState(0);

  const { height: wh, width: ww } = useWindowDimensions();
  const courtHeight = Math.min(wh, ww);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const leftTeam: Team = teamASide === 'left' ? 'A' : 'B';
  const rightTeam: Team = leftTeam === 'A' ? 'B' : 'A';

  const leftPoint = getPointLabel(matchState, leftTeam);
  const rightPoint = getPointLabel(matchState, rightTeam);
  const leftIsServing = matchState.currentServerPlayerId.startsWith(leftTeam);
  const rightIsServing = !leftIsServing;

  const leftPlayers = matchState.config.players.filter(p => p.team === leftTeam);
  const rightPlayers = matchState.config.players.filter(p => p.team === rightTeam);

  const leftGames = matchState.games[leftTeam];
  const rightGames = matchState.games[rightTeam];
  const leftSets = matchState.sets[leftTeam];
  const rightSets = matchState.sets[rightTeam];
  const hasSets = leftSets > 0 || rightSets > 0;

  const fmt = matchState.config.matchFormat ?? { type: 'open' };
  const formatLabel: string | null =
    fmt.type === 'fixed-games'
      ? `${leftGames + rightGames} / ${fmt.totalGames}${fmt.goldenGameOnTie && leftGames + rightGames === fmt.totalGames && leftGames === rightGames ? ' ★' : ''}`
      : fmt.type === 'race-to'
      ? `→ ${fmt.raceTo}`
      : null;

  const isAdvantage = (matchState.points.A + matchState.points.B) % 2 === 1;
  const scoreFontSize = courtHeight > 0 ? Math.floor(courtHeight * 0.70) : 240;

  const leftBallPos = isAdvantage
    ? { position: 'absolute' as const, top: 14, left: 14 }
    : { position: 'absolute' as const, bottom: 14, left: 14 };
  const rightBallPos = isAdvantage
    ? { position: 'absolute' as const, bottom: 14, right: 14 }
    : { position: 'absolute' as const, top: 14, right: 14 };

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar hidden />

      <View style={{ flex: 1, flexDirection: 'row' }}>

        {/* Left (blue) side */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => onAddPoint(leftTeam)} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: '#1e3a8a', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: scoreFontSize, fontWeight: '800', color: '#ffffff', letterSpacing: -2, includeFontPadding: false }}>
              {leftPoint}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right (red) side */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => onAddPoint(rightTeam)} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: '#7f1d1d', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: scoreFontSize, fontWeight: '800', color: '#ffffff', letterSpacing: -2, includeFontPadding: false }}>
              {rightPoint}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Net */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: '50%', marginLeft: -2, top: 0, bottom: 0, width: 4, backgroundColor: 'rgba(255,255,255,0.9)' }}
        />

        {/* ── Score box: own centred container ── */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}
        >
          <View
            onLayout={e => setScoreBoxHalfW(e.nativeEvent.layout.width / 2)}
            style={{ backgroundColor: '#0f172a', paddingHorizontal: 24, paddingTop: 6, paddingBottom: 9, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, alignItems: 'center' }}
          >
            {/* Set row — always rendered to keep box height stable; invisible until a set is won */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2, opacity: hasSets ? 1 : 0 }}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: leftSets > rightSets ? '#f8fafc' : '#475569', minWidth: 22, textAlign: 'center' }}>{leftSets}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569', marginHorizontal: 8 }}>–</Text>
              <Text style={{ fontSize: 26, fontWeight: '900', color: rightSets > leftSets ? '#f8fafc' : '#475569', minWidth: 22, textAlign: 'center' }}>{rightSets}</Text>
            </View>
            {/* Game row — fixed font size regardless of set state */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#fbbf24', minWidth: 16, textAlign: 'center' }}>{leftGames}</Text>
              <Text style={{ fontSize: 12, color: '#64748b', marginHorizontal: 8 }}>–</Text>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#fbbf24', minWidth: 16, textAlign: 'center' }}>{rightGames}</Text>
            </View>
            {/* Format progress label */}
            {formatLabel && (
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 3, letterSpacing: 0.5 }}>{formatLabel}</Text>
            )}
          </View>
        </View>

        {/* ── Suara button: right of score box ── */}
        {scoreBoxHalfW > 0 && (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 6, left: '50%', marginLeft: scoreBoxHalfW + 10 }}
          >
            <Pressable
              onPress={onToggleVoice}
              style={{ padding: 10, backgroundColor: '#1e293b', borderRadius: 12 }}
            >
              <Ionicons name="megaphone-outline" size={18} color={voiceEnabled ? '#4ade80' : '#475569'} />
            </Pressable>
          </View>
        )}

        {/* ── QR button: left of score box ── */}
        {scoreBoxHalfW > 0 && sessionCode && (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 6, right: '50%', marginRight: scoreBoxHalfW + 10 }}
          >
            <Pressable
              onPress={() => setShowQrModal(true)}
              style={{ padding: 10, backgroundColor: '#1e293b', borderRadius: 12 }}
            >
              <Ionicons name="qr-code-outline" size={18} color="#94a3b8" />
            </Pressable>
          </View>
        )}

        {/* ── Undo button: always full opacity, icon grey when disabled ── */}
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <Pressable
            onPress={onUndo}
            disabled={!hasUndo}
            style={{ padding: 14, backgroundColor: '#ea580c', borderRadius: 18 }}
          >
            <Ionicons name="arrow-undo-outline" size={24} color={hasUndo ? '#ffffff' : '#9a3412'} />
          </Pressable>
        </View>

        {/* ── Tennis ball: deuce / advantage corner ── */}
        {leftIsServing && (
          <View pointerEvents="none" style={leftBallPos}>
            <Ionicons name="tennisball" size={44} color="#fde047" />
          </View>
        )}
        {rightIsServing && (
          <View pointerEvents="none" style={rightBallPos}>
            <Ionicons name="tennisball" size={44} color="#fde047" />
          </View>
        )}

        {/* ── Akhiri: own centred absolute container ── */}
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' }}
        >
          <Pressable
            onPress={() => setShowEndConfirm(true)}
            style={{
              backgroundColor: '#1e293b',
              paddingHorizontal: 22,
              paddingTop: 10,
              paddingBottom: 8,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              alignItems: 'center',
            }}
          >
            <Ionicons name="stop-circle-outline" size={30} color="#fca5a5" />
          </Pressable>
        </View>

        {/* ── Player names: per-player colour — only the server's name is yellow ── */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row' }}
        >
          <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 80 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
              {leftPlayers.flatMap((p, i) => [
                ...(i > 0 ? [<Text key={`ls${i}`} style={{ fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.35)' }}> / </Text>] : []),
                <Text key={p.id} style={{ fontSize: 18, fontWeight: '800', color: p.id === matchState.currentServerPlayerId ? '#fde047' : '#ffffff' }}>{p.name}</Text>,
              ])}
            </View>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-start', paddingLeft: 80 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
              {rightPlayers.flatMap((p, i) => [
                ...(i > 0 ? [<Text key={`rs${i}`} style={{ fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.35)' }}> / </Text>] : []),
                <Text key={p.id} style={{ fontSize: 18, fontWeight: '800', color: p.id === matchState.currentServerPlayerId ? '#fde047' : '#ffffff' }}>{p.name}</Text>,
              ])}
            </View>
          </View>
        </View>

      </View>

      {/* QR code popup */}
      {showQrModal && sessionCode && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setShowQrModal(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: '#1e293b', borderRadius: 24, padding: 32, alignItems: 'center' }}
          >
            <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 16 }}>
              <QRCode value={sessionCode} size={180} color="#0f172a" backgroundColor="#f8fafc" />
            </View>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#f8fafc', letterSpacing: 10, marginTop: 20 }}>
              {sessionCode}
            </Text>
            <Text style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>Kode sesi</Text>
          </Pressable>
        </Pressable>
      )}

      {/* End-match confirmation dialog */}
      {showEndConfirm && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#1e293b', borderRadius: 16, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 32, paddingVertical: 28, alignItems: 'center', width: 320 }}>
            <Ionicons name="stop-circle-outline" size={32} color="#fca5a5" />
            <Text style={{ fontSize: 21, fontWeight: '900', color: '#f8fafc', textAlign: 'center', marginTop: 8 }}>Akhiri Pertandingan?</Text>
            <Text style={{ fontSize: 16, color: '#94a3b8', textAlign: 'center', lineHeight: 24, marginTop: 6, marginBottom: 4 }}>Skor saat ini akan dicatat sebagai hasil akhir.</Text>
            <View style={{ flexDirection: 'row', marginTop: 16, width: '100%' }}>
              <Pressable
                onPress={() => setShowEndConfirm(false)}
                style={{ flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', marginRight: 6 }}
              >
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#94a3b8' }}>Batal</Text>
              </Pressable>
              <Pressable
                onPress={() => { setShowEndConfirm(false); onEndMatch(); }}
                style={{ flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: '#991b1b', marginLeft: 6 }}
              >
                <Text style={{ fontSize: 17, fontWeight: '900', color: '#fecaca' }}>Akhiri</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
