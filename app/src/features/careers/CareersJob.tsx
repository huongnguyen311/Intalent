import { Link, useParams, useSearchParams } from 'react-router-dom';
import { jdMustHave } from '../../domain/jdExtract';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { JobUnavailable, MetaChips } from './JobBits';

const H2 = 'text-sm font-bold uppercase tracking-wide text-[#896a61] mt-8 mb-2';

/** Public job page; only open jobs are shown. The `?src` tracking code is carried over to the apply page. */
export function CareersJob() {
  const t = useT('careers');
  const { jobId } = useParams();
  const [params] = useSearchParams();
  const job = useStore((s) => s.jobs.find((j) => j.id === jobId));
  const jd = useStore((s) => s.jds.find((j) => j.id === job?.jdId));
  if (!job || job.status !== 'open') return <JobUnavailable />;
  const src = params.get('src');
  const apply = `/careers/${job.id}/apply${src ? `?src=${encodeURIComponent(src)}` : ''}`;
  const reqs = jd ? jdMustHave(jd) : [];
  return (
    <article className="max-w-3xl mx-auto">
      <Link to="/careers" className="text-sm font-medium text-[#896a61] hover:text-primary inline-flex items-center gap-1 mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {t('careers.back')}
      </Link>
      <div className="bg-white rounded-3xl border border-[#e6dddb] p-6 sm:p-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{job.title}</h1>
        <div className="mt-4"><MetaChips job={job} /></div>
        <h2 className={H2}>{t('careers.job.about')}</h2>
        <p className="text-sm leading-relaxed whitespace-pre-line text-[#3d312e]">{jd?.body || t('careers.job.noDescription')}</p>
        {reqs.length > 0 && (
          <>
            <h2 className={H2}>{t('careers.job.requirements')}</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-[#3d312e]">
              {reqs.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </>
        )}
        {jd && jd.skills.length > 0 && (
          <>
            <h2 className={H2}>{t('careers.job.skills')}</h2>
            <div className="flex gap-2 flex-wrap">
              {jd.skills.map((s) => <span key={s} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">{s}</span>)}
            </div>
          </>
        )}
        <Link to={apply} className="inline-block mt-10 px-8 py-3 rounded-full bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20">
          {t('careers.job.apply')}
        </Link>
      </div>
    </article>
  );
}
