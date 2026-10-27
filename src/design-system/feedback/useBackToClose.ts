import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Every open sheet is a back-able step (Aksi Sport › Mobile first): on the
 * web, the browser's back button — and Android's back gesture in a phone
 * browser — closes the overlay instead of leaving the screen.
 *
 * While `visible`, an extra history entry with the same URL is pushed;
 * back pops it and calls `onClose`. Closing any other way removes the
 * entry again, unless the app has already navigated on top of it (an
 * action in the sheet that opens another screen), in which case it is
 * left alone so that navigation isn't undone.
 *
 * The entry copies the current history state, so React Navigation's own
 * entry id is unchanged and it treats the pop as staying on the same
 * screen. On native, Modal's `onRequestClose` already handles Android
 * back.
 */

let nextId = 0;

// The open overlays, oldest first. One back closes only the topmost — a
// dialog over a sheet closes just the dialog — whatever the history
// entries' state says by then (React Navigation may replace the current
// entry's state, dropping our marker).
const open: { id: number; close: () => void }[] = [];
// Backs this module triggers itself (closing an overlay another way),
// which must not close the next overlay down.
let ownBacks = 0;
let listening = false;

function onPopState() {
  if (ownBacks > 0) {
    ownBacks -= 1;
    return;
  }
  const top = open.pop();
  top?.close();
}

export function useBackToClose(visible: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || typeof window === 'undefined') return;
    const id = ++nextId;
    window.history.pushState({ ...(window.history.state ?? {}), aksiOverlay: id }, '');
    open.push({ id, close: () => onCloseRef.current() });
    if (!listening) {
      window.addEventListener('popstate', onPopState);
      listening = true;
    }

    return () => {
      const index = open.findIndex((o) => o.id === id);
      if (index < 0) return; // closed by back: its entry is already gone
      open.splice(index, 1);
      // Closed another way: remove its entry too — unless the app has
      // already navigated on top of it.
      if (window.history.state?.aksiOverlay === id) {
        ownBacks += 1;
        window.history.back();
      }
    };
  }, [visible]);
}

/**
 * The same, as a component to drop inside a `Modal` (it mounts when the
 * modal opens and unmounts when it closes): `<CloseOnBack onClose={…} />`.
 */
export function CloseOnBack({ onClose }: { onClose: () => void }) {
  useBackToClose(true, onClose);
  return null;
}
