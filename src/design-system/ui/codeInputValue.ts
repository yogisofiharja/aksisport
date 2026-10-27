/**
 * What a CodeInput's value becomes when the box at `index` changes to
 * `typed`: digits from that box on are replaced by the digits typed, so one
 * digit fills one box and a pasted or autofilled code fills every box from
 * there. An emptied box clears it and everything after it. `previous` is
 * the box's digit before the change, which a field without a selection
 * keeps in front of the new one ("4" → "47").
 */
export function nextCodeValue(value: string, index: number, typed: string, previous: string, length: number): string {
  let incoming = typed.replace(/\D/g, '');
  if (previous && incoming.length > 1 && incoming.startsWith(previous)) incoming = incoming.slice(previous.length);
  if (!incoming) return value.slice(0, index);
  return (value.slice(0, index) + incoming).slice(0, length);
}
