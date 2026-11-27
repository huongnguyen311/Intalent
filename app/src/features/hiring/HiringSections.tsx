import { isClosedOut, isEnded } from '../../domain/stages';
import { useState, type ReactNode } from 'react';
import { Avatar, toneFor } from '../../components/Avatar';
import { DrawerSection } from '../../components/DrawerSection';
import { toast } from '../../components/Toast';
import { formatMoney, HANDOFF_TARGET, interviewTime, isLocked, offerFinal, scorecardAverage, scorecardsHiddenFrom, shortDate, TEMPLATE, zoneLabel } from '../../domain/hiring';
import type { Application, Candidate, Interview, Job, OfferStatus, Recommendation } from '../../domain/types';
import { criteriaOf } from '../../domain/scorecard';
import { userName } from '../../domain/users';
import type { TKey } from '../../i18n/en';
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
/** One scale from hire to no-hire: green for yes, amber/red for no; the "strong" ends are solid so they stand out. */
const REC_STYLE: Record<Recommendation, { icon: string; cls: string }> = {
  strong_yes: { icon: 'verified', cls: 'bg-emerald-600 text-white dark:bg-emerald-500/30 dark:text-emerald-200' },
  yes: { icon: 'thumb_up', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  no: { icon: 'thumb_down', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  strong_no: { icon: 'block', cls: 'bg-red-600 text-white dark:bg-red-500/30 dark:text-red-200' },
};

function RecPill({ rec, children }: { rec: Recommendation; children: ReactNode }) {
  const s = REC_STYLE[rec];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${s.cls}`}>
      <span aria-hidden="true" className="material-symbols-outlined text-[13px]" style={STAR_FILL}>{s.icon}</span>
      {children}
    </span>
  );
}
const OFFER_TONE: Record<OfferStatus, 'gray' | 'blue' | 'green' | 'red'> = { draft: 'gray', sent: 'blue', accepted: 'green', declined: 'red' };


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
    <DrawerSection icon="quiz" title={t('answers.title')} count={app.answers.length}>
      <dl className="space-y-3">
        {app.answers.map((a) => (
          <div key={a.questionId}>
            <dt className="text-xs text-ink-muted">{a.label}</dt>
            <dd className="font-medium whitespace-pre-wrap">{a.answer || '—'}</dd>
          </div>
        ))}
      </dl>
    </DrawerSection>
  );
}

/** "13:00 – 14:00" from a local stamp and a length in minutes. */
function timeRange(at: string, minutes: number): string {
  const [h, m] = at.slice(11, 16).split(':').map(Number);
  const hhmm = (x: number) => `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
  return `${hhmm(h * 60 + m)} – ${hhmm(h * 60 + m + minutes)}`;
}

const STATUS_DOT = { scheduled: 'bg-violet-500', done: 'bg-emerald-500', cancelled: 'bg-gray-300' } as const;
const STAR_FILL = { fontVariationSettings: "'FILL' 1" };

/** One labelled fact of the focused round: icon tile, small label, value. */
function Fact({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="size-8 shrink-0 rounded-lg grid place-items-center bg-gray-100 dark:bg-white/10 text-ink-muted dark:text-gray-300">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-ink-muted">{label}</dt>
        <dd className="font-semibold text-slate-800 dark:text-white">{children}</dd>
      </div>
    </div>
  );
}

function InterviewItem({ app, iv, locked, onScore, onEmail, focus = false, quiet = false }: {
  app: Application; iv: Interview; locked: boolean; onScore: () => void; onEmail: () => void;
  /** The round the drawer was opened for: a full card with labelled facts and the scorecard call to action. */ focus?: boolean;
  /** Context only (the other rounds next to a focused one): no action buttons. */ quiet?: boolean;
}) {
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
  // Join only while the meeting is still ahead: a done or cancelled round has nothing to join.
  const link = iv.status === 'scheduled' && iv.mode === 'online' && /^https?:\/\//.test(iv.place) ? iv.place : '';
  const [openCard, setOpenCard] = useState<string | null>(null);
  // A meeting URL is never shown as an address, even once the Join link is gone.
  const placeText = /^https?:\/\//.test(iv.place) ? '' : iv.place;
  const scoredByMe = iv.scorecards.some((c) => c.by === me());
  const zone = iv.timeZone ? ` (${zoneLabel(iv.timeZone, iv.at)})` : '';
  const actions = !quiet && !locked && iv.status !== 'cancelled';
  const nameOf = (id: string) => userName(users, id);
  // The panel, plus any reviewer outside it who scored this round anyway.
  const panel = [...new Set([...iv.interviewers, ...iv.scorecards.map((c) => c.by)])];
  const panelSent = panel.filter((u) => iv.scorecards.some((c) => c.by === u)).length;

  // Each reviewer's verdict with their note right under it, so a quote is never read apart from its author.
  const scores = (hidden > 0 || shown.length > 0) && (
    <div className="space-y-2">
      {hidden > 0 && (
        <p className="text-xs text-ink-muted flex items-center gap-1">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">visibility_off</span>{t('scorecard.hiddenUntilYours', { n: hidden })}
        </p>
      )}
      {shown.length > 0 && (
        <ul className="space-y-2">
          {shown.map((c) => (
            <li key={c.by} className="rounded-lg bg-background-light dark:bg-white/5 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <Avatar name={nameOf(c.by)} tone={toneFor(nameOf(c.by))} small />
                <span className="font-semibold flex-1 min-w-0 truncate">{nameOf(c.by)}</span>
                <span className="flex items-center gap-0.5 font-bold tabular-nums">
                  <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-amber-400" style={STAR_FILL}>star</span>
                  {scorecardAverage(c)}
                </span>
                <RecPill rec={c.recommendation}>{t(`scorecard.rec.${c.recommendation}`)}</RecPill>
              </div>
              {c.note && <p className="mt-1.5 pl-9 text-xs text-slate-600 dark:text-gray-300 italic">“{c.note}”</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const scoreButton = canScore && (
    <button
      onClick={onScore}
      // The focused round's own scorecard is the one thing to do here: a full-width filled button until it is sent.
      className={focus && !scoredByMe
        ? 'w-full justify-center px-4 py-2.5 text-sm font-bold bg-primary hover:bg-primary-hover text-white rounded-xl flex items-center gap-1.5 transition-colors'
        : BTN_SMALL}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">rate_review</span>
      {t(scoredByMe ? 'scorecard.edit' : 'scorecard.add')}
    </button>
  );

  if (focus) {
    return (
      <li className={`rounded-2xl border border-line dark:border-dark-line overflow-hidden ${iv.status === 'cancelled' ? 'opacity-60' : ''}`}>
        {/* Neutral header: a tinted one read as a warning and fought the scorecard button for attention. */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-white/[0.03] border-b border-hairline dark:border-dark-raised flex items-center justify-between gap-2">
          <span className="text-base font-bold text-slate-800 dark:text-white">{iv.round}</span>
          <Pill tone={tone}>{t(`interview.status.${iv.status}`)}</Pill>
        </div>
        <dl className="px-4 py-4 space-y-3.5">
          <Fact icon="calendar_today" label={t('interview.when')}>
            {interviewTime(iv.at).split(' · ')[0]}
            <span className="block text-sm font-normal text-ink-muted">{timeRange(iv.at, iv.durationMin)}{zone} · {t('interview.minutes', { n: iv.durationMin })}</span>
          </Fact>
          <Fact icon={MODE_ICON[iv.mode]} label={t('interview.where')}>
            {t(`interview.mode.${iv.mode}`)}
            {link ? (
              <a href={link} target="_blank" rel="noreferrer" title={link} className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/15">
                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">open_in_new</span>{t('interview.join')}
              </a>
            ) : placeText ? (
              <span className="block text-sm font-normal text-ink-muted">{placeText}</span>
            ) : null}
          </Fact>
        </dl>
        {/* The panel and its scorecards as one list: who sits on it, who has sent theirs, and (once visible) what they said. */}
        <div className="px-4 pt-3.5 pb-4 border-t border-hairline dark:border-dark-raised">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t('interview.panel')}</span>
            {iv.status !== 'cancelled' && (
              <span className="text-xs text-ink-muted tabular-nums">{t('interview.panelSent', { n: panelSent, total: panel.length })}</span>
            )}
          </div>
          <ul className="divide-y divide-hairline dark:divide-dark-raised">
            {panel.map((u) => {
              const card = iv.scorecards.find((c) => c.by === u);
              const visible = card && shown.includes(card);
              const mine = u === user.id;
              const extra = !iv.interviewers.includes(u);
              const open = visible && openCard === u;
              // A visible card opens on click to its per-criterion scores, so a low average can be read without asking.
              const Head = visible ? 'button' : 'div';
              return (
                <li key={u} className="py-2.5 first:pt-0 last:pb-0">
                  <Head
                    {...(visible ? { type: 'button' as const, 'aria-expanded': open, onClick: () => setOpenCard(open ? null : u) } : {})}
                    className={`w-full text-left flex items-center gap-2.5 ${visible ? '-mx-2 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 box-content' : ''}`}
                  >
                    <Avatar name={nameOf(u)} tone={toneFor(nameOf(u))} small />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 dark:text-white truncate">
                        {nameOf(u)}{mine && <span className="ml-1 font-normal text-ink-muted">({t('interview.you')})</span>}
                      </div>
                      {extra && <div className="text-2xs text-ink-muted">{t('interview.panel.extra')}</div>}
                    </div>
                    {visible ? (
                      <span className="shrink-0 flex items-center gap-2">
                        <span className="flex items-center gap-0.5 text-xs font-bold tabular-nums">
                          <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-amber-400" style={STAR_FILL}>star</span>
                          {scorecardAverage(card)}
                        </span>
                        <RecPill rec={card.recommendation}>{t(`scorecard.rec.${card.recommendation}`)}</RecPill>
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-ink-muted">{open ? 'expand_less' : 'expand_more'}</span>
                      </span>
                    ) : card ? (
                      <Pill tone="green"><span aria-hidden="true" className="material-symbols-outlined text-[14px]">check</span>{t('interview.panel.sent')}</Pill>
                    ) : iv.status === 'cancelled' ? null : mine && canScore ? (
                      <Pill tone="amber">{t('interview.panel.yourTurn')}</Pill>
                    ) : (
                      <Pill tone="gray">{t('interview.panel.pending')}</Pill>
                    )}
                  </Head>
                  {open && (
                    <dl className="mt-2 ml-9 rounded-lg bg-background-light dark:bg-white/5 px-3 py-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
                      {criteriaOf(card).map((c) => (
                        <div key={c.key} className="contents">
                          <dt className="text-slate-600 dark:text-gray-300 truncate">{c.label ?? t(`scorecard.c.${c.key}` as TKey)}</dt>
                          <dd className="font-bold tabular-nums text-right">
                            {card.scores[c.key] ? <>{card.scores[c.key]}<span className="font-normal text-ink-muted">/5</span></> : <span className="font-normal text-ink-muted">{t('scorecard.notScored')}</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {visible && card.note && <p className="mt-1.5 pl-9 text-xs text-slate-600 dark:text-gray-300 italic">“{card.note}”</p>}
                </li>
              );
            })}
          </ul>
          {hidden > 0 && (
            <p className="mt-3 text-xs text-ink-muted flex items-center gap-1">
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">visibility_off</span>{t('scorecard.hiddenUntilYours', { n: hidden })}
            </p>
          )}
        </div>
        {actions && scoreButton && <div className="px-4 py-3 border-t border-hairline dark:border-dark-raised bg-[#fcfbfb] dark:bg-white/[0.02]">{scoreButton}</div>}
      </li>
    );
  }

  // Timeline entry: a dot on the rail, the round and its date, then the panel's verdicts.
  return (
    <li className={`relative pl-6 ${iv.status === 'cancelled' ? 'opacity-60' : ''}`}>
      <span aria-hidden="true" className={`absolute left-0 top-1.5 size-3 rounded-full ring-4 ring-white dark:ring-dark-surface ${STATUS_DOT[iv.status]}`} />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-slate-800 dark:text-white">{iv.round}</span>
        <Pill tone={tone}>{t(`interview.status.${iv.status}`)}</Pill>
      </div>
      <div className="text-xs text-ink-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">schedule</span>
          {interviewTime(iv.at)}{zone} · {t('interview.minutes', { n: iv.durationMin })}
        </span>
        <span className="inline-flex items-center gap-1 min-w-0">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">{MODE_ICON[iv.mode]}</span>
          {link ? (
            <span>
              {t('interview.mode.online')} ·{' '}
              <a href={link} target="_blank" rel="noreferrer" title={link} className="font-bold text-primary hover:underline">{t('interview.join')}</a>
            </span>
          ) : (
            <span className="truncate">{t(`interview.mode.${iv.mode}`)}{placeText ? ` · ${placeText}` : ''}</span>
          )}
        </span>
      </div>
      <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1">
        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">group</span>
        {iv.interviewers.map(nameOf).join(', ')}
      </div>
      {scores && <div className="mt-2.5">{scores}</div>}
      {actions && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {scoreButton}
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

/** `focusId` (opened from "My interviews"): that round leads under "This interview", the rest follow below. */
export function InterviewsSection({ app, candidate, focusId }: Ctx & { focusId?: string }) {
  const t = useT();
  const [scheduling, setScheduling] = useState(false);
  const [scoring, setScoring] = useState<Interview | null>(null);
  const [mailing, setMailing] = useState<Interview | null>(null);
  const locked = isLocked(app);
  const all = [...(app.interviews ?? [])].sort((a, b) => a.at.localeCompare(b.at));
  const focused = focusId ? all.find((iv) => iv.id === focusId) : undefined;
  const canSchedule = !focused && can(currentUser(), 'interview.schedule') && !locked && !isEnded(app.stage);
  const list = focused ? all.filter((iv) => iv !== focused && iv.status !== 'cancelled') : all;
  const dialogs = (<>
    <InterviewDialog open={scheduling} app={app} candidateName={candidate?.name ?? ''} hasEmail={!!candidate?.email?.trim()} onClose={() => setScheduling(false)} />
    {scoring && <ScorecardDialog open appId={app.id} interview={scoring} onClose={() => setScoring(null)} />}
    {mailing && candidate && (
      <EmailComposer open candidateId={candidate.id} applicationId={app.id} templateId={TEMPLATE.interview} interview={mailing} onClose={() => setMailing(null)} />
    )}
  </>);
  if (focused) {
    return (
      <>
        <DrawerSection icon="event" title={t('interview.thisOne')}>
          <ul><InterviewItem focus app={app} iv={focused} locked={locked} onScore={() => setScoring(focused)} onEmail={() => setMailing(focused)} /></ul>
          {dialogs}
        </DrawerSection>
        {list.length > 0 && (
          <DrawerSection icon="history" title={t('interview.otherRounds')} count={list.length} hint={t('interview.otherRoundsHint')}>
            <ul className="relative space-y-5 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-dark-raised">
              {list.map((iv) => (
                <InterviewItem key={iv.id} quiet app={app} iv={iv} locked={locked} onScore={() => setScoring(iv)} onEmail={() => setMailing(iv)} />
              ))}
            </ul>
          </DrawerSection>
        )}
      </>
    );
  }
  return (
    <DrawerSection
        icon="event"
        title={t('interview.title')}
        count={list.length || undefined}
        action={canSchedule && (
          <button onClick={() => setScheduling(true)} className={BTN_SMALL}>
            <span className="material-symbols-outlined text-[14px]">event</span>{t('interview.schedule')}
          </button>
        )}
    >
      {list.length === 0 ? (
        <p className="text-ink-muted">{t('interview.none')}</p>
      ) : (
        <ul className="relative space-y-5 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-dark-raised">
          {list.map((iv) => (
            <InterviewItem key={iv.id} app={app} iv={iv} locked={locked} onScore={() => setScoring(iv)} onEmail={() => setMailing(iv)} />
          ))}
        </ul>
      )}
      {dialogs}
    </DrawerSection>
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
    <DrawerSection
        icon="request_quote"
        title={t('offer.title')}
        action={!offer && !locked && !isClosedOut(app.stage) && (
          <button onClick={() => setEditing(true)} className={BTN_SMALL}>
            <span className="material-symbols-outlined text-[14px]">request_quote</span>{t('offer.create')}
          </button>
        )}
    >
      {!offer ? (
        <p className="text-ink-muted">{t('offer.none')}</p>
      ) : (
        <div className="rounded-xl border border-hairline dark:border-dark-raised px-3 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-lg font-bold">{formatMoney(offer.salary, offer.currency)}</span>
            <Pill tone={OFFER_TONE[offer.status]}>{t(`offer.status.${offer.status}`)}</Pill>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-xs text-ink-muted">{t('offer.startDate')}</dt><dd className="font-medium">{shortDate(offer.startDate)}</dd></div>
            <div><dt className="text-xs text-ink-muted">{t('offer.contract')}</dt><dd className="font-medium">{offer.contract}</dd></div>
            <div><dt className="text-xs text-ink-muted">{t('offer.validUntil')}</dt><dd className="font-medium">{shortDate(offer.validUntil)}</dd></div>
            <div><dt className="text-xs text-ink-muted">{t('offer.by')}</dt><dd className="font-medium">{userName(users, offer.createdBy)}</dd></div>
          </dl>
          {offer.note && <p className="mt-2 text-xs text-ink-muted whitespace-pre-wrap">{offer.note}</p>}
          {offer.sentAt && offer.status !== 'draft' && <p className="mt-2 text-xs text-ink-muted">{t('offer.sentAt', { date: fullDate(offer.sentAt) })}</p>}
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
    </DrawerSection>
  );
}

export function HandoffSection({ app, candidate, job }: Ctx) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const allowed = useCan()('handoff');
  if (app.stage !== 'hired' || app.handoff || !allowed) return null;
  return (
    <DrawerSection icon="outbox" title={t('handoff.section')}>
      <div className="rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-sm">{t('handoff.prompt', { target: HANDOFF_TARGET })}</p>
        <button onClick={() => setOpen(true)} className="shrink-0 px-4 py-2 text-sm font-bold bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">outbox</span>{t('handoff.button')}
        </button>
      </div>
      <HandoffDialog open={open} app={app} candidate={candidate} job={job} onClose={() => setOpen(false)} />
    </DrawerSection>
  );
}

export function EmailsSection({ app }: { app: Application }) {
  const t = useT();
  const all = useStore((s) => s.emails);
  const users = useStore((s) => s.users);
  const [openId, setOpenId] = useState<string | null>(null);
  const emails = all.filter((e) => e.applicationId === app.id).sort((a, b) => b.at.localeCompare(a.at));
  return (
    <DrawerSection icon="mail" title={t('email.history')} count={emails.length || undefined}>
      {emails.length === 0 ? (
        <p className="text-ink-muted">{t('email.none')}</p>
      ) : (
        <ul className="space-y-2">
          {emails.map((e) => (
            <li key={e.id} className="rounded-xl bg-background-light dark:bg-dark-surface">
              <button onClick={() => setOpenId(openId === e.id ? null : e.id)} aria-expanded={openId === e.id} className="w-full text-left px-3 py-2 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-ink-muted mt-0.5">mail</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{e.subject}</span>
                  <span className="block text-xs text-ink-muted">{fullDate(e.at)} · {userName(users, e.by)}</span>
                </span>
              </button>
              {openId === e.id && <pre className="px-3 pb-3 text-xs whitespace-pre-wrap font-sans">{e.body}</pre>}
            </li>
          ))}
        </ul>
      )}
    </DrawerSection>
  );
}
