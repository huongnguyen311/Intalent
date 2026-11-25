import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { latestEvaluation } from '../../domain/aiEvaluation';
import { averageOf, criteriaOf, isRequired, templateFor } from '../../domain/scorecard';
import type { Interview, Recommendation, ScoreCriterionDef } from '../../domain/types';
import type { TKey } from '../../i18n/en';
import { useT } from '../../i18n/i18n';
import { me } from '../../store/session';
import { useStore } from '../../store/store';
import { aiText } from '../pipeline/AiEvaluationSection';
import { BTN_GHOST, BTN_PRIMARY, FIELD } from './ui';

export const RECOMMENDATIONS: Recommendation[] = ['strong_yes', 'yes', 'no', 'strong_no'];

const REC_STYLE: Record<Recommendation, { icon: string; on: string }> = {
  strong_yes: { icon: 'verified', on: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' },
  yes: { icon: 'thumb_up', on: 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' },
  no: { icon: 'thumb_down', on: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' },
  strong_no: { icon: 'block', on: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
};

/** Selected score colour: red below the bar, amber at it, green above. */
const scoreTone = (n: number) => (n <= 2 ? 'bg-red-500' : n === 3 ? 'bg-amber-500' : 'bg-emerald-500');

type Props = { open: boolean; appId: string; interview: Interview; onClose: () => void };

/**
 * The current user's scorecard for one round, built for the job: the JD's skills (optional, score what you tested),
 * the job family's core competencies (required), an overall recommendation and a note.
 */
export function ScorecardDialog({ open, appId, interview, onClose }: Props) {
  const t = useT();
  const app = useStore((s) => s.applications.find((a) => a.id === appId));
  const job = useStore((s) => s.jobs.find((j) => j.id === app?.jobId));
  const jds = useStore((s) => s.jds);
  const candidate = useStore((s) => s.candidates.find((c) => c.id === app?.candidateId));
  const mine = interview.scorecards.find((c) => c.by === me());
  const template = useMemo(() => templateFor(interview, job, jds), [interview, job, jds]);
  // Editing keeps the criteria the card was first scored on, so a later JD change never rewrites old scores.
  const criteria = mine ? criteriaOf(mine) : template.criteria;
  const [scores, setScores] = useState<Record<string, number>>({});
  const [rec, setRec] = useState<Recommendation | ''>('');
  const [note, setNote] = useState('');
  const [hints, setHints] = useState(false);

  useEffect(() => {
    if (!open) return;
    const card = interview.scorecards.find((c) => c.by === me());
    setScores(card?.scores ?? {});
    setRec(card?.recommendation ?? '');
    setNote(card?.note ?? '');
  }, [open, interview]);

  const label = (c: ScoreCriterionDef) => c.label ?? t(`scorecard.c.${c.key}` as TKey);
  const desc = (c: ScoreCriterionDef) => (c.group === 'skill' ? t('scorecard.d.skill', { skill: c.label ?? '' }) : t(`scorecard.d.${c.key}` as TKey));
  // Named so a disabled Submit explains itself.
  const missing = [
    ...criteria.filter((c) => isRequired(c) && !(scores[c.key] > 0)).map(label),
    ...(rec === '' ? [t('scorecard.recommendation')] : []),
  ];
  const complete = missing.length === 0;
  const avg = averageOf(scores);
  const questions = app ? latestEvaluation(app)?.questions ?? [] : [];

  const save = () => {
    if (!complete || rec === '') return;
    if (useStore.getState().submitScorecard(appId, interview.id, { scores, criteria, recommendation: rec, note }, me())) {
      toast(t('scorecard.toast'));
      onClose();
    }
  };

  const row = (c: ScoreCriterionDef) => {
    const v = scores[c.key] ?? 0;
    const name = label(c);
    return (
      <li key={c.key} className="py-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800 dark:text-white">
            {name}{isRequired(c) && <span aria-hidden="true" className="text-primary"> *</span>}
          </div>
          <div className="text-xs text-[#896a61] mt-0.5">{desc(c)}</div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div role="group" aria-label={name} className="inline-flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={t('pipeline.drawer.rate', { n })}
                aria-pressed={n === v}
                title={t(`scorecard.scale.${n}` as TKey)}
                onClick={() => setScores({ ...scores, [c.key]: n })}
                className={`size-8 rounded-lg text-sm font-bold tabular-nums transition-colors ${
                  n === v ? `${scoreTone(n)} text-white` : n < v ? 'bg-gray-200 text-slate-600 dark:bg-white/15 dark:text-gray-200' : 'border border-[#e6dddb] dark:border-[#3a3433] text-[#896a61] hover:border-primary/50 hover:text-primary'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-[#896a61] h-4 flex items-center gap-1.5">
            {v ? t(`scorecard.scale.${v}` as TKey) : t('scorecard.notScored')}
            {v > 0 && !isRequired(c) && (
              <button type="button" onClick={() => setScores(Object.fromEntries(Object.entries(scores).filter(([k]) => k !== c.key)))} className="font-bold text-primary hover:underline">
                {t('scorecard.clear')}
              </button>
            )}
          </div>
        </div>
      </li>
    );
  };

  const groups = (['skill', 'core'] as const)
    .map((g) => ({ g, items: criteria.filter((c) => c.group === g) }))
    .filter((x) => x.items.length > 0)
    // The round's focus decides which group leads (the template already ordered the criteria that way).
    .sort((a, b) => criteria.indexOf(a.items[0]) - criteria.indexOf(b.items[0]));

  return (
    <Modal
      open={open}
      wide
      title={t('scorecard.title', { round: interview.round })}
      onClose={onClose}
      footer={
        <>
          {!complete && <span className="mr-auto self-center text-xs text-[#896a61]">{t('scorecard.missing', { list: missing.join(', ') })}</span>}
          <button onClick={onClose} className={BTN_GHOST}>{t('common.cancel')}</button>
          <button onClick={save} disabled={!complete} className={BTN_PRIMARY}>{t('scorecard.submit')}</button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Who and what for, and what this round is meant to find out. */}
        <div className="rounded-xl bg-[#f8f6f6] dark:bg-white/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {candidate && <span className="font-bold text-slate-800 dark:text-white">{candidate.name}</span>}
            {job && <span className="text-[#896a61]">· {job.title}{job.level ? ` · ${job.level}` : ''}</span>}
            <span className="ml-auto px-2 py-0.5 rounded-full bg-white dark:bg-white/10 text-[11px] font-bold text-[#896a61]">{t(`scorecard.family.${template.family}`)}</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-gray-300 flex items-start gap-1.5">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-primary">target</span>
            {t(`scorecard.focus.${template.focus}`)}
          </p>
          {questions.length > 0 && (
            <div className="mt-2">
              <button type="button" aria-expanded={hints} onClick={() => setHints(!hints)} className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-300 hover:underline">
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">auto_awesome</span>
                {t('scorecard.aiQuestions')} ({questions.length})
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{hints ? 'expand_less' : 'expand_more'}</span>
              </button>
              {hints && (
                <ol className="mt-1.5 list-decimal pl-5 space-y-0.5 text-xs text-slate-700 dark:text-gray-200">
                  {questions.map((q, i) => <li key={i}>{aiText(t, q)}</li>)}
                </ol>
              )}
            </div>
          )}
        </div>

        {groups.map(({ g, items }) => (
          <section key={g} aria-label={t(`scorecard.group.${g}`)}>
            <div className="flex items-baseline justify-between gap-2 border-b border-[#f0ebea] dark:border-[#2a2423] pb-2">
              <h4 className="text-[15px] font-bold text-slate-800 dark:text-white">{t(`scorecard.group.${g}`)}</h4>
              <span className="text-xs text-[#896a61]">{t(g === 'skill' ? 'scorecard.group.skillHint' : 'scorecard.group.coreHint')}</span>
            </div>
            <ul className="divide-y divide-[#f8f6f6] dark:divide-white/5">{items.map(row)}</ul>
          </section>
        ))}

        <fieldset>
          <legend className="w-full flex items-baseline justify-between gap-2 mb-2">
            <span className="text-[15px] font-bold text-slate-800 dark:text-white">{t('scorecard.recommendation')}<span aria-hidden="true" className="text-primary"> *</span></span>
            {avg > 0 && <span className="text-xs text-[#896a61]">{t('scorecard.average')}: <b className="text-slate-800 dark:text-white tabular-nums">{avg}</b>/5</span>}
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {RECOMMENDATIONS.map((r) => (
              <label key={r} className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl border-2 cursor-pointer text-center transition-colors ${rec === r ? REC_STYLE[r].on : 'border-[#f0ebea] dark:border-[#3a3433] hover:border-[#e6dddb]'}`}>
                <input type="radio" name="sc-rec" aria-label={t(`scorecard.rec.${r}`)} checked={rec === r} onChange={() => setRec(r)} className="sr-only" />
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">{REC_STYLE[r].icon}</span>
                <span className="text-sm font-bold">{t(`scorecard.rec.${r}`)}</span>
                <span className="text-[11px] opacity-80">{t(`scorecard.rec.hint.${r}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="sc-note" className="text-[15px] font-bold text-slate-800 dark:text-white">{t('scorecard.note')}</label>
          <textarea id="sc-note" rows={3} className={FIELD} value={note} placeholder={t('scorecard.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
