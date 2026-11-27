import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { toast } from '../../components/Toast';
import { MenuItem, Popover } from '../../components/Popover';
import { Pagination } from '../../components/Pagination';
import { isFixtureMode } from '../../data/fixtureMockup';
import type { Jd } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { DeleteJdModal } from './DeleteJdModal';
import { canEditJd } from '../../domain/permissions';
import { useMe } from '../../store/session';
import { monthDay, year } from './format';

const PAGE_SIZE = 10;
/** Filter value for JDs without a client. */
const INTERNAL = '__internal__';
const FILTER_BTN =
  'flex items-center gap-2 px-3 py-2 bg-white dark:bg-dark-surface border border-line dark:border-dark-line rounded-lg text-sm font-medium text-ink dark:text-white hover:border-primary/50 transition-colors whitespace-nowrap ';
const INPUT =
  'w-full pl-10 pr-4 py-2.5 bg-white dark:bg-dark-surface border border-line dark:border-dark-line focus:border-primary focus:ring-0 rounded-lg text-sm text-ink dark:text-white transition-all placeholder-ink-muted';
const TH = 'px-4 py-4 whitespace-nowrap text-xs font-bold text-ink-muted uppercase tracking-wider border-b border-line dark:border-dark-raised  ';
// Cells wrap so the table fits the page without a sideways scroll.
const TD = 'px-4 py-4 align-middle ';

