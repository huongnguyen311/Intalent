import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { SOURCE_TALENT_POOL } from '../../domain/sources';
import { stageLabel } from '../../domain/stages';
import type { Stage } from '../../domain/types';
import { CURRENT_USER_ID } from '../../domain/users';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { PoolSearch } from './PoolSearch';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Fixed people to add; omit for search mode (multi-select from the Talent Pool). */
  candidateIds?: string[];
  /** Fixed target job (e.g. from its Pipeline); omit to pick an open job. */
  jobId?: string;
};

type Result = { ok: true } | { ok: false; stage: Stage } | { ok: false; closed: true };

const DEFAULT_SOURCE = SOURCE_TALENT_POOL;
const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';
const BTN_PRIMARY =
  'px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_GHOST =
  'px-4 py-2 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white rounded-lg hover:border-primary/50 transition-colors';

/** Adds Talent Pool candidates to one open job's pipeline and reports the outcome per candidate. */
export function AddToPipelineModal({ open, onClose, candidateIds: fixedIds, jobId: fixedJobId }: Props) {
  const t = useT();
  const [lang] = useLang();
  const jobs = useStore((s) => s.jobs);
  const candidates = useStore((s) => s.candidates);
  const [pickedJobId, setJobId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [results, setResults] = useState<Record<string, Result> | null>(null);

  useEffect(() => {
    if (!open) return;
    setJobId('');
    setPicked([]);
    setSource(DEFAULT_SOURCE);
    setResults(null);
  }, [open]);

  const searchMode = fixedIds === undefined;
  const candidateIds = fixedIds ?? picked;
  const jobId = fixedJobId ?? pickedJobId;
  const openJobs = jobs.filter((j) => j.status === 'open');
  const people = candidateIds.map((id) => ({ id, name: candidates.find((c) => c.id === id)?.name ?? id }));

  const confirm = () => {
    const store = useStore.getState();
    const next: Record<string, Result> = {};
    for (const id of candidateIds) {
      const res = store.addToPipeline(id, jobId, {
        via: 'talent_pool',
        source: source.trim() || DEFAULT_SOURCE,
        by: CURRENT_USER_ID,
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
        {!results && (
          <>
            {!fixedJobId && (
              <div className="flex flex-col gap-1">
                <label htmlFor="atp-job" className="text-xs font-semibold text-[#896a61]">{t('atp.job')}</label>
                <select id="atp-job" className={FIELD} value={jobId} onChange={(e) => setJobId(e.target.value)}>
                  <option value="">{t('atp.selectJob')}</option>
                  {openJobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="atp-source" className="text-xs font-semibold text-[#896a61]">{t('atp.source')}</label>
              <input id="atp-source" className={FIELD} value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
            {searchMode && <PoolSearch jobId={jobId} selected={picked} onChange={setPicked} />}
          </>
        )}
        {(!searchMode || results) && (
          <ul className="flex flex-col gap-2">
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
        )}
      </div>
    </Modal>
  );
}
