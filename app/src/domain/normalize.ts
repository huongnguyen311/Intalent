export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export function normalizePhone(s: string): string {
  const digits = s.replace(/\D/g, '');
  if (!digits.startsWith('84')) return digits;
  const rest = digits.slice(2);
  // "+84 0901..." (redundant trunk 0) and "+84 901..." both become 0901...
  return rest.startsWith('0') ? rest : `0${rest}`;
}
