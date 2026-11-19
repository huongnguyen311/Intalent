import { isClosedOut, isEnded } from '../../domain/stages';
import { useState, type ReactNode } from 'react';
import { toast } from '../../components/Toast';
import { formatMoney, HANDOFF_TARGET, interviewTime, isLocked, offerFinal, scorecardAverage, scorecardsHiddenFrom, shortDate, TEMPLATE, zoneLabel } from '../../domain/hiring';
import type { Application, Candidate, Interview, Job, OfferStatus, Recommendation } from '../../domain/types';
import { userName } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { can, normalizeRole } from '../../domain/permissions';
import { currentUser, me, useCan, useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { EmailComposer } from './EmailComposer';
import { HandoffDialog } from './HandoffDialog';
import { InterviewDialog } from './InterviewDialog';
import { DeclineOfferDialog, OfferDialog } from './OfferDialog';
import { ScorecardDialog } from './ScorecardDialog';
import { BTN_SMALL, Pill } from './ui';

type Ctx = { app: Application; candidate?: Candidate; job: Job };

const MODE_ICON = { online: 'videocam', onsite: 'apartment', phone: 'call' } as const;
const REC_TONE: Record<Recommendation, 'green' | 'blue' | 'amber' | 'red'> = { strong_yes: 'green', yes: 'blue', no: 'amber', strong_no: 'red' };
const OFFER_TONE: Record<OfferStatus, 'gray' | 'blue' | 'green' | 'red'> = { draft: 'gray', sent: 'blue', accepted: 'green', declined: 'red' };

function Heading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h4 className="text-xs font-bold text-[#896a61] uppercase tracking-wider">{title}</h4>
      {action}
    </div>
  );
}

function Block({ children }: { children: ReactNode }) {
  return <section className="py-5 border-t border-[#f4f1f0] dark:border-[#2a2423]">{children}</section>;
}

/** Green banner shown at the top of a handed-off application. */
export function HandoffBanner({ app }: { app: Application }) {
  const t = useT();
  const users = useStore((s) => s.users);
  if (!app.handoff) return null;
  return (
    <p className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-3 py-2 flex items-start gap-2">
      <span className="material-symbols-outlined text-[18px]">verified</span>
      <span>{t('handoff.done', { target: app.handoff.target, date: fullDate(app.handoff.at), by: userName(users, app.handoff.by) })}</span>
    </p>
  );
}

export function AnswersSection({ app }: { app: Application }) {
  const t = useT();
  if (!app.answers?.length) return null;
  return (
    <Block>
      <Heading title={t('answers.title')} />
      <dl className="space-y-3">
        {app.answers.map((a) => (
          <div key={a.questionId}>
            <dt className="text-xs text-[#896a61]">{a.label}</dt>
            <dd className="font-medium whitespace-pre-wrap">{a.answer || '—'}</dd>
          </div>
        ))}
      </dl>
    </Block>
  );
}

