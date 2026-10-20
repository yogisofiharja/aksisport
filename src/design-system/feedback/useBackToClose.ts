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

export function useBackToClose(visible: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || typeof window === 'undefined') return;
    const id = ++nextId;
    window.history.pushState({ ...(window.history.state ?? {}), aksiOverlay: id }, '');

    let poppedByBack = false;
    // Close only once history has gone back past this overlay's entry, so
    // back on a dialog over a sheet closes just the dialog.
    function onPopState() {
      const current = window.history.state?.aksiOverlay;
      if (typeof current === 'number' && current >= id) return;
      poppedByBack = true;
      window.removeEventListener('popstate', onPopState);
      onCloseRef.current();
    }
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      if (!poppedByBack && window.history.state?.aksiOverlay === id) window.history.back();
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
