import { pageItems } from '../../components/Pagination';
import type { MatchRow } from '../../domain/types';
import { useT } from '../../i18n/i18n';

const AVATARS = [
  'bg-purple-100 text-purple-600 border-purple-200',
  'bg-blue-100 text-blue-600 border-blue-200',
  'bg-emerald-100 text-emerald-600 border-emerald-200',
  'bg-amber-100 text-amber-600 border-amber-200',
];

const tone = (s: number): [string, string, string] =>
  s >= 80 ? ['#ecfdf5', '#059669', '#10b981'] : s >= 60 ? ['#fffbeb', '#d97706', '#f59e0b'] : ['#fef2f2', '#dc2626', '#ef4444'];

const initialsOf = (name: string) => {
  const p = name.trim().split(/\s+/);
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

function SkillChip({ label, ok }: { label: string; ok: boolean }) {
  return ok ? (
    <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-600 rounded border border-emerald-100 whitespace-nowrap">✓ {label}</span>
  ) : (
    <span className="px-2 py-0.5 text-xs font-medium bg-red-50 text-red-500 rounded border border-red-100 whitespace-nowrap">✕ {label}</span>
  );
}

export function MatchRowItem({ row, rank, onOpen }: { row: MatchRow; rank: number; onOpen: () => void }) {
  const t = useT();
  const [bg, fg, bar] = tone(row.score);
  return (
    <div role="link" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} className="jm-row px-6 py-5 flex items-start gap-4 cursor-pointer transition-colors">
      <div className="text-sm font-bold text-gray-400 w-5 pt-3">{rank}</div>
      <div className={`size-10 rounded-full flex items-center justify-center font-bold text-sm border shrink-0 ${AVATARS[(rank - 1) % 4]}`}>{initialsOf(row.name)}</div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-[#181211]">{row.name}</span>
          <span className="text-xs text-[#896a61]">· {row.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {row.have.map((s) => <SkillChip key={`h${s}`} label={s} ok />)}
          {row.miss.map((s) => <SkillChip key={`m${s}`} label={s} ok={false} />)}
          <span className="text-xs text-[#896a61] ml-1">{row.seniority} · {t('jd.yrs', { n: row.years })} · {t('matching.english', { level: row.english })}</span>
        </div>
        <p className="text-sm text-slate-600">
          <span className="material-symbols-outlined text-[14px] text-purple-500 align-middle">auto_awesome</span> {row.reason}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0" style={{ width: 120 }}>
        <div className="jm-score" style={{ background: bg, color: fg }}>{row.score}</div>
        <div className="jm-bar w-full"><div style={{ width: `${row.score}%`, background: bar }}></div></div>
      </div>
    </div>
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
