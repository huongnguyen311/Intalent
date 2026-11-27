import { Link, useParams } from 'react-router-dom';
import type { Jd, Job } from '../../domain/types';
import { salaryRange } from '../../domain/hiring';
import { useLang, useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { JobPostBody } from './JobPostBody';
import { JobUnavailable } from './JobBits';
import { SharePanel, ShareButton } from './JobShare';

// Section headings in sentence case: easier to scan than the old small uppercase labels.
// Each heading keeps its top gap; only the very first one on the card drops it (see BODY).
const H2 = 'text-xl font-bold text-ink mt-10 mb-3';
const BODY = 'bg-white rounded-3xl border border-stone-200/80 shadow-sm shadow-stone-900/[0.03] p-6 sm:p-10 text-[15px] leading-relaxed text-gray-700 [&>h2:first-child]:mt-0 [&>section:first-child>h2]:mt-0';

const APPLY = 'inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-lg shadow-orange-500/25';

/** Public job page; only open jobs are shown. */
export function CareersJob() {
  const { jobId } = useParams();
  const job = useStore((s) => s.jobs.find((j) => j.id === jobId));
  const jd = useStore((s) => s.jds.find((j) => j.id === job?.jdId));
  if (!job || job.status !== 'open') return <JobUnavailable />;
  return <CareersJobView job={job} jd={jd} />;
}

/**
 * The public job page body. `preview` is the job editor's pop-up preview of an unsaved draft:
 * no back link, and no sharing because the job has no public link yet.
 */
export function CareersJobView({ job, jd, preview }: { job: Job; jd?: Jd; preview?: boolean }) {
  const t = useT('careers');
  const [lang] = useLang('careers');
  const apply = `/careers/${job.id}/apply`;
  const salary = job.showSalary ? salaryRange(job) : '';
  const facts: [string, TKey, string][] = [
    ['apartment', 'careers.filter.department', job.department],
    ['location_on', 'careers.filter.location', job.location],
    ['military_tech', 'careers.filter.level', job.level],
    ['work', 'careers.job.employment', job.employment],
    ['home_work', 'jobs.drawer.workplace', job.workplace ? t(`workplace.${job.workplace}`) : ''],
    ['group', 'jobs.drawer.headcount', job.headcount ? String(job.headcount) : ''],
    ['timeline', 'jobs.drawer.minYears', job.minYears ? t('jobs.req.years', { n: job.minYears }) : ''],
    ['school', 'jobs.drawer.education', job.education && job.education !== 'any' ? t(`education.${job.education}`) : ''],
    ['payments', 'careers.job.salary', salary || ''],
    ['event', 'careers.job.posted', job.openedAt ? new Date(job.openedAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB') : ''],
  ];
  return (
    <article>
      {!preview && (
        <Link to="/careers#jobs" className="text-sm font-medium text-ink-muted hover:text-primary inline-flex items-center gap-1 mb-6">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {t('careers.back')}
        </Link>
      )}
      {/* Title band: dark, matching the careers hero. */}
      <header className="relative overflow-hidden rounded-3xl careers-dark text-white p-6 sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 careers-grid" />
        {!preview && <div className="relative float-right ml-4 mb-2"><ShareButton job={job} /></div>}
        <p className="relative text-xs font-bold uppercase tracking-[0.14em] text-brand-light">{job.department}</p>
        <h1 className="relative mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-balance max-w-3xl">{job.title}</h1>
        <p className="relative mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/70">
          {[['location_on', job.location], ['work', job.employment]].filter(([, v]) => v).map(([icon, v]) => (
            <span key={icon} className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-white/50">{icon}</span>
              {v}
            </span>
          ))}
        </p>
      </header>

      <div className="mt-8 grid lg:grid-cols-[1fr_20rem] gap-8 items-start">
        <div className={BODY}>
          <JobPostBody job={job} jd={jd} headingClass={H2} />
        </div>

        <aside className={`lg:sticky ${preview ? 'lg:top-0' : 'lg:top-24'} bg-white rounded-3xl border border-stone-200/80 shadow-sm shadow-stone-900/[0.03] p-6`}>
          <h2 className="font-bold">{t('careers.job.overview')}</h2>
          <dl className="mt-4 space-y-4">
            {facts.filter(([, , v]) => v).map(([icon, label, v]) => (
              <div key={label} className="flex gap-3">
                <span className="size-9 shrink-0 grid place-items-center rounded-lg bg-orange-50 text-primary-ink ring-1 ring-orange-100"><span className="material-symbols-outlined text-[20px]">{icon}</span></span>
                <div className="min-w-0">
                  <dt className="text-xs text-ink-muted">{t(label)}</dt>
                  <dd className="text-sm font-semibold text-ink">{v}</dd>
                </div>
              </div>
            ))}
          </dl>
          <Link to={apply} className={`${APPLY} mt-6 w-full`}>{t('careers.job.apply')}</Link>
          <p className="mt-3 text-xs text-ink-muted text-center leading-snug">{t('careers.job.applyHint')}</p>
          {!preview && <SharePanel job={job} />}
        </aside>
      </div>
    </article>
  );
}
