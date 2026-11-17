import { Link } from 'react-router-dom';
import { useT } from '../../i18n/i18n';
import { publicJobs } from '../../store/selectors';
import { useStore } from '../../store/store';
import { MetaChips } from './JobBits';

export function CareersHome() {
  const t = useT('careers');
  const jobs = publicJobs({ jobs: useStore((s) => s.jobs) });
  return (
    <div>
      <section className="rounded-3xl bg-sidebar-dark text-white px-6 py-10 sm:px-12 sm:py-16 mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">{t('careers.hero.title')}</h1>
        <p className="mt-3 text-[#c9bcb8] max-w-xl">{t('careers.hero.subtitle')}</p>
      </section>
      <p className="text-sm font-semibold text-[#896a61] mb-4">{t('careers.home.count', { n: jobs.length })}</p>
      {jobs.length === 0 ? (
        <p className="text-[#896a61]">{t('careers.home.empty')}</p>
      ) : (
        <ul data-testid="careers-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <li key={job.id} className="bg-white rounded-2xl border border-[#e6dddb] p-6 flex flex-col gap-4 hover:shadow-lg transition-shadow">
              <h2 className="text-lg font-bold leading-snug">
                <Link to={`/careers/${job.id}`} className="hover:text-primary">{job.title}</Link>
              </h2>
              <MetaChips job={job} />
              <Link to={`/careers/${job.id}`} className="mt-auto text-sm font-bold text-primary inline-flex items-center gap-1">
                {t('careers.card.view')}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