function InterviewItem({ app, iv, locked, onScore, onEmail }: { app: Application; iv: Interview; locked: boolean; onScore: () => void; onEmail: () => void }) {
  const t = useT();
  const perm = useCan();
  const user = useMe();
  // Interviewers score only the rounds they sit on; other reviewers may score any round.
  const canScore = perm('scorecard') && (normalizeRole(user.role) !== 'Interviewer' || iv.interviewers.includes(user.id));
  const users = useStore((s) => s.users);
  const blind = scorecardsHiddenFrom(iv, user);
  const shown = blind ? [] : iv.scorecards;
  const hidden = iv.scorecards.length - shown.length;
  const tone = iv.status === 'done' ? 'green' : iv.status === 'cancelled' ? 'gray' : 'violet';
  const cancel = () => {
    if (useStore.getState().cancelInterview(app.id, iv.id, me())) toast(t('interview.toast.cancelled'));
  };
  return (
    <li className={`rounded-xl border border-[#f0ebea] dark:border-[#2a2423] px-3 py-3 ${iv.status === 'cancelled' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold flex items-center gap-2 flex-wrap">{iv.round}<Pill tone={tone}>{t(`interview.status.${iv.status}`)}</Pill></div>
          <div className="text-xs text-[#896a61] mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            {interviewTime(iv.at)}{iv.timeZone ? ` (${zoneLabel(iv.timeZone, iv.at)})` : ''} · {t('interview.minutes', { n: iv.durationMin })}
          </div>
          <div className="text-xs text-[#896a61] mt-0.5 flex items-center gap-1 min-w-0">
            <span className="material-symbols-outlined text-[14px]">{MODE_ICON[iv.mode]}</span>
            <span className="truncate">{t(`interview.mode.${iv.mode}`)}{iv.place ? ` · ${iv.place}` : ''}</span>
          </div>
          <div className="text-xs text-[#896a61] mt-0.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">group</span>
            {iv.interviewers.map((u) => userName(users, u)).join(', ')}
          </div>
        </div>
      </div>
      {hidden > 0 && (
        <p className="mt-3 text-xs text-[#896a61] flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">visibility_off</span>{t('scorecard.hiddenUntilYours', { n: hidden })}
        </p>
      )}
      {shown.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {shown.map((c) => (
            <li key={c.by} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold">{userName(users, c.by)}</span>
              <span className="flex items-center gap-2">
                <span className="flex items-center gap-0.5 font-bold">
                  <span className="material-symbols-outlined text-[12px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  {scorecardAverage(c)}
                </span>
                <Pill tone={REC_TONE[c.recommendation]}>{t(`scorecard.rec.${c.recommendation}`)}</Pill>
              </span>
            </li>
          ))}
          {shown.filter((c) => c.note).map((c) => (
            <li key={`${c.by}-note`} className="text-xs text-[#896a61] italic">“{c.note}” — {userName(users, c.by)}</li>
          ))}
        </ul>
      )}
      {!locked && iv.status !== 'cancelled' && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {canScore && <button onClick={onScore} className={BTN_SMALL}>
            <span className="material-symbols-outlined text-[14px]">rate_review</span>
            {t(iv.scorecards.some((c) => c.by === me()) ? 'scorecard.edit' : 'scorecard.add')}
          </button>}
          {iv.status === 'scheduled' && perm('interview.schedule') && (
            <>
              <button onClick={onEmail} className={BTN_SMALL}>
                <span className="material-symbols-outlined text-[14px]">mail</span>{t('interview.sendInvite')}
              </button>
              <button onClick={cancel} className={BTN_SMALL}>
                <span className="material-symbols-outlined text-[14px]">event_busy</span>{t('interview.cancel')}
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function InterviewsSection({ app, candidate }: Ctx) {
  const t = useT();
  const [scheduling, setScheduling] = useState(false);
  const [scoring, setScoring] = useState<Interview | null>(null);
  const [mailing, setMailing] = useState<Interview | null>(null);
  const locked = isLocked(app);
  const canSchedule = can(currentUser(), 'interview.schedule') && !locked && !isEnded(app.stage);
  const list = [...(app.interviews ?? [])].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <Block>
      <Heading
        title={t('interview.title')}
        action={canSchedule && (
          <button onClick={() => setScheduling(true)} className={BTN_SMALL}>
            <span className="material-symbols-outlined text-[14px]">event</span>{t('interview.schedule')}
          </button>
        )}
      />
      {list.length === 0 ? (
        <p className="text-[#896a61]">{t('interview.none')}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((iv) => (
            <InterviewItem key={iv.id} app={app} iv={iv} locked={locked} onScore={() => setScoring(iv)} onEmail={() => setMailing(iv)} />
          ))}
        </ul>
      )}
      <InterviewDialog open={scheduling} app={app} candidateName={candidate?.name ?? ''} hasEmail={!!candidate?.email?.trim()} onClose={() => setScheduling(false)} />
      {scoring && <ScorecardDialog open appId={app.id} interview={scoring} onClose={() => setScoring(null)} />}
      {mailing && candidate && (
        <EmailComposer open candidateId={candidate.id} applicationId={app.id} templateId={TEMPLATE.interview} interview={mailing} onClose={() => setMailing(null)} />
      )}
    </Block>
  );
}

/** Stages before any interview: too early for an offer. */
const PRE_INTERVIEW: Application['stage'][] = ['new', 'ai_screening', 'screening'];

export function OfferSection({ app, candidate }: Ctx) {
  const t = useT();
  const users = useStore((s) => s.users);
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [declining, setDeclining] = useState(false);
  const offer = app.offer;
  const perm = useCan();
  // Without offer.manage the offer is read-only (Hiring Manager); without offer.view it is hidden.
  const [confirming, setConfirming] = useState(false);
  const locked = isLocked(app) || !perm('offer.manage');
  // From the first interview on (every interview round, assessment, custom steps and Offer), not only in Interview/Offer.
  const relevant = !!offer || (perm('offer.manage') && !isClosedOut(app.stage) && !PRE_INTERVIEW.includes(app.stage));
  if (!relevant || !perm('offer.view')) return null;
  const noEmail = !candidate?.email?.trim();
  const final = offerFinal(app);
  // An accepted offer whose candidate left Hired (backed out) is open again: edit, re-send or record the decline.
  const reopened = offer?.status === 'accepted' && !final;
  const canRespond = !!offer && (offer.status === 'sent' || offer.status === 'draft' || reopened);

  const accept = () => {
    setConfirming(false);
    if (useStore.getState().respondOffer(app.id, true, me())) toast(t('offer.toast.accepted', { name: candidate?.name ?? '' }));
  };
  const decline = (reason: string) => {
    if (useStore.getState().respondOffer(app.id, false, me(), reason)) toast(t('offer.toast.declined'));
    setDeclining(false);
  };

  return (
    <Block>
      <Heading
        title={t('offer.title')}
        action={!offer && !locked && !isClosedOut(app.stage) && (
          <button onClick={() => setEditing(true)} className={BTN_SMALL}>
            <span className="material-symbols-outlined text-[14px]">request_quote</span>{t('offer.create')}
          </button>
        )}
      />
      {!offer ? (
        <p className="text-[#896a61]">{t('offer.none')}</p>
      ) : (
        <div className="rounded-xl border border-[#f0ebea] dark:border-[#2a2423] px-3 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-lg font-bold">{formatMoney(offer.salary, offer.currency)}</span>
            <Pill tone={OFFER_TONE[offer.status]}>{t(`offer.status.${offer.status}`)}</Pill>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-xs text-[#896a61]">{t('offer.startDate')}</dt><dd className="font-medium">{shortDate(offer.startDate)}</dd></div>
            <div><dt className="text-xs text-[#896a61]">{t('offer.contract')}</dt><dd className="font-medium">{offer.contract}</dd></div>
            <div><dt className="text-xs text-[#896a61]">{t('offer.validUntil')}</dt><dd className="font-medium">{shortDate(offer.validUntil)}</dd></div>
            <div><dt className="text-xs text-[#896a61]">{t('offer.by')}</dt><dd className="font-medium">{userName(users, offer.createdBy)}</dd></div>
          </dl>
          {offer.note && <p className="mt-2 text-xs text-[#896a61] whitespace-pre-wrap">{offer.note}</p>}
          {offer.sentAt && offer.status !== 'draft' && <p className="mt-2 text-xs text-[#896a61]">{t('offer.sentAt', { date: fullDate(offer.sentAt) })}</p>}
          {offer.status === 'declined' && offer.declineReason && (
            <p className="mt-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 px-3 py-2 text-xs">
              <span className="font-bold">{t('offer.decline.reason')}:</span> {offer.declineReason}
            </p>
          )}
          {!locked && reopened && (
            <p className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-3 py-2 text-xs">{t('offer.reopened')}</p>
          )}
          {!locked && !final && noEmail && offer.status === 'draft' && (
            <p className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-3 py-2 text-xs">{t('offer.noEmailHint')}</p>
          )}
          {!locked && confirming && (
            <div role="alert" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
              <span className="flex-1 min-w-[180px]">{t('offer.confirmAccept', { name: candidate?.name ?? '' })}</span>
              <button onClick={() => setConfirming(false)} className={BTN_SMALL}>{t('common.cancel')}</button>
              <button onClick={accept} className={`${BTN_SMALL} !border-emerald-400 !bg-emerald-600 !text-white`}>{t('offer.confirmAcceptBtn')}</button>
            </div>
          )}
          {!locked && !final && !confirming && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {canRespond && (
                <>
                  {offer.status !== 'accepted' && (
                    <button onClick={() => setConfirming(true)} className={`${BTN_SMALL} !border-emerald-300 text-emerald-700 dark:text-emerald-300`}>
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>{t('offer.markAccepted')}
                    </button>
                  )}
                  <button onClick={() => setDeclining(true)} className={`${BTN_SMALL} !border-red-200 text-red-600`}>
                    <span className="material-symbols-outlined text-[14px]">cancel</span>{t('offer.markDeclined')}
                  </button>
                </>
              )}
              {!noEmail && (
                <button onClick={() => setSending(true)} className={BTN_SMALL}>
                  <span className="material-symbols-outlined text-[14px]">send</span>{t(offer.status === 'draft' ? 'offer.send' : 'offer.resend')}
                </button>
              )}
              <button onClick={() => setEditing(true)} className={BTN_SMALL}>
                <span className="material-symbols-outlined text-[14px]">edit</span>{t('offer.edit')}
              </button>
            </div>
          )}
        </div>
      )}
      <OfferDialog open={editing} app={app} onClose={() => setEditing(false)} />
      <DeclineOfferDialog open={declining} onClose={() => setDeclining(false)} onConfirm={decline} />
      {sending && candidate && (
        <EmailComposer
          open
          title={t('offer.send')}
          candidateId={candidate.id}
          applicationId={app.id}
          templateId={TEMPLATE.offer}
          onClose={() => setSending(false)}
          onSent={() => useStore.getState().markOfferSent(app.id, me())}
        />
      )}
    </Block>
  );
}

export function HandoffSection({ app, candidate, job }: Ctx) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const allowed = useCan()('handoff');
  if (app.stage !== 'hired' || app.handoff || !allowed) return null;
  return (
    <Block>
      <Heading title={t('handoff.section')} />
      <div className="rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-sm">{t('handoff.prompt', { target: HANDOFF_TARGET })}</p>
        <button onClick={() => setOpen(true)} className="shrink-0 px-4 py-2 text-sm font-bold bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">outbox</span>{t('handoff.button')}
        </button>
      </div>
      <HandoffDialog open={open} app={app} candidate={candidate} job={job} onClose={() => setOpen(false)} />
    </Block>
  );
}

export function EmailsSection({ app }: { app: Application }) {
  const t = useT();
  const all = useStore((s) => s.emails);
  const users = useStore((s) => s.users);
  const [openId, setOpenId] = useState<string | null>(null);
  const emails = all.filter((e) => e.applicationId === app.id).sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Block>
      <Heading title={t('email.history')} />
      {emails.length === 0 ? (
        <p className="text-[#896a61]">{t('email.none')}</p>
      ) : (
        <ul className="space-y-2">
          {emails.map((e) => (
            <li key={e.id} className="rounded-xl bg-[#f8f6f6] dark:bg-[#251f1e]">
              <button onClick={() => setOpenId(openId === e.id ? null : e.id)} aria-expanded={openId === e.id} className="w-full text-left px-3 py-2 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#896a61] mt-0.5">mail</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{e.subject}</span>
                  <span className="block text-xs text-[#896a61]">{fullDate(e.at)} · {userName(users, e.by)}</span>
                </span>
              </button>
              {openId === e.id && <pre className="px-3 pb-3 text-xs whitespace-pre-wrap font-sans">{e.body}</pre>}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}
