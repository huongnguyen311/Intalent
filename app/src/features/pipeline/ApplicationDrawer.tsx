import { useStageName } from './jobStageContext';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Drawer } from '../../components/Drawer';
import { DrawerSection as Section } from '../../components/DrawerSection';
import { awaitsScorecardFrom } from '../../domain/hiring';
import { normalizeRole } from '../../domain/permissions';
import { averageRating, daysInStage } from '../../domain/pipeline';
import type { Application, Candidate, Job, Stage } from '../../domain/types';
import { userName } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { me, useCan, useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { EmailComposer } from '../hiring/EmailComposer';
import { AnswersSection, EmailsSection, HandoffBanner, HandoffSection, InterviewsSection, OfferSection } from '../hiring/HiringSections';
import { AiEvaluationSection } from './AiEvaluationSection';
import { MoveToMenu } from './CandidateCard';

type Props = {
  appId: string | null; job: Job; onClose: () => void; onMove: (appId: string, to: Stage) => void;
  /** Opened from "My interviews": lead with that round and its scorecard, leave out the recruiter-only sections. */
  focusInterviewId?: string;
};

const FILLED = { fontVariationSettings: "'FILL' 1" };
const CHIP = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold';

function Stars({ value }: { value: number }) {
  return (
    <span className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`material-symbols-outlined text-[16px] ${n <= value ? 'text-amber-400' : 'text-gray-200'}`} style={FILLED}>star</span>
      ))}
    </span>
  );
}

