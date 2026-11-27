import type { ReactNode } from 'react';
import { shortDate } from '../../domain/hiring';
import type { MatchSort } from '../../domain/matchFilters';
import { stageLabel } from '../../domain/stages';
import type { MatchRow } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { BADGE, flagsOf, SOON_DAYS, STALE_DAYS, type MatchNeed } from './MatchList';

interface Props {
  rows: MatchRow[];
  need?: MatchNeed;
  today: string;
  sort: MatchSort;
  onSort?: (s: MatchSort) => void;
  onOpen: (id: string) => void;
  onAdd?: (id: string) => void;
  selected?: Set<string>;
  onSelect?: (id: string, on: boolean) => void;
}

const TH = 'px-3 py-2.5 text-left text-2xs font-bold uppercase tracking-wider text-ink-muted whitespace-nowrap';
const TD = 'px-3 py-3 align-middle text-sm';
const WARN = 'text-amber-700 dark:text-amber-400';

function Warn({ on, hint, children }: { on: boolean; hint?: string; children: ReactNode }) {
  return (
    <span title={on ? hint : undefined} className={`inline-flex items-center gap-1 font-bold ${on ? WARN : 'text-ink dark:text-gray-100'}`}>
      {on && <span aria-hidden="true" className="material-symbols-outlined text-[16px]">warning</span>}
      {children}
      {on && hint && <span className="sr-only"> ({hint})</span>}
    </span>
  );
}

