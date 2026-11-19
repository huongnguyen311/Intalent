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
export function QueueRows({ rows, dark, maxFiles, onResolve, onRetry }: { rows: QueueRow[]; dark?: boolean; maxFiles: number } & Actions) {
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
