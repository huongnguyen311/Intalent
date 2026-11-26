import { Link } from 'react-router-dom';
import { useT, type TKey } from '../../i18n/i18n';
import type { QueueRow } from './useUploadQueue';

const REASON_KEY: Record<NonNullable<QueueRow['reason']>, TKey> = {
  type: 'upload.reject.type',
  size: 'upload.reject.size',
  batch: 'upload.reject.batch',
  parse: 'upload.reject.parse',
};

function statusKey(r: QueueRow): TKey {
  if (r.status === 'done') return r.outcome === 'merged' ? 'upload.status.merged' : 'upload.status.created';
  return `upload.status.${r.status}`;
}

/** "3 added · 1 to review · 2 failed" over the whole queue (PRD AC-06). */
export function QueueSummary({ rows, dark }: { rows: QueueRow[]; dark?: boolean }) {
  const t = useT();
  if (!rows.length) return null;
  const done = rows.filter((r) => r.status === 'done').length;
  const review = rows.filter((r) => r.status === 'review').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  return <p className={`text-xs font-semibold ${dark ? 'text-gray-300' : 'text-[#896a61]'}`}>{t('upload.summary', { done, review, failed })}</p>;
}

type Actions = { onResolve?: (id: number, choice: 'merge' | 'skip') => void; onRetry?: (id: number) => void };

const ACTION = 'px-3 py-1 rounded-full border border-current text-xs font-bold text-primary hover:bg-primary/10 shrink-0';

const formatSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** One queue row; `dark` is the Ultra Upload glass style, otherwise the light card style. */
export function QueueRows({ rows, dark, compact, maxFiles, onResolve, onRetry }: { rows: QueueRow[]; dark?: boolean; compact?: boolean; maxFiles: number } & Actions) {
  if (compact) return <CompactRows rows={rows} maxFiles={maxFiles} onResolve={onResolve} onRetry={onRetry} />;
  const t = useT();
  const tone = (r: QueueRow) =>
    r.status === 'failed'
      ? dark ? 'text-red-400' : 'text-red-600'
      : r.status === 'review'
        ? dark ? 'text-amber-300' : 'text-amber-700'
      : r.status === 'done'
        ? r.outcome === 'merged' ? (dark ? 'text-blue-300' : 'text-blue-600') : dark ? 'text-green-400' : 'text-green-600'
        : dark ? 'text-gray-300' : 'text-[#896a61]';

  return (
    <ul className={dark ? 'space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1' : 'divide-y divide-gray-100 dark:divide-[#2a2423]'}>
      {rows.map((r) => (
        <li
          key={r.id}
          className={dark ? 'flex items-center gap-4 bg-white/5 rounded-xl border border-white/10 px-4 py-3' : 'flex items-center gap-4 px-6 py-4'}
        >
          <span className={`material-symbols-outlined text-[24px] ${dark ? 'text-gray-400' : 'text-[#896a61]'}`}>description</span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold truncate ${dark ? 'text-white' : 'text-[#181211] dark:text-white'}`}>{r.name}</p>
            <p className={`text-xs ${dark ? 'text-gray-400' : 'text-[#896a61]'}`}>{formatSize(r.size)}</p>
            {r.status === 'parsing' && (
              <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <div className="h-full bg-primary transition-all" style={{ width: `${r.progress}%` }} />
              </div>
            )}
          </div>
          <span className={`text-xs font-semibold ${tone(r)}`}>
            {r.status === 'failed' && r.reason
              ? t(REASON_KEY[r.reason], { max: maxFiles })
              : r.status === 'review'
                ? t('upload.status.review', { name: r.duplicateName ?? '' })
                : t(statusKey(r))}
          </span>
          {r.status === 'review' && onResolve && (
            <span className="flex gap-2 shrink-0">
              {r.duplicateId && (
                <Link to={`/candidates/${r.duplicateId}`} target="_blank" className="text-xs font-bold text-primary hover:underline self-center">
                  {t('upload.viewProfile')}
                </Link>
              )}
              <button onClick={() => onResolve(r.id, 'merge')} className={ACTION}>{t('upload.action.merge')}</button>
              <button onClick={() => onResolve(r.id, 'skip')} className={ACTION}>{t('upload.action.skip')}</button>
            </span>
          )}
          {r.status === 'failed' && r.reason === 'batch' && onRetry && (
            <button onClick={() => onRetry(r.id)} className={ACTION}>{t('upload.action.retry')}</button>
          )}
          {r.status === 'done' && r.candidateId && (
            <Link to={`/candidates/${r.candidateId}`} className="text-xs font-bold text-primary hover:underline">
              {t('upload.viewProfile')}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

const PILL: Record<QueueRow['status'], string> = {
  queued: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  parsing: 'bg-primary/10 text-primary',
  done: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  review: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  skipped: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400',
};
const MERGED_PILL = 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300';
const ICON: Record<QueueRow['status'], string> = {
  queued: 'schedule',
  parsing: 'progress_activity',
  done: 'check_circle',
  review: 'difference',
  failed: 'error',
  skipped: 'do_not_disturb_on',
};
const LINK = 'text-xs font-bold text-primary hover:underline shrink-0';
const BTN_SM = 'h-7 px-2.5 rounded-md border border-gray-200 dark:border-[#3a3433] text-xs font-bold text-[#181211] dark:text-white hover:border-primary hover:text-primary shrink-0';

/** Dense rows for the redesigned upload workspace: file, size, status pill and inline actions. */
function CompactRows({ rows, maxFiles, onResolve, onRetry }: { rows: QueueRow[]; maxFiles: number } & Actions) {
  const t = useT();
  return (
    <ul className="divide-y divide-gray-100 dark:divide-[#2a2423]">
      {rows.map((r) => {
        const pill = r.status === 'done' && r.outcome === 'merged' ? MERGED_PILL : PILL[r.status];
        const label =
          r.status === 'failed' && r.reason
            ? t(REASON_KEY[r.reason], { max: maxFiles })
            : r.status === 'review'
              ? t('upload.status.review', { name: r.duplicateName ?? '' })
              : t(statusKey(r));
        return (
          <li key={r.id} className="upload-row-in flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
            <span className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${pill}`}>
              <span className={`material-symbols-outlined text-[18px] ${r.status === 'parsing' ? 'animate-spin' : ''}`}>{ICON[r.status]}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold truncate text-[#181211] dark:text-white" title={r.name}>{r.name}</p>
              <div className="flex items-center gap-2 mt-0.5 min-w-0">
                <span className="text-[11px] text-gray-400 tabular-nums shrink-0">{formatSize(r.size)}</span>
                {r.status === 'parsing' ? (
                  <span className="flex-1 max-w-[160px] h-1 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                    <span className="block h-full bg-primary transition-all" style={{ width: `${r.progress}%` }} />
                  </span>
                ) : null}
              </div>
            </div>
            <span className={`inline-flex items-center h-6 shrink-0 px-2 rounded-full text-[11px] font-semibold max-w-[260px] truncate ${pill}`}>
              <span className="truncate">{label}</span>
            </span>
            {r.status === 'review' && onResolve && (
              <span className="flex items-center gap-1.5 shrink-0">
                {r.duplicateId && (
                  <Link to={`/candidates/${r.duplicateId}`} target="_blank" className={`${LINK} mr-1`}>
                    {t('upload.viewProfile')}
                  </Link>
                )}
                <button onClick={() => onResolve(r.id, 'merge')} className={`${BTN_SM} !border-primary !text-primary hover:bg-primary/5`}>{t('upload.action.merge')}</button>
                <button onClick={() => onResolve(r.id, 'skip')} className={BTN_SM}>{t('upload.action.skip')}</button>
              </span>
            )}
            {r.status === 'failed' && r.reason === 'batch' && onRetry && (
              <button onClick={() => onRetry(r.id)} className={BTN_SM}>{t('upload.action.retry')}</button>
            )}
            {r.status === 'done' && r.candidateId && (
              <Link to={`/candidates/${r.candidateId}`} className={LINK}>
                {t('upload.viewProfile')}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
type StatKey = 'created' | 'merged' | 'review' | 'failed' | 'skipped' | 'pending';
/** Segment colours match the row pills, so the bar reads as a map of the list below. */
const STAT: { key: StatKey; bar: string; label: TKey }[] = [
  { key: 'created', bar: 'bg-green-500', label: 'upload.stat.created' },
  { key: 'merged', bar: 'bg-blue-500', label: 'upload.stat.merged' },
  { key: 'review', bar: 'bg-amber-400', label: 'upload.stat.review' },
  { key: 'failed', bar: 'bg-red-500', label: 'upload.stat.failed' },
  { key: 'skipped', bar: 'bg-gray-400 dark:bg-gray-500', label: 'upload.stat.skipped' },
  { key: 'pending', bar: 'bg-primary/30', label: 'upload.stat.pending' },
];

const countStats = (rows: QueueRow[]): Record<StatKey, number> => {
  const c: Record<StatKey, number> = { created: 0, merged: 0, review: 0, failed: 0, skipped: 0, pending: 0 };
  for (const r of rows) {
    if (r.status === 'done') c[r.outcome === 'merged' ? 'merged' : 'created']++;
    else if (r.status === 'queued' || r.status === 'parsing') c.pending++;
    else c[r.status]++;
  }
  return c;
};

/** Segmented progress bar (one colour per outcome) with a dot legend of the non-zero counts. */
export function QueueStats({ rows }: { rows: QueueRow[] }) {
  const t = useT();
  if (!rows.length) return null;
  const c = countStats(rows);
  const total = rows.length;
  const pct = Math.round(((total - c.pending) / total) * 100);
  const shown = STAT.filter((s) => c[s.key] > 0);
  const summary = t('upload.summary', { done: c.created + c.merged, review: c.review, failed: c.failed });
  return (
    <div className="px-4 pt-1 pb-3 border-b border-gray-100 dark:border-[#2a2423]">
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t('upload.stat.progress')}
          className="flex-1 flex h-1.5 gap-0.5 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5"
        >
          {STAT.map((s) =>
            c[s.key] ? (
              <span key={s.key} className={`h-full transition-[width] duration-500 ease-out ${s.bar}`} style={{ width: `${(c[s.key] / total) * 100}%` }} />
            ) : null,
          )}
        </div>
        <span className="text-[11px] font-bold tabular-nums text-[#181211] dark:text-white w-9 text-right">{pct}%</span>
      </div>
      <ul aria-label={summary} className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {shown.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5 text-xs text-[#896a61]">
            <span className={`size-2 rounded-full ${s.bar}`} aria-hidden="true" />
            <span className="font-bold tabular-nums text-[#181211] dark:text-white">{c[s.key]}</span>
            {t(s.label)}
          </li>
        ))}
      </ul>
    </div>
  );
}
