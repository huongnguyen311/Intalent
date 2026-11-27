import type { CampaignStatus } from '../../domain/types';
import { useT } from '../../i18n/i18n';

export const PRIMARY_BTN =
  'px-6 py-2.5 bg-brand-accent hover:bg-brand-strong text-white rounded-full font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all transform active:scale-95 text-sm shrink-0';
export const SECONDARY_BTN =
  'px-5 py-2.5 bg-white dark:bg-dark-raised border border-line dark:border-dark-line text-slate-700 dark:text-white text-sm font-bold rounded-full shadow-sm hover:border-primary/50 transition-colors flex items-center gap-2';

const STATUS_STYLE: Record<CampaignStatus, { pill: string; dot: string }> = {
  active: { pill: 'bg-emerald-50 text-emerald-500', dot: 'bg-emerald-500' },
  paused: { pill: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  draft: { pill: 'bg-white border border-gray-300 text-gray-500', dot: 'bg-gray-300' },
  scheduled: { pill: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  completed: { pill: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
  cancelled: { pill: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const t = useT();
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.completed;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-bold ${s.pill}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`}></span>
      {t(`campaigns.status.${status}`)}
    </span>
  );
}
