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

const formatSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** One queue row; `dark` is the Ultra Upload glass style, otherwise the light card style. */
export function QueueRows({ rows, dark, maxFiles }: { rows: QueueRow[]; dark?: boolean; maxFiles: number }) {
  const t = useT();
  const tone = (r: QueueRow) =>
    r.status === 'failed'
      ? dark ? 'text-red-400' : 'text-red-600'
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
            {r.status === 'failed' && r.reason ? t(REASON_KEY[r.reason], { max: maxFiles }) : t(statusKey(r))}
          </span>
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
