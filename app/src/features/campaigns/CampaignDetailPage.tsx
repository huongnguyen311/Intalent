import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/BackButton';
import { Chip } from '../../components/Chip';
import { Modal } from '../../components/Modal';
import { PriorityBadge } from '../../components/PriorityBadge';
import { toast } from '../../components/Toast';
import { campaignJobRows, campaignPerformance, campaignStats, effectiveStatus, pastEnd } from '../../domain/campaigns';
import { isOverdue, todayIso } from '../../domain/jobUrgency';
import { stageLabel } from '../../domain/stages';
import type { CampaignStatus } from '../../domain/types';
import { userName } from '../../domain/users';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { JobStatusBadge } from '../jobs/JobBits';
import { CampaignStatusBadge, PRIMARY_BTN, SECONDARY_BTN } from './CampaignBits';
import { CampaignFunnel } from './CampaignFunnel';

const CARD = 'bg-white dark:bg-surface-dark p-8 rounded-[2rem] border border-gray-100 dark:border-white/10 shadow-sm';
const LABEL = 'text-2xs font-bold text-muted uppercase tracking-widest';
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

const money = (n: number, currency = 'VND') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

/** What the header offers in each (effective) status; finished campaigns offer nothing. */
const ACTIONS: Record<CampaignStatus, Array<'edit' | 'launch' | 'pause' | 'resume' | 'complete' | 'cancel'>> = {
  draft: ['edit', 'launch', 'cancel'],
  scheduled: ['edit', 'cancel'],
  active: ['edit', 'pause', 'complete', 'cancel'],
  paused: ['edit', 'resume', 'complete', 'cancel'],
  completed: [],
  cancelled: [],
};

