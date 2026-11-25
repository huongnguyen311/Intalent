import { useRef, useState, type DragEvent } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { UPLOAD_LIMITS } from '../../domain/parseCv';
import { SOURCE_CV_UPLOAD } from '../../domain/sources';
import { useShowNew } from '../../hooks';
import { useT } from '../../i18n/i18n';
import { UploadModeSwitch } from './UploadModeSwitch';
import { QueueRows, QueueSummary } from './QueueRows';
import { useUploadQueue } from './useUploadQueue';

// The app uses the brand primary for the main action; the mockup's button is near-black.
const BTN_PRIMARY = 'bg-primary hover:bg-primary-hover text-white';
const BTN_DARK = 'bg-[#181211] dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-[#181211]';

export function UploadPage() {
  const t = useT();
  const showNew = useShowNew();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { rows, running, add, clear, resolve, retry } = useUploadQueue({
    limits: UPLOAD_LIMITS,
    source: SOURCE_CV_UPLOAD,
    concurrency: 2,
    autoStart: true,
  });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    add(Array.from(e.dataTransfer.files));
  };

  return (
    <AppLayout title={t('nav.uploadCvs')} subtitle={showNew ? t('upload.subtitle') : undefined}>
      <div className="px-8 pb-8 pt-4">
        <div className="max-w-[1100px] mx-auto flex flex-col gap-8">
          <div className={`flex flex-col md:flex-row md:items-end gap-6 ${showNew ? 'md:justify-end' : 'justify-between'}`}>
            {/* In the app the page header carries the title and subtitle; the mockup repeats them here. */}
            {!showNew && <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#181211] dark:text-white mb-2">{t('upload.title')}</h1>
              <p className="text-[#896a61] text-sm">{t('upload.subtitle')}</p>
            </div>}
            <UploadModeSwitch mode="normal" />
          </div>
          <div className="w-full">
            <div
              className={`group relative rounded-[2rem] p-1 bg-gradient-to-br transition-all duration-300 shadow-sm cursor-pointer ${
                dragging ? 'from-brand-vivid to-brand-light' : 'from-gray-200 to-gray-100 dark:from-[#3a3433] dark:to-[#2a2423] hover:from-brand-vivid hover:to-brand-light'
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div className="relative bg-white dark:bg-[#1e1e1e] rounded-[calc(2rem-4px)] p-2">
                <div className="relative rounded-[calc(2rem-12px)] p-12 flex flex-col items-center justify-center text-center transition-all duration-300 bg-orange-50/40 dark:bg-orange-950/20 group-hover:bg-orange-50/60 dark:group-hover:bg-orange-900/30">
                  <div className="size-20 rounded-2xl bg-white dark:bg-brand-vivid/10 flex items-center justify-center text-brand-vivid mb-6 shadow-md group-hover:scale-110 group-hover:shadow-glow transition-all duration-300 border border-gray-100 dark:border-transparent">
                    <span className="material-symbols-outlined text-[40px] icon-filled">folder_open</span>
                  </div>
                  <h3 className="ty-section text-xl font-bold text-[#181211] dark:text-white mb-2">{t('upload.drop.title')}</h3>
                  <p className="text-[#896a61] text-sm mb-1 max-w-sm mx-auto">{t('upload.drop.hint')}</p>
                  <p className="text-gray-400 text-xs mb-8">{t('upload.drop.limits')}</p>
                  <button className={`px-8 py-2.5 ${showNew ? BTN_PRIMARY : BTN_DARK} font-bold rounded-full shadow-lg transition-all transform active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed`}>
                    {t('upload.browse')}
                  </button>
                  <input
                    ref={inputRef}
                    multiple
                    accept=".pdf,.docx,.txt"
                    className="sr-only"
                    type="file"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      add(Array.from(e.target.files ?? []));
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-12 shadow-soft border border-gray-100 dark:border-[#2a2423] text-center">
              <div className="size-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mx-auto mb-4">
                <span className="material-symbols-outlined text-[32px]">draft</span>
              </div>
              <h3 className="ty-section text-lg font-bold text-[#181211] dark:text-white mb-2">{t('upload.empty.title')}</h3>
              <p className="text-[#896a61] text-sm">{t('upload.empty.hint')}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-soft border border-gray-100 dark:border-[#2a2423] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2a2423]">
                <div className="flex items-center gap-4">
                  <h3 className="ty-section text-lg font-bold text-[#181211] dark:text-white">{t('upload.queue.title')}</h3>
                  {showNew && <QueueSummary rows={rows} />}
                </div>
                {!running && (
                  <button onClick={clear} className="text-sm font-medium text-[#896a61] hover:text-primary">
                    {t('upload.queue.clearFinished')}
                  </button>
                )}
              </div>
              <QueueRows rows={rows} maxFiles={UPLOAD_LIMITS.maxFiles} onResolve={resolve} onRetry={retry} />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
