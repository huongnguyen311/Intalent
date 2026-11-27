import { assignableUsers } from '../../../domain/users';
import { useT } from '../../../i18n/i18n';
import { me } from '../../../store/session';
import { useStore } from '../../../store/store';
import { recruiterOptions } from '../jobForm';
import type { JobForm } from '../useJobForm';
import { CHECKBOX, Field, FIELD, LEGEND } from './ui';

/** Hiring team section: manager, recruiter(s) and interviewers. Internal only, never on the careers page. */
export function TeamStep({ form }: { form: JobForm }) {
  const t = useT();
  const users = useStore((s) => s.users);
  const { values: v, set, recruiters, keepsMe } = form;
  // Interviewers only sit on panels; Hiring Managers come first since they usually own the job.
  const managerOptions = assignableUsers(users)
    .filter((u) => u.role !== 'Interviewer' || u.id === v.manager)
    .sort((a, b) => Number(b.role === 'Hiring Manager') - Number(a.role === 'Hiring Manager'));
  return (
    <div className="flex flex-col gap-6">
      <div className="lg:w-1/2">
      <Field id="job-manager" label={t('jobs.drawer.manager')}>
        <select id="job-manager" className={FIELD} value={v.manager} onChange={(e) => set.manager(e.target.value)}>
          {managerOptions.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
        </select>
        {keepsMe && <p className="text-xs text-ink-muted mt-1">{t('jobs.drawer.keepsMe')}</p>}
      </Field>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 items-start">
      <fieldset className="flex flex-col gap-2">
        <legend className={LEGEND}>{t('jobs.drawer.recruiters')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {recruiterOptions(users, recruiters).map((u, i) => (
            <label key={u.id} className="flex items-center gap-2 text-sm text-ink dark:text-white cursor-pointer">
              <input
                type="checkbox"
                id={i === 0 ? 'job-recruiters' : undefined}
                // The creator stays on as recruiter when someone else manages the job (see keepsMe).
                checked={recruiters.includes(u.id)}
                disabled={keepsMe && u.id === me()}
                onChange={() => form.toggleRecruiter(u.id)}
                className={CHECKBOX}
              />
              {u.name}
            </label>
          ))}
        </div>
        {form.err('recruiters') && <p className="text-xs text-red-600">{form.err('recruiters')}</p>}
        {form.editing && recruiters.length === 0 && (
          <p className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">info</span>{t('jobs.drawer.noRecruiter')}
          </p>
        )}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className={LEGEND}>{t('jobs.drawer.interviewers')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {assignableUsers(users).map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm text-ink dark:text-white cursor-pointer">
              <input type="checkbox" checked={v.interviewers.includes(u.id)} onChange={() => form.toggleInterviewer(u.id)} className={CHECKBOX} />
              {u.name}
            </label>
          ))}
        </div>
      </fieldset>
      </div>
    </div>
  );
}
