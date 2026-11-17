import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Chip } from '../../components/Chip';
import { campaignLinks, campaignStats, CHANNELS, channelFromSource } from '../../domain/campaigns';
import { stageLabel } from '../../domain/stages';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { CampaignStatusBadge, LinkRow, PRIMARY_BTN, SECONDARY_BTN, useChannelLabel } from './CampaignBits';
import { CampaignWizard } from './CampaignWizard';

const CARD = 'bg-white dark:bg-surface-dark p-8 rounded-[2rem] border border-gray-100 dark:border-white/10 shadow-sm';
const LABEL = 'text-[10px] font-bold text-gray-400 uppercase tracking-widest';
const TH = 'px-6 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]';
const TD = 'px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400';

function Kpi({ id, label, value, hint }: { id: string; label: string; value: string; hint?: string }) {
  return (
    <div className={CARD}>
      <div className={LABEL}>{label}</div>
      <div data-testid={`kpi-${id}`} className="text-4xl font-bold text-slate-800 dark:text-white mt-3">{value}</div>
      {hint && <div className="text-xs font-semibold text-gray-400 mt-2">{hint}</div>}
    </div>
  );
}

export function CampaignDetailPage() {
  const t = useT();
  const [lang] = useLang();
  const channelLabel = useChannelLabel();
  const navigate = useNavigate();
  const { id } = useParams();
  const state = useStore();
  const { applications, candidates, jobs } = state;
  const campaign = state.campaigns.find((c) => c.id === id);
  const [editing, setEditing] = useState(false);

  if (!campaign) {
    return (
      <AppLayout title={t('nav.campaigns')}>
        <div className="p-8 text-[#896a61]">
          <p>{t('campaigns.detail.notFound')}</p>
          <Link to="/campaigns" className="text-primary font-bold hover:underline">{t('campaigns.detail.back')}</Link>
        </div>
      </AppLayout>
    );
  }

  const stats = campaignStats(state, campaign.id);
  const jobTitle = (jobId: string) => jobs.find((j) => j.id === jobId)?.title ?? jobId;
  const rows = applications
    .filter((a) => a.campaignId === campaign.id)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const maxBar = Math.max(1, ...Object.values(stats.byChannel));
  const barChannels = CHANNELS.filter((c) => campaign.channels.includes(c) || stats.byChannel[c] > 0);
  const links = campaignLinks(campaign, location.origin);
  const setStatus = (next: 'active' | 'paused' | 'ended') => useStore.getState().setCampaignStatus(campaign.id, next);

  const actions = (
    <div className="flex items-center gap-3">
      <button onClick={() => setEditing(true)} className={SECONDARY_BTN}>
        <span className="material-symbols-outlined text-[20px]">edit</span>{t('campaigns.detail.edit')}
      </button>
      {campaign.status === 'active' && (
        <button onClick={() => setStatus('paused')} className={SECONDARY_BTN}>{t('campaigns.detail.pause')}</button>
      )}
      {campaign.status !== 'ended' && (
        <button onClick={() => setStatus('ended')} className={SECONDARY_BTN}>{t('campaigns.detail.end')}</button>
      )}
      {campaign.status !== 'active' && (
        <button onClick={() => setStatus('active')} className={PRIMARY_BTN}>{t('campaigns.detail.resume')}</button>
      )}
    </div>
  );

  return (
    <AppLayout title={campaign.name} subtitle={`${fullDate(campaign.start)} – ${fullDate(campaign.end)}`} actions={actions}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-8">
        <div className="flex items-center gap-4 flex-wrap">
          <button aria-label={t('common.back')} onClick={() => navigate('/campaigns')} className="size-10 rounded-full bg-white dark:bg-[#2a2423] border border-[#e6dddb] dark:border-[#3a3433] flex items-center justify-center text-[#896a61] hover:text-[#ff6b00] transition-colors shadow-sm">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <CampaignStatusBadge status={campaign.status} />
          {campaign.jobIds.map((jobId) => (
            <Link key={jobId} to={`/pipeline/${jobId}`} className="text-sm font-bold text-slate-700 dark:text-gray-200 hover:text-primary flex items-center gap-1.5 transition-colors">
              <span className="material-symbols-outlined text-[18px]">view_kanban</span>
              {t('campaigns.detail.pipeline', { title: jobTitle(jobId) })}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-6">
          <Kpi id="views" label={t('campaigns.kpi.views')} value={stats.views.toLocaleString('en-US')} />
          <Kpi id="applicants" label={t('campaigns.kpi.applicants')} value={String(stats.applicants)} hint={t('campaigns.kpi.goal', { goal: campaign.goal })} />
          <Kpi id="conversion" label={t('campaigns.kpi.conversion')} value={`${(stats.conversion * 100).toFixed(1)}%`} />
          <Kpi id="hires" label={t('campaigns.kpi.hires')} value={String(stats.hires)} />
        </div>

        <div className={CARD}>
          <div className={`${LABEL} mb-6`}>{t('campaigns.byChannel')}</div>
          <div className="space-y-4">
            {barChannels.map((c) => (
              <div key={c} data-testid={`bar-${c}`} className="flex items-center gap-4">
                <div className="w-36 text-sm font-semibold text-slate-600 dark:text-gray-300">{channelLabel(c)}</div>
                <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(stats.byChannel[c] / maxBar) * 100}%` }} />
                </div>
                <div className="w-8 text-right text-sm font-bold text-slate-700 dark:text-white">{stats.byChannel[c]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className={`${LABEL} px-6 pt-6 pb-4`}>{t('campaigns.applicants')}</div>
          {rows.length === 0 ? (
            <div className="px-6 pb-10 text-center">
              <span className="material-symbols-outlined text-[40px] text-gray-300">group_off</span>
              <p className="text-sm font-bold text-slate-700 dark:text-gray-200 mt-2">{t('campaigns.applicants.empty')}</p>
              <p className="text-sm text-[#896a61] mt-1">{t('campaigns.applicants.emptyHint')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f8f6f6] dark:bg-[#251f1e]">
                  <tr>
                    {(['campaigns.applicants.col.name', 'campaigns.applicants.col.job', 'campaigns.applicants.col.source', 'campaigns.applicants.col.stage', 'campaigns.applicants.col.applied'] as const).map((k) => (
                      <th key={k} className={TH}>{t(k)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                  {rows.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className={TD}>
                        <Link to={`/candidates/${a.candidateId}`} className="font-bold text-slate-800 dark:text-gray-200 hover:text-primary transition-colors">
                          {candidates.find((c) => c.id === a.candidateId)?.name ?? a.candidateId}
                        </Link>
                      </td>
                      <td className={TD}>{jobTitle(a.jobId)}</td>
                      <td className={TD}>{channelLabel(channelFromSource(a.source))}</td>
                      <td className={TD}><Chip>{stageLabel(a.stage, lang)}</Chip></td>
                      <td className={TD}>{fullDate(a.addedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={CARD}>
          <div className={`${LABEL} mb-2`}>{t('campaigns.links')}</div>
          <div className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
            {links.map((l) => <LinkRow key={`${l.jobId}-${l.channel}`} channel={l.channel} jobTitle={jobTitle(l.jobId)} url={l.url} />)}
          </div>
        </div>
      </div>
      <CampaignWizard open={editing} campaign={campaign} onClose={() => setEditing(false)} />
    </AppLayout>
  );
}