export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const published = status === 'Published';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-bold ${published ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`size-1.5 rounded-full ${published ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
      {t(published ? 'jds.status.published' : 'jds.status.draft')}
    </span>
  );
}

function FilterButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={FILTER_BTN}>
      <span className="material-symbols-outlined text-[18px] text-ink-muted">{icon}</span>
      <span>{label}</span>
      <span className="material-symbols-outlined text-[18px] text-ink-muted">expand_more</span>
    </button>
  );
}

const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.trim().toLowerCase());

export function JdListPage() {
  const t = useT();
  const navigate = useNavigate();
  const jds = useStore((s) => s.jds);
  const jobs = useStore((s) => s.jobs);
  const user = useMe();
  const jobCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) m.set(j.jdId, (m.get(j.jdId) ?? 0) + 1);
    return m;
  }, [jobs]);
  const [client, setClient] = useState('');
  const [q, setQ] = useState('');
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Jd | null>(null);

  const search = isFixtureMode() ? '?fixture=mockup' : '';
  const open = (jd: Jd) => navigate({ pathname: `/jds/${jd.id}`, search });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const domains = useMemo(() => [...new Set(jds.flatMap((j) => j.domains))].sort(), [jds]);
  const clients = useMemo(() => [...new Set(jds.map((j) => j.client).filter(Boolean))].sort(), [jds]);
  const filtered = useMemo(() => {
    const out = jds.filter(
      (j) =>
        (!client || (client === INTERNAL ? !j.client : j.client === client)) &&
        (!q.trim() || has(j.title, q) || j.domains.some((d) => has(d, q)) || j.skills.some((s) => has(s, q))) &&
        (!domain || j.domains.includes(domain)) &&
        (!status || j.status === status),
    );
    // Newest first, always.
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [jds, client, q, domain, status]);
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
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-md relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted group-focus-within:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </span>
            <input className={INPUT} placeholder={t('jds.search')} type="text" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
          </div>
          {/* Client is a picked value, not free text: the list comes from the JDs, plus "Internal" for JDs with no client. */}
          <Popover trigger={({ toggle }) => <FilterButton icon="corporate_fare" label={t('jds.filter.clientValue', { value: client === INTERNAL ? t('jds.client.internal') : client || t('jds.filter.allClients') })} onClick={toggle} />}>
            {optionMenu(client, reset(setClient), [['', t('jds.filter.allClients')], ...clients.map((c): [string, string] => [c, c]), [INTERNAL, t('jds.client.internal')]])}
          </Popover>
          <Popover trigger={({ toggle }) => <FilterButton icon="filter_list" label={t('jds.filter.domain', { value: domain || t('jds.filter.allDomains') })} onClick={toggle} />}>
            {optionMenu(domain, reset(setDomain), [['', t('jds.filter.allDomains')], ...domains.map((d): [string, string] => [d, d])])}
          </Popover>
          <Popover trigger={({ toggle }) => <FilterButton icon="radio_button_checked" label={t('jds.filter.status', { value: status ? t(status === 'Published' ? 'jds.status.published' : 'jds.status.draft') : t('jds.filter.allStatus') })} onClick={toggle} />}>
            {optionMenu(status, reset(setStatus), [['', t('jds.filter.allStatus')], ['Published', t('jds.status.published')], ['Draft', t('jds.status.draft')]])}
          </Popover>
          <button onClick={() => navigate({ pathname: '/jds/new', search })} className="ml-auto px-6 py-2.5 bg-brand-accent hover:bg-brand-strong text-white rounded-full font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all transform active:scale-95 text-sm shrink-0">
            <span className="material-symbols-outlined text-[20px]">add</span> {t('jds.create')}
          </button>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-line dark:border-dark-raised shadow-sm flex flex-col border-0 shadow-none rounded-none">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-274px)] custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-background-light dark:bg-dark-surface sticky top-0 z-10">
                  <tr>
                    {(['jds.col.client', 'jds.col.jd', 'jds.col.domain', 'jds.col.stack', 'jds.col.jobs', 'jds.col.status'] as const).map((k) => (
                      <th key={k} className={TH}><div className="flex items-center gap-1">{t(k)}</div></th>
                    ))}
                    <th className={`${TH}text-right`}><div className="flex items-center gap-1">{t('jds.col.edited')}</div></th>
                    <th className="px-2 py-4 w-12 border-b border-line dark:border-dark-raised text-xs font-bold text-ink-muted uppercase tracking-wider text-center"><span className="sr-only">{t('jds.col.actions')}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline dark:divide-dark-raised">
                  {rows.map((jd) => (
                    <tr key={jd.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ">
                      <td className={TD}>
                        <div className="text-sm font-semibold text-slate-700 dark:text-gray-300">
                          {jd.client || <span className="text-muted dark:text-gray-500 font-medium">{t('jds.client.internal')}</span>}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="flex gap-3 min-w-[200px]">
                          <div className="size-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-50 text-orange-500">
                            <span className="material-symbols-outlined">description</span>
                          </div>
                          <div>
                            <div onClick={() => open(jd)} className="font-bold text-sm text-slate-800 dark:text-gray-200 group-hover:text-primary transition-colors cursor-pointer">{jd.title}</div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-2xs font-bold text-muted uppercase tracking-wider">{t('jds.id', { code: jd.code })}</span>
                              {/* Level sits with the title: two JDs can share a title and differ only here. */}
                              {jd.seniority && <span className="px-1.5 py-0.5 rounded bg-orange-50 dark:bg-white/10 text-2xs font-bold text-orange-700 dark:text-orange-300">{jd.seniority}{jd.minYears != null && ` · ${t('jds.minYears', { n: jd.minYears })}`}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="flex gap-1.5 flex-wrap max-w-[150px]">
                          {jd.domains.slice(0, 2).map((d) => <span key={d} className="text-sm font-semibold text-slate-600 dark:text-gray-400">{d}</span>)}
                          {jd.domains.length > 2 && <span className="text-sm font-semibold text-muted dark:text-gray-400">+{jd.domains.length - 2}</span>}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="flex gap-1.5 flex-wrap max-w-[200px]">
                          {jd.skills.slice(0, 2).map((s) => (
                            <span key={s} className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-2xs font-bold text-slate-600 dark:text-muted border border-transparent">{s}</span>
                          ))}
                          {jd.skills.length > 2 && (
                            <span className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-white/5 text-2xs font-bold text-muted">+{jd.skills.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className={TD}>
                        {jobCount.get(jd.id) ? (
                          <button onClick={() => open(jd)} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline whitespace-nowrap">
                            <span className="material-symbols-outlined text-[16px]">work</span>
                            {t('jds.jobsCount', { count: jobCount.get(jd.id)! })}
                          </button>
                        ) : (
                          <span className="text-sm text-muted dark:text-gray-400 whitespace-nowrap">{t('jds.jobsNone')}</span>
                        )}
                      </td>
                      <td className={`${TD}whitespace-nowrap`}><StatusBadge status={jd.status} /></td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="text-right">
                          <div className="text-xs font-bold text-gray-500">{monthDay(jd.updatedAt)}</div>
                          <div className="text-2xs font-bold text-muted">{year(jd.updatedAt)}</div>
                        </div>
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-center">
                        <Popover
                          align="right"
                          trigger={({ toggle }) => (
                            <button aria-label={`${t('jds.col.actions')} ${jd.title}`} onClick={toggle} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-muted dark:text-gray-400 hover:text-slate-900 dark:hover:text-white">
                              <span className="material-symbols-outlined">more_horiz</span>
                            </button>
                          )}
                        >
                          {(close) => (
                            <>
                              <MenuItem onClick={() => { close(); open(jd); }}>{t('jds.menu.view')}</MenuItem>
                              {/* Only the author, recruiters of jobs using it, and Super Admin / Lead change a JD; others see why. */}
                              {(() => {
                                const locked = !canEditJd(user, jd, jobs);
                                const why = locked ? t('jds.page.readOnly') : undefined;
                                return (<>
                                  <MenuItem disabled={locked} title={why} onClick={() => { close(); navigate({ pathname: `/jds/${jd.id}/edit`, search }); }}>{t('jds.menu.edit')}</MenuItem>
                                  <MenuItem disabled={locked} title={why} onClick={() => { close(); publish(jd); }}>{t(jd.status === 'Published' ? 'jds.menu.unpublish' : 'jds.menu.publish')}</MenuItem>
                                  <MenuItem disabled={locked} title={why} onClick={() => { close(); setDeleting(jd); }}>{t('jds.menu.delete')}</MenuItem>
                                </>);
                              })()}
                            </>
                          )}
                        </Popover>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-ink-muted">{t('jds.empty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} noun="job descriptions" onPage={setPage} />
          </div>
        </div>
      </div>
      <DeleteJdModal jd={deleting} onClose={() => setDeleting(null)} />
    </AppLayout>
  );
}
