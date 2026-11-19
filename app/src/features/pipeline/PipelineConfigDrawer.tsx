import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../components/Drawer';
import { MenuItem, Popover } from '../../components/Popover';
import { toast } from '../../components/Toast';
import { FIXED_END, FIXED_START, middleStages, OPTIONAL_STAGES, REJECT_CODES, suggestedRules } from '../../domain/pipelineConfig';
import { CUSTOM_STAGES, END_STAGES, isCustomStage, stageLabel } from '../../domain/stages';
import type { AutomationRule, Job, RejectCode, Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { STAGE_COLOR } from '../jobs/JobBits';

type Props = { job: Job; open: boolean; onClose: () => void };

const FIELD =
  'h-9 py-0 pl-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';
const ICON_BTN =
  'size-7 rounded-full flex items-center justify-center text-[#896a61] hover:text-primary hover:bg-[#f8f6f6] dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none';

let seq = 0;
const newId = () => `r-${Date.now().toString(36)}-${++seq}`;

/**
 * Per-job pipeline settings: the board's columns (add, rename, reorder, remove; New, Hired and Rejected always stay),
 * the SLA (days) of each column, and stage automation rules ("in New with AI score of at least 70, move to HR Screening").
 */
export function PipelineConfigDrawer({ job, open, onClose }: Props) {
  const t = useT();
  const [lang] = useLang();
  const updateJob = useStore((s) => s.updateJob);
  const runAutomations = useStore((s) => s.runAutomations);
  const applications = useStore((s) => s.applications);
  const jobApps = useMemo(() => applications.filter((a) => a.jobId === job.id), [applications, job.id]);

  const [mid, setMid] = useState<Stage[]>([]);
  const [withdrawn, setWithdrawn] = useState(false);
  const [names, setNames] = useState<Partial<Record<Stage, string>>>({});
  const [sla, setSla] = useState<Partial<Record<Stage, number>>>({});
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [applyNow, setApplyNow] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMid(middleStages(job));
    setWithdrawn(!!job.pipeline?.includes('withdrawn'));
    setNames({ ...job.stageNames });
    setSla({ ...job.stageSla });
    setRules(job.automations ?? []);
    setApplyNow(false);
  }, [open, job]);

  const columns: Stage[] = [...FIXED_START, ...mid, ...FIXED_END, ...(withdrawn ? (['withdrawn'] as Stage[]) : [])];
  const on = (s: Stage) => columns.includes(s);
  const nameOf = (s: Stage) => names[s]?.trim() || stageLabel(s, lang);
  const occupied = (s: Stage) => jobApps.filter((a) => a.stage === s).length;
  const addable: Stage[] = [...OPTIONAL_STAGES.filter((s) => !isCustomStage(s) && !mid.includes(s)), ...(withdrawn ? [] : (['withdrawn'] as Stage[]))];
  const freeCustom = CUSTOM_STAGES.find((s) => !mid.includes(s));

  const moveCol = (s: Stage, dir: -1 | 1) =>
    setMid((cur) => {
      const i = cur.indexOf(s);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const removeCol = (s: Stage) => (s === 'withdrawn' ? setWithdrawn(false) : setMid((cur) => cur.filter((x) => x !== s)));
  const addCol = (s: Stage) => {
    if (s === 'withdrawn') {
      setWithdrawn(true);
      return;
    }
    // A new column goes before Offer when the job has one, else at the end of the middle.
    setMid((cur) => {
      const at = cur.indexOf('offer');
      return at < 0 ? [...cur, s] : [...cur.slice(0, at), s, ...cur.slice(at)];
    });
    // A reused custom slot starts unnamed.
    if (isCustomStage(s)) setNames((n) => ({ ...n, [s]: '' }));
  };

  const patchRule = (id: string, patch: Partial<AutomationRule>) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  // A rule touching a removed column never fires; flag it instead of silently dropping it.
  const ruleBroken = (r: AutomationRule) => !on(r.from) || !on(r.to) || r.from === r.to || (r.when !== 'on_enter' && (r.score === undefined || Number.isNaN(r.score)));

  const save = () => {
    const cleanSla = Object.fromEntries(Object.entries(sla).filter(([s, d]) => on(s as Stage) && d && d > 0)) as Partial<Record<Stage, number>>;
    // Keep a name only where it differs from the standard label; a custom column always keeps one.
    const cleanNames = Object.fromEntries(
      columns.flatMap((s) => {
        const v = names[s]?.trim();
        if (v && v !== stageLabel(s, lang)) return [[s, v]];
        return isCustomStage(s) ? [[s, stageLabel(s, lang)]] : [];
      }),
    ) as Partial<Record<Stage, string>>;
    const cleanRules = rules.map((r) => (r.to === 'rejected' ? { ...r, rejectCode: r.rejectCode ?? 'other' } : { ...r, rejectCode: undefined }));
    updateJob(job.id, {
      pipeline: [...mid, ...(withdrawn ? (['withdrawn'] as Stage[]) : [])],
      stageNames: cleanNames,
      stageSla: cleanSla,
      automations: cleanRules,
    });
    let moved = 0;
    if (applyNow) for (const a of jobApps) moved += runAutomations(a.id) > 0 ? 1 : 0;
    toast(applyNow ? t('pipeline.config.savedMoved', { n: moved }) : t('pipeline.config.saved'));
    onClose();
  };

  return (
    <Drawer open={open} title={t('pipeline.config.title', { title: job.title })} onClose={onClose} guardUnsaved variant="center">
      <div className="flex flex-col gap-6 text-sm">
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-slate-800 dark:text-white">{t('pipeline.config.stages')}</h4>
            <Popover
              align="right"
              trigger={({ toggle }) => (
                <button onClick={toggle} className="h-8 px-3 rounded-full border border-[#e6dddb] dark:border-[#3a3433] text-xs font-bold flex items-center gap-1 hover:border-primary/50">
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>
                  {t('pipeline.config.addColumn')}
                </button>
              )}
            >
              {(close) => (
                <>
                  {freeCustom && <MenuItem onClick={() => { close(); addCol(freeCustom); }}>{t('pipeline.config.addCustom')}</MenuItem>}
                  {addable.map((s) => (
                    <MenuItem key={s} onClick={() => { close(); addCol(s); }}>{nameOf(s)}</MenuItem>
                  ))}
                </>
              )}
            </Popover>
          </div>
          <p className="text-xs text-[#896a61]">{t('pipeline.config.stagesHint')}</p>
          <ul className="flex flex-col divide-y divide-[#f4f1f0] dark:divide-[#2a2423] rounded-xl border border-[#e6dddb] dark:border-[#3a3433]">
            {columns.map((s) => {
              const i = mid.indexOf(s);
              const movable = i >= 0;
              const removable = movable || s === 'withdrawn';
              const n = occupied(s);
              return (
                <li key={s} data-testid={`col-${s}`} className="flex items-center gap-2 px-3 py-2">
                  <span aria-hidden="true" className="size-2.5 rounded-full shrink-0" style={{ background: STAGE_COLOR[s] }} />
                  <input
                    aria-label={t('pipeline.config.nameFor', { stage: nameOf(s) })}
                    value={names[s] ?? ''}
                    placeholder={isCustomStage(s) ? t('pipeline.config.customPlaceholder') : stageLabel(s, lang)}
                    onChange={(e) => setNames((cur) => ({ ...cur, [s]: e.target.value }))}
                    className={`${FIELD} flex-1 min-w-0 pr-2 font-semibold placeholder:font-normal placeholder:text-slate-500`}
                  />
                  {!END_STAGES.includes(s) ? (
                    <label className="flex items-center gap-1 text-xs text-[#896a61] shrink-0">
                      {t('pipeline.config.sla')}
                      <input
                        type="number"
                        min={0}
                        aria-label={t('pipeline.config.slaFor', { stage: nameOf(s) })}
                        value={sla[s] ?? ''}
                        onChange={(e) => setSla((cur) => ({ ...cur, [s]: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) }))}
                        className={`${FIELD} w-14`}
                      />
                      {t('pipeline.config.days')}
                    </label>
                  ) : (
                    <span className="w-[104px] shrink-0" />
                  )}
                  <span className="flex items-center shrink-0 w-[84px] justify-end">
                    {movable && (
                      <>
                        <button aria-label={t('pipeline.config.moveUp', { stage: nameOf(s) })} disabled={i === 0} onClick={() => moveCol(s, -1)} className={ICON_BTN}>
                          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_upward</span>
                        </button>
                        <button aria-label={t('pipeline.config.moveDown', { stage: nameOf(s) })} disabled={i === mid.length - 1} onClick={() => moveCol(s, 1)} className={ICON_BTN}>
                          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_downward</span>
                        </button>
                      </>
                    )}
                    {removable ? (
                      <button
                        aria-label={t('pipeline.config.removeColumn', { stage: nameOf(s) })}
                        title={n > 0 ? t('pipeline.config.stillHas', { n }) : t('pipeline.config.removeColumn', { stage: nameOf(s) })}
                        onClick={() => removeCol(s)}
                        className={`${ICON_BTN} hover:!text-red-600`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    ) : (
                      <span title={t('pipeline.config.required')} className="size-7 flex items-center justify-center text-gray-300">
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">lock</span>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {[...OPTIONAL_STAGES, 'withdrawn' as Stage].filter((s) => !on(s) && occupied(s) > 0).map((s) => (
            <p key={s} className="text-2xs text-amber-600">{nameOf(s)}: {t('pipeline.config.stillHas', { n: occupied(s) })}</p>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-slate-800 dark:text-white">{t('pipeline.config.rules')}</h4>
            <div className="flex gap-2">
              {rules.length === 0 && (
                <button onClick={() => setRules(suggestedRules().map((r) => ({ ...r, id: newId() })))} className="text-xs font-bold text-primary hover:underline">
                  {t('pipeline.config.suggest')}
                </button>
              )}
              <button
                onClick={() => setRules((rs) => [...rs, { id: newId(), enabled: true, from: columns[0], when: 'score_gte', score: 70, to: columns[1] ?? columns[0] }])}
                className="h-8 px-3 rounded-full border border-[#e6dddb] dark:border-[#3a3433] text-xs font-bold flex items-center gap-1 hover:border-primary/50"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>
                {t('pipeline.config.addRule')}
              </button>
            </div>
          </div>
          <p className="text-xs text-[#896a61]">{t('pipeline.config.rulesHint')}</p>
          {rules.length === 0 && <p className="text-xs text-gray-400 italic">{t('pipeline.config.noRules')}</p>}
          <ul className="flex flex-col gap-2">
            {rules.map((r, i) => (
              <li key={r.id} data-testid={`rule-${i}`} className={`rounded-xl border px-3 py-2 flex flex-col gap-2 ${ruleBroken(r) ? 'border-amber-400' : 'border-[#e6dddb] dark:border-[#3a3433]'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs font-semibold">
                    <input type="checkbox" checked={r.enabled} onChange={(e) => patchRule(r.id, { enabled: e.target.checked })} className="rounded border-gray-300 text-primary focus:ring-primary" />
                    {t('pipeline.config.ruleOn')}
                  </label>
                  <span className="text-xs text-[#896a61]">{t('pipeline.config.when')}</span>
                  <select aria-label={t('pipeline.config.from')} className={FIELD} value={r.from} onChange={(e) => patchRule(r.id, { from: e.target.value as Stage })}>
                    {columns.filter((s) => !END_STAGES.includes(s)).map((s) => <option key={s} value={s}>{nameOf(s)}</option>)}
                  </select>
                  <select aria-label={t('pipeline.config.condition')} className={FIELD} value={r.when} onChange={(e) => patchRule(r.id, { when: e.target.value as AutomationRule['when'] })}>
                    <option value="on_enter">{t('pipeline.config.onEnter')}</option>
                    <option value="score_gte">{t('pipeline.config.scoreGte')}</option>
                    <option value="score_lt">{t('pipeline.config.scoreLt')}</option>
                  </select>
                  {r.when !== 'on_enter' && (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      aria-label={t('pipeline.config.score')}
                      value={r.score ?? ''}
                      onChange={(e) => patchRule(r.id, { score: e.target.value === '' ? undefined : Math.min(100, Math.max(0, Number(e.target.value))) })}
                      className={`${FIELD} w-16`}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap pl-6">
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-[#896a61]">subdirectory_arrow_right</span>
                  <span className="text-xs text-[#896a61]">{t('pipeline.config.to')}</span>
                  <select aria-label={t('pipeline.config.to')} className={FIELD} value={r.to} onChange={(e) => patchRule(r.id, { to: e.target.value as Stage })}>
                    {columns.map((s) => <option key={s} value={s}>{nameOf(s)}</option>)}
                  </select>
                  {r.to === 'rejected' && (
                    <select aria-label={t('pipeline.reject.category')} className={FIELD} value={r.rejectCode ?? 'other'} onChange={(e) => patchRule(r.id, { rejectCode: e.target.value as RejectCode })}>
                      {REJECT_CODES.map((c) => <option key={c} value={c}>{t(`reject.${c}`)}</option>)}
                    </select>
                  )}
                  <button aria-label={t('pipeline.config.removeRule')} title={t('pipeline.config.removeRule')} onClick={() => setRules((rs) => rs.filter((x) => x.id !== r.id))} className="ml-auto size-7 rounded-full flex items-center justify-center text-[#896a61] hover:text-red-600">
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
                {ruleBroken(r) && <p className="text-2xs text-amber-600">{t('pipeline.config.ruleBroken')}</p>}
              </li>
            ))}
          </ul>
          {rules.length > 0 && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={applyNow} onChange={(e) => setApplyNow(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary" />
              {t('pipeline.config.applyNow', { n: jobApps.length })}
            </label>
          )}
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#e6dddb] dark:border-[#2a2423]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] rounded-lg hover:border-primary/50">{t('common.cancel')}</button>
          <button onClick={save} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg shadow-sm">{t('pipeline.config.save')}</button>
        </div>
      </div>
    </Drawer>
  );
}
