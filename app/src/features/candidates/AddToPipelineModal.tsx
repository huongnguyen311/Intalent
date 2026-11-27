import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { jobsInScope } from '../../domain/permissions';
import { SOURCE_TALENT_POOL } from '../../domain/sources';
import { stageLabel } from '../../domain/stages';
import type { Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { me, useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { PoolSearch } from './PoolSearch';
import { BTN_GHOST, BTN_PRIMARY, FIELD } from '../../components/ui';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Fixed people to add; omit for search mode (multi-select from the Talent Pool). */
  candidateIds?: string[];
  /** Fixed target job (e.g. from its Pipeline); omit to pick an open job. */
  jobId?: string;
};

type Result = { ok: true } | { ok: false; stage: Stage } | { ok: false; closed: true };


/** Adds Talent Pool candidates to one open job's pipeline and reports the outcome per candidate. */
export function AddToPipelineModal({ open, onClose, candidateIds: fixedIds, jobId: fixedJobId }: Props) {
  const t = useT();
  const [lang] = useLang();
  const jobs = useStore((s) => s.jobs);
  const candidates = useStore((s) => s.candidates);
  const [pickedJobId, setJobId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, Result> | null>(null);

  useEffect(() => {
    if (!open) return;
    setJobId('');
    setPicked([]);
    setResults(null);
  }, [open]);

  const user = useMe();
  const searchMode = fixedIds === undefined;
  const candidateIds = fixedIds ?? picked;
  const jobId = fixedJobId ?? pickedJobId;
  // Only jobs this user works on: adding to someone else's job would leave them unable to follow the candidate.
  const openJobs = jobsInScope(user, jobs).filter((j) => j.status === 'open');
  // HR flagged these people "do not hire": still allowed, but say so before they go into a pipeline.
  const flagged = candidates.filter((c) => candidateIds.includes(c.id) && c.doNotHire);
  const people = candidateIds.map((id) => ({ id, name: candidates.find((c) => c.id === id)?.name ?? id }));

  const confirm = () => {
    const store = useStore.getState();
    const next: Record<string, Result> = {};
    for (const id of candidateIds) {
      const res = store.addToPipeline(id, jobId, {
        via: 'talent_pool',
        // Always the Talent Pool: this modal only ever picks people from it.
        source: SOURCE_TALENT_POOL,
        by: me(),
      });
      next[id] = res.ok ? { ok: true } : res.reason === 'duplicate' ? { ok: false, stage: res.stage } : { ok: false, closed: true };
    }
    setResults(next);
  };

  return (
    <Modal
      open={open}
      title={t(fixedJobId ? 'pipeline.addFromPool' : 'atp.title')}
      onClose={onClose}
      footer={
        results ? (
          <button className={BTN_PRIMARY} onClick={onClose}>{t('atp.done')}</button>
        ) : (
          <>
            <button className={BTN_GHOST} onClick={onClose}>{t('common.cancel')}</button>
            <button className={BTN_PRIMARY} disabled={!jobId || candidateIds.length === 0} onClick={confirm}>{t('atp.confirm')}</button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {!results && flagged.length > 0 && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] shrink-0">block</span>
            <span>{t('atp.dnhWarn', { names: flagged.map((c) => c.name).join(', ') })}</span>
          </div>
        )}
        {!results && (
          <>
            {!fixedJobId && (
              <div className="flex flex-col gap-1">
                <label htmlFor="atp-job" className="text-xs font-semibold text-ink-muted">{t('atp.job')}</label>
                <select id="atp-job" className={FIELD} value={jobId} onChange={(e) => setJobId(e.target.value)}>
                  <option value="">{t('atp.selectJob')}</option>
                  {openJobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>
            )}
            {searchMode && <PoolSearch jobId={jobId} selected={picked} onChange={setPicked} />}
          </>
        )}
        {(!searchMode || results) && (
          <div className="flex flex-col gap-1">
          <p id="atp-people" className="text-xs font-semibold text-ink-muted">{t('atp.people')}</p>
          <ul aria-labelledby="atp-people" className="flex flex-col gap-2">
            {people.map((p) => {
              const r = results?.[p.id];
              return (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span className="font-medium">{p.name}</span>
                  {r && (
                    <span className={`text-xs font-medium ${r.ok ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                      {r.ok ? t('atp.added') : 'stage' in r ? t('intake.toast.alreadyInJob', { stage: stageLabel(r.stage, lang) }) : t('pipeline.jobNotOpen')}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
