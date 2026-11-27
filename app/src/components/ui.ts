/**
 * Shared control styles for admin screens. Use these instead of re-declaring button/field class strings per page.
 *
 *   BTN_PRIMARY  main action of a form, dialog or toolbar (one per area)
 *   BTN_GHOST    secondary action next to a primary one (Cancel, Back, Preview)
 *   BTN_SMALL    compact pill action inside cards and rows
 *   FIELD        text input, select and textarea in forms and dialogs
 */
const DISABLED = 'disabled:opacity-50 disabled:cursor-not-allowed';

export const BTN_PRIMARY = `px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors ${DISABLED}`;

export const BTN_GHOST = `px-4 py-2 text-sm font-medium border border-line dark:border-dark-line text-ink dark:text-white rounded-lg hover:border-primary/50 transition-colors ${DISABLED}`;

export const BTN_SMALL = `px-3 py-1.5 text-xs font-bold border border-line dark:border-dark-line rounded-full hover:border-primary/50 hover:text-primary transition-colors flex items-center gap-1 ${DISABLED}`;

export const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-dark-surface border border-line dark:border-dark-line rounded-lg text-sm text-ink dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';
