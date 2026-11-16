type Props = { page: number; pageSize: number; total: number; noun?: string; onPage: (page: number) => void };

const NAV = 'size-8 flex items-center justify-center rounded-lg border border-[#e6dddb] dark:border-[#3a3433] text-[#896a61] disabled:opacity-50 disabled:cursor-not-allowed';
const NUM = 'size-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors border';
const NUM_ON = `${NUM} border-[#e6dddb] dark:border-[#3a3433] bg-white dark:bg-[#251f1e] text-[#181211] dark:text-white hover:border-primary`;
const NUM_OFF = `${NUM} border-transparent text-[#896a61] hover:text-[#181211] dark:hover:text-white`;

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

export function Pagination({ page, pageSize, total, noun = 'results', onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const strong = 'font-medium text-[#181211] dark:text-white';
  return (
    <div className="px-6 py-4 border-t border-[#f4f1f0] dark:border-[#2a2423] flex items-center justify-between">
      <span className="text-xs text-[#896a61]">
        Showing <span className={strong}>{from}-{to}</span> of <span className={strong}>{total}</span> {noun}
      </span>
      <div className="flex items-center gap-2">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={NAV}>
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        {pageItems(page, pages).map((p, i) =>
          p === '...' ? (
            <span key={`gap${i}`} className="text-[#896a61] text-xs">...</span>
          ) : (
            <button key={p} onClick={() => onPage(p)} className={p === page ? NUM_ON : NUM_OFF}>{p}</button>
          ),
        )}
        <button aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className={NAV}>
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
