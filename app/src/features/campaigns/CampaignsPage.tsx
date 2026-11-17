import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Pagination } from '../../components/Pagination';
import { MenuItem, Popover } from '../../components/Popover';
import { campaignStats } from '../../domain/campaigns';
import type { Campaign, CampaignStatus } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { CampaignStatusBadge, ChannelIcons, PRIMARY_BTN } from './CampaignBits';
import { CampaignWizard } from './CampaignWizard';

const PAGE_SIZE = 10;
const FILTER_BTN =
  'flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm font-medium text-[#181211] dark:text-white hover:border-primary/50 transition-colors whitespace-nowrap ';
const INPUT =
  'w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] focus:border-primary focus:ring-0 rounded-lg text-sm text-[#181211] dark:text-white transition-all placeholder-[#896a61]';
const TH = 'px-6 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]';
const TD = 'px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600 dark:text-gray-400';
const STATUSES: CampaignStatus[] = ['active', 'paused', 'ended'];

export function CampaignsPage() {
  const t = useT();
  const { campaigns, applications, jobs } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<CampaignStatus | ''>('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () => campaigns.filter((c) => (!q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())) && (!status || c.status === status)),
    [campaigns, q, status],
  );
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const jobsLabel = (c: Campaign) => {
    const titles = c.jobIds.map((id) => jobs.find((j) => j.id === id)?.title ?? id);
    return titles.length > 1 ? t('campaigns.jobsMore', { title: titles[0], n: titles.length - 1 }) : titles[0] ?? '';
  };

  const createButton = (
    <button onClick={() => setCreating(true)} className={PRIMARY_BTN}>
      <span className="material-symbols-outlined text-[20px]">add</span> {t('campaigns.create')}
    </button>
  );

  return (
    <AppLayout title={t('nav.campaigns')} subtitle={t('campaigns.subtitle')} actions={createButton}>
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
            {(close) => (
              <>
                <MenuItem active={!status} onClick={() => { setStatus(''); setPage(1); close(); }}>{t('campaigns.filter.all')}</MenuItem>
                {STATUSES.map((s) => (
                  <MenuItem key={s} active={status === s} onClick={() => { setStatus(s); setPage(1); close(); }}>{t(`campaigns.status.${s}`)}</MenuItem>
                ))}
              </>
            )}
          </Popover>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] sticky top-0 z-10">
                <tr>
                  {(['campaigns.col.name', 'campaigns.col.jobs', 'campaigns.col.channels', 'campaigns.col.period', 'campaigns.col.status', 'campaigns.col.progress', 'campaigns.col.hires'] as const).map((k) => (
                    <th key={k} className={TH}>{t(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                {rows.map((c) => {
                  const stats = campaignStats({ applications, campaigns }, c.id);
                  const pct = c.goal ? Math.min(100, (stats.applicants / c.goal) * 100) : 0;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                      <td className={TD}>
                        <Link to={`/campaigns/${c.id}`} className="font-bold text-slate-800 dark:text-gray-200 group-hover:text-primary transition-colors">{c.name}</Link>
                      </td>
                      <td className={TD}>{jobsLabel(c)}</td>
                      <td className={TD}><ChannelIcons channels={c.channels} /></td>
                      <td className={TD}>{fullDate(c.start)} – {fullDate(c.end)}</td>
                      <td className={TD}><CampaignStatusBadge status={c.status} /></td>
                      <td className={TD}>
                        <div className="w-32">
                          <div className="text-sm font-bold text-slate-700 dark:text-gray-200">{t('campaigns.progress', { n: stats.applicants, goal: c.goal })}</div>
                          <div className="h-1.5 mt-1 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                        </div>
                      </td>
                      <td className={`${TD} font-bold`}>{stats.hires}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-[#896a61]">{t('campaigns.empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} noun={t('campaigns.noun')} onPage={setPage} />
        </div>
      </div>
      <CampaignWizard open={creating} onClose={() => setCreating(false)} />
    </AppLayout>
  );
}
