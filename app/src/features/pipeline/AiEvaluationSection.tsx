import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { latestEvaluation } from '../../domain/aiEvaluation';
import type { AiFinding, AiQuestion, Application } from '../../domain/types';
import type { TKey } from '../../i18n/en';
import { useT } from '../../i18n/i18n';
import { me, useCan } from '../../store/session';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { aiTone } from './aiTone';

const H = 'text-xs font-bold text-[#896a61] uppercase tracking-wider';

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

/** Latest AI evaluation for one application: score, per-criterion bars, strengths/gaps with CV evidence, questions. */
export function AiEvaluationSection({ app }: { app: Application }) {
  const t = useT();
  const perm = useCan();
  const headingId = useId();
  const e = latestEvaluation(app);
  const canRerun = perm('pipeline.move') && !app.handoff && !app.aiPending;
  const rerun = () => useStore.getState().runAiEvaluation(app.id, me());
  const [bg, fg] = aiTone(e?.score ?? 0);

  return (
    <section aria-labelledby={headingId} className="py-5 border-t border-[#f4f1f0] dark:border-[#2a2423]">
      <div className="flex items-center justify-between mb-3">
        <h4 id={headingId} className={`${H} flex items-center gap-1`}>
          <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-purple-500">auto_awesome</span>
          {t('ai.section')}
        </h4>
        {canRerun && (
          <button onClick={rerun} className="px-3 py-1 rounded-full border border-[#e6dddb] dark:border-[#3a3433] text-xs font-bold hover:border-primary/50">
            {t('ai.rerun')}
          </button>
        )}
      </div>

      {app.aiPending ? (
        <p className="text-[#896a61]">{t('ai.pending')}</p>
      ) : !e ? (
        <p className="text-[#896a61]">{t('ai.none')}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#896a61]">{t('ai.score')}</span>
            <span className="px-2.5 py-0.5 rounded-lg text-lg font-bold" style={e.noCriteria ? undefined : { background: bg, color: fg }}>{e.noCriteria ? '—' : e.score}</span>
            <span className="text-xs text-[#896a61]">/ 100</span>
          </div>
          <dl className="space-y-1.5">
            {e.breakdown.map((b) => (
              <div key={b.key} className="grid grid-cols-[88px_1fr_44px] items-center gap-2 text-xs">
                <dt className="text-slate-700 dark:text-gray-200">{t(`ai.criterion.${b.key}`)}</dt>
                <dd className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${b.max ? (b.points / b.max) * 100 : 0}%`, background: aiTone(b.max ? (b.points / b.max) * 100 : 0)[2] }} />
                </dd>
                <dd className="text-right font-bold tabular-nums">{b.points}/{b.max}</dd>
              </div>
            ))}
          </dl>
          <Findings title={t('ai.strengths')} icon="check_circle" cls="text-emerald-600" items={e.strengths} />
          <Findings title={t('ai.gaps')} icon="cancel" cls="text-red-500" items={e.gaps} />
          {e.questions.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-gray-200 mb-1">{t('ai.questions')}</div>
              <Folded items={e.questions} listClass="list-disc pl-5 space-y-0.5" render={(q, i) => <li key={i}>{aiText(t, q)}</li>} />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-xs text-[#896a61]">
            <span>{t('ai.meta', { model: e.model, date: fullDate(e.at), n: app.aiEvaluations?.length ?? 1 })}</span>
            <Link to={`/candidates/${app.candidateId}`} className="inline-flex items-center gap-1 font-bold text-primary hover:underline shrink-0">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">description</span>{t('ai.openCv')}
            </Link>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-[#896a61]">{t('ai.disclaimer')}</p>
    </section>
  );
}
