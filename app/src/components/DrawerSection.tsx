import { useId, type ReactNode } from 'react';

type Props = {
  /** Material Symbols name shown in the tile before the title. */
  icon: string;
  title: string;
  /** Small number after the title (rounds, comments...). */
  count?: number;
  /** One line under the title saying what the block is for, when the title alone does not. */
  hint?: string;
  /** Button or link at the right of the heading. */
  action?: ReactNode;
  /** Tile colour; AI uses violet so it reads as machine output, everything else stays neutral. */
  tone?: 'neutral' | 'violet';
  children: ReactNode;
};

const TILE = {
  neutral: 'bg-gray-100 text-ink-muted dark:bg-white/10 dark:text-gray-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
};

/**
 * One block of a side drawer. Blocks are split by a full-width band (the drawer body pads 24px, hence -mx-6),
 * so each reads as its own section rather than one long scroll.
 */
export function DrawerSection({ icon, title, count, hint, action, tone = 'neutral', children }: Props) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="-mx-6 px-6 py-5 border-t-[10px] border-[#efeaea] dark:border-[#0e0b0b] first:border-t-0 first:pt-0">
      <div className="flex items-start gap-2.5 mb-4">
        <span aria-hidden="true" className={`mt-px size-7 shrink-0 rounded-lg grid place-items-center ${TILE[tone]}`}>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </span>
        <div className="flex-1 min-w-0">
          <h4 id={id} className="ty-section text-base leading-7 font-bold text-slate-800 dark:text-white">
            {title}
            {count !== undefined && <span className="ml-1.5 text-ink-muted font-medium">({count})</span>}
          </h4>
          {hint && <p className="text-xs text-ink-muted">{hint}</p>}
        </div>
        {action && <div className="shrink-0 mt-0.5">{action}</div>}
      </div>
      {children}
    </section>
  );
}
