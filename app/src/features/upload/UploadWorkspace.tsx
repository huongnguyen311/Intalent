import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/i18n';
import { QueueRows, QueueStats } from './QueueRows';
import { UploadModeSwitch } from './UploadModeSwitch';
import type { QueueRow, RunResult } from './useUploadQueue';

type Mode = 'normal' | 'ultra';

type Props = {
  mode: Mode;
  rows: QueueRow[];
  running: boolean;
  accept: string;
  maxFiles: number;
  lastRun?: RunResult | null;
  dismissResult?: () => void;
  add: (files: File[]) => void;
  clear: () => void;
  start?: () => void;
  resolve: (id: number, choice: 'merge' | 'skip') => void;
  retry: (id: number) => void;
};

const CARD = 'bg-white dark:bg-dark-surface rounded-xl border border-gray-200/70 dark:border-dark-raised shadow-soft';
const BTN = 'inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

/** True while files are dragged anywhere over the window, so the dropzone can light up before the cursor reaches it. */
function useWindowFileDrag(onDrop: (files: File[]) => void) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  useEffect(() => {
    const hasFiles = (e: globalThis.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current++;
      setActive(true);
    };
    const leave = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setActive(false);
    };
    const over = (e: globalThis.DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    // A drop outside the dropzone still uploads instead of the browser opening the file.
    const drop = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      dropRef.current(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  return active;
}

/** Shared layout for Standard and Bulk (Ultra) upload: a tall dropzone with an entry spotlight, then the queue. */
export function UploadWorkspace({ mode, rows, running, accept, maxFiles, lastRun, dismissResult, add, clear, start, resolve, retry }: Props) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [spotlight, setSpotlight] = useState(true);
  const windowDrag = useWindowFileDrag(add);
  const ultra = mode === 'ultra';
  const queued = rows.filter((r) => r.status === 'queued').length;
  const settled = rows.filter((r) => r.status !== 'queued' && r.status !== 'parsing').length;
  const dragging = over || windowDrag;
  // Any drag means the user found the dropzone: the entry glow gives way to the drag state.
  const glow = spotlight && !dragging;

  const open = () => {
    setSpotlight(false);
    inputRef.current?.click();
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    // Handled here; keep the window listener from adding the same files again.
    e.stopPropagation();
    setOver(false);
    add(Array.from(e.dataTransfer.files));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  const steps = ultra
    ? [
        { icon: 'upload_file', label: t('ultra.step.drop') },
        { icon: 'rocket_launch', label: t('ultra.step.start') },
        { icon: 'fact_check', label: t('ultra.step.parse') },
      ]
    : [
        { icon: 'upload_file', label: t('upload.step.drop') },
        { icon: 'auto_awesome', label: t('upload.step.parse') },
        { icon: 'fact_check', label: t('upload.step.review') },
      ];

  return (
    <div className="p-8 max-w-[1400px] mx-auto min-h-full">
      <div className="flex flex-col gap-4">
        <UploadModeSwitch mode={mode} />

        {/* Dropzone */}
        <div className={`${CARD} relative p-2`}>
          <div
            role="button"
            tabIndex={0}
            aria-label={t(ultra ? 'ultra.drop.title' : 'upload.drop.title')}
            onClick={open}
            onKeyDown={onKey}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            // The entry glow ends with its border animation (no timer to clean up).
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) setSpotlight(false);
            }}
            className={`group relative min-h-[176px] flex flex-col items-center justify-center text-center gap-2.5 rounded-lg border-2 border-dashed px-6 py-6 cursor-pointer transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              dragging
                ? 'border-primary bg-primary/[0.05]'
                : `border-gray-200 dark:border-dark-line hover:border-primary/50 hover:bg-orange-50/40 dark:hover:bg-primary/5 ${glow ? 'upload-glow' : ''}`
            }`}
          >
            <div
              className={`size-11 rounded-xl flex items-center justify-center transition-transform duration-200 ${dragging ? 'scale-110' : ''} ${
                ultra ? 'bg-ink dark:bg-white/10 text-white' : 'bg-primary/10 text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[24px] icon-filled">{dragging ? 'download' : ultra ? 'bolt' : 'cloud_upload'}</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink dark:text-white">
                {dragging ? t('upload.drop.release') : t(ultra ? 'ultra.title' : 'upload.drop.title')}
              </h3>
              <p className="text-xs text-ink-muted mt-0.5 max-w-md">{t(ultra ? 'ultra.drop.hint' : 'upload.drop.hint')}</p>
            </div>
            <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 transition-opacity ${dragging ? 'opacity-0' : ''}`}>
              <span className={`${BTN} ${ultra ? 'border border-gray-200 dark:border-dark-line bg-white dark:bg-transparent text-ink dark:text-white group-hover:border-primary/60' : 'bg-primary hover:bg-primary-hover text-white shadow-sm'}`}>
                <span className="material-symbols-outlined text-[16px]">folder_open</span>
                {t('upload.browse')}
              </span>
              <span className="text-2xs text-muted dark:text-gray-400">{t(ultra ? 'ultra.drop.limits' : 'upload.drop.limits')}</span>
            </div>
            <input
              ref={inputRef}
              multiple
              accept={accept}
              className="sr-only"
              type="file"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                add(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </div>

          {/* How it works + Ultra's start button */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 px-2 pt-2.5 pb-0.5">
            <ol className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-muted">
              {steps.map((s, i) => (
                <li key={s.icon} className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="size-5 rounded-full bg-primary/10 text-primary text-2xs font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
                    <span className="material-symbols-outlined text-[16px] text-gray-400">{s.icon}</span>
                    {s.label}
                  </span>
                  {i < steps.length - 1 && <span className="material-symbols-outlined text-[14px] text-gray-300 dark:text-gray-600">chevron_right</span>}
                </li>
              ))}
            </ol>
            {ultra && start && (
              <button onClick={start} disabled={!queued || running} className={`${BTN} bg-primary hover:bg-primary-hover text-white`}>
                <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                {t('ultra.process')}
                {queued > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-2xs tabular-nums">{queued}</span>}
              </button>
            )}
          </div>
        </div>

        {/* Completion banner */}
        {lastRun && !running && <ResultBanner result={lastRun} onDismiss={dismissResult} />}

        {/* Queue */}
        <section className={`${CARD} overflow-hidden`}>
          <header className={`flex items-center gap-2 px-4 ${rows.length ? 'h-10 pt-1' : 'h-12'} ${rows.length ? '' : 'border-b border-gray-100 dark:border-dark-raised'}`}>
            <h3 className="text-sm font-bold whitespace-nowrap text-ink dark:text-white">{t(ultra ? 'ultra.status.title' : 'upload.queue.title')}</h3>
            {rows.length > 0 && <span className="hidden sm:inline text-xs text-muted dark:text-gray-400 tabular-nums whitespace-nowrap">· {t('upload.stat.files', { n: rows.length })}</span>}
            {running && (
              <span className="inline-flex items-center gap-1.5 ml-2 text-xs font-semibold text-primary whitespace-nowrap" aria-live="polite">
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                {t('upload.progress', { done: settled, total: rows.length })}
              </span>
            )}
            {rows.length > 0 && (ultra || !running) && (
              <button onClick={clear} className="ml-auto whitespace-nowrap text-xs font-semibold text-ink-muted hover:text-primary">
                {t(ultra ? 'ultra.clear' : 'upload.queue.clearFinished')}
              </button>
            )}
          </header>
          <QueueStats rows={rows} />
          {rows.length === 0 ? (
            <div className="flex flex-col items-center text-center py-12 px-6">
              <div className="size-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-muted dark:text-gray-400 mb-3">
                <span className="material-symbols-outlined text-[24px]">draft</span>
              </div>
              <p className="text-sm font-semibold text-ink dark:text-white">{t(ultra ? 'ultra.empty.title' : 'upload.empty.title')}</p>
              <p className="text-xs text-ink-muted mt-1">{t(ultra ? 'ultra.empty.hint' : 'upload.empty.hint')}</p>
            </div>
          ) : (
            <QueueRows rows={rows} compact maxFiles={maxFiles} onResolve={resolve} onRetry={retry} />
          )}
        </section>
      </div>
    </div>
  );
}

/** Shown once a run finishes: what happened, and the next step (open the pool, or resolve rows below). */
function ResultBanner({ result, onDismiss }: { result: RunResult; onDismiss?: () => void }) {
  const t = useT();
  const { created, merged, review, failed } = result;
  const clean = review === 0 && failed === 0;
  const tone = clean
    ? 'border-green-200 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10'
    : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10';
  return (
    <div role="status" className={`upload-row-in flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3 ${tone}`}>
      <span className={`size-9 shrink-0 rounded-full flex items-center justify-center ${clean ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'}`}>
        <span className="material-symbols-outlined text-[20px] icon-filled">{clean ? 'task_alt' : 'priority_high'}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink dark:text-white">
          {t('upload.result.title')}
          <span className="font-normal text-ink-muted"> · {t(clean ? 'upload.result.allGood' : 'upload.result.needsReview')}</span>
        </p>
        <p className="text-xs text-ink-muted mt-0.5 tabular-nums">{t('upload.result.body', { created, merged, review, failed })}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {created + merged > 0 && (
          <Link to="/candidates" className={`${BTN} h-8 bg-ink dark:bg-white text-white dark:text-ink hover:opacity-90`}>
            <span className="material-symbols-outlined text-[16px]">groups</span>
            {t('upload.result.openPool')}
          </Link>
        )}
        {onDismiss && (
          <button onClick={onDismiss} aria-label={t('upload.result.dismiss')} className="size-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-black/5 dark:hover:bg-white/10">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>
    </div>
  );
}
