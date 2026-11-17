import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { toast } from '../../components/Toast';
import { MenuItem, Popover } from '../../components/Popover';
import { Pagination } from '../../components/Pagination';
import { isFixtureMode } from '../../data/fixtureMockup';
import type { Jd } from '../../domain/types';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { DeleteJdModal } from './DeleteJdModal';
import { monthDay, year } from './format';
import { JdEditor } from './JdEditor';

const PAGE_SIZE = 10;
const FILTER_BTN =
  'flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm font-medium text-[#181211] dark:text-white hover:border-primary/50 transition-colors whitespace-nowrap ';
const INPUT =
  'w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] focus:border-primary focus:ring-0 rounded-lg text-sm text-[#181211] dark:text-white transition-all placeholder-[#896a61]';
const TH = 'px-6 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]  ';
const TD = 'px-6 py-4 whitespace-nowrap ';

type Sort = 'newest' | 'oldest' | 'title';
const SORTS: Array<[Sort, TKey]> = [['newest', 'jds.sort.newest'], ['oldest', 'jds.sort.oldest'], ['title', 'jds.sort.title']];

export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const published = status === 'Published';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${published ? 'bg-[#ECFDF5] text-[#10B981]' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`size-1.5 rounded-full ${published ? 'bg-[#10B981]' : 'bg-gray-400'}`}></span>
      {t(published ? 'jds.status.published' : 'jds.status.draft')}
    </span>
  );
}

function FilterButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={FILTER_BTN}>
      <span className="material-symbols-outlined text-[18px] text-[#896a61]">{icon}</span>
      <span>{label}</span>
      <span className="material-symbols-outlined text-[18px] text-[#896a61]">expand_more</span>
    </button>
  );
}

const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.trim().toLowerCase());