/** Score as a number plus a bar, so the column reads at a glance. */
function ScoreCell({ row }: { row: MatchRow }) {
  const tone = row.score >= 70 ? 'bg-primary' : 'bg-gray-400';
  return (
    <div className="w-24" title={row.reason}>
      <div className="text-base font-extrabold text-ink dark:text-white tabular-nums"><span data-testid="match-score">{row.score}</span>%</div>
      <div aria-hidden="true" className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${row.score}%` }} />
      </div>
    </div>
  );
}

/** "3/3" when every skill is there; otherwise the count and the missing ones in red (must-haves bold). */
function SkillsCell({ row }: { row: MatchRow }) {
  const t = useT();
  const total = row.have.length + row.miss.length;
  const crit = new Set((row.critical ?? []).map((s) => s.toLowerCase()));
  const domains = (row.domainHave?.length ?? 0) + (row.domainMiss?.length ?? 0);
  return (
    <div className="space-y-0.5 min-w-[130px]">
      {total > 0 && (
        <p className={row.miss.length ? 'text-red-600 dark:text-red-300' : 'text-ink dark:text-gray-100'}>
          {!row.miss.length && <span aria-hidden="true" className="text-emerald-600 dark:text-emerald-400 font-bold">✓ </span>}
          <b className="tabular-nums">{row.have.length}/{total}</b>
          {row.miss.length > 0 && (
            <>
              {' · '}{t('matching.missing')}{' '}
              {row.miss.map((s, i) => (
                <span key={s} className={crit.has(s.toLowerCase()) ? 'font-bold' : ''}>
                  {i > 0 && ', '}{s}{crit.has(s.toLowerCase()) && <span aria-hidden="true">★</span>}
                </span>
              ))}
            </>
          )}
        </p>
      )}
      {domains > 0 && (
        <p className="text-xs text-ink-muted" title={[...(row.domainHave ?? []), ...(row.domainMiss ?? []).map((d) => `✕ ${d}`)].join(', ')}>
          {t('matching.domains')} <b className={row.domainMiss?.length ? WARN : ''}>{row.domainHave?.length ?? 0}/{domains}</b>
        </p>
      )}
    </div>
  );
}

export function MatchTable({ rows, need, today, sort, onSort, onOpen, onAdd, selected, onSelect }: Props) {
  const t = useT();
  const [lang] = useLang();
  const SortTh = ({ id, children, className = '' }: { id: MatchSort; children: ReactNode; className?: string }) => (
    <th scope="col" aria-sort={sort === id ? (id === 'rate' || id === 'available' ? 'ascending' : 'descending') : undefined} className={`${TH} ${className}`}>
      {onSort ? (
        <button type="button" onClick={() => onSort(id)} className={`inline-flex items-center gap-0.5 uppercase hover:text-primary ${sort === id ? 'text-primary' : ''}`}>
          {children}
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">{sort === id ? (id === 'rate' || id === 'available' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
        </button>
      ) : children}
    </th>
  );

  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-x-auto">
      <table data-testid="match-table" className="w-full border-collapse">
        <thead className="bg-gray-50 dark:bg-white/5 border-b border-hairline dark:border-white/10">
          <tr>
            {onSelect && <th scope="col" className={`${TH} w-10`}><span className="sr-only">{t('matching.selectCol')}</span></th>}
            <th scope="col" className={TH}>{t('matching.candidate')}</th>
            <SortTh id="score">{t('matching.matchScore')}</SortTh>
            <SortTh id="experience">{t('matching.stat.exp')}</SortTh>
            <th scope="col" className={TH}>{t('matching.stat.english')}</th>
            <SortTh id="rate">{t('matching.stat.rate')}</SortTh>
            <SortTh id="available">{t('matching.stat.start')}</SortTh>
            <th scope="col" className={TH}>{t('matching.skillsCol')}</th>
            <th scope="col" className={TH}><span className="sr-only">{t('matching.actions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const f = flagsOf(r, need, today);
            const blocked = !!r.doNotHire || !!r.pipeline;
            const stage = r.pipeline ? stageLabel(r.pipeline.stage, lang) : '';
            const isSel = selected?.has(r.candidateId);
            return (
              <tr
                key={r.candidateId}
                data-testid="match-row"
                aria-label={r.name}
                className={`border-b border-hairline dark:border-white/5 last:border-0 hover:bg-orange-50/40 dark:hover:bg-white/5 ${isSel ? 'bg-orange-50/60 dark:bg-orange-500/10' : ''} ${r.doNotHire ? 'bg-red-50/40 dark:bg-red-500/5' : ''}`}
              >
                {onSelect && (
                  <td className={TD}>
                    <input
                      type="checkbox"
                      checked={!!isSel}
                      disabled={blocked}
                      onChange={(e) => onSelect(r.candidateId, e.target.checked)}
                      aria-label={t('matching.select', { name: r.name })}
                      className="size-4 accent-[var(--color-primary,#ea580c)] disabled:opacity-40"
                    />
                  </td>
                )}
                <td className={`${TD} min-w-[180px] max-w-[240px]`}>
                  <button type="button" onClick={() => onOpen(r.candidateId)} className="block text-left font-bold text-ink dark:text-white hover:text-primary truncate max-w-full">{r.name}</button>
                  <p className="text-xs text-ink-muted truncate" title={[r.title, r.location].filter(Boolean).join(' · ')}>
                    {[r.title, r.location].filter(Boolean).join(' · ')}
                  </p>
                  {(r.doNotHire || r.pipeline || r.openToWork === false || f.staleDays > STALE_DAYS) && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {r.doNotHire && <span title={t('matching.dnhReason', { r: r.doNotHire })} className={`${BADGE} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`}>{t('matching.dnh')}</span>}
                      {r.pipeline && <span title={t('matching.inPipelineJob', { job: r.pipeline.jobTitle, stage })} className={`${BADGE} bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300`}>{t('matching.inPipeline', { stage })}</span>}
                      {r.openToWork === false && <span className={`${BADGE} bg-gray-100 text-ink-muted dark:bg-white/10`}>{t('matching.notOpen')}</span>}
                      {f.staleDays > STALE_DAYS && <span className={`${BADGE} bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300`}>{t('matching.stale', { n: Math.floor(f.staleDays / 30) })}</span>}
                    </div>
                  )}
                </td>
                <td className={TD}><ScoreCell row={r} /></td>
                <td className={`${TD} whitespace-nowrap`}>
                  <Warn on={f.lowSeniority || f.lowYears} hint={t('matching.belowJd', { v: [need?.seniority, need?.years && t('matching.yrs', { n: need.years })].filter(Boolean).join(' · ') })}>
                    {t('matching.yrs', { n: r.years })}
                  </Warn>
                  <p className="text-xs text-ink-muted">{r.seniority}</p>
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {r.english && r.english !== '—' ? (
                    <Warn on={f.lowEnglish} hint={need?.english && t('matching.belowJd', { v: need.english })}>{r.english}</Warn>
                  ) : <span className="text-ink-muted">{t('matching.notStated')}</span>}
                </td>
                <td className={`${TD} whitespace-nowrap tabular-nums`}>
                  {r.rate ? <b className="text-ink dark:text-gray-100">${r.rate.toLocaleString('en-US')}</b> : <span className="text-ink-muted">{t('matching.contactRate')}</span>}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {f.startIn === undefined ? (
                    <span className="text-ink-muted">{t('matching.notStated')}</span>
                  ) : (
                    <Warn on={f.startIn > SOON_DAYS} hint={t('matching.startLate', { n: f.startIn })}>
                      {f.startIn <= 0 ? t('matching.startNow') : shortDate(r.availableFrom!)}
                    </Warn>
                  )}
                </td>
                <td className={TD}><SkillsCell row={r} /></td>
                <td className={`${TD} whitespace-nowrap text-right w-[84px]`}>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpen(r.candidateId)}
                      aria-label={`${t('matching.viewProfile')}: ${r.name}`}
                      title={t('matching.viewProfile')}
                      className="size-8 rounded-lg border border-line dark:border-white/15 flex items-center justify-center text-ink-muted hover:text-primary hover:border-primary/50"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">visibility</span>
                    </button>
                    {onAdd && !blocked ? (
                      <button
                        type="button"
                        onClick={() => onAdd(r.candidateId)}
                        aria-label={`${t('matching.addToJob')}: ${r.name}`}
                        title={t('matching.addToJob')}
                        className="size-8 rounded-lg flex items-center justify-center text-primary hover:bg-orange-50 dark:hover:bg-orange-500/10"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">person_add</span>
                      </button>
                    ) : <span aria-hidden="true" className="size-8" />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
