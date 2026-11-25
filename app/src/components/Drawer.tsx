import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n/i18n';
import { useDialog } from './useDialog';

type Props = {
  open: boolean;
  title: string;
  /** Line under the title (e.g. the job an application is for). */
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Forms: ask before the backdrop or Escape throws away edits (the X button always closes). Closing after a save (parent calls onClose) never asks. */
  guardUnsaved?: boolean;
  /** `side` (default): right-hand slide-over that keeps the page visible. `center`: wide dialog in the middle of the screen, for focused forms. */
  variant?: 'side' | 'center';
  /** Fixed area under the title bar (e.g. a stepper); does not scroll with the body. */
  subheader?: ReactNode;
  /** Fixed area under the body (e.g. form buttons); does not scroll with the body. */
  footer?: ReactNode;
  /** Edits the form makes without a DOM change event (adding a row, an AI draft...) — counted like typed changes. */
  dirty?: boolean;
};

/** Right-hand slide-over or centred dialog (`animate-slide-left` / `animate-pop-in` come from supplement.css). */
export function Drawer({ open, title, subtitle, onClose, children, guardUnsaved, variant = 'side', subheader, footer, dirty: dirtyProp }: Props) {
  const center = variant === 'center';
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    setDirty(false);
    setAsking(false);
  }, [open]);
  const requestClose = () => (guardUnsaved && (dirty || dirtyProp) ? setAsking(true) : onClose());
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
        // Any input in the body, subheader or footer counts as an unsaved edit.
        onChange={() => guardUnsaved && setDirty(true)}
      >
        <div className="min-h-16 py-3 px-6 border-b border-[#e6dddb] dark:border-[#2a2423] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-[#181211] dark:text-white truncate">{title}</h3>
            {subtitle && <div className="mt-0.5 text-sm text-[#896a61] min-w-0">{subtitle}</div>}
          </div>
          {/* X is a deliberate close: never second-guess it. Only the backdrop and Escape (easy to hit by accident) ask. */}
          <button aria-label="Close" onClick={onClose} className="text-[#896a61] hover:text-[#181211] dark:hover:text-white">
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
        {subheader && <div className="shrink-0 px-6 pt-4 pb-3 border-b border-[#e6dddb] dark:border-[#2a2423]">{subheader}</div>}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">{children}</div>
        {footer && <div className="shrink-0 px-6 py-4 border-t border-[#e6dddb] dark:border-[#2a2423]">{footer}</div>}
      </aside>
    </div>
  );
}
