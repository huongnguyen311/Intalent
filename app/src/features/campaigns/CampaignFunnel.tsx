import type { CampaignPerformance } from '../../domain/campaigns';
import { useT } from '../../i18n/i18n';

/** The campaign's hiring chain with the share that moved on at each step; New and Rejected sit beside it. */
export function CampaignFunnel({ perf }: { perf: CampaignPerformance }) {
  const t = useT();
  const top = Math.max(1, perf.total);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        {perf.steps.map((s) => (
          <div key={s.key} data-testid={`funnel-${s.key}`} className="flex items-center gap-4">
            <div className="w-32 shrink-0 text-sm font-semibold text-slate-600 dark:text-gray-300">{t(`campaigns.funnel.${s.key}`)}</div>
            <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(s.count / top) * 100}%` }} />
            </div>
            <div className="w-10 text-right text-sm font-bold text-slate-800 dark:text-white">{s.count}</div>
            <div className="w-14 text-right text-xs font-semibold text-ink-muted">{s.rate === undefined ? '' : `${Math.round(s.rate * 100)}%`}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-6 text-sm text-slate-600 dark:text-gray-300 border-t border-hairline dark:border-dark-raised pt-3">
        <span data-testid="funnel-new">{t('campaigns.funnel.new')}: <b className="text-slate-800 dark:text-white">{perf.new}</b></span>
        <span data-testid="funnel-rejected">{t('campaigns.funnel.rejected')}: <b className="text-slate-800 dark:text-white">{perf.rejected}</b></span>
      </div>
    </div>
  );
}
