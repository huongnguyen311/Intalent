import { useEffect, useRef, type RefObject } from 'react';

/** Open dialogs; only the top one reacts to Escape and Tab. */
const stack: { id: symbol; el: () => HTMLElement | null }[] = [];

/**
 * The top dialog: the latest one that holds no other open dialog. A modal rendered inside a drawer registers first
 * (child effects run first), so nesting, not order, decides.
 */
function topId(): symbol | undefined {
  const leaves = stack.filter((a) => !stack.some((b) => b !== a && a.el()?.contains(b.el() ?? null)));
  return leaves[leaves.length - 1]?.id;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared dialog keyboard behaviour (Drawer and Modal): focus moves inside on open, Tab cycles inside,
 * Escape asks the top dialog to close, and focus returns to whatever opened it.
 */
export function useDialog(open: boolean, ref: RefObject<HTMLElement>, onEscape: () => void, focusField = true): void {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;
  useEffect(() => {
    if (!open) return;
    const id = Symbol('dialog');
    stack.push({ id, el: () => ref.current });
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    // Forms start on their first field; read-only panels (whose first field may sit far below) start on the panel itself.
    const field = focusField ? ref.current?.querySelector<HTMLElement>('input:not([disabled]), select, textarea') : null;
    (field ?? ref.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (topId() !== id) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        escapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) return;
      const i = list.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : i === -1 || i === list.length - 1 ? 0 : i + 1;
      e.preventDefault();
      list[next].focus();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const at = stack.findIndex((x) => x.id === id);
      if (at >= 0) stack.splice(at, 1);
      if (opener?.isConnected) opener.focus();
    };
  }, [open, ref, focusField]);
}
