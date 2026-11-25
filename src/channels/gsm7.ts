// GSM 03.38 default alphabet. Extension characters cost two septets.
const BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const EXT = '^{}\\[~]|€';

export const isGsm7Char = (c: string) => BASIC.includes(c) || EXT.includes(c);
export const septetLength = (text: string) =>
  [...text].reduce((n, c) => n + (EXT.includes(c) ? 2 : 1), 0);
export const nonGsm7Chars = (text: string) => [...new Set([...text].filter((c) => !isGsm7Char(c)))];

// National-language letters that are not in GSM-7. A design choice: transliteration keeps the
// 182-septet limit, but it can change spelling and, in tonal languages, meaning. See docs/ARCHITECTURE.md.
const MAP: Record<string, string> = {
  ɛ: 'e', ɔ: 'o', ŋ: 'ng', ə: 'e', ɗ: 'd', ƙ: 'k', ɓ: 'b', ƴ: 'y', ʉ: 'u', ɨ: 'i', ɑ: 'a',
  Ɛ: 'E', Ɔ: 'O', Ŋ: 'Ng', Ə: 'E', Ɗ: 'D', Ƙ: 'K', Ɓ: 'B',
  '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...',
};

export function transliterate(text: string): string {
  let out = '';
  for (const c of text) {
    if (isGsm7Char(c)) out += c;
    else if (MAP[c] !== undefined) out += MAP[c];
    else {
      const base = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      out += [...base].every(isGsm7Char) ? base : '?';
    }
  }
  return out;
}

/** Shortens text to at most `max` septets, dropping whole trailing lines first. */
export function fitSeptets(text: string, max: number): { text: string; truncated: boolean } {
  if (septetLength(text) <= max) return { text, truncated: false };
  const lines = text.split('\n');
  while (lines.length > 1 && septetLength(lines.join('\n')) > max) lines.pop();
  let out = lines.join('\n');
  while (septetLength(out) > max) out = out.slice(0, -1);
  return { text: out, truncated: true };
}
