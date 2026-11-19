import { Link, useParams, useSearchParams } from 'react-router-dom';
import { salaryRange } from '../../domain/hiring';
import { jdMustHave } from '../../domain/jdExtract';
import { PostSection } from './PostSection';
import { useLang, useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { JdBody } from './JdBody';
import { JobUnavailable } from './JobBits';
import { SharePanel, ShareButton } from './JobShare';

// Section headings in sentence case: easier to scan than the old small uppercase labels.
const H2 = 'text-xl font-bold text-[#181211] mt-10 mb-3 first:mt-0';
const APPLY = 'inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-lg shadow-primary/20';

/** Public job page; only open jobs are shown. The `?src` tracking code is carried over to the apply page. */
export function CareersJob() {
  const t = useT('careers');
  const [lang] = useLang('careers');
  const { jobId } = useParams();
  const [params] = useSearchParams();
  const job = useStore((s) => s.jobs.find((j) => j.id === jobId));
  const jd = useStore((s) => s.jds.find((j) => j.id === job?.jdId));
  if (!job || job.status !== 'open') return <JobUnavailable />;
  const src = params.get('src');
  const apply = `/careers/${job.id}/apply${src ? `?src=${encodeURIComponent(src)}` : ''}`;
  const reqs = jd ? jdMustHave(jd) : [];
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
      <Link to="/careers#jobs" className="text-sm font-medium text-[#896a61] hover:text-primary inline-flex items-center gap-1 mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {t('careers.back')}
      </Link>
      {/* Title band: dark, matching the careers hero. */}
      <header className="relative overflow-hidden rounded-3xl bg-sidebar-dark text-white p-6 sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative float-right ml-4 mb-2"><ShareButton job={job} /></div>
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
        <div className="bg-white rounded-3xl border border-[#e6dddb] p-6 sm:p-10 text-[15px] leading-relaxed text-[#3d312e]">
          {jd?.body ? (
            <JdBody
              body={jd.body}
              title={job.title}
              headingClass={H2}
              // Requirements and skills have their own blocks below, so their copies in the body are not repeated.
              skip={[...(reqs.length || jd.skillsExperience ? [/MUST|REQUIRE/] : []), ...(jd.skills.length ? [/TECH STACK|SKILLS/] : [])]}
            />
          ) : (
            <>
              <h2 className={H2}>{t('careers.job.about')}</h2>
              <p>{t('careers.job.noDescription')}</p>
            </>
          )}
          {jd?.skillsExperience ? (
            <PostSection heading={t('careers.job.skillsExperience')} text={jd.skillsExperience} headingClass={H2} />
          ) : reqs.length > 0 && (
            <>
              <h2 className={H2}>{t('careers.job.requirements')}</h2>
              <ul className="space-y-2">
                {reqs.map((r) => (
                  <li key={r} className="flex gap-2.5">
                    <span className="material-symbols-outlined icon-filled text-primary text-[20px] mt-0.5">check_circle</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {jd && jd.skills.length > 0 && (
            <>
              <h2 className={H2}>{t('careers.job.skills')}</h2>
              <div className="flex gap-2 flex-wrap">
                {jd.skills.map((s) => <span key={s} className="px-3 py-1 rounded-full bg-primary/10 text-primary-ink text-xs font-semibold">{s}</span>)}
              </div>
            </>
          )}
          {job.whyLove && <PostSection heading={t('careers.job.whyLove')} text={job.whyLove} headingClass={H2} />}
          {job.additionalInfo && <PostSection heading={t('careers.job.additionalInfo')} text={job.additionalInfo} headingClass={H2} />}
        </div>

        <aside className="lg:sticky lg:top-24 bg-white rounded-3xl border border-[#e6dddb] p-6">
          <h2 className="font-bold">{t('careers.job.overview')}</h2>
          <dl className="mt-4 space-y-4">
            {facts.filter(([, , v]) => v).map(([icon, label, v]) => (
              <div key={label} className="flex gap-3">
                <span className="size-9 shrink-0 grid place-items-center rounded-lg bg-[#f4efee] text-[#3d312e]"><span className="material-symbols-outlined text-[20px]">{icon}</span></span>
                <div className="min-w-0">
                  <dt className="text-xs text-[#896a61]">{t(label)}</dt>
                  <dd className="text-sm font-semibold text-[#181211]">{v}</dd>
                </div>
              </div>
            ))}
          </dl>
          <Link to={apply} className={`${APPLY} mt-6 w-full`}>{t('careers.job.apply')}</Link>
          <p className="mt-3 text-xs text-[#896a61] text-center leading-snug">{t('careers.job.applyHint')}</p>
          <SharePanel job={job} />
        </aside>
      </div>
    </article>
  );
}
