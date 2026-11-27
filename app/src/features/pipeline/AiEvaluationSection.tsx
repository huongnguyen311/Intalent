import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DrawerSection } from '../../components/DrawerSection';
import { latestEvaluation } from '../../domain/aiEvaluation';
import type { AiCriterion, AiEvaluation, AiFinding, AiQuestion, Application } from '../../domain/types';
import type { TKey } from '../../i18n/en';
import { useT } from '../../i18n/i18n';
import { me, useCan } from '../../store/session';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { aiTone } from './aiTone';

type T = ReturnType<typeof useT>;
type Params = Record<string, string | number>;

/** "Senior, ~6 yrs" (CV) and "Senior, 5+ yrs" (JD) from an experience finding; an unknown level is left out, never "-". */
function experienceSides(t: T, p: Params): { have: string; want: string } {
  const known = (x: unknown) => !!x && x !== '-' && x !== '—';
  return {
    have: [p.have, t('ai.yrs', { n: p.years ?? 0 })].filter(known).join(', '),
    want: [p.want, p.wantYears ? t('ai.yrsPlus', { n: p.wantYears }) : ''].filter(Boolean).join(', '),
  };
}

/** Text of a stored finding or question in the viewer's language; experience params are composed here. */
export function aiText(t: T, item: AiFinding | AiQuestion): string {
  const p = item.params ?? {};
  if (item.key === 'ai.f.expMeets' || item.key === 'ai.f.expBelow') return t(item.key as TKey, experienceSides(t, p));
  return t(item.key as TKey, p);
}

/** Match controls stay violet like the rest of the section; orange is kept for real actions on the application. */
const AI_LINK = 'inline-flex items-center gap-0.5 text-xs font-bold text-violet-600 dark:text-violet-300 hover:underline';

const CRITERIA: AiCriterion[] = ['stack', 'experience', 'domain', 'english'];

/** Word for the score, on the same bands as its colour. */
const band = (s: number) => (s >= 80 ? 'strong' : s >= 60 ? 'partial' : 'weak');

function Toggle({ open, onClick, children }: { open: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-expanded={open} onClick={onClick} className={AI_LINK}>
      {children}
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{open ? 'expand_less' : 'expand_more'}</span>
    </button>
  );
}

type Row = { k: AiCriterion; jd: string; cv: string; points: number; max: number; required: boolean };

/** One row per JD requirement: what the JD asks, what the CV shows, and the points that adds to the total. */
function rows(t: T, e: AiEvaluation): Row[] {
  return CRITERIA.map((k) => {
    const b = e.breakdown.find((x) => x.key === k) ?? { points: 0, max: 0 };
    const has = e.strengths.filter((f) => f.criterion === k);
    const miss = e.gaps.filter((f) => f.criterion === k);
    const first = has[0] ?? miss[0];
    const base = { k, points: b.points, max: b.max, required: !!first };
    if (!first) return { ...base, jd: t('ai.notRequiredShort'), cv: '—' };
    if (k === 'stack') return { ...base, jd: t('ai.nSkills', { n: has.length + miss.length }), cv: has.length ? t('ai.nFound', { n: has.length }) : t('ai.noneFound') };
    if (k === 'domain') {
      const names = (fs: AiFinding[]) => fs.map((f) => String(f.params?.d ?? '')).join(', ');
      return { ...base, jd: names([...has, ...miss]), cv: has.length ? names(has) : t('ai.noneFound') };
    }
    if (k === 'experience') {
      const { have, want } = experienceSides(t, first.params ?? {});
      return { ...base, jd: want, cv: have || t('ai.notStated') };
    }
    const have = first.params?.have;
    return { ...base, jd: String(first.params?.want ?? ''), cv: have && have !== '-' ? String(have) : t('ai.notStated') };
  });
}