export function CampaignDetailPage() {
  const t = useT();
  const [lang] = useLang();
  const navigate = useNavigate();
  const { id } = useParams();
  const state = useStore();
  const { applications, candidates, jobs, users } = state;
  const campaign = state.campaigns.find((c) => c.id === id);
  const [confirmCancel, setConfirmCancel] = useState(false);

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

  const today = todayIso();
  const status = effectiveStatus(campaign, today);
  const stats = campaignStats(state, campaign.id);
  const perf = campaignPerformance(state, campaign.id, new Date());
  const { rows: jobRows, totals } = campaignJobRows(state, campaign);
  const jobTitle = (jobId: string) => jobs.find((j) => j.id === jobId)?.title ?? jobId;
  const rows = applications
    .filter((a) => a.campaignId === campaign.id)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const { setCampaignStatus, launchCampaign } = useStore.getState();
  const move = (next: CampaignStatus) => setCampaignStatus(campaign.id, next);
  const goals = campaign.goals;

  const buttons = {
    edit: (
      <button key="edit" onClick={() => navigate(`/campaigns/${campaign.id}/edit`)} className={SECONDARY_BTN}>
        <span className="material-symbols-outlined text-[20px]">edit</span>{t('campaigns.detail.edit')}
      </button>
    ),
    launch: <button key="launch" onClick={() => launchCampaign(campaign.id) || toast(t('campaigns.err.launchEnded'), 'error')} className={PRIMARY_BTN}>{t('campaigns.editor.launch')}</button>,
    pause: <button key="pause" onClick={() => move('paused')} className={SECONDARY_BTN}>{t('campaigns.detail.pause')}</button>,
    resume: <button key="resume" onClick={() => move('active')} className={PRIMARY_BTN}>{t('campaigns.detail.resume')}</button>,
    complete: <button key="complete" onClick={() => move('completed')} className={SECONDARY_BTN}>{t('campaigns.detail.complete')}</button>,
    cancel: <button key="cancel" onClick={() => setConfirmCancel(true)} className={`${SECONDARY_BTN} !text-red-600 whitespace-nowrap`}>{t('campaigns.detail.cancel')}</button>,
  };
  const offered = ACTIONS[status];
  const actions = <div className="flex items-center gap-3">{offered.map((a) => buttons[a])}</div>;

  return (
    <AppLayout title={campaign.name} subtitle={`${fullDate(campaign.start)} – ${fullDate(campaign.end)}`} actions={actions}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-8">
        <div data-testid="campaign-header" className="flex items-center gap-4 flex-wrap">
          <BackButton label={t('campaigns.detail.back')} onClick={() => navigate('/campaigns')} />
          <span className="text-sm font-bold text-[#896a61]">{campaign.code}</span>
          <CampaignStatusBadge status={status} />
          {campaign.priority && <PriorityBadge priority={campaign.priority} />}
          <span className="text-sm text-slate-600 dark:text-gray-300">{t('campaigns.detail.owner', { name: campaign.owner ? userName(users, campaign.owner) : '—' })}</span>
          {campaign.applicationDeadline && (
            <span className="text-sm text-slate-600 dark:text-gray-300">{t('campaigns.detail.deadline', { date: fullDate(campaign.applicationDeadline) })}</span>
          )}
        </div>
        {campaign.description && <p className="text-sm text-slate-600 dark:text-gray-300 -mt-4">{campaign.description}</p>}

        {pastEnd(campaign, today) && (
          <div data-testid="past-end" role="status" className="flex items-center gap-3 px-5 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-sm">
            <span aria-hidden="true" className="material-symbols-outlined text-amber-600">event_busy</span>
            <span className="flex-1 font-semibold text-amber-900 dark:text-amber-100">{t('campaigns.detail.pastEnd', { date: fullDate(campaign.end) })}</span>
            <button onClick={() => move('completed')} className={SECONDARY_BTN}>{t('campaigns.detail.complete')}</button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6">
          <Kpi id="views" label={t('campaigns.kpi.views')} value={stats.views.toLocaleString('en-US')} />
          <Kpi id="applicants" label={t('campaigns.kpi.applicants')} value={String(stats.applicants)} hint={goals.targetApplicants ? t('campaigns.kpi.target', { n: goals.targetApplicants }) : undefined} />
          <Kpi id="conversion" label={t('campaigns.kpi.conversion')} value={`${(stats.conversion * 100).toFixed(1)}%`} />
          <Kpi id="hires" label={t('campaigns.kpi.hires')} value={String(stats.hires)} hint={t('campaigns.kpi.of', { n: totals.target })} />
          <Kpi id="cph" label={t('campaigns.kpi.cph')} value={perf.costPerHire === undefined ? '—' : money(perf.costPerHire, goals.currency)} />
        </div>

        <div className={CARD}>
          <div className={`${LABEL} mb-6`}>{t('campaigns.funnel')}</div>
          <CampaignFunnel perf={perf} />
        </div>

        <JobsTable rows={jobRows} totals={totals} today={today} />

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
                    {(['campaigns.applicants.col.name', 'campaigns.applicants.col.job', 'campaigns.applicants.col.stage', 'campaigns.applicants.col.applied'] as const).map((k) => (
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
                      <td className={TD}><Chip>{stageLabel(a.stage, lang)}</Chip></td>
                      <td className={TD}>{fullDate(a.addedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Modal
        open={confirmCancel} title={t('campaigns.detail.cancelTitle')} onClose={() => setConfirmCancel(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmCancel(false)} className={SECONDARY_BTN}>{t('campaigns.detail.keep')}</button>
            <button onClick={() => { move('cancelled'); setConfirmCancel(false); }} className={`${PRIMARY_BTN} !bg-red-600`}>{t('campaigns.detail.cancel')}</button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-gray-300">{t('campaigns.detail.cancelBody')}</p>
      </Modal>
    </AppLayout>
  );
}

function JobsTable({ rows, totals, today }: {
  rows: ReturnType<typeof campaignJobRows>['rows'];
  totals: ReturnType<typeof campaignJobRows>['totals'];
  today: string;
}) {
  const t = useT();
  const jobs = useStore((s) => s.jobs);
  const applications = useStore((s) => s.applications);
  const cols = ['job', 'priority', 'date', 'status', 'target', 'hired', 'remaining'] as const;
  return (
    <div className="bg-white dark:bg-surface-dark rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
      <div className={`${LABEL} px-6 pt-6 pb-4`}>{t('campaigns.jobs.title')}</div>
      {rows.length === 0 ? (
        <p className="px-6 pb-8 text-sm text-[#896a61]">{t('campaigns.jobs.empty')}</p>
      ) : (
      <div className="overflow-x-auto custom-scrollbar">
        <table data-testid="campaign-jobs" className="w-full text-left border-collapse">
          <thead className="bg-[#f8f6f6] dark:bg-[#251f1e]">
            <tr>{cols.map((k) => <th key={k} className={TH}>{t(`campaigns.jobs.col.${k}`)}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
            {rows.map((r) => {
              const job = jobs.find((j) => j.id === r.jobId);
              const overdue = !!job && isOverdue(job, applications, today);
              return (
                <tr key={r.jobId}>
                  <td className={TD}>
                    {job ? (
                      <Link to={`/pipeline/${r.jobId}`} className="font-bold text-slate-800 dark:text-gray-200 hover:text-primary transition-colors">{r.title}</Link>
                    ) : (
                      <span className="font-bold text-slate-500">{r.title}</span>
                    )}
                    {job && !r.attached && <div className="text-xs text-[#896a61] mt-0.5">{t('campaigns.jobs.moved')}</div>}
                  </td>
                  <td className={TD}><PriorityBadge priority={r.priority} />{r.priority === 'normal' && <span className="text-gray-300">—</span>}</td>
                  <td className={`${TD} ${overdue ? 'text-red-600 font-semibold' : ''}`}>{r.targetHiringDate ? fullDate(r.targetHiringDate) : '—'}</td>
                  <td className={TD} data-testid="cell-status">{r.jobStatus ? <JobStatusBadge status={r.jobStatus} /> : '—'}</td>
                  <td className={TD} data-testid="cell-target">{r.target}</td>
                  <td className={`${TD} font-bold`} data-testid="cell-hired">{r.hired}</td>
                  <td className={TD} data-testid="cell-remaining">{r.remaining}</td>
                </tr>
              );
            })}
            <tr data-testid="jobs-total" className="bg-[#fbf9f8] dark:bg-white/5 font-bold">
              <td className={`${TD} font-bold text-slate-800 dark:text-white`} colSpan={4}>{t('campaigns.jobs.total')}</td>
              <td className={`${TD} font-bold`} data-testid="cell-target">{totals.target}</td>
              <td className={`${TD} font-bold`} data-testid="cell-hired">{totals.hired}</td>
              <td className={`${TD} font-bold`} data-testid="cell-remaining">{totals.remaining}</td>
            </tr>
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
