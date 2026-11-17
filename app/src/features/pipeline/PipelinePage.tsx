import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { PipelineWorkspace } from './PipelineWorkspace';

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
  return (
    <AppLayout title={t('nav.pipeline')} subtitle={t('pipeline.subtitle')}>
      <div className="p-4 max-w-[1600px] mx-auto min-h-full">
        {job ? (
          <PipelineWorkspace key={job.id} job={job} switchable={switchable} onSwitch={(id) => navigate(`/pipeline/${id}`)} />
        ) : (
          <p className="text-[#896a61]">{t(jobId ? 'pipeline.notFound' : 'pipeline.noOpenJobs')}</p>
        )}
      </div>
    </AppLayout>
  );
}
