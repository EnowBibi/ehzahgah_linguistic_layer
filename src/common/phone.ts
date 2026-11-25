/** 677000001, +237 677 000 001 and 237677000001 are the same account. Returns 237XXXXXXXXX. */
export function normalisePhone(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('237') && digits.length === 12) return digits;
  if (digits.length === 9) return '237' + digits;
  return digits;
}

/** Finds a Cameroonian mobile number inside free text and returns it normalised, or null. */
export function findPhone(text: string): { phone: string; rest: string } | null {
  const m = text.match(/(?:\+?\s?237[\s.-]?)?(6[\s.-]?\d(?:[\s.-]?\d){7})/);
  if (!m) return null;
  const digits = m[1].replace(/\D/g, '');
  if (digits.length !== 9) return null;
  return { phone: '237' + digits, rest: text.replace(m[0], ' ') };
}
