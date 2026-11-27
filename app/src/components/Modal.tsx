import { useRef, type ReactNode } from 'react';
import { useDialog } from './useDialog';

/** `wide` for forms with a few sections; `xl` for long working dialogs such as a scorecard. `focusField={false}` opens on the dialog itself, not its first input. */
type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; xl?: boolean; focusField?: boolean };

export function Modal({ open, title, onClose, children, footer, wide, xl, focusField = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Escape closes (same as the close button); focus stays inside and goes back to whatever opened the dialog.
  useDialog(open, ref, onClose, focusField);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`outline-none w-full ${xl ? 'max-w-4xl' : wide ? 'max-w-2xl' : 'max-w-md'} bg-white dark:bg-dark-surface rounded-xl shadow-2xl border border-line dark:border-dark-raised`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-line dark:border-dark-raised flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink dark:text-white">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="text-ink-muted hover:text-ink dark:hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={`px-6 py-4 text-sm text-ink dark:text-[#e6dddb]${xl ? ' max-h-[80vh] overflow-y-auto custom-scrollbar' : wide ? ' max-h-[70vh] overflow-y-auto custom-scrollbar' : ''}`}>{children}</div>
        {footer && <div className="px-6 py-4 border-t border-line dark:border-dark-raised flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
