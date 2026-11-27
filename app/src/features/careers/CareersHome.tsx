import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { salaryRange } from '../../domain/hiring';
import { normalizeRole } from '../../domain/permissions';
import type { Job } from '../../domain/types';
import { useT, type TKey } from '../../i18n/i18n';
import { useMe } from '../../store/session';
import { publicJobs } from '../../store/selectors';
import { useStore } from '../../store/store';

const WRAP = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';
const EYEBROW = 'text-xs font-bold uppercase tracking-[0.14em] text-primary-ink';
const H2 = 'mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-balance';
const FILTER = 'h-11 px-3 border-0 rounded-xl bg-stone-100/70 ring-1 ring-transparent hover:ring-stone-200 focus:ring-2 focus:ring-primary outline-none text-sm';
const KEYS = ['department', 'location', 'level'] as const;


export function CareersHome() {
  const t = useT('careers');
  const { hash } = useLocation();
  const all = publicJobs({ jobs: useStore((s) => s.jobs) });
  const [q, setQ] = useState('');
  const [sel, setSel] = useState({ department: '', location: '', level: '' });
  const options = useMemo(
    () => KEYS.map((k) => [k, [...new Set(all.map((j) => j[k]).filter(Boolean))].sort()] as const),
    [all],
  );
  const needle = q.trim().toLowerCase();
  const jobs = all.filter((j) => (!needle || j.title.toLowerCase().includes(needle)) && KEYS.every((k) => !sel[k] || j[k] === sel[k]));
  const filtered = needle !== '' || KEYS.some((k) => sel[k]);

  // Header and footer links point at /careers#jobs; the router does not scroll to hashes on its own.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.({ behavior: 'smooth' });
  }, [hash]);

  const stats: [number, TKey][] = [
    [all.length, 'careers.stat.jobs'],
    [options[0][1].length, 'careers.stat.departments'],
    [options[1][1].length, 'careers.stat.locations'],
  ];

  return (
    <div>
      {/* Hero: team photo ("home 1") on the right, pitch and keyword search on the left. */}
      <section className="relative overflow-hidden careers-dark text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 careers-grid" />
        <div className={`${WRAP} relative grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center py-14 sm:py-20 lg:py-24`}>
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-bold tracking-tight leading-[1.08] text-balance">
              {t('careers.hero.title2')}
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/70 max-w-xl leading-relaxed">{t('careers.hero.subtitle2')}</p>
            <dl className="mt-10 grid grid-cols-3 gap-6 max-w-md border-t border-white/10 pt-6">
              {stats.map(([n, key]) => (
                <div key={key} className="flex flex-col-reverse">
                  <dt className="text-xs text-white/60 mt-1">{t(key)}</dt>
                  <dd className="text-3xl font-bold tabular-nums bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">{n}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div aria-hidden="true" className="absolute -inset-2 rounded-[1.9rem] ring-1 ring-white/10 bg-gradient-to-br from-orange-500/25 via-white/5 to-amber-400/10" />
            <img
              src="/assets/images/careers-hero.jpg"
              alt={t('careers.hero.photoAlt')}
              width={967}
              height={639}
              className="relative w-full aspect-[967/639] object-cover rounded-3xl shadow-2xl shadow-black/40"
            />
            <div className="absolute -bottom-6 left-4 sm:-left-6 flex items-start gap-3 rounded-2xl bg-white/95 backdrop-blur text-ink p-4 pr-5 shadow-2xl shadow-black/30 ring-1 ring-black/5 max-w-[17rem]">
              <span className="size-10 shrink-0 grid place-items-center rounded-xl careers-gradient text-white"><span className="material-symbols-outlined icon-filled">bolt</span></span>
              <div>
                <p className="text-sm font-bold">{t('careers.hero.badgeTitle')}</p>
                <p className="text-xs text-stone-500 mt-0.5 leading-snug">{t('careers.hero.badgeBody')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Open positions: warm gradient with a faint dot grid, so the list reads as the heart of the page. */}
      <section id="jobs" className="relative overflow-hidden scroll-mt-16 bg-white border-b border-stone-200/70">
        <div className={`${WRAP} relative py-16 sm:py-24`}>
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-balance">
              <span className="block">{t('careers.jobs.title')}</span>
              <span className="block careers-gradient-text">{t('careers.jobs.titleHi')}</span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-stone-500">{t('careers.jobs.subtitle')}</p>
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2.5 p-2.5 rounded-2xl bg-white shadow-xl shadow-stone-900/[0.06] ring-1 ring-stone-200/80">
            <label className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-muted">search</span>
              <input
                type="search"
                aria-label={t('careers.filter.search')}
                placeholder={t('careers.filter.search')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={`${FILTER} w-full pl-10`}
              />
            </label>
            {options.map(([k, values]) => (
              <select key={k} aria-label={t(`careers.filter.${k}`)} value={sel[k]} onChange={(e) => setSel({ ...sel, [k]: e.target.value })} className={FILTER}>
                <option value="">{t(`careers.filter.${k}`)}: {t('careers.filter.all')}</option>
                {values.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            ))}
            <button
              type="button"
              disabled={!filtered}
              onClick={() => { setQ(''); setSel({ department: '', location: '', level: '' }); }}
              className="h-11 px-4 rounded-xl text-sm font-semibold text-primary-ink hover:bg-primary/10 disabled:text-muted disabled:hover:bg-transparent"
            >
              {t('careers.jobs.clear')}
            </button>
          </div>
          {jobs.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
              <span className="material-symbols-outlined text-4xl text-muted">search_off</span>
              <p className="mt-2 text-ink-muted">{t(all.length === 0 ? 'careers.home.empty' : 'careers.filter.noMatch')}</p>
            </div>
          ) : (
            <ul data-testid="careers-grid" className="mt-8 grid gap-3">
              {jobs.map((job) => <JobRow key={job.id} job={job} />)}
            </ul>
          )}
        </div>
      </section>

      {/* Hiring process */}
      <section className={`${WRAP} pt-16 pb-16 sm:pt-24 sm:pb-24`}>
        <div className="max-w-2xl">
          <p className={EYEBROW}>{t('careers.process.eyebrow')}</p>
          <h2 className={H2}>{t('careers.process.title')}</h2>
        </div>
        <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {([1, 2, 3, 4] as const).map((n) => (
            <li key={n} className="relative">
              <div className="flex items-center gap-3">
                <span className="size-10 shrink-0 rounded-full careers-gradient text-white grid place-items-center text-sm font-bold shadow-lg shadow-orange-500/25">{n}</span>
                {n < 4 && <span aria-hidden="true" className="hidden lg:block h-px flex-1 bg-gradient-to-r from-orange-300 to-transparent" />}
              </div>
              <h3 className="mt-4 font-bold text-lg">{t(`careers.process.${n}.title`)}</h3>
              <p className="mt-1.5 text-sm text-stone-500 leading-relaxed">{t(`careers.process.${n}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <CtaBand />
    </div>
  );
}

const deptIcon = (d: string) =>
  /design/i.test(d) ? 'palette' : /market|sales|growth/i.test(d) ? 'campaign' : /engineer|tech|dev|data/i.test(d) ? 'code' : /hr|people|talent/i.test(d) ? 'groups' : 'work';

/** One scannable row per job: title and where/what on the left, level and salary on the right. */
function JobRow({ job }: { job: Job }) {
  const t = useT('careers');
  const salary = job.showSalary ? salaryRange(job) : '';
  const meta: [string, string][] = [
    ['apartment', job.department],
    ['location_on', job.location],
    ['work', job.employment],
  ];
  return (
    <li>
      <Link
        to={`/careers/${job.id}`}
        className="group relative flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 sm:px-6 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-900/[0.06] transition"
      >
        <span className="hidden sm:grid size-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-primary-ink ring-1 ring-orange-100 group-hover:bg-primary group-hover:text-white group-hover:ring-primary transition-colors">
          <span className="material-symbols-outlined">{deptIcon(job.department)}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-snug group-hover:text-primary-ink">{job.title}</h3>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
            {meta.filter(([, v]) => v).map(([icon, v]) => (
              <span key={icon} className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px] text-stone-400">{icon}</span>
                {v}
              </span>
            ))}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {job.level && <span className="px-3 py-1 rounded-full bg-stone-100 ring-1 ring-stone-200/70 text-xs font-semibold text-stone-600">{job.level}</span>}
          {salary && <span className="px-3 py-1 rounded-full bg-emerald-50 ring-1 ring-emerald-100 text-xs font-semibold text-emerald-700">{salary}</span>}
          <span className="ml-auto sm:ml-3 inline-flex items-center gap-1 text-sm font-bold text-stone-500 group-hover:text-primary-ink">
            <span className="sm:sr-only">{t('careers.card.view')}</span>
            <span className="size-9 grid place-items-center rounded-full bg-stone-100 group-hover:bg-primary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </span>
          </span>
        </div>
      </Link>
    </li>
  );
}

function CtaBand() {
  const t = useT('careers');
  const isCandidate = normalizeRole(useMe().role) === 'Candidate';
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
      <div className="relative overflow-hidden rounded-3xl careers-dark text-white px-6 py-10 sm:px-12 sm:py-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 careers-grid" />
        <div className="relative max-w-xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{t(isCandidate ? 'careers.cta.candidateTitle' : 'careers.cta.title')}</h2>
          <p className="mt-2 text-white/70">{t(isCandidate ? 'careers.cta.candidateBody' : 'careers.cta.body')}</p>
        </div>
        <div className="relative flex flex-wrap gap-3">
          {isCandidate ? (
            <Link to="/me" className="h-12 px-6 inline-flex items-center rounded-full bg-primary hover:bg-primary-hover text-white font-bold text-sm">{t('portal.nav.profile')}</Link>
          ) : (
            // Status lookup and sign-in are the same page now, so one button.
            <Link to="/careers/login" className="h-12 px-6 inline-flex items-center rounded-full bg-primary hover:bg-primary-hover text-white font-bold text-sm">{t('portal.nav.login')}</Link>
          )}
        </div>
      </div>
    </section>
  );
}
