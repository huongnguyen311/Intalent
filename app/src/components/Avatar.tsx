const TONES = {
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 border border-green-200 dark:border-green-800',
  teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
} as const;

export type AvatarTone = keyof typeof TONES;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

const TONE_NAMES = Object.keys(TONES) as AvatarTone[];

/** Stable tone for a name, so a person keeps the same colour across screens. */
export function toneFor(name: string): AvatarTone {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONE_NAMES[h % TONE_NAMES.length];
}

export function Avatar({ name, tone = 'purple', small }: { name: string; tone?: AvatarTone; small?: boolean }) {
  return (
    <div className={`${small ? 'size-7 text-[11px]' : 'size-10 text-sm'} shrink-0 rounded-full flex items-center justify-center font-bold ${TONES[tone]}`}>
      {initials(name)}
    </div>
  );
}
