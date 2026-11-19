import { useRef, type ReactNode } from 'react';
import { useDialog } from './useDialog';

type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean };

export function Modal({ open, title, onClose, children, footer, wide }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Escape closes (same as the close button); focus stays inside and goes back to whatever opened the dialog.
  useDialog(open, ref, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`outline-none w-full ${wide ? 'max-w-2xl' : 'max-w-md'} bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-[#e6dddb] dark:border-[#2a2423]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#e6dddb] dark:border-[#2a2423] flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#181211] dark:text-white">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="text-[#896a61] hover:text-[#181211] dark:hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={`px-6 py-4 text-sm text-[#181211] dark:text-[#e6dddb]${wide ? ' max-h-[70vh] overflow-y-auto custom-scrollbar' : ''}`}>{children}</div>
        {footer && <div className="px-6 py-4 border-t border-[#e6dddb] dark:border-[#2a2423] flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
