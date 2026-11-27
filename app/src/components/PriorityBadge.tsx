import type { HiringPriority } from '../domain/types';
import { useT } from '../i18n/i18n';

export type AnyPriority = HiringPriority | 'low' | 'medium';

const STYLE: Record<Exclude<AnyPriority, 'normal'>, string> = {
  low: 'bg-gray-100 text-gray-500',
  medium: 'bg-blue-50 text-blue-600',
  high: 'bg-amber-50 text-amber-700',
  // Urgent: warm outline, reads as "act soon" without shouting.
  urgent: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/40',
  // Critical: the only solid pill, so it stands out from everything else in the row.
  critical: 'bg-red-600 text-white shadow-sm shadow-red-600/30 dark:bg-red-500',
};

/** Priority pill for jobs and campaigns; `normal` (the default) shows nothing. */
export function PriorityBadge({ priority, reason }: { priority?: AnyPriority; reason?: string }) {
  const t = useT();
  if (!priority || priority === 'normal') return null;
  return (
    <span title={reason} className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-2xs font-bold whitespace-nowrap ${STYLE[priority]}`}>
      {priority === 'critical' && (
        // A soft pulse on the dot; still when the viewer prefers reduced motion.
        <span aria-hidden="true" className="relative flex size-1.5">
          <span className="absolute inline-flex size-full rounded-full bg-white opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex size-1.5 rounded-full bg-white" />
        </span>
      )}
      {priority === 'urgent' && (
        <span aria-hidden="true" className="material-symbols-outlined text-[14px] -ml-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
      )}
      {t(`priority.${priority}`)}
    </span>
  );
}
