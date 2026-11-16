import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { ULTRA_LIMITS } from '../../domain/parseCv';
import { useT } from '../../i18n/i18n';
import { QueueRows } from './QueueRows';
import { LucideIcon } from './ultraIcons';
import { useUploadQueue } from './useUploadQueue';

// Particle positions are taken from the mockup snapshot; only their drift is animated (CSS, see ANIMATIONS).
const PARTICLES: [left: number, top: number][] = [
  [69.9652, 86.4161], [87.6995, 70.9022], [95.9208, 89.8864], [18.7813, 48.5902],
  [40.1845, 63.3949], [42.2472, 0.222291], [64.8171, 80.2024], [53.0354, 83.2634],
];

const ANIMATIONS = `
@keyframes ultra-blob { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
@keyframes ultra-drift { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(10px, -30px); } }
@keyframes ultra-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes ultra-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ultra-anim { animation: none !important; } }
`;

export function UltraUploadPage() {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { rows, running, add, start, clear } = useUploadQueue({
    limits: ULTRA_LIMITS,
    source: 'Ultra Upload',
    concurrency: 20,
    autoStart: false,
  });
  const hasQueued = rows.some((r) => r.status === 'queued');

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    add(Array.from(e.dataTransfer.files));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <AppLayout title={t('nav.ultraUpload')}>
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="ultra-anim absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" style={{ animation: 'ultra-blob 8s ease-in-out infinite' }} />
          <div className="ultra-anim absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" style={{ animation: 'ultra-blob 10s ease-in-out infinite' }} />
          {PARTICLES.map(([left, top], i) => (
            <div
              key={i}
              className="ultra-anim absolute w-1 h-1 bg-white/30 rounded-full"
              style={{ left: `${left}%`, top: `${top}%`, animation: `ultra-drift ${6 + (i % 4)}s ease-in-out ${i * 0.4}s infinite` }}
            />
          ))}
        </div>
        <div className="relative z-10 container mx-auto px-6 py-12">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-4 mb-6 bg-white/5 backdrop-blur-xl rounded-full px-8 py-3 border border-white/20">
              <LucideIcon name="cpu" className="w-6 h-6 text-gray-300" />
              <LucideIcon name="sparkles" className="w-6 h-6 text-orange-400" />
              <h1 className="text-3xl font-bold text-white">{t('ultra.title')}</h1>
              <LucideIcon name="database" className="w-6 h-6 text-gray-300" />
              <LucideIcon name="layers" className="w-6 h-6 text-gray-300" />
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
              <div
                className={`relative bg-white/5 backdrop-blur-2xl border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-500 cursor-pointer ${
                  dragging ? 'border-orange-400/50 bg-orange-500/5' : 'border-white/20 hover:border-orange-400/50 hover:bg-orange-500/5 hover:shadow-xl hover:shadow-orange-500/10'
                } `}
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={onKey}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <input
                  ref={inputRef}
                  multiple
                  accept=".pdf,.docx"
                  className="sr-only"
                  type="file"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    add(Array.from(e.target.files ?? []));
                    e.target.value = '';
                  }}
                />
                <div className="mb-8">
                  <div className="ultra-anim" style={{ animation: 'ultra-float 3s ease-in-out infinite' }}>
                    <LucideIcon name="upload" className="w-24 h-24 text-gray-400 mx-auto drop-shadow-lg" />
                  </div>
                </div>
                <h3 className="text-white text-2xl font-bold mb-4">{t('ultra.drop.title')}</h3>
                <p className="text-gray-300 text-base mb-6">{t('ultra.drop.hint')}</p>
                <div className="bg-white/5 rounded-full px-8 py-3 inline-block border border-white/20">
                  <span className="text-gray-400 text-xs font-semibold">{t('ultra.drop.limits')}</span>
                </div>
              </div>
              <div className="flex gap-6">
                <button
                  disabled={!hasQueued || running}
                  onClick={start}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-4 font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-orange-500/25"
                  tabIndex={0}
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className="ultra-anim" style={{ animation: 'ultra-float 2s ease-in-out infinite' }}>
                      <LucideIcon name="arrow-up" className="w-6 h-6" />
                    </div>
                    {t('ultra.process')}
                  </div>
                </button>
                <button
                  onClick={clear}
                  className="px-8 py-4 bg-white/10 text-white rounded-2xl font-bold text-base hover:bg-white/20 disabled:opacity-50 transition-all duration-300 backdrop-blur-xl border border-white/20"
                  tabIndex={0}
                >
                  {t('ultra.clear')}
                </button>
              </div>
            </div>
            <div className="space-y-8">
              <div className="bg-white/10 backdrop-blur-2xl rounded-2xl p-8 border border-white/20 shadow-xl">
                <div className="flex items-center gap-3 mb-8">
                  <LucideIcon name="zap" className="w-6 h-6 text-yellow-400" />
                  <h3 className="text-white text-xl font-bold">{t('ultra.status.title')}</h3>
                  <div className="ml-auto flex gap-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full" />
                    <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                    <div className="w-3 h-3 bg-orange-400 rounded-full" />
                  </div>
                </div>
                {rows.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="ultra-anim" style={{ animation: 'ultra-spin 20s linear infinite' }}>
                      <LucideIcon name="file" className="w-20 h-20 text-gray-500 mx-auto mb-6 drop-shadow-lg" />
                    </div>
                    <p className="text-gray-400 text-base">{t('ultra.empty.title')}</p>
                    <p className="text-gray-500 text-xs mt-2">{t('ultra.empty.hint')}</p>
                  </div>
                ) : (
                  <QueueRows rows={rows} dark maxFiles={ULTRA_LIMITS.maxFiles} />
                )}
              </div>
            </div>
          </div>
        </div>
        <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(239, 81, 37, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(239, 81, 37, 0.7);
        }
      `}</style>
        <style>{ANIMATIONS}</style>
      </div>
    </AppLayout>
  );
}
