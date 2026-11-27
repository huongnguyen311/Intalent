import { useStageName } from './jobStageContext';
import type { Stage } from '../../domain/types';
import { STAGE_COLOR } from '../jobs/JobBits';

type Props = {
  stage: Stage;
  /** Visible (filtered) cards in the column. */
  count: number;
};

/** Column title (board style): stage dot + name + soft count pill, with a thin muted stage-colour rule underneath. */
export function ColumnHeader({ stage, count }: Props) {
  const label = useStageName();
  const color = STAGE_COLOR[stage];
  const name = label(stage);
  return (
    <header data-testid="column-header" className="-mx-2 -mt-2 mb-2 px-3 py-3 border-b-2" style={{ borderBottomColor: `${color}80`, background: `${color}0f` }}>
      <div className="flex items-center gap-2 min-w-0 h-7">
        <span aria-hidden="true" className="shrink-0 size-2 rounded-full" style={{ background: color }} />
        <span className="min-w-0 text-[15px] font-bold text-slate-700 dark:text-white leading-tight truncate" title={name}>{name}</span>
        <span
          data-testid="column-count"
          className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold tabular-nums text-slate-600 dark:text-slate-200 flex items-center justify-center"
          style={{ background: `${color}1f` }}
        >
          {count}
        </span>
      </div>
    </header>
  );
}
