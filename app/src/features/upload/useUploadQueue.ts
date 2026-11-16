import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../../components/Toast';
import { mulberry32 } from '../../data/seed';
import { hashString, parseCvFile, validateFiles, type RejectReason, type UploadLimits } from '../../domain/parseCv';
import { CURRENT_USER_ID } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';

export type RowStatus = 'queued' | 'parsing' | 'done' | 'failed';

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
}

/** Simulated CV parsing queue: queued, parsing (timer-driven progress), done (created or merged) or failed. */
export function useUploadQueue({ limits, source, concurrency, autoStart }: Options) {
  const t = useT();
  const rowsRef = useRef<QueueRow[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runRef = useRef({ created: 0, merged: 0 });
  const nextId = useRef(1);
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [running, setRunning] = useState(false);

  const publish = () => setRows([...rowsRef.current]);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
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
        const input = parseCvFile(r, mulberry32(hashString(r.name)));
        const { candidate, created } = useStore.getState().upsertCandidate(input, { source, by: CURRENT_USER_ID });
        r.status = 'done';
        r.outcome = created ? 'created' : 'merged';
        r.candidateId = candidate.id;
        runRef.current[r.outcome]++;
      } catch {
        r.status = 'failed';
        r.reason = 'parse';
      }
    }
    publish();
    if (!all.some((r) => r.status === 'queued' || r.status === 'parsing')) {
      stopTimer();
      const { created, merged } = runRef.current;
      runRef.current = { created: 0, merged: 0 };
      if (created + merged > 0) toast(t('upload.toast.done', { created, merged }), 'success');
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

  const clear = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    rowsRef.current = [];
    runRef.current = { created: 0, merged: 0 };
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

  return { rows, running, add, start, clear };
}
