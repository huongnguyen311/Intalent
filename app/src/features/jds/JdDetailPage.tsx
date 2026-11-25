import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/BackButton';
import { NotFoundState } from '../../components/NotFoundState';
import { toast } from '../../components/Toast';
import { jobsInScope } from '../../domain/permissions';
import { userName } from '../../domain/users';
import { useMe } from '../../store/session';
import { isFixtureMode } from '../../data/fixtureMockup';
import { jdMustHave, jdRequirements } from '../../domain/jdExtract';
import { useShowNew } from '../../hooks';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { JobStatusBadge } from '../jobs/JobBits';
import { DeleteJdModal } from './DeleteJdModal';
import { fullDate } from './format';

const SECONDARY =
  'px-5 py-2.5 bg-white dark:bg-[#2a2423] border border-[#e6dddb] dark:border-[#3a3433] hover:bg-gray-50 dark:hover:bg-[#332d2c] text-[#181211] dark:text-white text-sm font-bold rounded-full shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap';
const LABEL = 'text-2xs text-[#896a61] uppercase font-bold mb-0.5';
const VALUE = 'text-sm font-semibold text-[#181211] dark:text-white';

const SUB = 'text-xs font-medium text-[#896a61]';
const CHIP = 'px-2.5 py-1 rounded bg-gray-100 dark:bg-white/10 text-[11px] font-bold text-slate-600 dark:text-gray-300';

