// Payments (Session pricing): IDR has no subunit in practice, so amounts
// are always whole numbers — matches the server's plain-integer
// pricePerPerson/totalPrice fields, no decimal handling needed.
// "Rp 1.000.000" (Aksi Sport: money is written "Rp 75.000" — prefix, a
// space, dot-separated thousands), built by hand rather than with
// Intl.NumberFormat's currency style, whose spacing and symbol vary by
// engine.
export function formatIDR(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

// Amount inputs keep their state as bare digits ("150000") and show it
// with thousand separators ("150.000") while typing. digitsOnly() is the
// way back: it strips the separators — and anything else that isn't a
// digit — from what the field hands to onChangeText, and drops leading
// zeros so "0150" can't be entered.
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

export function formatThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
