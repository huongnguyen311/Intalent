import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

export type ToastType = 'success' | 'error' | 'info';

/** Sonner renders the `data-sonner-*` markup styled by the CSS in index.html. */
export function toast(message: string, type: ToastType = 'success') {
  if (type === 'info') return sonnerToast(message);
  return sonnerToast[type](message);
}

export function Toaster() {
  return <SonnerToaster />;
}
