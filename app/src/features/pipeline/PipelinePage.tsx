import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useMemo, useState } from 'react';
import { pipelineSummary } from '../../domain/pipelineFilter';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { Board } from './Board';
import { PipelineHeader, type PipelineQuery, type PipelineView } from './PipelineHeader';

/** `/pipeline/:jobId`; bare `/pipeline` redirects to the first open job. */
export function PipelinePage() {
  const t = useT();
  const navigate = useNavigate();
  const { jobId } = useParams();
  const jobs = useStore((s) => s.jobs);
  const openJobs = jobs.filter((j) => j.status === 'open');
  const applications = useStore((s) => s.applications);
  const job = jobs.find((j) => j.id === jobId);

  const [query, setQuery] = useState<PipelineQuery>({ text: '', source: '' });
  const [view, setView] = useState<PipelineView>('kanban');
  const jobApps = useMemo(() => applications.filter((a) => a.jobId === jobId), [applications, jobId]);
  const sources = useMemo(() => [...new Set(jobApps.map((a) => a.source))].sort(), [jobApps]);
  const summary = useMemo(() => (job ? pipelineSummary(jobApps, job, Date.now()) : { total: 0, overdue: 0, daysOpen: 0 }), [jobApps, job]);

  if (!jobId && openJobs[0]) return <Navigate to={`/pipeline/${openJobs[0].id}`} replace />;

  // A draft/closed job reached by link stays selectable so the switcher shows where you are.
  const switchable = job && job.status !== 'open' ? [job, ...openJobs] : openJobs;
  return (
    <AppLayout title={t('nav.pipeline')} subtitle={t('pipeline.subtitle')}>
      <div className="p-4 max-w-[1600px] mx-auto min-h-full">
        {job ? (
          <>
            <PipelineHeader
              job={job}
              switchable={switchable}
              onSwitch={(id) => navigate(`/pipeline/${id}`)}
              summary={summary}
              sources={sources}
              query={query}
              onQuery={setQuery}
              view={view}
              onView={setView}
            />
            <Board key={job.id} job={job} filter={query} />
          </>
        ) : (
          <p className="text-[#896a61]">{t(jobId ? 'pipeline.notFound' : 'pipeline.noOpenJobs')}</p>
        )}
      </div>
    </AppLayout>
  );
}
