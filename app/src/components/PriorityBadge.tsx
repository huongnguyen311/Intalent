import type { HiringPriority } from '../domain/types';
import { useT } from '../i18n/i18n';

export type AnyPriority = HiringPriority | 'low' | 'medium';

const STYLE: Record<Exclude<AnyPriority, 'normal'>, string> = {
  low: 'bg-gray-100 text-gray-500',
  medium: 'bg-sky-50 text-sky-600',
  high: 'bg-amber-50 text-amber-700',
  urgent: 'bg-orange-50 text-orange-600',
  critical: 'bg-red-50 text-red-600',
};

/** Priority pill for jobs and campaigns; `normal` (the default) shows nothing. */
export function PriorityBadge({ priority }: { priority?: AnyPriority }) {
  const t = useT();
  if (!priority || priority === 'normal') return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold whitespace-nowrap ${STYLE[priority]}`}>
      {(priority === 'urgent' || priority === 'critical') && (
        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">priority_high</span>
      )}
      {t(`priority.${priority}`)}
    </span>
  );
}
