import { useEffect, useRef, type ReactNode } from 'react';

type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode };

export function Modal({ open, title, onClose, children, footer }: Props) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Escape closes (same as the close button); focus goes back to whatever opened the dialog.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-[#e6dddb] dark:border-[#2a2423]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#e6dddb] dark:border-[#2a2423] flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#181211] dark:text-white">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="text-[#896a61] hover:text-[#181211] dark:hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-6 py-4 text-sm text-[#181211] dark:text-[#e6dddb]">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-[#e6dddb] dark:border-[#2a2423] flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
