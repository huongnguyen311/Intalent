import type { ReactNode } from 'react';

type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode };

/** Right-hand slide-over (`animate-slide-left` comes from app.css / the page styles). */
export function Drawer({ open, title, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/50" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-xl h-full bg-white dark:bg-[#1e1e1e] shadow-2xl animate-slide-left flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-16 px-6 border-b border-[#e6dddb] dark:border-[#2a2423] flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-[#181211] dark:text-white">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="text-[#896a61] hover:text-[#181211] dark:hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">{children}</div>
      </aside>
    </div>
  );
}
