import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { addCriterion, averageOf, COMPETENCY_KEYS, criteriaOf, isRequired, removeCriterion, templateFor } from '../../domain/scorecard';
import type { Interview, Recommendation, ScoreCriterionDef } from '../../domain/types';
import type { TKey } from '../../i18n/en';
import { useT } from '../../i18n/i18n';
import { me } from '../../store/session';
import { useStore } from '../../store/store';
import { BTN_GHOST, BTN_PRIMARY, FIELD } from './ui';

export const RECOMMENDATIONS: Recommendation[] = ['strong_yes', 'yes', 'no', 'strong_no'];

const REC_STYLE: Record<Recommendation, { icon: string; on: string }> = {
  strong_yes: { icon: 'verified', on: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' },
  // Same green family as Strong yes (lighter border), matching the verdict pills in the drawer.
  yes: { icon: 'thumb_up', on: 'border-emerald-300 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-300' },
  no: { icon: 'thumb_down', on: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' },
  strong_no: { icon: 'block', on: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
};

/** Selected score colour: red below the bar, amber at it, green above. */
const scoreTone = (n: number) => (n <= 2 ? 'bg-red-500' : n === 3 ? 'bg-amber-500' : 'bg-emerald-500');

type Props = { open: boolean; appId: string; interview: Interview; onClose: () => void };

/**
 * The current user's scorecard for one round, built for the job: the JD's skills (optional, score what you tested),
 * the job family's core competencies (required), an overall recommendation and a note.
 * Criteria are suggested from the JD, department and round; the interviewer can add or remove them here.
 */
export function ScorecardDialog({ open, appId, interview, onClose }: Props) {
  const t = useT();
  const app = useStore((s) => s.applications.find((a) => a.id === appId));
  const job = useStore((s) => s.jobs.find((j) => j.id === app?.jobId));
  const jds = useStore((s) => s.jds);
  const candidate = useStore((s) => s.candidates.find((c) => c.id === app?.candidateId));
  const template = useMemo(() => templateFor(interview, job, jds), [interview, job, jds]);
  const jdSkills = useMemo(() => jds.find((j) => j.id === job?.jdId)?.skills ?? [], [jds, job]);
  // Suggested from the JD, department and round; the interviewer fine-tunes it. A saved card reopens on its own list.
  const initial = () => {
    const card = interview.scorecards.find((c) => c.by === me());
    return card ? criteriaOf(card) : template.criteria;
  };
  const [criteria, setCriteria] = useState<ScoreCriterionDef[]>(initial);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [rec, setRec] = useState<Recommendation | ''>('');
  const [note, setNote] = useState('');
  // Gaps are flagged only once Submit was tried, so an untouched card does not open covered in red.
  const [tried, setTried] = useState(false);
  const [draft, setDraft] = useState<Record<ScoreCriterionDef['group'], string>>({ skill: '', core: '' });

  useEffect(() => {
    if (!open) return;
    const card = interview.scorecards.find((c) => c.by === me());
    setCriteria(card ? criteriaOf(card) : template.criteria);
    setScores(card?.scores ?? {});
    setRec(card?.recommendation ?? '');
    setNote(card?.note ?? '');
    setTried(false);
    setDraft({ skill: '', core: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens or the round changes
  }, [open, interview]);

  const label = (c: ScoreCriterionDef) => c.label ?? t(`scorecard.c.${c.key}` as TKey);
  const desc = (c: ScoreCriterionDef) =>
    c.group === 'skill' ? t('scorecard.d.skill', { skill: c.label ?? '' }) : c.label ? t('scorecard.d.custom') : t(`scorecard.d.${c.key}` as TKey);
  const gap = (c: ScoreCriterionDef) => isRequired(c) && !(scores[c.key] > 0);
  const gaps = criteria.filter(gap);
  const complete = gaps.length === 0 && rec !== '';
  const avg = averageOf(scores);
  const coreCount = criteria.filter(isRequired).length;

  // What "+ Add" offers: the JD skills and the built-in competencies not already on the card.
  const onCard = new Set(criteria.map((c) => c.key));
  const options: Record<ScoreCriterionDef['group'], string[]> = {
    skill: jdSkills.filter((s) => !onCard.has(`skill:${s}`)),
    core: COMPETENCY_KEYS.filter((k) => !onCard.has(k)).map((k) => t(`scorecard.c.${k}` as TKey)),
  };

  const add = (g: ScoreCriterionDef['group']) => {
    const text = draft[g].trim();
    const known = g === 'core' ? COMPETENCY_KEYS.find((k) => t(`scorecard.c.${k}` as TKey).toLowerCase() === text.toLowerCase()) : undefined;
    setCriteria(addCriterion(criteria, g, text, known));
    setDraft({ ...draft, [g]: '' });
  };

  const remove = (key: string) => {
    const next = removeCriterion(criteria, key);
    if (next === criteria) return;
    setCriteria(next);
    setScores(Object.fromEntries(Object.entries(scores).filter(([k]) => k !== key)));
  };

  const save = () => {
    if (!complete || !rec) {
      setTried(true);
      document.getElementById(gaps.length ? `sc-${gaps[0].key}` : 'sc-rec')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      return;
    }
    const kept = Object.fromEntries(Object.entries(scores).filter(([k]) => onCard.has(k)));
    if (useStore.getState().submitScorecard(appId, interview.id, { scores: kept, criteria, recommendation: rec, note }, me())) {
      toast(t('scorecard.toast'));
      onClose();
    }
  };

  const row = (c: ScoreCriterionDef) => {
    const v = scores[c.key] ?? 0;
    const name = label(c);
    const flagged = tried && gap(c);
    const removable = !isRequired(c) || coreCount > 1;
    return (
      <li key={c.key} id={`sc-${c.key}`} className="py-3 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-800 dark:text-white">
            {name}{isRequired(c) && <span aria-hidden="true" className="text-primary"> *</span>}
          </div>
          <div className="text-xs text-ink-muted mt-0.5">{desc(c)}</div>
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
                  n === v
                    ? `${scoreTone(n)} text-white`
                    : n < v
                      ? 'bg-gray-200 text-slate-600 dark:bg-white/15 dark:text-gray-200'
                      : flagged
                        ? 'border border-red-400 text-red-500 hover:border-primary/50 hover:text-primary'
                        : 'border border-line dark:border-dark-line text-ink-muted hover:border-primary/50 hover:text-primary'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="text-2xs text-ink-muted h-4 flex items-center gap-1.5">
            {v ? t(`scorecard.scale.${v}` as TKey) : flagged ? <span className="font-bold text-red-600 dark:text-red-400">{t('scorecard.required')}</span> : t('scorecard.notScored')}
            {v > 0 && !isRequired(c) && (
              <button type="button" onClick={() => setScores(Object.fromEntries(Object.entries(scores).filter(([k]) => k !== c.key)))} className="font-bold text-primary hover:underline">
                {t('scorecard.clear')}
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label={t('scorecard.remove', { name })}
          title={t('scorecard.remove', { name })}
          disabled={!removable}
          onClick={() => remove(c.key)}
          className="shrink-0 -mr-1 mt-1 size-6 grid place-items-center rounded-md text-ink-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 disabled:invisible"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </li>
    );
  };

  const addRow = (g: ScoreCriterionDef['group']) => {
    const name = t(g === 'skill' ? 'scorecard.addSkill' : 'scorecard.addCompetency');
    const listId = `sc-add-${g}`;
    return (
      <div className="pt-2 flex items-center gap-2">
        <input
          aria-label={name}
          list={listId}
          value={draft[g]}
          placeholder={t(g === 'skill' ? 'scorecard.addSkillPh' : 'scorecard.addCompetencyPh')}
          onChange={(e) => setDraft({ ...draft, [g]: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(g); } }}
          className={`${FIELD} flex-1 min-w-0`}
        />
        <datalist id={listId}>{options[g].map((o) => <option key={o} value={o} />)}</datalist>
        <button type="button" onClick={() => add(g)} disabled={!draft[g].trim()} className={`${BTN_GHOST} shrink-0 inline-flex items-center gap-1`}>
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add</span>
          {name}
        </button>
      </div>
    );
  };

  // The round's focus decides which group leads: competencies in a final round, skills otherwise.
  const order = template.focus === 'final' ? (['core', 'skill'] as const) : (['skill', 'core'] as const);
  const recFlagged = tried && rec === '';
  const scored = (items: ScoreCriterionDef[]) => items.filter((c) => scores[c.key] > 0).length;

  const tag = (required: boolean) => (
    <span
      className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
        required ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-ink-muted dark:bg-white/10 dark:text-gray-300'
      }`}
    >
      {t(required ? 'scorecard.tag.required' : 'scorecard.tag.optional')}
    </span>
  );

  /** One numbered block: what to do here, whether it is required, and how far along it is. */
  const section = (p: { n: number; id?: string; title: string; hint: string; required: boolean; aside?: ReactNode; flag?: boolean; children: ReactNode }) => (
    <section key={p.title} id={p.id} aria-label={p.title} className={`rounded-xl border ${p.flag ? 'border-red-300 dark:border-red-500/50' : 'border-line dark:border-dark-line'}`}>
      <header className="flex items-start gap-3 px-4 py-3 rounded-t-xl border-b border-hairline dark:border-dark-raised bg-background-light/70 dark:bg-white/[0.03]">
        <span aria-hidden="true" className="mt-0.5 size-6 shrink-0 grid place-items-center rounded-full bg-primary text-white text-xs font-bold tabular-nums">{p.n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="ty-section text-[15px] font-bold text-slate-800 dark:text-white">{p.title}</h4>
            {tag(p.required)}
            {p.flag && <span className="text-xs font-bold text-red-600 dark:text-red-400">{t('scorecard.required')}</span>}
          </div>
          <p className="text-xs text-ink-muted mt-0.5">{p.hint}</p>
        </div>
        {p.aside && <span className="shrink-0 mt-0.5 text-xs text-ink-muted tabular-nums">{p.aside}</span>}
      </header>
      <div className="px-4 py-2">{p.children}</div>
    </section>
  );

  return (
    <Modal
      open={open}
      xl
      focusField={false}
      title={t('scorecard.title', { round: interview.round })}
      onClose={onClose}
      footer={
        <>
          {avg > 0 && (
            <span className="mr-auto self-center text-sm text-ink-muted">
              {t('scorecard.average')}: <b className="text-slate-800 dark:text-white tabular-nums">{avg}</b>/5
            </span>
          )}
          <button onClick={onClose} className={BTN_GHOST}>{t('common.cancel')}</button>
          <button onClick={save} className={BTN_PRIMARY}>{t('scorecard.submit')}</button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Who and what for, and what the numbers mean. */}
        <div className="rounded-xl bg-background-light dark:bg-white/5 px-4 py-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {candidate && <span className="font-bold text-slate-800 dark:text-white">{candidate.name}</span>}
            {job && <span className="text-ink-muted">· {job.title}{job.level ? ` · ${job.level}` : ''}</span>}
            <span className="ml-auto px-2 py-0.5 rounded-full bg-white dark:bg-white/10 text-2xs font-bold text-ink-muted">{t(`scorecard.family.${template.family}`)}</span>
          </div>
          <p className="text-2xs text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold uppercase tracking-wide">{t('scorecard.scaleLabel')}</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="inline-flex items-center gap-1">
                <span className={`size-4 grid place-items-center rounded text-[10px] font-bold text-white ${scoreTone(n)}`}>{n}</span>
                {t(`scorecard.scale.${n}` as TKey)}
              </span>
            ))}
          </p>
        </div>

        {order.map((g, i) => {
          const items = criteria.filter((c) => c.group === g);
          return section({
            n: i + 1,
            title: t(`scorecard.group.${g}`),
            hint: t(g === 'skill' ? 'scorecard.group.skillHint' : 'scorecard.group.coreHint'),
            required: g === 'core',
            aside: items.length > 0 ? t('scorecard.progress', { n: scored(items), total: items.length }) : undefined,
            children: (
              <>
                <ul className="divide-y divide-[#f8f6f6] dark:divide-white/5">{items.map(row)}</ul>
                <div className="pb-2">{addRow(g)}</div>
              </>
            ),
          });
        })}

        {section({
          n: 3,
          id: 'sc-rec',
          title: t('scorecard.recommendation'),
          hint: t('scorecard.recHint'),
          required: true,
          flag: recFlagged,
          children: (
            <fieldset className="py-2">
              <legend className="sr-only">{t('scorecard.recommendation')}</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {RECOMMENDATIONS.map((r) => (
                  <label key={r} className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl border-2 cursor-pointer text-center transition-colors ${rec === r ? REC_STYLE[r].on : 'border-hairline dark:border-dark-line hover:border-line'}`}>
                    <input type="radio" name="sc-rec" aria-label={t(`scorecard.rec.${r}`)} checked={rec === r} onChange={() => setRec(r)} className="sr-only" />
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">{REC_STYLE[r].icon}</span>
                    <span className="text-sm font-bold">{t(`scorecard.rec.${r}`)}</span>
                    <span className="text-2xs opacity-80">{t(`scorecard.rec.hint.${r}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ),
        })}

        {section({
          n: 4,
          title: t('scorecard.note'),
          hint: t('scorecard.noteHint'),
          required: false,
          children: (
            <div className="py-2">
              <textarea id="sc-note" aria-label={t('scorecard.note')} rows={3} className={`${FIELD} w-full`} value={note} placeholder={t('scorecard.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
            </div>
          ),
        })}
      </div>
    </Modal>
  );
}
