import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n/i18n';
import { useDialog } from './useDialog';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Forms: ask before the backdrop, Close or Escape throws away edits. Closing after a save (parent calls onClose) never asks. */
  guardUnsaved?: boolean;
  /** `side` (default): right-hand slide-over that keeps the page visible. `center`: wide dialog in the middle of the screen, for focused forms. */
  variant?: 'side' | 'center';
};

/** Right-hand slide-over or centred dialog (`animate-slide-left` / `animate-pop-in` come from supplement.css). */
export function Drawer({ open, title, onClose, children, guardUnsaved, variant = 'side' }: Props) {
  const center = variant === 'center';
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    setDirty(false);
    setAsking(false);
  }, [open]);
  const requestClose = () => (guardUnsaved && dirty ? setAsking(true) : onClose());
  useDialog(open, ref, () => (asking ? setAsking(false) : requestClose()), !!guardUnsaved);
  if (!open) return null;
  return (
    <div className={`fixed inset-0 z-[60] flex bg-black/50 ${center ? 'items-center justify-center p-4 sm:p-8' : 'justify-end'}`} onClick={requestClose}>
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`outline-none w-full bg-white dark:bg-[#1e1e1e] shadow-2xl flex flex-col ${
          center
            ? 'max-w-3xl max-h-[min(90vh,960px)] rounded-xl border border-[#e6dddb] dark:border-[#2a2423] overflow-hidden animate-pop-in'
            : 'max-w-xl h-full animate-slide-left'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-16 px-6 border-b border-[#e6dddb] dark:border-[#2a2423] flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-[#181211] dark:text-white">{title}</h3>
          <button aria-label="Close" onClick={requestClose} className="text-[#896a61] hover:text-[#181211] dark:hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {asking && (
          <div role="alertdialog" aria-label={t('drawer.discard.title')} className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-3 text-sm">
            <span className="flex-1 font-semibold text-amber-900 dark:text-amber-100">{t('drawer.discard.title')}</span>
            <button onClick={() => setAsking(false)} className="px-3 py-1.5 rounded-full border border-[#e6dddb] bg-white dark:bg-transparent font-bold">{t('drawer.discard.keep')}</button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-full bg-red-600 text-white font-bold">{t('drawer.discard.confirm')}</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6" onChange={() => guardUnsaved && setDirty(true)}>{children}</div>
      </aside>
    </div>
  );
}