export function JdListPage() {
  const t = useT();
  const navigate = useNavigate();
  const jds = useStore((s) => s.jds);
  const [client, setClient] = useState('');
  const [q, setQ] = useState('');
  const [stack, setStack] = useState('');
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ jd?: Jd } | null>(null);
  const [deleting, setDeleting] = useState<Jd | null>(null);

  const search = isFixtureMode() ? '?fixture=mockup' : '';
  const open = (jd: Jd) => navigate({ pathname: `/jds/${jd.id}`, search });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const domains = useMemo(() => [...new Set(jds.flatMap((j) => j.domains))].sort(), [jds]);
  const filtered = useMemo(() => {
    const out = jds.filter(
      (j) =>
        (!client.trim() || has(j.client, client)) &&
        (!q.trim() || has(j.title, q) || j.domains.some((d) => has(d, q)) || j.skills.some((s) => has(s, q))) &&
        (!stack.trim() || j.skills.some((s) => has(s, stack))) &&
        (!domain || j.domains.includes(domain)) &&
        (!status || j.status === status),
    );
    return out.sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title)
        : sort === 'oldest' ? a.updatedAt.localeCompare(b.updatedAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [jds, client, q, stack, domain, status, sort]);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const publish = (jd: Jd) => {
    const next = jd.status === 'Published' ? 'Draft' : 'Published';
    useStore.getState().setJdStatus(jd.id, next);
    toast(t(next === 'Published' ? 'jds.toast.published' : 'jds.toast.unpublished'));
  };

  const optionMenu = (value: string, set: (v: string) => void, options: Array<[string, string]>) => (close: () => void) => (
    <>
      {options.map(([v, label]) => (
        <MenuItem key={v} active={v === value} onClick={() => { set(v); close(); }}>{label}</MenuItem>
      ))}
    </>
  );

  return (
    <AppLayout title={t('nav.jdManagement')} subtitle={t('jds.subtitle')}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-8 min-h-full">
        <div className="flex items-center justify-between gap-4">
          <div className="relative group w-full max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#896a61] group-focus-within:text-primary transition-colors pointer-events-none flex items-center">
              <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
            </span>
            <input placeholder={t('jds.filter.client')} className={INPUT} type="text" value={client} onChange={(e) => reset(setClient)(e.target.value)} />
          </div>
          <button onClick={() => setEditor({})} className="px-6 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all transform active:scale-95 text-sm shrink-0">
            <span className="material-symbols-outlined text-[20px]">add</span> {t('jds.create')}
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[280px] max-w-md relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#896a61] group-focus-within:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </span>
            <input className={INPUT} placeholder={t('jds.search')} type="text" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
          </div>
          <Popover trigger={({ toggle }) => <FilterButton icon="filter_list" label={t('jds.filter.domain', { value: domain || t('jds.filter.allDomains') })} onClick={toggle} />}>
            {optionMenu(domain, reset(setDomain), [['', t('jds.filter.allDomains')], ...domains.map((d): [string, string] => [d, d])])}
          </Popover>
          <Popover trigger={({ toggle }) => <FilterButton icon="radio_button_checked" label={t('jds.filter.status', { value: status ? t(status === 'Published' ? 'jds.status.published' : 'jds.status.draft') : t('jds.filter.allStatus') })} onClick={toggle} />}>
            {optionMenu(status, reset(setStatus), [['', t('jds.filter.allStatus')], ['Published', t('jds.status.published')], ['Draft', t('jds.status.draft')]])}
          </Popover>
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#896a61] group-focus-within:text-primary transition-colors pointer-events-none flex items-center">
              <span className="material-symbols-outlined text-[18px]">code</span>
            </span>
            <input placeholder={t('candidates.filter.stack')} className={`${INPUT.replace('w-full', 'w-64')}`} type="text" value={stack} onChange={(e) => reset(setStack)(e.target.value)} />
          </div>
          <Popover
            wrapperClass="relative"
            trigger={({ toggle }) => (
              <button onClick={toggle} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] hover:border-primary rounded-lg text-sm font-medium text-[#181211] dark:text-white transition-all">
                <span className="material-symbols-outlined text-[18px] text-[#896a61]">notes</span>
                {t(SORTS.find(([s]) => s === sort)![1])}
              </button>
            )}
          >
            {optionMenu(sort, (v) => setSort(v as Sort), SORTS.map(([s, k]): [string, string] => [s, t(k)]))}
          </Popover>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-[#e6dddb] dark:border-[#2a2423] shadow-sm flex flex-col border-0 shadow-none rounded-none">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] sticky top-0 z-10">
                  <tr>
                    {(['jds.col.client', 'jds.col.jd', 'jds.col.domain', 'jds.col.stack', 'jds.col.status'] as const).map((k) => (
                      <th key={k} className={TH}><div className="flex items-center gap-1">{t(k)}</div></th>
                    ))}
                    <th className={`${TH}text-right`}><div className="flex items-center gap-1">{t('jds.col.edited')}</div></th>
                    <th className="px-6 py-4 w-16 border-b border-[#e6dddb] dark:border-[#2a2423] text-xs font-bold text-[#896a61] uppercase tracking-wider text-center">{t('jds.col.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                  {rows.map((jd) => (
                    <tr key={jd.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ">
                      <td className={TD}>
                        <div className="text-sm font-semibold text-slate-700 dark:text-gray-300">
                          {jd.client || <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="flex gap-4">
                          <div className="size-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-50 text-orange-500">
                            <span className="material-symbols-outlined">description</span>
                          </div>
                          <div>
                            <div onClick={() => open(jd)} className="font-bold text-sm text-slate-800 dark:text-gray-200 group-hover:text-primary transition-colors cursor-pointer">{jd.title}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('jds.id', { code: jd.code })}</div>
                          </div>
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="flex gap-1.5 flex-wrap max-w-[150px]">
                          {jd.domains.slice(0, 2).map((d) => <span key={d} className="text-sm font-semibold text-slate-600 dark:text-gray-400">{d}</span>)}
                          {jd.domains.length > 2 && <span className="text-sm font-semibold text-gray-400">+{jd.domains.length - 2}</span>}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="flex gap-1.5 flex-wrap max-w-[200px]">
                          {jd.skills.slice(0, 2).map((s) => (
                            <span key={s} className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-[10px] font-bold text-slate-600 dark:text-gray-400 border border-transparent">{s}</span>
                          ))}
                          {jd.skills.length > 2 && (
                            <span className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-white/5 text-[10px] font-bold text-gray-400">+{jd.skills.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className={TD}><StatusBadge status={jd.status} /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-right">
                          <div className="text-xs font-bold text-gray-500">{monthDay(jd.updatedAt)}</div>
                          <div className="text-[10px] font-bold text-gray-400">{year(jd.updatedAt)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Popover
                          align="right"
                          trigger={({ toggle }) => (
                            <button aria-label={`${t('jds.col.actions')} ${jd.title}`} onClick={toggle} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-slate-900 dark:hover:text-white">
                              <span className="material-symbols-outlined">more_horiz</span>
                            </button>
                          )}
                        >
                          {(close) => (
                            <>
                              <MenuItem onClick={() => { close(); open(jd); }}>{t('jds.menu.view')}</MenuItem>
                              <MenuItem onClick={() => { close(); setEditor({ jd }); }}>{t('jds.menu.edit')}</MenuItem>
                              <MenuItem onClick={() => { close(); publish(jd); }}>{t(jd.status === 'Published' ? 'jds.menu.unpublish' : 'jds.menu.publish')}</MenuItem>
                              <MenuItem onClick={() => { close(); setDeleting(jd); }}>{t('jds.menu.delete')}</MenuItem>
                            </>
                          )}
                        </Popover>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-[#896a61]">{t('jds.empty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} noun="job descriptions" onPage={setPage} />
          </div>
        </div>
      </div>
      <JdEditor open={editor !== null} jd={editor?.jd} onClose={() => setEditor(null)} />
      <DeleteJdModal jd={deleting} onClose={() => setDeleting(null)} />
    </AppLayout>
  );
}