/** A titled block in the overview card: a paragraph or a bullet list. */
function Block({ title, text, items }: { title: string; text?: string; items?: string[] }) {
  if (!text?.trim() && !items?.length) return null;
  return (
    <section>
      <h3 className="text-xs font-bold text-[#896a61] uppercase tracking-wider mb-2">{title}</h3>
      {items?.length ? (
        <ul className="text-sm text-[#332d2c] dark:text-gray-300 list-disc pl-5 space-y-1">{items.map((x) => <li key={x}>{x}</li>)}</ul>
      ) : (
        <p className="text-sm text-[#332d2c] dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{text}</p>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <p className={VALUE}>{value}</p>
    </div>
  );
}

export function JdDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { id } = useParams();
  const showNew = useShowNew();
  const jd = useStore((s) => s.jds.find((j) => j.id === id));
  const taxonomy = useStore((s) => s.taxonomy);
  const allJobs = useStore((s) => s.jobs);
  const users = useStore((s) => s.users);
  const user = useMe();
  // Only the jobs this user may open are links; the rest are listed without one.
  const mine = new Set(jobsInScope(user, allJobs).map((j) => j.id));
  const [deleting, setDeleting] = useState(false);
  const search = isFixtureMode() ? '?fixture=mockup' : '';

  if (!jd) {
    return (
      <AppLayout title={t('nav.jdManagement')}>
        <NotFoundState message={t('jd.notFound')} backTo={`/jds${search}`} backLabel={t('jd.backToList')} />
      </AppLayout>
    );
  }

  const req = jdRequirements(jd, taxonomy);
  const critical = new Set(req.critical ?? []);
  // Sections only render when the JD has data for them, so older JDs (and the mockup fixture) look as before.
  const hasQualifications = Boolean(jd.education || jd.major || jd.languages?.length || jd.certifications?.length || jd.otherRequirements);
  const hasOverview = Boolean(jd.summary || jd.responsibilities?.length || jd.dailyTasks?.length || jd.aboutTeam);
  const jobs = allJobs.filter((j) => j.jdId === jd.id);
  const published = jd.status === 'Published';
  const copy = () => {
    void navigator.clipboard?.writeText(jd.body);
    toast(t('jd.copied'));
  };
  const toggleStatus = () => {
    useStore.getState().setJdStatus(jd.id, published ? 'Draft' : 'Published');
    toast(t(published ? 'jds.toast.unpublished' : 'jds.toast.published'));
  };

  return (
    <AppLayout title="">
      <div className="min-h-full bg-[#fbf9f8] dark:bg-background-dark">
        <div className="px-8 pb-8 pt-8">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div className="flex items-center gap-4 min-w-0">
                <BackButton label={t('jd.backToList')} onClick={() => navigate({ pathname: '/jds', search })} />
                <div>
                  <div className="flex items-baseline gap-3 mb-1">
                    <h1 className="ty-title text-[22px] font-bold tracking-tight text-[#181211] dark:text-white">{jd.title}</h1>
                  </div>
                  <p className="text-[#896a61] text-sm">
                    {jd.client && (
                      <span className="font-semibold text-[#5b4a45] dark:text-gray-300">
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px] align-[-3px] mr-1">corporate_fare</span>{jd.client} •{' '}
                      </span>
                    )}
                    {t('jds.id', { code: jd.code })} • {t('jd.created', { date: fullDate(jd.createdAt) })}
                    <span className={`ml-3 px-2 py-0.5 rounded-full text-2xs font-bold ${published ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                      {t(published ? 'jds.status.published' : 'jds.status.draft')}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {showNew && (
                  <>
                    <button onClick={() => setDeleting(true)} className={`${SECONDARY} text-red-600`}>
                      <span className="material-symbols-outlined text-[20px]">delete</span>{t('jds.menu.delete')}
                    </button>
                    <button onClick={toggleStatus} className={SECONDARY}>
                      <span className="material-symbols-outlined text-[20px]">{published ? 'unpublished' : 'publish'}</span>
                      {t(published ? 'jds.menu.unpublish' : 'jds.menu.publish')}
                    </button>
                    <button onClick={() => navigate(`/jobs/new?fromJd=${jd.id}`, { state: { from: `/jds/${jd.id}` } })} className={SECONDARY}>
                      <span className="material-symbols-outlined text-[20px]">work</span>{t('jd.createJob')}
                    </button>
                  </>
                )}
                <button onClick={() => navigate(`/jds/${jd.id}/edit`)} className={SECONDARY}>
                  <span className="material-symbols-outlined text-[20px]">edit</span>{t('jds.menu.edit')}
                </button>
                <button
                  onClick={() => navigate({ pathname: '/jd-matching', search: search ? `${search}&jd=${jd.id}` : `?jd=${jd.id}` })}
                  className="px-5 py-2.5 text-white text-sm font-bold rounded-full shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap bg-brand-vivid hover:bg-[#e65e00]"
                  title=""
                >
                  <span className="material-symbols-outlined text-[20px] ">auto_awesome</span>{t('jd.runMatch')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-card border border-hairline dark:border-[#2a2423] p-6 h-fit">
                  <h2 className="ty-section text-lg font-bold text-[#181211] dark:text-white mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-brand-vivid text-[22px]">psychology</span>{t('jd.requirements')}
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-bold text-[#896a61] uppercase tracking-wider mb-3">{t('jd.core')}</h3>
                      <div className="space-y-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-[#896a61]">{t('jd.techStack')}</span>
                          <div className="flex flex-wrap gap-2">
                            {jd.skills.map((s) => (
                              <span key={s} className={`px-2.5 py-1 rounded bg-orange-50 text-brand-vivid dark:bg-orange-900/20 text-[11px] font-bold border inline-flex items-center gap-1 ${critical.has(s) ? 'border-orange-400' : 'border-orange-100 dark:border-orange-800'}`}>
                                {critical.has(s) && <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-label={t('jd.critical')}>star</span>}
                                {s}
                              </span>
                            ))}
                          </div>
                          {critical.size > 0 && <span className="text-2xs text-[#896a61]">{t('jd.criticalLegend')}</span>}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-[#896a61]">{t('jd.mustHave')}</span>
                          <ul className="text-sm font-medium text-[#181211] dark:text-gray-200 list-disc list-inside space-y-1">
                            {jdMustHave(jd).map((m) => <li key={m}>{m}</li>)}
                          </ul>
                        </div>
                        {!!jd.niceToHave?.length && (
                          <div className="flex flex-col gap-1.5">
                            <span className={SUB}>{t('jds.page.nice')}</span>
                            <ul className="text-sm font-medium text-[#181211] dark:text-gray-200 list-disc list-inside space-y-1">
                              {jd.niceToHave.map((m) => <li key={m}>{m}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="pt-6 border-t border-hairline dark:border-[#2a2423]">
                      <h3 className="text-xs font-bold text-[#896a61] uppercase tracking-wider mb-4">{t('jd.breakdown')}</h3>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                        <Fact label={t('jd.seniority')} value={req.seniority ?? '—'} />
                        <Fact label={t('jd.experience')} value={req.years ? t('jd.yrs', { n: req.years }) : '—'} />
                        <Fact label={t('jd.english')} value={req.english ?? t('jd.none')} />
                        <Fact label={t('jd.domain')} value={jd.domains.join(', ') || '—'} />
                        <Fact label={t('jd.availability')} value={fullDate(jd.availableFrom ?? jd.createdAt)} />
                        <Fact label={t('jd.employment')} value={t('jd.fullTime')} />
                        {jd.location && <Fact label={t('jds.page.location')} value={jd.location} />}
                        {jd.workingModel && <Fact label={t('jds.page.model')} value={t(`jds.page.model.${jd.workingModel}`)} />}
                      </div>
                    </div>
                    {hasQualifications && (
                      <div className="pt-6 border-t border-hairline dark:border-[#2a2423] space-y-4">
                        <h3 className="text-xs font-bold text-[#896a61] uppercase tracking-wider">{t('jds.page.qualifications')}</h3>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                          {jd.education && <Fact label={t('jds.page.education')} value={t(`education.${jd.education}`)} />}
                          {jd.major && <Fact label={t('jds.page.major')} value={jd.major} />}
                        </div>
                        {!!jd.languages?.length && (
                          <div className="flex flex-col gap-1.5">
                            <span className={SUB}>{t('jds.page.languages')}</span>
                            <div className="flex flex-wrap gap-2">{jd.languages.map((x) => <span key={x} className={CHIP}>{x}</span>)}</div>
                          </div>
                        )}
                        {!!jd.certifications?.length && (
                          <div className="flex flex-col gap-1.5">
                            <span className={SUB}>{t('jds.page.certs')}</span>
                            <div className="flex flex-wrap gap-2">{jd.certifications.map((x) => <span key={x} className={CHIP}>{x}</span>)}</div>
                          </div>
                        )}
                        {jd.otherRequirements && (
                          <div className="flex flex-col gap-1.5">
                            <span className={SUB}>{t('jds.page.other')}</span>
                            <p className="text-sm text-[#181211] dark:text-gray-200 whitespace-pre-wrap">{jd.otherRequirements}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {showNew && (
                  <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-card border border-hairline dark:border-[#2a2423] p-6 h-fit">
                    <h2 className="ty-section text-lg font-bold text-[#181211] dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-brand-vivid text-[22px]">work</span>{t('jd.jobs')}
                    </h2>
                    {jobs.length === 0 ? (
                      <p className="text-sm text-[#896a61]">{t('jd.jobsEmpty')}</p>
                    ) : (
                      <ul className="divide-y divide-hairline dark:divide-[#2a2423]">
                        {jobs.map((j) => (
                          <li key={j.id}>
                            {mine.has(j.id) ? (
                              <Link to={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 py-2.5 group">
                                <span className="text-sm font-semibold text-[#181211] dark:text-white group-hover:text-primary truncate">{j.title}</span>
                                <JobStatusBadge status={j.status} />
                              </Link>
                            ) : (
                              // Someone else's job: listed so the JD's use is visible, but not a link into "no access".
                              <div className="flex items-center justify-between gap-3 py-2.5" title={t('jd.jobNotYours', { name: userName(users, j.hiringManager) })}>
                                <span className="text-sm text-[#896a61] truncate flex items-center gap-1">
                                  <span aria-hidden="true" className="material-symbols-outlined text-[14px]">lock</span>{j.title}
                                </span>
                                <JobStatusBadge status={j.status} />
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="lg:col-span-8 flex flex-col gap-6">
                {hasOverview && (
                  <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-card border border-hairline dark:border-[#2a2423] p-8">
                    <h2 className="ty-section text-lg font-bold text-[#181211] dark:text-white flex items-center gap-2 mb-6">
                      <span className="material-symbols-outlined text-brand-vivid text-[22px]">article</span>{t('jd.overview')}
                    </h2>
                    <div className="space-y-6">
                      <Block title={t('jds.page.summary')} text={jd.summary} />
                      <Block title={t('jds.page.duties')} items={[...new Set([...(jd.responsibilities ?? []), ...(jd.dailyTasks ?? [])])]} />
                      <Block title={t('jds.page.team')} text={jd.aboutTeam} />
                    </div>
                  </div>
                )}
                {(jd.body.trim() || !hasOverview) && (
                <div className={`bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-card border border-hairline dark:border-[#2a2423] p-8 ${hasOverview ? '' : 'h-full'}`}>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="ty-section text-lg font-bold text-[#181211] dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-brand-vivid text-[22px]">subject</span>{t('jd.original')}
                    </h2>
                    <button onClick={copy} className="text-[#896a61] hover:text-[#181211] dark:hover:text-white transition-colors" title={t('jd.copy')}>
                      <span className="material-symbols-outlined text-[20px]">content_copy</span>
                    </button>
                  </div>
                  <div className="prose prose-sm max-w-none text-[#332d2c] dark:text-gray-300 leading-relaxed space-y-6">
                    <div><p className="whitespace-pre-wrap">{jd.body}</p></div>
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <DeleteJdModal jd={deleting ? jd : null} onClose={() => setDeleting(false)} onDeleted={() => navigate({ pathname: '/jds', search })} />
    </AppLayout>
  );
}