/** Full points, none, or part of them, as an icon and colour the eye can scan down the table. */
function Status({ r }: { r: Row }) {
  const [icon, cls] = !r.required || r.points >= r.max
    ? ['check_circle', r.required ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-white/30']
    : r.points === 0 ? ['cancel', 'text-red-500'] : ['timelapse', 'text-amber-500'];
  return <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${cls}`}>{icon}</span>;
}

/** How the CV matches the job's JD: one score with a word, a four-row table that adds up to it, then the detail. */
export function AiEvaluationSection({ app, compact = false }: { app: Application; compact?: boolean }) {
  const t = useT();
  const perm = useCan();
  const e = latestEvaluation(app);
  const [quotes, setQuotes] = useState(false);
  // Interview prep (compact) opens on the questions to ask; elsewhere they wait behind a toggle.
  const [asking, setAsking] = useState(compact);
  const canRerun = !compact && perm('pipeline.move') && !app.handoff && !app.aiPending;
  const rerun = () => useStore.getState().runAiEvaluation(app.id, me());

  const body = () => {
    if (app.aiPending) return <p className="text-ink-muted">{t('ai.pending')}</p>;
    if (!e) return <p className="text-ink-muted">{t('ai.none')}</p>;
    if (e.noCriteria) return <p className="text-ink-muted">{t('ai.f.noCriteria')}</p>;
    const [, fg, bar] = aiTone(e.score);
    const table = rows(t, e);
    const skillName = (f: AiFinding) => String(f.params?.s ?? '');
    const foundSkills = e.strengths.filter((f) => f.criterion === 'stack');
    const missingSkills = e.gaps.filter((f) => f.criterion === 'stack');
    const missingDomains = e.gaps.filter((f) => f.criterion === 'domain');
    return (
      <div className="space-y-4">
        {/* The verdict first: the number, a word for it, one bar. */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums" style={{ color: fg }}>{e.score}</span>
            <span className="text-sm text-ink-muted">/100</span>
            <span className="ml-1 text-sm font-bold" style={{ color: fg }}>{t(`ai.band.${band(e.score)}`)}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${e.score}%`, background: bar }} />
          </div>
        </div>

        {/* Read across: what the JD asks, what the CV shows, the points. The points column adds up to the score. */}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted border-b border-hairline dark:border-dark-raised">
              <th scope="col" className="py-1.5 font-semibold">{t('ai.col.req')}</th>
              <th scope="col" className="py-1.5 font-semibold">{t('ai.col.jd')}</th>
              <th scope="col" className="py-1.5 font-semibold">{t('ai.col.cv')}</th>
              <th scope="col" className="py-1.5 font-semibold text-right">{t('ai.col.points')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline dark:divide-dark-raised">
            {table.map((r) => (
              <tr key={r.k} className="align-top">
                {/* A td with the rowheader role: the app-wide `main table th` style would set it in small caps. */}
                <td role="rowheader" className="py-2 pr-2 font-semibold text-slate-800 dark:text-white">
                  <span className="inline-flex items-center gap-1.5"><Status r={r} />{t(`ai.criterion.${r.k}`)}</span>
                </td>
                <td className={`py-2 pr-2 ${r.required ? 'text-slate-700 dark:text-gray-200' : 'text-ink-muted'}`}>{r.jd}</td>
                <td className={`py-2 pr-2 ${r.required ? 'text-slate-700 dark:text-gray-200' : 'text-ink-muted'}`}>{r.cv}</td>
                <td className="py-2 text-right font-bold tabular-nums whitespace-nowrap text-slate-800 dark:text-white">
                  {r.points}<span className="font-normal text-ink-muted"> / {r.max}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Which skills (and domains) make up the gap, as plain lines; quotes from the CV on demand. */}
        {(missingSkills.length > 0 || foundSkills.length > 0 || missingDomains.length > 0) && (
          <dl className="space-y-1.5 text-xs">
            {missingSkills.length > 0 && (
              <div>
                <dt className="inline font-bold text-red-600 dark:text-red-400">{t('ai.missingSkills')}: </dt>
                <dd className="inline text-slate-700 dark:text-gray-200">{missingSkills.map(skillName).join(', ')}</dd>
              </div>
            )}
            {missingDomains.length > 0 && (
              <div>
                <dt className="inline font-bold text-red-600 dark:text-red-400">{t('ai.missingDomains')}: </dt>
                <dd className="inline text-slate-700 dark:text-gray-200">{missingDomains.map((f) => String(f.params?.d ?? '')).join(', ')}</dd>
              </div>
            )}
            {foundSkills.length > 0 && (
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span>
                  <dt className="inline font-bold text-emerald-700 dark:text-emerald-400">{t('ai.foundSkills')}: </dt>
                  <dd className="inline text-slate-700 dark:text-gray-200">{foundSkills.map(skillName).join(', ')}</dd>
                </span>
                <Toggle open={quotes} onClick={() => setQuotes(!quotes)}>{t(quotes ? 'ai.quotes.hide' : 'ai.quotes.show')}</Toggle>
              </div>
            )}
            {quotes && (
              <ul className="mt-1 space-y-1.5 border-l-2 border-hairline dark:border-dark-raised pl-3">
                {foundSkills.map((f) => (
                  <li key={skillName(f)}>
                    <span className="font-semibold text-slate-700 dark:text-gray-200">{skillName(f)}</span>
                    <span className="block text-ink-muted italic">{f.evidence ? `“${f.evidence}”` : t('ai.noEvidence')}</span>
                  </li>
                ))}
              </ul>
            )}
          </dl>
        )}

        {/* What to check in the room: folded away except in interview prep. */}
        {e.questions.length > 0 && (
          <div className="rounded-xl bg-violet-50/70 dark:bg-violet-500/10 px-3.5 py-2.5">
            <Toggle open={asking} onClick={() => setAsking(!asking)}>{t('ai.questionsN', { n: e.questions.length })}</Toggle>
            {asking && (
              <ol className="mt-2 space-y-1 list-decimal pl-5 text-slate-700 dark:text-gray-200">
                {e.questions.map((q, i) => <li key={i}>{aiText(t, q)}</li>)}
              </ol>
            )}
          </div>
        )}

        {!compact && (
          <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
            <span>{t('ai.meta', { model: e.model, date: fullDate(e.at), n: app.aiEvaluations?.length ?? 1 })}</span>
            <Link to={`/candidates/${app.candidateId}`} className="inline-flex items-center gap-1 font-bold text-primary hover:underline shrink-0">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">description</span>{t('ai.openCv')}
            </Link>
          </div>
        )}
        <p className="text-xs text-ink-muted">{t('ai.disclaimer')}</p>
      </div>
    );
  };

  return (
    <DrawerSection
      icon="join_inner"
      tone="violet"
      title={t('ai.section')}
      hint={t('ai.sectionHint')}
      action={canRerun && (
        <button onClick={rerun} className="px-3 py-1 rounded-full border border-line dark:border-dark-line text-xs font-bold hover:border-primary/50">
          {t('ai.rerun')}
        </button>
      )}
    >
      {body()}
    </DrawerSection>
  );
}
