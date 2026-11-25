import { Link } from 'react-router-dom';
import { Chip } from '../../components/Chip';
import { campaignJobIds } from '../../domain/campaigns';
import { stageLabel } from '../../domain/stages';
import type { Application, Campaign, Job, Jd } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { useMe } from '../../store/session';
import { can } from '../../domain/permissions';
import { JobPostBody } from '../careers/JobPostBody';
import { fullDate } from '../jds/format';

const TH = 'px-6 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]';
const TD = 'px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400';

export function CandidatesTab({ job }: { job: Job }) {
  const t = useT();
  const [lang] = useLang();
  const applications = useStore((s) => s.applications);
  const candidates = useStore((s) => s.candidates);
  const rows = applications
    .filter((a) => a.jobId === job.id)
    .sort((a: Application, b: Application) => b.addedAt.localeCompare(a.addedAt));
  return (
    <div className="bg-white dark:bg-surface-dark rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar max-h-[calc(100vh-380px)] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] sticky top-0 z-10">
            <tr>
              {(['jobs.candidates.col.name', 'jobs.candidates.col.stage', 'jobs.candidates.col.source', 'jobs.candidates.col.via', 'jobs.candidates.col.applied'] as const).map((k) => (
                <th key={k} className={`${TH} text-left`}>{t(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
            {rows.map((a) => {
              const c = candidates.find((x) => x.id === a.candidateId);
              return (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className={TD}>
                    <Link to={`/candidates/${a.candidateId}`} className="font-bold text-slate-800 dark:text-gray-200 hover:text-primary transition-colors">{c?.name ?? a.candidateId}</Link>
                  </td>
                  <td className={TD}><Chip>{stageLabel(a.stage, lang)}</Chip></td>
                  <td className={TD}>{a.source}</td>
                  <td className={TD}>{t(`jobs.via.${a.via}`)}</td>
                  <td className={TD}>{fullDate(a.addedAt)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-[#896a61]">{t('jobs.candidates.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CampaignsTab({ job }: { job: Job }) {
  const t = useT();
  const { campaigns: all, jobs, applications } = useStore();
  // The campaign the job runs in now, plus earlier ones it brought applicants to.
  const campaigns = all.filter((c: Campaign) => campaignJobIds(c, { jobs, applications }).includes(job.id));
  const canCampaign = can(useMe(), 'campaign');
  return (
    <div className="bg-white dark:bg-surface-dark rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#f8f6f6] dark:bg-[#251f1e]">
          <tr>
            {(['jobs.campaigns.col.name', 'jobs.campaigns.col.period', 'jobs.campaigns.col.status'] as const).map((k) => (
              <th key={k} className={`${TH} text-left`}>{t(k)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
          {campaigns.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <td className={TD}>
                {canCampaign ? <Link to={`/campaigns/${c.id}`} className="font-bold text-slate-800 dark:text-gray-200 hover:text-primary transition-colors">{c.name}</Link> : <span className="font-bold text-slate-800 dark:text-gray-200">{c.name}</span>}
              </td>
              <td className={TD}>{fullDate(c.start)} – {fullDate(c.end)}</td>
              <td className={`${TD} capitalize`}>{c.status}</td>
            </tr>
          ))}
          {campaigns.length === 0 && (
            <tr><td colSpan={3} className="px-6 py-10 text-center text-sm text-[#896a61]">{t('jobs.campaigns.empty')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Simple stand-in for the public job page, shown inside a bordered frame. */
/** `compact`: narrower card for the job editor's side preview. */
export function CareersPreviewTab({ job, jd, compact }: { job: Job; jd?: Jd; compact?: boolean }) {
  const t = useT();
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#896a61]">
        {t('jobs.preview.note')}
        {job.status !== 'open' && <span className="ml-2 text-orange-500 font-bold">{t('jobs.preview.unpublished')}</span>}
      </p>
      <div data-testid="careers-preview" className={`border-2 border-dashed border-[#e6dddb] dark:border-[#3a3433] bg-white dark:bg-[#1e1e1e] ${compact ? 'p-6 rounded-2xl' : 'p-10 max-w-3xl rounded-[2rem]'}`}>
        <h2 className={`ty-title ${compact ? 'text-xl' : 'text-2xl'} font-bold text-slate-800 dark:text-white`}>{job.title}</h2>
        <div className="flex gap-2 flex-wrap mt-3">
          {[
            job.location, job.level, job.employment,
            job.minYears ? t('jobs.req.years', { n: job.minYears }) : '',
            job.education && job.education !== 'any' ? t(`education.${job.education}`) : '',
          ].filter(Boolean).map((x) => <Chip key={x}>{x}</Chip>)}
        </div>
        {/* The same sections, in the same order, as the public job page. */}
        <div className="mt-2 text-sm text-slate-600 dark:text-gray-300 leading-relaxed">
          {jd || job.summary !== undefined
            ? <JobPostBody job={job} jd={jd} scope="app" headingClass="text-base font-bold text-slate-800 dark:text-white mt-6 mb-2" />
            : <p className="mt-6">{t('jobs.preview.noJd')}</p>}
        </div>
        <span className="inline-block mt-8 px-6 py-2.5 bg-brand-accent text-white rounded-full font-bold text-sm shadow-lg shadow-orange-500/20">
          {t('jobs.preview.apply')}
        </span>
      </div>
    </div>
  );
}
