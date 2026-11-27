import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from '../../components/Toast';
import { shortDate } from '../../domain/hiring';
import { can, jobsInScope } from '../../domain/permissions';
import { stageLabel } from '../../domain/stages';
import type { Candidate, Recommendation } from '../../domain/types';
import { userName } from '../../domain/users';
import { useLang, useT, type TKey } from '../../i18n/i18n';
import { me, useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { feedbackSummary } from './feedbackSummary';

const RECS: Recommendation[] = ['strong_yes', 'yes', 'no', 'strong_no'];
const REC_TONE: Record<Recommendation, string> = {
  strong_yes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  yes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  no: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  strong_no: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};
const ITEM = 'p-4 rounded-xl border border-line dark:border-dark-line bg-background-light dark:bg-dark-canvas';
const PILL = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold';
const STAGE_TONE: Record<string, string> = {
  hired: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  withdrawn: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

/**
 * Every job this candidate was in, newest first: where they came from and who added them, and, for
 * Talent Pool staff (`showFeedback`), what the team thought — ratings, scorecards, comments, why they
 * were rejected — plus the do-not-hire flag.
 */
export function ApplicationHistory({ c, showFeedback }: { c: Candidate; showFeedback: boolean }) {
  const t = useT();
  const [lang] = useLang();
  const user = useMe();
  const users = useStore((s) => s.users);
  const jobs = useStore((s) => s.jobs);
  const apps = useStore((s) => s.applications)
    .filter((a) => a.candidateId === c.id)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  // Link a job only when this user can open its pipeline; otherwise the link would end on "No access".
  const linkable = new Set(can(user, 'pipeline') ? jobsInScope(user, jobs).map((j) => j.id) : []);
  const fb = feedbackSummary(apps);
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState('');
  const name = (id: string) => userName(users, id) || id;

  const flag = () => {
    const r = reason.trim();
    if (!r) return;
    useStore.getState().updateCandidate(c.id, { doNotHire: { reason: r, by: me(), at: new Date().toISOString() } }, me());
    toast(t('profile.dnh.set'));
    setFlagging(false);
    setReason('');
  };
  const unflag = () => {
    useStore.getState().updateCandidate(c.id, { doNotHire: undefined }, me());
    toast(t('profile.dnh.cleared'));
  };

  return (
    <section aria-label={t('profile.section.applications')}>
      <div className="flex items-center justify-between gap-2 mb-5">
        <h3 className="text-base font-semibold text-ink dark:text-white flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">account_tree</span>
          {t('profile.section.applications')}
        </h3>
        {showFeedback && !flagging && (c.doNotHire ? (
          <button type="button" onClick={unflag} className="text-sm font-semibold text-primary hover:underline">{t('profile.dnh.clear')}</button>
        ) : (
          <button type="button" onClick={() => setFlagging(true)} className="flex items-center gap-1 text-sm font-semibold text-red-700 dark:text-red-400 hover:underline">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">block</span>{t('profile.dnh.mark')}
          </button>
        ))}
      </div>

      {flagging && (
        <div className={`${ITEM} mb-4 space-y-2`}>
          <label htmlFor="dnh-reason" className="block text-sm font-semibold text-ink dark:text-white">{t('profile.dnh.reason')}</label>
          <textarea id="dnh-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('profile.dnh.placeholder')}
            className="w-full rounded-lg border border-line dark:border-dark-line bg-white dark:bg-dark-surface p-2 text-sm text-ink dark:text-white focus:ring-1 focus:ring-primary focus:border-primary" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setFlagging(false); setReason(''); }} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-line dark:border-dark-line text-ink dark:text-white">{t('common.cancel')}</button>
            <button type="button" disabled={!reason.trim()} onClick={flag} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">{t('profile.dnh.confirm')}</button>
          </div>
        </div>
      )}

      {apps.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('profile.usedIn.empty')}</p>
      ) : (
        <div className="space-y-3">
          {showFeedback && (fb.avgStars !== undefined || fb.scorecardCount > 0 || fb.rejections > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {fb.avgStars !== undefined && <span className={`${PILL} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300`}><span aria-hidden="true" className="material-symbols-outlined text-[14px]">star</span>{fb.avgStars} · {t('profile.hero.ratings', { n: fb.ratingCount })}</span>}
              {RECS.filter((r) => fb.recs[r]).map((r) => (
                <span key={r} className={`${PILL} ${REC_TONE[r]}`}>{t(`scorecard.rec.${r}` as TKey)} × {fb.recs[r]}</span>
              ))}
              {fb.rejections > 0 && <span className={`${PILL} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`}>{t('profile.feedback.rejections', { n: fb.rejections })}</span>}
            </div>
          )}
          {apps.map((a) => {
            const title = jobs.find((j) => j.id === a.jobId)?.title ?? a.jobId;
            const cards = showFeedback ? (a.interviews ?? []).flatMap((iv) => iv.scorecards.map((sc) => ({ ...sc, round: iv.round }))) : [];
            const comments = showFeedback ? a.comments : [];
            const stars = showFeedback ? a.ratings ?? [] : [];
            const avg = stars.length ? Math.round((stars.reduce((s, r) => s + r.stars, 0) / stars.length) * 10) / 10 : undefined;
            const via = t(`via.${a.via}` as TKey);
            // "Talent Pool · Talent Pool", "Careers page · Careers site": the channel only shows when it adds something.
            const viaShown = a.source && a.source.toLowerCase().includes(via.split(' ')[0].toLowerCase()) ? '' : via;
            const meta = [a.source, viaShown, t('profile.app.addedBy', { name: name(a.addedBy) }), shortDate(a.addedAt)].filter(Boolean);
            return (
              <article key={a.id} className={ITEM} data-testid={`application-${a.jobId}`}>
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {linkable.has(a.jobId) ? (
                      <Link to={`/pipeline/${a.jobId}`} className="font-semibold text-sm text-ink dark:text-white hover:text-primary hover:underline">{title}</Link>
                    ) : (
                      <span className="font-semibold text-sm text-ink dark:text-white">{title}</span>
                    )}
                    <p className="text-xs text-ink-muted mt-0.5">{meta.join(' · ')}</p>
                  </div>
                  <span className="flex items-center gap-2 shrink-0">
                    {avg !== undefined && <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600"><span aria-hidden="true" className="material-symbols-outlined text-[14px]">star</span>{avg}</span>}
                    <span className={`${PILL} ${STAGE_TONE[a.stage] ?? 'bg-white dark:bg-dark-surface border border-line dark:border-dark-line text-ink dark:text-white'}`}>{stageLabel(a.stage, lang)}</span>
                  </span>
                </header>
                {showFeedback && a.stage === 'rejected' && (a.rejectedCode || a.rejectedReason) && (
                  <p className="text-sm text-red-700 dark:text-red-400 mt-3">
                    <b>{t('profile.feedback.rejectedFor')}</b> {[a.rejectedCode && t(`reject.${a.rejectedCode}` as TKey), a.rejectedReason].filter(Boolean).join(' · ')}
                  </p>
                )}
                {cards.length > 0 && (
                  <ul className="space-y-1.5 mt-3">
                    {cards.map((sc, i) => (
                      <li key={i} className="text-sm flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={`${PILL} ${REC_TONE[sc.recommendation]}`}>{t(`scorecard.rec.${sc.recommendation}` as TKey)}</span>
                        <span className="text-ink dark:text-white">{sc.round}</span>
                        <span className="text-ink-muted text-xs">· {name(sc.by)} · {shortDate(sc.at)}</span>
                        {sc.note && <span className="w-full text-ink-muted italic">“{sc.note}”</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {comments.length > 0 && (
                  <ul className="space-y-1 border-t border-line dark:border-dark-raised pt-2 mt-3">
                    {comments.slice(-3).map((cm, i) => (
                      <li key={i} className="text-sm text-ink dark:text-white">
                        {cm.text} <span className="text-xs text-ink-muted">— {name(cm.by)}, {shortDate(cm.at)}</span>
                      </li>
                    ))}
                    {comments.length > 3 && <li className="text-xs text-ink-muted">{t('profile.feedback.moreComments', { n: comments.length - 3 })}</li>}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
