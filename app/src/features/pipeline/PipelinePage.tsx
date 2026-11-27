import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useT } from '../../i18n/i18n';
import { jobsInScope } from '../../domain/permissions';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { PipelineWorkspace } from './PipelineWorkspace';

/** `/pipeline` = All jobs (every open / on-hold job in scope); `/pipeline/:jobId` = one job. */
export function PipelinePage() {
  const t = useT();
  const navigate = useNavigate();
  const { jobId } = useParams();
  const user = useMe();
  const allJobs = useStore((s) => s.jobs);
  const jobs = jobsInScope(user, allJobs);
  // On Hold jobs stop intake but their pipeline keeps moving.
  const openJobs = jobs.filter((j) => j.status === 'open' || j.status === 'on_hold');
  const job = jobs.find((j) => j.id === jobId);

  // A draft/closed job reached by link stays selectable so the switcher shows where you are.
  const switchable = job && !openJobs.includes(job) ? [job, ...openJobs] : openJobs;
  // Bare `/pipeline` is "All jobs": every open / on-hold job in the user's scope on one board.
  const showAll = !jobId && openJobs.length > 0;
  return (
    <AppLayout title={t('nav.pipeline')} subtitle={t('pipeline.subtitle')}>
      <div className="p-8 min-h-full">
        {job || showAll ? (
          <PipelineWorkspace key={job?.id ?? 'all'} job={job} switchable={switchable} onSwitch={(id) => navigate(id ? `/pipeline/${id}` : '/pipeline')} />
        ) : (
          <div className="p-12 flex flex-col items-center text-center gap-3">
            <p className="text-ink-muted">{t(jobId ? 'pipeline.notFound' : 'pipeline.noOpenJobs')}</p>
            {/* Not a dead end: offer the user's own pipelines (or their job list when none is open). */}
            <Link to={openJobs[0] ? `/pipeline/${openJobs[0].id}` : '/jobs'} className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold">
              {t(openJobs[0] ? 'pipeline.goToMine' : 'nav.jobs')}
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
