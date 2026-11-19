import { useJobStages, useStageName } from './jobStageContext';
import { useMemo, useState } from 'react';
import { Pagination, usePaginationLabels } from '../../components/Pagination';
import { aiRank, latestEvaluation } from '../../domain/aiEvaluation';
import { averageRating, daysInStage, isOverSla } from '../../domain/pipeline';
import type { Application, Candidate, Job, Stage } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { fullDate } from '../jds/format';
import { STAGE_COLOR } from '../jobs/JobBits';
import { awaitsScorecardFrom } from '../../domain/hiring';
import { normalizeRole } from '../../domain/permissions';
import { useMe } from '../../store/session';
import { AI_PILL, MoveToMenu } from './CandidateCard';
import { JobStageProvider } from './jobStageContext';

export const LIST_PAGE_SIZE = 20;

type SortKey = 'candidate' | 'stage' | 'source' | 'days' | 'score' | 'rating' | 'added';
type Sort = { key: SortKey; dir: 'asc' | 'desc' } | null;

type Props = {
  /** The job each row belongs to (one job, or many on the "All jobs" board). */
  jobOf: (app: Application) => Job;
  /** "All jobs": rows name their job and offer that job's own columns. */
  showJob?: boolean;
  apps: Application[];
  candidates: Map<string, Candidate>;
  onOpen: (appId: string) => void;
  onMove: (appId: string, to: Stage) => void;
  /** "Sort: AI score" from the header: rank by AI score within a stage when no column sort is set. */
  aiOrder?: boolean;
  /** Bulk selection shared with the board; omit to hide the checkbox column. */
  selected?: Set<string>;
  onSelect?: (ids: string[], on: boolean) => void;
};

const TH = 'px-4 py-3 text-left text-xs font-bold text-[#896a61] uppercase tracking-wider whitespace-nowrap';
const FILLED = { fontVariationSettings: "'FILL' 1" };

