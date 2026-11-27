import { useT } from '../i18n/i18n';

/** Words around the numbers; the default is today's English so ported screens keep their pixels. */
export type PaginationLabels = { showing: string; of: string; prev: string; next: string };
const EN_LABELS: PaginationLabels = { showing: 'Showing', of: 'of', prev: 'Previous page', next: 'Next page' };

/** Translated labels for screens added after the mockup. */
export function usePaginationLabels(): PaginationLabels {
  const t = useT();
  return { showing: t('pagination.showing'), of: t('pagination.of'), prev: t('pagination.prev'), next: t('pagination.next') };
}

type Props = {
  page: number; pageSize: number; total: number; noun?: string; labels?: PaginationLabels; onPage: (page: number) => void;
  /** With both set, a "Rows per page" picker shows on the right and the page numbers move to the middle. */
  pageSizes?: number[]; onPageSize?: (size: number) => void; rowsLabel?: string;
};

const NAV = 'size-8 flex items-center justify-center rounded-lg border border-line dark:border-dark-line text-ink-muted disabled:opacity-50 disabled:cursor-not-allowed';
const NEXT = `${NAV} bg-white dark:bg-dark-surface text-ink dark:text-white hover:border-primary transition-colors`;
const NUM = 'size-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors border';
const NUM_ON = `${NUM} border-line dark:border-dark-line bg-white dark:bg-dark-surface text-ink dark:text-white hover:border-primary`;
const NUM_OFF = `${NUM} border-transparent text-ink-muted hover:text-ink dark:hover:text-white`;

/** Page numbers: first, current±1, last, with "..." gaps. */
export function pageItems(page: number, pages: number): (number | '...')[] {
  const want = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const out: (number | '...')[] = [];
  let prev = 0;
  for (const p of [...want].sort((a, b) => a - b)) {
    if (p - prev > 1) out.push('...');
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({ page, pageSize, total, noun = 'results', labels = EN_LABELS, onPage, pageSizes, onPageSize, rowsLabel }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const strong = 'font-medium text-ink dark:text-white';
  return (
    <div className="px-6 py-4 border-t border-hairline dark:border-dark-raised flex items-center justify-between">
      <span className="text-xs text-ink-muted">
        {labels.showing} <span className={strong}>{from}-{to}</span> {labels.of} <span className={strong}>{total}</span> {noun}
      </span>
      <div className="flex items-center gap-2">
        <button aria-label={labels.prev} disabled={page <= 1} onClick={() => onPage(page - 1)} className={NAV}>
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        {pageItems(page, pages).map((p, i) =>
          p === '...' ? (
            <span key={`gap${i}`} className="text-ink-muted text-xs">...</span>
          ) : (
            <button key={p} onClick={() => onPage(p)} className={p === page ? NUM_ON : NUM_OFF}>{p}</button>
          ),
        )}
        <button aria-label={labels.next} disabled={page >= pages} onClick={() => onPage(page + 1)} className={NEXT}>
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
      {pageSizes && onPageSize && (
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          {rowsLabel}
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 pl-2 pr-7 rounded-lg border border-line dark:border-dark-line bg-white dark:bg-dark-surface text-xs font-medium text-ink dark:text-white"
          >
            {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
