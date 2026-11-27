import type { ReactNode } from 'react';
import { useT } from '../../../i18n/i18n';
import type { JobForm } from '../useJobForm';
import { BTN_GHOST, BTN_PRIMARY, FIELD } from '../../../components/ui';
export { BTN_GHOST, BTN_PRIMARY, FIELD };

export const LEGEND = 'text-xs font-semibold text-ink-muted mb-1';
export const CHECKBOX = 'rounded border-gray-300 text-primary focus:ring-primary';

/** A section body made of field groups, with a divider between groups. */
export const GROUPS = 'flex flex-col divide-y divide-hairline dark:divide-dark-raised';
/** One block of related fields inside GROUPS. */
export const GROUP = 'flex flex-col gap-4 py-6 first:pt-0 last:pb-0';
export const SUBHEADING = 'text-sm font-bold text-ink dark:text-white';

/**
 * Visible title row for a fieldset group: title + optional hint on the left, an action on the right.
 * Pair it with a `sr-only` legend; the title here is hidden from screen readers so it is not read twice.
 */
export function GroupHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span aria-hidden="true" className={SUBHEADING}>{title}</span>
        {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** `hint` renders under the control as `${id}-hint`; point the control's aria-describedby at it. */
export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-ink-muted">{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="text-xs text-ink-muted">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

type PostText = 'summary' | 'responsibilities' | 'mustHave' | 'niceToHave' | 'aboutTeam';

/** Textarea bound to one job-post text field; `perLine` hints that each line becomes a bullet. */
export function PostArea({ form, id, label, field, rows, perLine }: { form: JobForm; id: string; label: string; field: PostText; rows: number; perLine?: boolean }) {
  const t = useT();
  return (
    <Field id={id} label={label}>
      <textarea id={id} rows={rows} className={FIELD} value={form.values[field]} onChange={(e) => form.set[field](e.target.value)}
        placeholder={perLine ? t('jobs.post.perLine') : undefined} />
    </Field>
  );
}
