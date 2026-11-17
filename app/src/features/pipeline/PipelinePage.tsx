import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { MenuItem, Popover } from '../../components/Popover';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { AddFromPoolButton } from './AddFromPoolModal';
import { Board } from './Board';

/** `/pipeline/:jobId`; bare `/pipeline` redirects to the first open job. */
export function PipelinePage() {
  const t = useT();
  const navigate = useNavigate();
  const { jobId } = useParams();
  const jobs = useStore((s) => s.jobs);
  const openJobs = jobs.filter((j) => j.status === 'open');
  const job = jobs.find((j) => j.id === jobId);

  if (!jobId && openJobs[0]) return <Navigate to={`/pipeline/${openJobs[0].id}`} replace />;

  // A draft/closed job reached by link stays selectable so the switcher shows where you are.
  const switchable = job && job.status !== 'open' ? [job, ...openJobs] : openJobs;
  const actions = job && (
    <div className="flex items-center gap-3">
      <Popover
        align="right"
        trigger={({ toggle }) => (
          <button onClick={toggle} className="px-4 py-2.5 rounded-full bg-white dark:bg-[#2a2423] border border-[#e6dddb] dark:border-[#3a3433] text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2 hover:border-primary/50 transition-colors shadow-sm max-w-[320px]">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-[#896a61]">work</span>
            <span className="truncate">{t('pipeline.job', { title: job.title })}</span>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">expand_more</span>
          </button>
        )}
      >
        {(close) =>
          switchable.map((j) => (
            <MenuItem key={j.id} active={j.id === job.id} onClick={() => { close(); navigate(`/pipeline/${j.id}`); }}>
              {j.title}
            </MenuItem>
          ))
        }
      </Popover>
      <AddFromPoolButton jobId={job.id} />
    </div>
  );

  return (
    <AppLayout title={t('nav.pipeline')} subtitle={t('pipeline.subtitle')} actions={actions}>
      <div className="p-8 max-w-[1400px] mx-auto min-h-full">
        {job ? (
          <Board key={job.id} job={job} />
        ) : (
          <p className="text-[#896a61]">{t(jobId ? 'pipeline.notFound' : 'pipeline.noOpenJobs')}</p>
        )}
      </div>
    </AppLayout>
  );
}
