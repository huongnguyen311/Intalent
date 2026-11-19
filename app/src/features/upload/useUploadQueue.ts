import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../../components/Toast';
import { mulberry32 } from '../../data/seed';
import { findDuplicate } from '../../domain/dedupe';
import { hashString, parseCvFile, parseReport, validateFiles, type RejectReason, type UploadLimits } from '../../domain/parseCv';
import type { CandidateInput } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { me } from '../../store/session';
import { useStore } from '../../store/store';

/** `review`: the parsed CV matches an existing profile (email/phone) and waits for HR to merge or skip it. */
export type RowStatus = 'queued' | 'parsing' | 'done' | 'failed' | 'review' | 'skipped';

export interface QueueRow {
  id: number;
  name: string;
  size: number;
  status: RowStatus;
  /** 0-100 while parsing. */
  progress: number;
  outcome?: 'created' | 'merged';
  candidateId?: string;
  reason?: RejectReason | 'parse';
  /** `review` rows: the parsed data and the profile it may duplicate. */
  input?: CandidateInput;
  duplicateId?: string;
  duplicateName?: string;
}

const TICK_MS = 120;
const STEP = 25;

interface Options {
  limits: UploadLimits;
  /** Candidate source recorded on created/merged profiles. */
  source: string;
  /** Rows parsed in parallel. */
  concurrency: number;
  /** Start parsing as soon as files are added; otherwise wait for `start()`. */
  autoStart: boolean;
  /** Job whose pipeline each added profile joins; none = Talent Pool only. */
  jobId?: string;
}

/** Simulated CV parsing queue: queued, parsing (timer-driven progress), done (created or merged) or failed. */
export function useUploadQueue({ limits, source, concurrency, autoStart, jobId }: Options) {
  const t = useT();
  const rowsRef = useRef<QueueRow[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runRef = useRef({ created: 0, merged: 0, review: 0 });
  const jobRef = useRef(jobId);
  jobRef.current = jobId;
  const nextId = useRef(1);
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [running, setRunning] = useState(false);

  const publish = () => setRows([...rowsRef.current]);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
  };

  /** Saves the profile (merging only when HR confirmed) and, with a job chosen, adds it to that pipeline. */
  const commit = (r: QueueRow, input: CandidateInput) => {
    const st = useStore.getState();
    const { candidate, created } = st.upsertCandidate(input, { source, by: me() });
    if (jobRef.current) st.addToPipeline(candidate.id, jobRef.current, { via: 'manual', source, by: me() });
    r.status = 'done';
    r.outcome = created ? 'created' : 'merged';
    r.candidateId = candidate.id;
    r.input = undefined;
  };

  const tick = () => {
    const all = rowsRef.current;
    let active = all.filter((r) => r.status === 'parsing').length;
    for (const r of all) {
      if (active >= concurrency) break;
      if (r.status === 'queued') {
        r.status = 'parsing';
        r.progress = 0;
        active++;
      }
    }
    for (const r of all) {
      if (r.status !== 'parsing') continue;
      r.progress = Math.min(100, r.progress + STEP);
      if (r.progress < 100) continue;
      try {
        const parsed = parseCvFile(r, mulberry32(hashString(r.name)));
        // Some CVs carry no English level: leave it empty rather than guess (PRD AC-07).
        const raw = hashString(r.name) % 5 === 0 ? { ...parsed, english: '' } : parsed;
        const input = { ...raw, parse: parseReport(r.name, raw, new Date().toISOString()) };
        // Never merge on our own (PRD AC-11): a match by email/phone waits for HR to confirm.
        const dup = findDuplicate(useStore.getState().candidates, input);
        if (dup) {
          r.status = 'review';
          r.input = input;
          r.duplicateId = dup.id;
          r.duplicateName = dup.name;
          runRef.current.review++;
          continue;
        }
        commit(r, input);
        runRef.current.created++;
      } catch {
        r.status = 'failed';
        r.reason = 'parse';
      }
    }
    publish();
    if (!all.some((r) => r.status === 'queued' || r.status === 'parsing')) {
      stopTimer();
      const { created, merged, review } = runRef.current;
      runRef.current = { created: 0, merged: 0, review: 0 };
      if (created + merged > 0) toast(t('upload.toast.done', { created, merged }), 'success');
      if (review > 0) toast(t('upload.toast.review', { n: review }), 'info');
    }
  };

  const ensureTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(tick, TICK_MS);
    setRunning(true);
  };

  const add = (files: { name: string; size: number }[]) => {
    const { accepted, rejected } = validateFiles(files, limits);
    const fresh: QueueRow[] = [
      ...rejected.map(({ file, reason }) => ({
        id: nextId.current++, name: file.name, size: file.size, status: 'failed' as const, progress: 0, reason,
      })),
      ...accepted.map((file) => ({
        id: nextId.current++, name: file.name, size: file.size, status: 'queued' as const, progress: 0,
      })),
    ];
    if (!fresh.length) return;
    rowsRef.current = [...rowsRef.current, ...fresh];
    publish();
    if (rejected.length) toast(t('upload.toast.rejected', { n: rejected.length }), 'error');
    if (autoStart && accepted.length) ensureTimer();
  };

  const start = () => ensureTimer();

  /** HR's answer for a `review` row: merge into the matching profile, or leave it untouched. */
  const resolve = (id: number, choice: 'merge' | 'skip') => {
    const r = rowsRef.current.find((x) => x.id === id);
    if (!r || r.status !== 'review' || !r.input) return;
    if (choice === 'merge') commit(r, r.input);
    else {
      r.status = 'skipped';
      r.input = undefined;
    }
    publish();
  };

  /** Re-queues a file that only missed the batch limit (type and size errors would fail again). */
  const retry = (id: number) => {
    const r = rowsRef.current.find((x) => x.id === id);
    if (!r || r.status !== 'failed' || r.reason !== 'batch') return;
    r.status = 'queued';
    r.reason = undefined;
    r.progress = 0;
    publish();
    if (autoStart) ensureTimer();
  };

  const clear = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    rowsRef.current = [];
    runRef.current = { created: 0, merged: 0, review: 0 };
    setRunning(false);
    setRows([]);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    },
    [],
  );

  return { rows, running, add, start, clear, resolve, retry };
}
