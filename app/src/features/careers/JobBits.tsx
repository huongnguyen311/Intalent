import { Link } from 'react-router-dom';
import { salaryRange } from '../../domain/hiring';
import type { Job } from '../../domain/types';
import { useT } from '../../i18n/i18n';

export function MetaChips({ job }: { job: Job }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {[job.location, job.level, job.employment, job.department].filter(Boolean).map((x) => (
        <span key={x} className="px-3 py-1 rounded-full bg-stone-100 ring-1 ring-stone-200/70 text-xs font-semibold text-stone-600">{x}</span>
      ))}
      {job.showSalary && salaryRange(job) && (
        <span className="px-3 py-1 rounded-full bg-emerald-50 ring-1 ring-emerald-100 text-xs font-semibold text-emerald-700">{salaryRange(job)}</span>
      )}
    </div>
  );
}

/** Shown for closed, draft and unknown jobs. */
export function JobUnavailable() {
  const t = useT('careers');
  return (
    <div data-testid="careers-unavailable" className="max-w-xl mx-auto text-center bg-white rounded-3xl border border-stone-200/80 shadow-sm p-8 sm:p-12">
      <span className="material-symbols-outlined text-ink-muted text-5xl">work_off</span>
      <h1 className="text-2xl font-bold mt-4">{t('careers.unavailable.title')}</h1>
      <p className="text-ink-muted mt-2">{t('careers.unavailable.body')}</p>
      <Link to="/careers" className="inline-block mt-6 px-6 py-3 rounded-full bg-primary text-white font-bold text-sm">
        {t('careers.applied.browse')}
      </Link>
    </div>
  );
}