/** Side panel for one application: summary, quick move, ratings by the team, stage history and comments. */
export function ApplicationDrawer({ appId, job, onClose, onMove, focusInterviewId }: Props) {
  const app = useStore((s) => s.applications.find((a) => a.id === appId));
  const candidate = useStore((s) => s.candidates.find((c) => c.id === app?.candidateId));
  const t = useT();
  const perm = useCan();
  // Comments are their own tab: the overview stays about the candidate, the conversation about them sits apart.
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => setTab('overview'), [appId]);
  if (!app) return null;
  const name = candidate?.name ?? app.candidateId;
  const focus = focusInterviewId && app.interviews?.some((iv) => iv.id === focusInterviewId) ? focusInterviewId : undefined;
  return (
    <Drawer
      open
      title={name}
      // The job sits right under the name; it links to the job page for those who can open it (interviewers cannot).
      subtitle={
        <span className="flex items-center gap-1 min-w-0">
          <span aria-hidden="true" className="material-symbols-outlined text-[16px] shrink-0">work</span>
          <span className="shrink-0">{t('pipeline.drawer.applyingForLabel')}</span>
          {perm('pipeline') ? (
            <Link to={`/jobs/${job.id}`} className="font-bold text-primary hover:underline truncate">{job.title}</Link>
          ) : (
            <span className="font-bold text-slate-700 dark:text-gray-200 truncate">{job.title}</span>
          )}
        </span>
      }
      subheader={
        <div role="tablist" aria-label={name} className="inline-flex items-center gap-1 rounded-xl bg-[#f4f1f0] dark:bg-white/10 p-1">
          {(['overview', 'comments'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === k ? 'bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white shadow-sm' : 'text-[#896a61] hover:text-slate-700 dark:hover:text-white'}`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{k === 'overview' ? 'person' : 'forum'}</span>
              {t(k === 'overview' ? 'pipeline.drawer.overview' : 'pipeline.drawer.comments')}
              {k === 'comments' && app.comments.length > 0 && (
                <span className="min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[11px] tabular-nums">{app.comments.length}</span>
              )}
            </button>
          ))}
        </div>
      }
      onClose={onClose}
    >
      <DrawerBody app={app} job={job} candidate={candidate} onMove={(to) => onMove(app.id, to)} focus={focus} tab={tab} />
    </Drawer>
  );
}

type Tab = 'overview' | 'comments';
type BodyProps = { app: Application; job: Job; candidate?: Candidate; onMove: (to: Stage) => void; focus?: string; tab: Tab };

function DrawerBody({ app, job, candidate, onMove, focus, tab }: BodyProps) {
  const t = useT();
  const label = useStageName();
  const users = useStore((s) => s.users);
  const [comment, setComment] = useState('');
  const [mailing, setMailing] = useState(false);
  const perm = useCan();
  const user = useMe();
  // Interviewers judge through their scorecard only, and see the team's ratings and comments after sending it.
  const interviewer = normalizeRole(user.role) === 'Interviewer';
  const blind = interviewer && awaitsScorecardFrom(app, user.id);
  useEffect(() => setComment(''), [app.id]);
  const who = (id: string) => userName(users, id);
  const ratings = app.ratings ?? [];
  const avg = averageRating(app);
  const mine = ratings.find((r) => r.by === me())?.stars ?? 0;

  const post = () => {
    if (useStore.getState().addComment(app.id, comment, me())) setComment('');
  };

  // Stage and time in stage sit in the summary chips; the rest is the paper trail of how the application arrived.
  const facts: [string, string][] = [
    [t('pipeline.drawer.source'), app.source],
    [t('pipeline.drawer.via'), t(`jobs.via.${app.via}`)],
    [t('pipeline.drawer.addedBy'), who(app.addedBy)],
    [t('pipeline.drawer.added'), fullDate(app.addedAt)],
  ];

  return (
    <div className="text-sm text-[#181211] dark:text-[#e6dddb]">
      {tab === 'overview' && (<>
      {/* Summary: where the application stands, and the actions on it. Name and job are in the drawer title. */}
      <div className="pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${CHIP} bg-primary/10 text-primary`}>
            <span aria-hidden="true" className="material-symbols-outlined text-[14px]">flag</span>{label(app.stage)}
          </span>
          <span className={`${CHIP} bg-[#f4f1f0] text-[#896a61] dark:bg-white/10 dark:text-gray-300`}>
            <span aria-hidden="true" className="material-symbols-outlined text-[14px]">schedule</span>
            {t('pipeline.drawer.inStageFor', { days: t('jobs.days', { n: daysInStage(app) }) })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link to={`/candidates/${app.candidateId}`} className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold text-primary hover:bg-primary/5">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">description</span>{t('pipeline.drawer.profile')}
            </Link>
            {!focus && perm('email.send') && <button
              aria-label={t('email.title')}
              title={t('email.title')}
              onClick={() => setMailing(true)}
              className="size-9 shrink-0 rounded-full border border-[#e6dddb] dark:border-[#3a3433] flex items-center justify-center text-[#896a61] hover:border-primary/50 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">mail</span>
            </button>}
            {!app.handoff && (
              <MoveToMenu
                current={app.stage}
                onMove={onMove}
                button={(toggle) => (
                  <button onClick={toggle} className="shrink-0 px-4 py-2 rounded-full border border-[#e6dddb] dark:border-[#3a3433] text-sm font-bold flex items-center gap-1 hover:border-primary/50 transition-colors">
                    {t('pipeline.moveTo')}<span className="material-symbols-outlined text-[18px]">expand_more</span>
                  </button>
                )}
              />
            )}
          </div>
        </div>
        {app.stage === 'rejected' && (app.rejectedReason || app.rejectedCode) && (
          <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 px-3 py-2">
            <span className="font-bold">{t('pipeline.drawer.reason')}:</span>{' '}
            {[app.rejectedCode && t(`reject.${app.rejectedCode}`), app.rejectedReason].filter(Boolean).join(' · ')}
          </p>
        )}
        <HandoffBanner app={app} />
      </div>

      {focus ? (<>
        <InterviewsSection app={app} candidate={candidate} job={job} focusId={focus} />
        {!blind && <AiEvaluationSection app={app} compact />}
        <AnswersSection app={app} />
      </>) : (<>
      <Section icon="info" title={t('pipeline.drawer.details')}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-[#896a61]">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <HandoffSection app={app} candidate={candidate} job={job} />
      {/* In the Offer stage the offer is the next thing to act on, so it comes first (like Hand-off once Hired). */}
      {app.stage === 'offer' && <OfferSection app={app} candidate={candidate} job={job} />}
      <AnswersSection app={app} />
      {!blind && <AiEvaluationSection app={app} />}
      <InterviewsSection app={app} candidate={candidate} job={job} />
      {app.stage !== 'offer' && <OfferSection app={app} candidate={candidate} job={job} />}

      {perm('review') && !interviewer && <Section icon="star" title={t('pipeline.drawer.ratings')}>
        <p className="text-[#896a61] mb-3">
          {avg === undefined ? t('pipeline.drawer.noRatings') : t('pipeline.drawer.average', { avg, count: ratings.length })}
        </p>
        <ul className="space-y-2 mb-4">
          {ratings.map((r) => (
            <li key={r.by} className="flex items-center justify-between">
              <span>{who(r.by)}</span>
              <Stars value={r.stars} />
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[#896a61]">{t('pipeline.drawer.yourRating')}</span>
          <span className="flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                aria-label={t('pipeline.drawer.rate', { n })}
                aria-pressed={n <= mine}
                onClick={() => useStore.getState().rateApplication(app.id, me(), n)}
                className={`material-symbols-outlined text-[22px] hover:scale-110 transition-transform ${n <= mine ? 'text-amber-400' : 'text-gray-300'}`}
                style={FILLED}
              >
                star
              </button>
            ))}
          </span>
        </div>
      </Section>}

      <Section icon="timeline" title={t('pipeline.drawer.history')} count={app.history.length}>
        <ol className="space-y-3 border-l-2 border-[#f4f1f0] dark:border-[#2a2423] pl-4">
          {[...app.history].reverse().map((h, i) => (
            <li key={`${h.at}-${i}`}>
              <div className="font-bold flex items-center gap-1.5">
                {label(h.stage)}
                {h.ruleId && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300 text-2xs font-bold">
                    <span aria-hidden="true" className="material-symbols-outlined text-[12px]">bolt</span>
                    {t('pipeline.drawer.auto')}
                  </span>
                )}
              </div>
              <div className="text-xs text-[#896a61]">{fullDate(h.at)} · {who(h.by)}</div>
              {h.note && !(h.stage === 'rejected' && h.note === app.rejectedReason) && <div className="text-sm mt-1 whitespace-pre-wrap">{h.note}</div>}
            </li>
          ))}
        </ol>
      </Section>

      {perm('email.send') && <EmailsSection app={app} />}
      </>)}

      </>)}

      {tab === 'comments' && (<div>
        {blind ? (
          <p className="text-[#896a61] flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">visibility_off</span>{t('pipeline.drawer.hiddenUntilScored')}
          </p>
        ) : (<>
        <ul className="space-y-3 mb-4">
          {app.comments.map((c, i) => (
            <li key={`${c.at}-${i}`} className="rounded-xl bg-[#f8f6f6] dark:bg-[#251f1e] px-3 py-2">
              <div className="text-xs text-[#896a61] mb-1"><span className="font-bold text-slate-700 dark:text-gray-200">{who(c.by)}</span> · {fullDate(c.at)}</div>
              <div>{c.text}</div>
            </li>
          ))}
          {app.comments.length === 0 && <li className="text-[#896a61]">{t('pipeline.drawer.noComments')}</li>}
        </ul>
        <label htmlFor="app-comment" className="sr-only">{t('pipeline.drawer.commentLabel')}</label>
        <textarea
          id="app-comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('pipeline.drawer.commentPlaceholder')}
          className="w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
        />
        <div className="flex justify-end mt-2">
          <button
            disabled={!comment.trim()}
            onClick={post}
            className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('pipeline.drawer.post')}
          </button>
        </div>
        </>)}
      </div>)}
      {mailing && <EmailComposer open candidateId={app.candidateId} applicationId={app.id} onClose={() => setMailing(false)} />}
    </div>
  );
}
