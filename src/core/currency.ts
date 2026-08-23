// Payments (Session pricing): IDR has no subunit in practice, so amounts
// are always whole numbers — matches the server's plain-integer
// pricePerPerson/totalPrice fields, no decimal handling needed.
// "IDR1.000.000" (prefix + dot-separated thousands), not Intl.NumberFormat's
// currency style (which would render the "Rp" symbol instead).
export function formatIDR(amount: number): string {
  return `IDR${Math.round(amount).toLocaleString('id-ID')}`;
}
