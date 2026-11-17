import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/i18n';
import { publicJobs } from '../../store/selectors';
import { useStore } from '../../store/store';
import { MetaChips } from './JobBits';

export function CareersHome() {
  const t = useT('careers');
  const all = publicJobs({ jobs: useStore((s) => s.jobs) });
  const [q, setQ] = useState('');
  const [sel, setSel] = useState({ department: '', location: '', level: '' });
  const options = useMemo(
    () => (['department', 'location', 'level'] as const).map((k) => [k, [...new Set(all.map((j) => j[k]).filter(Boolean))].sort()] as const),
    [all],
  );
  const needle = q.trim().toLowerCase();
  const jobs = all.filter(
    (j) => (!needle || j.title.toLowerCase().includes(needle)) && (['department', 'location', 'level'] as const).every((k) => !sel[k] || j[k] === sel[k]),
  );
  return (
    <div>
      <section className="rounded-3xl bg-sidebar-dark text-white px-6 py-10 sm:px-12 sm:py-16 mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">{t('careers.hero.title')}</h1>
        <p className="mt-3 text-[#c9bcb8] max-w-xl">{t('careers.hero.subtitle')}</p>
      </section>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <input
          type="search"
          aria-label={t('careers.filter.search')}
          placeholder={t('careers.filter.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 px-4 rounded-lg bg-white ring-1 ring-gray-200 focus:ring-2 focus:ring-primary outline-none text-sm"
        />
        {options.map(([k, values]) => (
          <select
            key={k}
            aria-label={t(`careers.filter.${k}`)}
            value={sel[k]}
            onChange={(e) => setSel({ ...sel, [k]: e.target.value })}
            className="h-11 px-3 rounded-lg bg-white ring-1 ring-gray-200 focus:ring-2 focus:ring-primary outline-none text-sm"
          >
            <option value="">{t(`careers.filter.${k}`)}: {t('careers.filter.all')}</option>
            {values.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        ))}
      </div>
      <p className="text-sm font-semibold text-[#896a61] mb-4">{t('careers.home.count', { n: jobs.length })}</p>
      {jobs.length === 0 ? (
        <p className="text-[#896a61]">{t(all.length === 0 ? 'careers.home.empty' : 'careers.filter.noMatch')}</p>
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
