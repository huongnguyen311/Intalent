import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DrawerSection } from '../../components/DrawerSection';
import { latestEvaluation } from '../../domain/aiEvaluation';
import type { AiFinding, AiQuestion, Application } from '../../domain/types';
import type { TKey } from '../../i18n/en';
import { useT } from '../../i18n/i18n';
import { me, useCan } from '../../store/session';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { aiTone } from './aiTone';


type T = ReturnType<typeof useT>;

/** Text of a stored finding or question in the viewer's language; experience params are composed here. */
export function aiText(t: T, item: AiFinding | AiQuestion): string {
  const p = item.params ?? {};
  if (item.key === 'ai.f.expMeets' || item.key === 'ai.f.expBelow') {
    // An unknown level is stored as "-": leave it out rather than print "-, ~0 yrs".
    const known = (x: unknown) => !!x && x !== '-' && x !== '—';
    const have = [p.have, t('ai.yrs', { n: p.years ?? 0 })].filter(known).join(', ');
    const want = [p.want, p.wantYears ? t('ai.yrsPlus', { n: p.wantYears }) : ''].filter(Boolean).join(', ');
    return t(item.key as TKey, { have, want });
  }
  return t(item.key as TKey, p);
}

/** Long lists fold to their first few items so Interviews and Offer stay within reach in the drawer. */
const FOLD = 3;

function Folded<X>({ items, render, listClass }: { items: X[]; render: (x: X, i: number) => ReactNode; listClass: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, FOLD);
  return (
    <>
      <ul className={listClass}>{shown.map(render)}</ul>
      {items.length > FOLD && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-xs font-bold text-primary hover:underline">
          {open ? t('ai.less') : t('ai.more', { n: items.length - FOLD })}
        </button>
      )}
    </>
  );
}

function Findings({ title, icon, cls, items }: { title: string; icon: string; cls: string; items: AiFinding[] }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <div>
      <div className="text-xs font-bold text-slate-700 dark:text-gray-200 mb-1">{title}</div>
      <Folded
        items={items}
        listClass="space-y-1.5"
        render={(f, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden="true" className={`material-symbols-outlined text-[16px] shrink-0 ${cls}`}>{icon}</span>
            <span className="min-w-0">
              {aiText(t, f)}
              <span className="block text-xs text-[#896a61] italic">{f.evidence ? `“${f.evidence}”` : icon === 'check_circle' && f.criterion === 'stack' ? t('ai.noEvidence') : null}</span>
            </span>
          </li>
        )}
      />
    </div>
  );
}

/** Score as a ring coloured by band, with the number in the middle; "—" when the job set no criteria. */
function ScoreRing({ score, label }: { score?: number; label: string }) {
  const r = 28;
  const len = 2 * Math.PI * r;
  const [, fg, bar] = aiTone(score ?? 0);
  return (
    <div className="shrink-0 flex flex-col items-center gap-1">
      <div className="relative size-[72px]">
        <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-gray-100 dark:stroke-white/10" />
          {score !== undefined && (
            <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" strokeLinecap="round" stroke={bar} strokeDasharray={`${(score / 100) * len} ${len}`} />
          )}
        </svg>
        <span className="absolute inset-0 grid place-items-center text-xl font-bold tabular-nums" style={{ color: score === undefined ? undefined : fg }}>
          {score ?? '—'}
        </span>
      </div>
      <span className="text-[11px] text-[#896a61]">{label}</span>
    </div>
  );
}

/** What the interviewer should check in the room, as a numbered list on a soft violet card. */
function Questions({ items }: { items: AiQuestion[] }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <div className="rounded-xl bg-violet-50/70 dark:bg-violet-500/10 p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-300 mb-2">
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">help</span>{t('ai.questions')}
      </div>
      <Folded
        items={items}
        listClass="space-y-1.5"
        render={(q, i) => (
          <li key={i} className="flex gap-2 text-slate-700 dark:text-gray-200">
            <span aria-hidden="true" className="size-5 shrink-0 rounded-full bg-white dark:bg-white/10 text-violet-600 dark:text-violet-300 text-[11px] font-bold grid place-items-center">{i + 1}</span>
            <span className="min-w-0">{aiText(t, q)}</span>
          </li>
        )}
      />
    </div>
  );
}

