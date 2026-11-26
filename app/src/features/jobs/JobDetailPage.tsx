import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/BackButton';
import { NotFoundState } from '../../components/NotFoundState';
import { userName } from '../../domain/users';
import { useT, type TKey } from '../../i18n/i18n';
import { can, jobsInScope } from '../../domain/permissions';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { PipelineWorkspace } from '../pipeline/PipelineWorkspace';
import { CampaignsTab, CandidatesTab } from './JobTabs';
import { ago, editorPath } from './jobForm';
import { useJobActions } from './useJobActions';

const SECONDARY =
  'h-10 px-5 bg-white dark:bg-[#2a2423] border border-[#e6dddb] dark:border-[#3a3433] text-slate-700 dark:text-white text-sm font-bold rounded-full shadow-sm hover:border-primary/50 transition-colors flex items-center gap-2 whitespace-nowrap';
const PRIMARY =
  'h-10 px-5 bg-brand-accent hover:bg-brand-strong text-white text-sm font-bold rounded-full shadow-lg shadow-orange-500/20 transition-colors flex items-center gap-2 whitespace-nowrap';

const TABS: Array<['pipeline' | 'candidates' | 'campaigns', TKey]> = [
  ['pipeline', 'jobs.tab.pipeline'],
  ['candidates', 'jobs.tab.candidates'],
  ['campaigns', 'jobs.tab.campaigns'],
];

export function JobDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useMe();
  const job = useStore((s) => jobsInScope(user, s.jobs).find((j) => j.id === id));
  const canEdit = can(user, 'job.edit');
  const users = useStore((s) => s.users);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('pipeline');
  const { actionsFor, dialog } = useJobActions();

  if (!job) {
    // A job that exists but is outside the user's scope is "no access", not "not found".
    const exists = useStore.getState().jobs.some((j) => j.id === id);
    return (
      <AppLayout title={t('nav.jobs')}>
        <NotFoundState
          icon={exists ? 'lock' : 'search_off'}
          message={t(exists ? 'jobs.detail.noAccess' : 'jobs.detail.notFound')}
          backTo="/jobs"
          backLabel={t('jobs.detail.back')}
        />
      </AppLayout>
    );
  }

  const actions = actionsFor(job);
  const approval = job.approval;
  const asked = approval ? ago(approval.requestedAt) : undefined;

  return (
    <AppLayout title={t('nav.jobs')} subtitle={t('jobs.subtitle')}>
      <div className="min-h-full bg-[#fbf9f8] dark:bg-background-dark">
        <div className="p-8 max-w-[1400px] mx-auto space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <BackButton label={t('jobs.detail.back')} onClick={() => navigate('/jobs')} />
              <div>
                <h1 className="ty-title text-[22px] font-bold tracking-tight text-[#181211] dark:text-white mb-1">{job.title}</h1>
                <p className="text-[#896a61] text-sm flex items-center gap-3 flex-wrap">
                  <span>{t('jobs.detail.meta', { department: job.department, location: job.location, level: job.level })}</span>
                  <span>• {t('jobs.detail.opened', { date: fullDate(job.openedAt) })}</span>
                </p>
              </div>
            </div>
            {(canEdit || actions.length > 0) && <div className="flex items-center gap-2 shrink-0">
              {canEdit && (
                <button onClick={() => navigate(editorPath('edit', job.id), { state: { from: `/jobs/${job.id}` } })} className={SECONDARY}>
                  <span className="material-symbols-outlined text-[18px]">edit</span>{t('jobs.menu.edit')}
                </button>
              )}
              {actions.map((a) => (
                <button key={a.id} onClick={a.run} className={a.primary ? PRIMARY : SECONDARY}>
                  <span className="material-symbols-outlined text-[18px]">{a.icon}</span>{a.label}
                </button>
              ))}
            </div>}
          </div>

          {job.status === 'pending_approval' && approval && asked && (
            <div role="status" className="flex items-center gap-2 p-3 rounded-xl bg-violet-50 text-violet-700 text-sm">
              <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
              {t('jobs.approval.pending', { name: userName(users, approval.requestedBy), when: t(`jobs.ago.${asked.unit}`, { n: asked.n }) })}
            </div>
          )}
          {job.status === 'draft' && approval?.rejectedReason && approval.decidedBy && (
            <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
              <span className="material-symbols-outlined text-[18px]">undo</span>
              {t('jobs.approval.rejected', { name: userName(users, approval.decidedBy), reason: approval.rejectedReason })}
            </div>
          )}

          <div role="tablist" className="flex gap-8 border-b border-[#e6dddb] dark:border-[#2a2423]">
            {TABS.map(([key, label]) => (
              <button
                key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={`ty-tab pb-3 text-sm font-bold border-b-2 transition-colors ${tab === key ? 'border-primary text-primary' : 'border-transparent text-[#896a61] hover:text-slate-800'}`}
              >
                {t(label)}
              </button>
            ))}
          </div>

          {tab === 'pipeline' && <PipelineWorkspace job={job} />}
          {tab === 'candidates' && <CandidatesTab job={job} />}
          {tab === 'campaigns' && <CampaignsTab job={job} />}
        </div>
      </div>
      {dialog}
    </AppLayout>
  );
}
