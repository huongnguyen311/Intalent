import { useStageName } from './jobStageContext';
import { MenuItem, Popover } from '../../components/Popover';
import type { Stage } from '../../domain/types';
import { useT } from '../../i18n/i18n';

type Props = {
  count: number;
  /** Stages offered in "Move to"; Rejected has its own button. */
  stages: Stage[];
  onMove: (to: Stage) => void;
  onClear: () => void;
};

/** Shown while cards are selected: move them all, reject them all (one reason for the batch), or clear. */
export function BulkBar({ count, stages, onMove, onClear }: Props) {
  const t = useT();
  const label = useStageName();
  const targets = stages.filter((s) => s !== 'rejected');
  return (
    <div
      role="region"
      aria-label={t('pipeline.bulk.region')}
      className="sticky top-0 z-10 mb-3 flex items-center gap-2 flex-wrap rounded-2xl border border-primary/30 bg-orange-50 dark:bg-[#2a2423] px-3 py-2 text-sm"
    >
      <span className="font-bold text-slate-800 dark:text-white">{t('pipeline.bulk.selected', { n: count })}</span>
      <Popover
        align="left"
        trigger={({ toggle }) => (
          <button onClick={toggle} className="h-8 px-3 rounded-full bg-primary text-white text-xs font-bold flex items-center gap-1 hover:bg-primary-hover">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_forward</span>
            {t('pipeline.moveTo')}
          </button>
        )}
      >
        {(close) => targets.map((s) => (
          <MenuItem key={s} onClick={() => { close(); onMove(s); }}>{label(s)}</MenuItem>
        ))}
      </Popover>
      <button onClick={() => onMove('rejected')} className="h-8 px-3 rounded-full border border-red-300 text-red-600 text-xs font-bold flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-500/10">
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">block</span>
        {t('pipeline.bulk.reject')}
      </button>
      <button onClick={onClear} className="ml-auto h-8 px-3 rounded-full text-xs font-bold text-[#896a61] hover:text-primary">
        {t('pipeline.bulk.clear')}
      </button>
    </div>
  );
}
