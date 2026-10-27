import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import QRCode from 'qrcode';

/**
 * A QR code of `value` (Aksi Sport › QR): dark modules on white, with the
 * standard four-module quiet zone, always black on white in both themes so
 * every phone camera reads it. The pattern comes from the `qrcode`
 * library; it is drawn here with react-native-svg as one path, so it is
 * crisp at any size on web, iOS and Android.
 */

type QrCodeProps = {
  value: string;
  size: number;
  accessibilityLabel?: string;
};

const QUIET = 4;

export function QrCode({ value, size, accessibilityLabel }: QrCodeProps) {
  const { count, path } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(x, y)) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
      }
    }
    return { count: n + QUIET * 2, path: d };
  }, [value]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${count} ${count}`}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Rect x={0} y={0} width={count} height={count} fill="#ffffff" />
      <Path d={path} fill="#131315" />
    </Svg>
  );
}
