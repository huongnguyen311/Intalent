import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { toast } from '../../components/Toast';
import { userName } from '../../domain/users';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { JobStatusBadge } from './JobBits';
import { JobDrawer } from './JobDrawer';
import { Board } from '../pipeline/Board';
import { CampaignsTab, CandidatesTab, CareersPreviewTab } from './JobTabs';

const SECONDARY =
  'px-5 py-2.5 bg-white dark:bg-[#2a2423] border border-[#e6dddb] dark:border-[#3a3433] text-slate-700 dark:text-white text-sm font-bold rounded-full shadow-sm hover:border-primary/50 transition-colors flex items-center gap-2';

const TABS: Array<['pipeline' | 'candidates' | 'campaigns' | 'careers', TKey]> = [
  ['pipeline', 'jobs.tab.pipeline'],
  ['candidates', 'jobs.tab.candidates'],
  ['campaigns', 'jobs.tab.campaigns'],
  ['careers', 'jobs.tab.careers'],
];

export function JobDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { id } = useParams();
  const job = useStore((s) => s.jobs.find((j) => j.id === id));
  const jd = useStore((s) => s.jds.find((j) => j.id === job?.jdId));
  const users = useStore((s) => s.users);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('pipeline');
  const [editing, setEditing] = useState(false);

  if (!job) {
    return (
      <AppLayout title={t('nav.jobs')}>
        <div className="p-8 text-[#896a61]">{t('jobs.detail.notFound')}</div>
      </AppLayout>
    );
  }

  const setStatus = (next: 'open' | 'closed') => {
    useStore.getState().setJobStatus(job.id, next);
    toast(t(next === 'open' ? 'jobs.toast.published' : 'jobs.toast.closed'));
  };

  return (
    <AppLayout title={t('nav.jobs')} subtitle={t('jobs.subtitle')}>
      <div className="min-h-full bg-[#fbf9f8] dark:bg-background-dark">
        <div className="p-8 max-w-[1400px] mx-auto space-y-8">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-4">
              <button aria-label={t('common.back')} onClick={() => navigate('/jobs')} className="size-10 rounded-full bg-white dark:bg-[#2a2423] border border-[#e6dddb] dark:border-[#3a3433] flex items-center justify-center text-[#896a61] hover:text-[#ff6b00] transition-colors shadow-sm">
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div>
                <h1 className="text-[22px] font-bold tracking-tight text-[#181211] dark:text-white mb-1">{job.title}</h1>
                <p className="text-[#896a61] text-sm flex items-center gap-3 flex-wrap">
                  <span>{t('jobs.detail.meta', { department: job.department, location: job.location, level: job.level })}</span>
                  <span>• {t('jobs.detail.opened', { date: fullDate(job.openedAt) })}</span>
                  {jd && <span>• {t('jobs.detail.jd', { code: jd.code })}</span>}
                  <span>• {userName(users, job.hiringManager)}</span>
                  <JobStatusBadge status={job.status} />
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setEditing(true)} className={SECONDARY}>
                <span className="material-symbols-outlined text-[20px]">edit</span>{t('jobs.menu.edit')}
              </button>
              {job.status === 'open' ? (
                <button onClick={() => setStatus('closed')} className={SECONDARY}>
                  <span className="material-symbols-outlined text-[20px]">lock</span>{t('jobs.menu.close')}
                </button>
              ) : (
                <button onClick={() => setStatus('open')} className="px-6 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-[20px]">publish</span>{t(job.status === 'closed' ? 'jobs.menu.reopen' : 'jobs.menu.publish')}
                </button>
              )}
            </div>
          </div>

          <div role="tablist" className="flex gap-8 border-b border-[#e6dddb] dark:border-[#2a2423]">
            {TABS.map(([key, label]) => (
              <button
                key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={`pb-3 text-sm font-bold border-b-2 transition-colors ${tab === key ? 'border-primary text-primary' : 'border-transparent text-[#896a61] hover:text-slate-800'}`}
              >
                {t(label)}
              </button>
            ))}
          </div>

          {tab === 'pipeline' && <Board job={job} />}
          {tab === 'candidates' && <CandidatesTab job={job} />}
          {tab === 'campaigns' && <CampaignsTab job={job} />}
          {tab === 'careers' && <CareersPreviewTab job={job} jd={jd} />}
        </div>
      </div>
      <JobDrawer open={editing} job={job} onClose={() => setEditing(false)} />
    </AppLayout>
  );
}
