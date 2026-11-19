import { useStageName } from './jobStageContext';
import type { Stage } from '../../domain/types';
import { STAGE_COLOR } from '../jobs/JobBits';

type Props = {
  stage: Stage;
  /** Visible (filtered) cards in the column. */
  count: number;
};

/** Column title (board style): stage name + filled count pill, with a thick stage-colour rule underneath. */
export function ColumnHeader({ stage, count }: Props) {
  const label = useStageName();
  const color = STAGE_COLOR[stage];
  const name = label(stage);
  return (
    <header data-testid="column-header" className="-mx-2 -mt-2 mb-2 px-3 py-3 border-b-[3px]" style={{ borderBottomColor: color, background: `${color}24` }}>
      <div className="flex items-center gap-2 min-w-0 h-7">
        <span className="min-w-0 text-[15px] font-bold text-slate-800 dark:text-white leading-tight truncate" title={name}>{name}</span>
        <span
          data-testid="column-count"
          className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full text-[12px] font-bold tabular-nums text-white flex items-center justify-center"
          style={{ background: color }}
        >
          {count}
        </span>
      </div>
    </header>
  );
}
