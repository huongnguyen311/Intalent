import { Link } from 'react-router-dom';
import { Avatar, toneFor } from '../../components/Avatar';
import { can, jobsInScope } from '../../domain/permissions';
import { shortDate } from '../../domain/hiring';
import { stageLabel } from '../../domain/stages';
import type { Candidate } from '../../domain/types';
import { userName } from '../../domain/users';
import { useLang, useT } from '../../i18n/i18n';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { feedbackSummary, isActiveApplication } from './feedbackSummary';

const CHIP = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-line dark:border-dark-line bg-background-light dark:bg-dark-canvas text-xs text-ink dark:text-white';
const BADGE = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold';

/** Who the candidate is and where they stand right now: the first thing on the profile. */
export function ProfileHero({ c, years, showPipeline, onAddToPipeline }: {
  c: Candidate; years: number; showPipeline: boolean;
  /** Shown next to the candidate's pipelines when the user may add them to one. */
  onAddToPipeline?: () => void;
}) {
  const t = useT();
  const [lang] = useLang();
  const user = useMe();
  const users = useStore((s) => s.users);
  const allJobs = useStore((s) => s.jobs);
  const apps = useStore((s) => s.applications).filter((a) => a.candidateId === c.id);
  const active = apps.filter(isActiveApplication).sort((a, b) => b.stageEnteredAt.localeCompare(a.stageEnteredAt));
  const fb = feedbackSummary(apps);
  const linkable = new Set(can(user, 'pipeline') ? jobsInScope(user, allJobs).map((j) => j.id) : []);
  const facts = [c.title, c.seniority, c.location, years > 0 ? t('candidates.years', { n: years }) : ''].filter(Boolean);

  return (
    <section aria-label={t('profile.hero.label')} className="rounded-2xl border border-line dark:border-dark-line bg-white dark:bg-dark-surface p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-4">
        <Avatar name={c.name} tone={toneFor(c.name)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-ink dark:text-white truncate">{c.name}</h2>
            {c.openToWork && <span className={`${BADGE} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`}>{t('profile.field.openToWork')}</span>}
            {c.doNotHire && <span className={`${BADGE} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`}><span className="material-symbols-outlined text-[14px]">block</span>{t('profile.dnh.badge')}</span>}
          </div>
          <p className="text-sm text-ink-muted mt-0.5">{facts.join(' · ') || '—'}</p>
        </div>
        {fb.avgStars !== undefined && (
          <div className="text-right shrink-0" title={t('profile.hero.ratingHint', { n: fb.ratingCount })}>
            <div className="flex items-center gap-1 text-amber-500 font-bold">
              <span className="material-symbols-outlined text-[18px]">star</span>{fb.avgStars}
            </div>
            <div className="text-xs text-ink-muted">{t('profile.hero.ratings', { n: fb.ratingCount })}</div>
          </div>
        )}
      </div>
      {c.doNotHire && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px] shrink-0">block</span>
          <span>
            <b>{t('profile.dnh.banner')}</b> {c.doNotHire.reason}
            <span className="block text-xs opacity-80">{userName(users, c.doNotHire.by) || c.doNotHire.by} · {shortDate(c.doNotHire.at)}</span>
          </span>
        </div>
      )}
      {showPipeline && (
        <div className="border-t border-line dark:border-dark-raised pt-4">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2.5">{t('profile.hero.pipeline', { n: active.length, total: apps.length })}</p>
          {active.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line dark:border-dark-line bg-background-light dark:bg-dark-canvas px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-ink-muted">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">account_tree</span>{t('profile.hero.noActive')}
              </span>
              {onAddToPipeline && (
                <button type="button" onClick={onAddToPipeline} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-colors">
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>{t('atp.title')}
                </button>
              )}
            </div>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {active.map((a) => {
                const title = allJobs.find((j) => j.id === a.jobId)?.title ?? a.jobId;
                const body = <><span className="font-semibold">{title}</span><span className="text-ink-muted">·</span><span>{stageLabel(a.stage, lang)}</span></>;
                return (
                  <li key={a.id}>
                    {linkable.has(a.jobId) ? (
                      <Link to={`/pipeline/${a.jobId}`} className={`${CHIP} hover:border-primary/50`}>{body}</Link>
                    ) : (
                      <span className={CHIP}>{body}</span>
                    )}
                  </li>
                );
              })}
              {onAddToPipeline && (
                <li>
                  <button type="button" onClick={onAddToPipeline} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-primary/60 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors">
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>{t('atp.title')}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