/** Latest AI evaluation for one application: score, per-criterion bars, strengths/gaps with CV evidence, questions. */
export function AiEvaluationSection({ app, compact = false }: { app: Application; compact?: boolean }) {
  const t = useT();
  const perm = useCan();
  const e = latestEvaluation(app);
  // Compact (interview prep): score and the questions to check; the breakdown and findings fold away.
  const [details, setDetails] = useState(!compact);
  const canRerun = !compact && perm('pipeline.move') && !app.handoff && !app.aiPending;
  const rerun = () => useStore.getState().runAiEvaluation(app.id, me());

  return (
    <DrawerSection
      icon="auto_awesome"
      tone="violet"
      title={t('ai.section')}
      action={canRerun && (
        <button onClick={rerun} className="px-3 py-1 rounded-full border border-[#e6dddb] dark:border-[#3a3433] text-xs font-bold hover:border-primary/50">
          {t('ai.rerun')}
        </button>
      )}
    >
      {app.aiPending ? (
        <p className="text-[#896a61]">{t('ai.pending')}</p>
      ) : !e ? (
        <p className="text-[#896a61]">{t('ai.none')}</p>
      ) : (
        <div className="space-y-4">
          {/* Score and what it is made of, side by side: the number never shows without its reasons. */}
          <div className="flex items-center gap-5 rounded-xl border border-[#f0ebea] dark:border-[#2a2423] p-4">
            <ScoreRing score={e.noCriteria ? undefined : e.score} label={t('ai.score')} />
            <dl className="flex-1 min-w-0 grid grid-cols-2 gap-x-5 gap-y-3">
              {e.breakdown.map((b) => {
                const pct = b.max ? (b.points / b.max) * 100 : 0;
                return (
                  <div key={b.key} className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <dt className="text-slate-600 dark:text-gray-300 truncate">{t(`ai.criterion.${b.key}`)}</dt>
                      <dd className="font-bold tabular-nums text-slate-800 dark:text-white">{b.points}<span className="font-normal text-[#896a61]">/{b.max}</span></dd>
                    </div>
                    <dd className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: aiTone(pct)[2] }} />
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          {/* In interview prep the questions come straight after the score: they are what to ask in the room. */}
          {compact && <Questions items={e.questions} />}

          {compact && (
            <button type="button" aria-expanded={details} onClick={() => setDetails(!details)} className="inline-flex items-center gap-0.5 text-xs font-bold text-primary hover:underline">
              {t(details ? 'ai.hideFindings' : 'ai.showFindings')}
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{details ? 'expand_less' : 'expand_more'}</span>
            </button>
          )}
          {details && (<>
            <div className="grid gap-3">
              <Findings title={t('ai.strengths')} icon="check_circle" cls="text-emerald-600" items={e.strengths} />
              <Findings title={t('ai.gaps')} icon="cancel" cls="text-red-500" items={e.gaps} />
            </div>
            {!compact && <Questions items={e.questions} />}
            {!compact && (
              <div className="flex items-center justify-between gap-2 text-xs text-[#896a61]">
                <span>{t('ai.meta', { model: e.model, date: fullDate(e.at), n: app.aiEvaluations?.length ?? 1 })}</span>
                <Link to={`/candidates/${app.candidateId}`} className="inline-flex items-center gap-1 font-bold text-primary hover:underline shrink-0">
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">description</span>{t('ai.openCv')}
                </Link>
              </div>
            )}
          </>)}
        </div>
      )}
      {details && e && <p className="mt-3 text-xs text-[#896a61]">{t('ai.disclaimer')}</p>}
    </DrawerSection>
  );
}