/** Sortable, paged table version of the pipeline; the row menu goes through the same move flow as the board. */
export function PipelineList({ jobOf, showJob, apps, candidates, onOpen, onMove, aiOrder = false, selected, onSelect }: Props) {
  const t = useT();
  const label = useStageName();
  const labels = usePaginationLabels();
  const stages = useJobStages();
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const now = Date.now();
    const name = (a: Application) => candidates.get(a.candidateId)?.name ?? a.candidateId;
    const value: Record<SortKey, (a: Application) => string | number> = {
      candidate: name,
      stage: (a) => stages.indexOf(a.stage),
      source: (a) => a.source,
      days: (a) => daysInStage(a, now),
      score: (a) => aiRank(a),
      rating: (a) => averageRating(a) ?? -1,
      added: (a) => a.addedAt,
    };
    const cmp = (x: string | number, y: string | number) => (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)));
    const list = [...apps];
    if (!sort) {
      // Default: pipeline order, the longest-waiting candidate first within a stage.
      // With "Sort: AI score", the highest score comes first within a stage instead.
      const within = aiOrder ? (a: Application, b: Application) => aiRank(b) - aiRank(a) : (a: Application, b: Application) => cmp(value.days(b), value.days(a));
      return list.sort((a, b) => cmp(value.stage(a), value.stage(b)) || within(a, b));
    }
    const f = sort.dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => f * cmp(value[sort.key](a), value[sort.key](b)));
  }, [apps, sort, candidates, aiOrder, stages]);

  const pages = Math.max(1, Math.ceil(rows.length / LIST_PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * LIST_PAGE_SIZE, current * LIST_PAGE_SIZE);

  const toggle = (key: SortKey) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setPage(1);
  };
  const head = (key: SortKey, label: string) => {
    const on = sort?.key === key;
    return (
      <th scope="col" aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={TH}>
        <button onClick={() => toggle(key)} className="inline-flex items-center gap-1 uppercase tracking-wider font-bold hover:text-primary">
          {label}
          <span aria-hidden="true" className={`material-symbols-outlined text-[14px] ${on ? 'text-primary' : 'opacity-40'}`}>
            {on && sort.dir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] border-b border-[#f4f1f0] dark:border-[#2a2423]">
            <tr>
              {onSelect && selected && (
                <th className="w-10 pl-4">
                  <input
                    type="checkbox"
                    aria-label={t('pipeline.bulk.selectPage')}
                    checked={visible.length > 0 && visible.every((a) => selected.has(a.id))}
                    onChange={(e) => onSelect(visible.filter((a) => !a.handoff).map((a) => a.id), e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </th>
              )}
              {head('candidate', t('pipeline.list.candidate'))}
              {head('stage', t('pipeline.list.stage'))}
              {head('source', t('pipeline.list.source'))}
              {head('days', t('pipeline.list.days'))}
              {head('score', t('pipeline.list.score'))}
              {head('rating', t('pipeline.list.rating'))}
              {head('added', t('pipeline.list.added'))}
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => {
              const c = candidates.get(a.candidateId);
              const n = c?.name ?? a.candidateId;
              const job = jobOf(a);
              const late = isOverSla(a, job);
              const avg = averageRating(a);
              return (
                <tr
                  key={a.id}
                  data-testid={`row-${a.id}`}
                  onClick={() => onOpen(a.id)}
                  className="border-b border-[#f4f1f0] dark:border-[#2a2423] last:border-b-0 cursor-pointer hover:bg-[#f8f6f6] dark:hover:bg-white/5 transition-colors"
                >
                  {onSelect && selected && (
                    <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                      {!a.handoff && (
                        <input
                          type="checkbox"
                          aria-label={t('pipeline.bulk.select', { name: n })}
                          checked={selected.has(a.id)}
                          onChange={(e) => onSelect([a.id], e.target.checked)}
                          className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpen(a.id); }}
                          className="block max-w-full text-left font-bold text-slate-800 dark:text-white truncate hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                        >
                          {n}
                        </button>
                        <div className="text-xs text-[#896a61] truncate">{showJob ? job.title : c?.title}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#f4f1f0] dark:bg-[#2a2423] text-xs font-medium whitespace-nowrap">
                      <span aria-hidden="true" className="size-2 rounded-full" style={{ background: STAGE_COLOR[a.stage] }}></span>
                      {label(a.stage, job)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#896a61]">{a.source}</td>
                  <td className="px-4 py-2.5 font-medium" title={late ? t('pipeline.overSla', { n: job.stageSla[a.stage] ?? 0 }) : undefined}>
                    {t('jobs.days', { n: daysInStage(a) })}{late ? ' ⚠' : ''}
                  </td>
                  <td className="px-4 py-2.5"><ScoreCell app={a} /></td>
                  <td className="px-4 py-2.5">
                    {avg !== undefined ? (
                      <span aria-label={t('pipeline.avgRating', { n: avg })} className="inline-flex items-center gap-0.5 font-bold text-slate-600 dark:text-gray-300">
                        <span className="material-symbols-outlined text-[14px] text-amber-400" style={FILLED}>star</span>
                        {avg}
                      </span>
                    ) : (
                      <span className="text-gray-300">–</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[#896a61] whitespace-nowrap">{fullDate(a.addedAt)}</td>
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    {showJob ? <JobStageProvider job={job}>{<MoveToMenu
                      current={a.stage}
                      onMove={(to) => onMove(a.id, to)}
                      button={(open) => (
                        <button aria-label={t('pipeline.moveTo')} onClick={open} className="size-7 rounded-full flex items-center justify-center text-[#896a61] hover:text-primary hover:bg-[#f4f1f0] dark:hover:bg-white/5">
                          <span className="material-symbols-outlined text-[18px]">more_vert</span>
                        </button>
                      )}
                    />}</JobStageProvider> : (
                    <MoveToMenu
                      current={a.stage}
                      onMove={(to) => onMove(a.id, to)}
                      button={(open) => (
                        <button aria-label={t('pipeline.moveTo')} onClick={open} className="size-7 rounded-full flex items-center justify-center text-[#896a61] hover:text-primary hover:bg-[#f4f1f0] dark:hover:bg-white/5">
                          <span className="material-symbols-outlined text-[18px]">more_vert</span>
                        </button>
                      )}
                    />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination labels={labels} page={current} pageSize={LIST_PAGE_SIZE} total={rows.length} noun={t('pipeline.list.noun')} onPage={setPage} />
    </div>
  );
}

/** Same rule as the card badge: an interviewer sees no score until their scorecard is in. */
function ScoreCell({ app }: { app: Application }) {
  const t = useT();
  const user = useMe();
  if (normalizeRole(user.role) === 'Interviewer' && awaitsScorecardFrom(app, user.id)) return <span className="text-gray-300">–</span>;
  if (app.aiPending) return <span className="text-xs text-gray-400">{t('ai.badge.pending')}</span>;
  const e = latestEvaluation(app);
  if (!e || e.noCriteria) return <span className="text-gray-300">–</span>;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${AI_PILL}`}>{`✦ ${e.score}`}</span>;
}
