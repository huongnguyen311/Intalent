import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  trigger: (a: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  wrapperClass?: string;
  align?: 'left' | 'right';
};

/**
 * Click-to-open menu. The panel is `fixed` so it is not clipped by the scrolling table / filter bar that hosts it;
 * it closes on outside click, Escape or any scroll.
 */
export function Popover({ trigger, children, wrapperClass, align = 'left' }: Props) {
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const open = pos !== null;
  const close = () => setPos(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    // Scrolling the panel itself (long option lists) must not close it; any other scroll does.
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) return close();
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(
      align === 'right'
        ? { top: r.bottom + 4, right: window.innerWidth - r.right }
        : { top: r.bottom + 4, left: r.left },
    );
  };

  return (
    <div ref={ref} className={wrapperClass}>
      {trigger({ open, toggle })}
      {pos && (
        <div
          role="menu"
          style={pos}
          className={`fixed z-50 min-w-[160px] max-h-72 overflow-y-auto py-1 bg-white dark:bg-dark-surface border border-line dark:border-dark-line rounded-lg shadow-lg`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

const ITEM =
  'w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-ink dark:text-white hover:bg-background-light dark:hover:bg-white/5';

/** `disabled` + `title`: shown greyed out with the reason on hover, so a missing permission is explained, not hidden. */
export function MenuItem({ children, onClick, active, disabled, title }: {
  children: ReactNode; onClick: () => void; active?: boolean; disabled?: boolean; title?: string;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={title}
      className={`${ITEM} ${active ? 'font-bold text-primary' : ''} ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}`}
    >
      {children}
    </button>
  );
}
