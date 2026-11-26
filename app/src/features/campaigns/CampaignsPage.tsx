import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Pagination, usePaginationLabels } from '../../components/Pagination';
import { MenuItem, Popover } from '../../components/Popover';
import { PriorityBadge } from '../../components/PriorityBadge';
import { campaignJobIds, effectiveStatus, filledHires, targetHires } from '../../domain/campaigns';
import { todayIso } from '../../domain/jobUrgency';
import { userName } from '../../domain/users';
import { CAMPAIGN_STATUSES, type Campaign, type CampaignStatus } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { CampaignStatusBadge, PRIMARY_BTN } from './CampaignBits';

const PAGE_SIZE = 10;
const FILTER_BTN =
  'flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm font-medium text-[#181211] dark:text-white hover:border-primary/50 transition-colors whitespace-nowrap ';
const INPUT =
  'w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] focus:border-primary focus:ring-0 rounded-lg text-sm text-[#181211] dark:text-white transition-all placeholder-[#896a61]';
const TH = 'px-4 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]';
const TD = 'px-4 py-4 whitespace-nowrap text-sm font-semibold text-slate-600 dark:text-gray-400';
const STATUSES: CampaignStatus[] = [...CAMPAIGN_STATUSES];
const COLUMNS = ['campaigns.col.name', 'campaigns.col.owner', 'campaigns.col.jobs', 'campaigns.col.period', 'campaigns.col.status', 'campaigns.col.progress'] as const;

export function CampaignsPage() {
  const navigate = useNavigate();
  const t = useT();
  const paginationLabels = usePaginationLabels();
  const { campaigns, applications, jobs, users } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<CampaignStatus | ''>('');
  const [page, setPage] = useState(1);
  const today = todayIso();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return campaigns.filter(
      (c) =>
        (!needle || c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle)) &&
        (!status || effectiveStatus(c, today) === status),
    );
  }, [campaigns, q, status, today]);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const jobsLabel = (c: Campaign) => {
    const titles = campaignJobIds(c, { jobs, applications }).map((id) => jobs.find((j) => j.id === id)?.title ?? id);
    return titles.length > 1 ? t('campaigns.jobsMore', { title: titles[0], n: titles.length - 1 }) : titles[0] ?? '';
  };
  const filterMenu = <V extends string>(value: V | '', setValue: (v: V | '') => void, options: readonly V[], label: (v: V) => string) =>
    (close: () => void) => (
      <>
        <MenuItem active={!value} onClick={() => { setValue(''); setPage(1); close(); }}>{t('campaigns.filter.all')}</MenuItem>
        {options.map((o) => (
          <MenuItem key={o} active={value === o} onClick={() => { setValue(o); setPage(1); close(); }}>{label(o)}</MenuItem>
        ))}
      </>
    );

  const createButton = (
    <button onClick={() => navigate('/campaigns/new')} className={PRIMARY_BTN}>
      <span className="material-symbols-outlined text-[20px]">add</span> {t('campaigns.create')}
    </button>
  );

  return (
    <AppLayout title={t('nav.campaigns')} subtitle={t('campaigns.subtitle')}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-8 min-h-full">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[280px] max-w-md relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#896a61] group-focus-within:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </span>
            <input className={INPUT} placeholder={t('campaigns.search')} type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <Popover
            trigger={({ toggle }) => (
              <button onClick={toggle} className={FILTER_BTN}>
                <span className="material-symbols-outlined text-[18px] text-[#896a61]">radio_button_checked</span>
                <span>{t('campaigns.filter.status', { value: status ? t(`campaigns.status.${status}`) : t('campaigns.filter.all') })}</span>
                <span className="material-symbols-outlined text-[18px] text-[#896a61]">expand_more</span>
              </button>
            )}
          >
            {filterMenu(status, setStatus, STATUSES, (s) => t(`campaigns.status.${s}`))}
          </Popover>
          <div className="ml-auto">{createButton}</div>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-274px)] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] sticky top-0 z-10">
                <tr>
                  {COLUMNS.map((k) => <th key={k} className={TH}>{t(k)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                {rows.map((c) => {
                  const target = targetHires({ applications, jobs }, c);
                  const filled = filledHires({ applications, jobs }, c);
                  const pct = target ? Math.min(100, (filled / target) * 100) : 0;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                      <td className={TD}>
                        <div className="flex items-center gap-2">
                          <Link to={`/campaigns/${c.id}`} className="font-bold text-slate-800 dark:text-gray-200 group-hover:text-primary transition-colors">{c.name}</Link>
                          <PriorityBadge priority={c.priority} />
                        </div>
                        <div className="text-xs font-medium text-[#896a61] mt-0.5">{c.code}</div>
                      </td>
                      <td className={TD}>{c.owner ? userName(users, c.owner) : '—'}</td>
                      <td className={TD}><span className="block max-w-[200px] truncate" title={jobsLabel(c)}>{jobsLabel(c)}</span></td>
                      <td className={TD}>{fullDate(c.start)} – {fullDate(c.end)}</td>
                      <td className={TD}><CampaignStatusBadge status={effectiveStatus(c, today)} /></td>
                      <td className={TD}>
                        <div className="w-32">
                          <div className="text-sm font-bold text-slate-700 dark:text-gray-200">{t('campaigns.progress', { n: filled, goal: target })}</div>
                          <div className="h-1.5 mt-1 rounded-full bg-gray-100 overflow-hidden"><div data-testid="progress-bar" className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={COLUMNS.length} className="px-6 py-10 text-center text-sm text-[#896a61]">{t('campaigns.empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination labels={paginationLabels} page={page} pageSize={PAGE_SIZE} total={filtered.length} noun={t('campaigns.noun')} onPage={setPage} />
        </div>
      </div>
    </AppLayout>
  );
}
