import { pageItems } from '../../components/Pagination';
import type { ReactNode } from 'react';
import { Popover } from '../../components/Popover';
import { WEIGHTS } from '../../domain/scoring';
import type { MatchRow } from '../../domain/types';
import { useT } from '../../i18n/i18n';

const initialsOf = (name: string) => {
  const p = name.trim().split(/\s+/);
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

function SkillChip({ label, ok }: { label: string; ok: boolean }) {
  return ok ? (
    <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 rounded border border-emerald-100 dark:border-emerald-500/20 whitespace-nowrap">✓ {label}</span>
  ) : (
    <span className="px-2 py-0.5 text-xs font-medium bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300 rounded border border-red-100 dark:border-red-500/20 whitespace-nowrap">✕ {label}</span>
  );
}

function Fact({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-sm text-[#181211] dark:text-gray-200">
      <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-[#896a61]">{icon}</span>
      <span className="truncate">{children}</span>
    </li>
  );
}

/** The score badge; its ⓘ opens why the candidate got this score (AI reason + points per criterion). */
function ScoreBadge({ row }: { row: MatchRow }) {
  const t = useT();
  const parts = row.breakdown
    ? ([
        ['matching.w.stack', row.breakdown.stack, WEIGHTS.stack],
        ['matching.w.exp', row.breakdown.experience, WEIGHTS.experience],
        ['matching.w.domain', row.breakdown.domain, WEIGHTS.domain],
        ['matching.w.english', row.breakdown.english, WEIGHTS.english],
      ] as const)
    : [];
  return (
    <div className="flex items-center gap-2 pl-4 pr-2 py-2 rounded-2xl bg-orange-50 dark:bg-orange-500/10">
      <div className="text-center leading-none">
        <div className="text-[28px] font-extrabold text-primary"><span data-testid="match-score">{row.score}</span>%</div>
        <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-primary/80">{t('matching.matchScore')}</div>
      </div>
      <Popover
        align="right"
        trigger={({ toggle, open }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={t('matching.whyScore')}
            title={t('matching.whyScore')}
            className="size-8 rounded-full flex items-center justify-center text-primary hover:bg-orange-100 dark:hover:bg-orange-500/20"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">info</span>
          </button>
        )}
      >
        {() => (
          <div className="w-72 px-4 py-3 space-y-3 text-sm">
            <p className="text-slate-700 dark:text-gray-200">
              <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-primary align-middle mr-1">auto_awesome</span>
              {row.reason}
            </p>
            {parts.length > 0 && (
              <ul className="space-y-1.5">
                {parts.map(([k, got, max]) => (
                  <li key={k} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[#896a61]">{t(k)}</span>
                    <span className="font-bold text-[#181211] dark:text-gray-100 tabular-nums">{got}/{max}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Popover>
    </div>
  );
}

export function MatchCard({ row, onOpen, onAdd }: { row: MatchRow; onOpen: () => void; onAdd?: () => void }) {
  const t = useT();
  return (
    <article
      data-testid="match-card"
      aria-label={row.name}
      className="relative overflow-hidden bg-white dark:bg-surface-dark rounded-[1.5rem] border border-gray-100 dark:border-white/10 shadow-sm pl-7 pr-6 py-6 flex flex-col lg:flex-row lg:items-center gap-5"
    >
      <span aria-hidden="true" className="absolute left-0 inset-y-0 w-1.5 bg-primary" />
      <div className="flex items-center gap-4 lg:w-[300px] shrink-0 min-w-0">
        <div aria-hidden="true" className="size-16 rounded-full bg-gray-100 dark:bg-white/10 text-[#6b5550] dark:text-gray-300 flex items-center justify-center text-xl font-bold shrink-0">{initialsOf(row.name)}</div>
        <div className="min-w-0">
          <button type="button" onClick={onOpen} className="block text-left text-lg font-bold text-[#181211] dark:text-white hover:text-primary truncate max-w-full">{row.name}</button>
          <p className="text-sm text-[#896a61] truncate">{row.title}</p>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <ul className="space-y-1.5">
          <Fact icon="work">{t('matching.yearsExp', { n: row.years })} · {row.seniority}</Fact>
          {row.location && <Fact icon="location_on">{row.location}</Fact>}
          <Fact icon="payments">{row.rate ? t('matching.rate', { n: row.rate.toLocaleString('en-US') }) : t('matching.contactRate')}</Fact>
        </ul>
        {row.have.length + row.miss.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {row.have.map((s) => <SkillChip key={`h${s}`} label={s} ok />)}
            {row.miss.map((s) => <SkillChip key={`m${s}`} label={s} ok={false} />)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <ScoreBadge row={row} />
        <div className="flex flex-col items-stretch gap-2">
          <button type="button" onClick={onOpen} className="px-5 h-11 rounded-xl border border-[#e6dddb] dark:border-white/15 bg-white dark:bg-transparent text-sm font-bold text-[#181211] dark:text-gray-100 hover:border-primary/50 whitespace-nowrap">
            {t('matching.viewProfile')}
          </button>
          {onAdd && (
            <button type="button" onClick={onAdd} className="text-xs font-bold text-primary hover:underline whitespace-nowrap">
              + {t('matching.addToJob')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

const NAV = 'size-8 flex items-center justify-center rounded-lg border border-[#e6dddb]';

export function MatchPager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  return (
    <div className="px-6 py-4 flex items-center justify-between text-sm text-[#896a61] border-t border-[#f4f1f0]">
      <span>
        {t('matching.showing')} <b className="text-[#181211]">{from}-{Math.min(page * pageSize, total)}</b> {t('matching.of')} <b className="text-[#181211]">{total}</b> {t('matching.matches')}
      </span>
      <div className="flex items-center gap-1">
        <button aria-label="Previous page" aria-disabled={page <= 1} onClick={() => page > 1 && onPage(page - 1)} className={NAV}>
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        {pageItems(page, pages).map((p, i) =>
          p === '...' ? (
            <button key={`gap${i}`} className={NAV}>…</button>
          ) : (
            <button key={p} onClick={() => onPage(p)} className={p === page ? 'size-8 flex items-center justify-center rounded-lg bg-primary text-white font-bold' : NAV}>{p}</button>
          ),
        )}
        <button aria-label="Next page" aria-disabled={page >= pages} onClick={() => page < pages && onPage(page + 1)} className={NAV}>
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
