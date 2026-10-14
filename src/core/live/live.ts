import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { auth } from '../../firebase';
import { apiUrl } from '../api/client';

// The live connection (DP-021): one WebSocket per signed-in app, over which
// the server announces new messages, read receipts, typing and new
// notifications the moment they happen. Screens still poll, slowly, as a
// safety net — and quickly whenever the connection is down.

export type LiveEvent = { type: string; data?: any };

type Listener = (event: LiveEvent) => void;

const listeners = new Set<Listener>();
const connectionListeners = new Set<(connected: boolean) => void>();

let socket: WebSocket | null = null;
let wanted = false;
let connected = false;
let retryDelay = 1000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: { remove: () => void } | null = null;

const MAX_RETRY_DELAY = 30_000;

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  connectionListeners.forEach((l) => l(value));
}

function scheduleReconnect() {
  if (!wanted || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
}

async function connect() {
  if (!wanted || socket) return;
  let token: string | undefined;
  try {
    token = await auth?.currentUser?.getIdToken();
  } catch {
    token = undefined;
  }
  if (!wanted || socket) return;
  if (!token) {
    scheduleReconnect();
    return;
  }
  const url = apiUrl(`/v1/live?token=${encodeURIComponent(token)}`).replace(/^http/, 'ws');
  const ws = new WebSocket(url);
  socket = ws;
  ws.onopen = () => {
    retryDelay = 1000;
    setConnected(true);
  };
  ws.onmessage = (e) => {
    let event: LiveEvent;
    try {
      event = JSON.parse(String(e.data));
    } catch {
      return;
    }
    listeners.forEach((l) => l(event));
  };
  ws.onclose = () => {
    if (socket === ws) socket = null;
    setConnected(false);
    scheduleReconnect();
  };
  ws.onerror = () => {
    // onclose follows and reconnects
  };
}

// Starts (and keeps) the connection for whoever is signed in.
export function startLive() {
  if (wanted) return;
  wanted = true;
  retryDelay = 1000;
  connect();
  // Coming back to the app: reconnect at once rather than waiting out the
  // back-off (phones drop sockets in the background).
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state !== 'active' || !wanted || socket) return;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryDelay = 1000;
    connect();
  });
}

export function stopLive() {
  wanted = false;
  appStateSub?.remove();
  appStateSub = null;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  socket?.close();
  socket = null;
  setConnected(false);
}

// Sends something to the server — only typing, today. Dropped when offline.
export function sendLive(message: object) {
  if (socket && connected) socket.send(JSON.stringify(message));
}

export function subscribeLive(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLiveConnected(): boolean {
  const [value, setValue] = useState(connected);
  useEffect(() => {
    setValue(connected);
    connectionListeners.add(setValue);
    return () => {
      connectionListeners.delete(setValue);
    };
  }, []);
  return value;
}

// Calls handler for every live event while the component is mounted. The
// latest handler is always used, so it may close over fresh state.
export function useLiveEvents(handler: Listener) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribeLive((e) => ref.current(e)), []);
}

// How often a screen should re-fetch on its own: rarely while the live
// connection tells it about changes, often when it is down.
export function usePollInterval(fallbackMs = 5000): number {
  return useLiveConnected() ? 30_000 : fallbackMs;
}
