import { EDUCATIONS, type Education } from '../../../domain/types';
import { useT } from '../../../i18n/i18n';
import type { JobForm } from '../useJobForm';
import { Field, FIELD, LEGEND } from './ui';

/** Step 2: experience, education, and what the picked JD already asks for. */
export function RequirementsStep({ form }: { form: JobForm }) {
  const t = useT();
  const { values: v, set, selected } = form;
  const fromJd = selected && (selected.skills.length > 0 || (selected.mustHave?.length ?? 0) > 0);
  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <div className="grid grid-cols-2 gap-4">
        <Field id="job-min-years" label={t('jobs.drawer.minYears')}>
          <input id="job-min-years" type="number" min={0} max={40} className={FIELD} value={v.minYears} onChange={(e) => set.minYears(e.target.value)} />
        </Field>
        <Field id="job-education" label={t('jobs.drawer.education')}>
          <select id="job-education" className={FIELD} value={v.education} onChange={(e) => set.education(e.target.value as Education | '')}>
            <option value=""></option>
            {EDUCATIONS.map((x) => <option key={x} value={x}>{t(`education.${x}`)}</option>)}
          </select>
        </Field>
      </div>
      {fromJd && (
        <section aria-label={t('jobs.drawer.fromJd')} className="flex flex-col gap-2 p-4 rounded-lg bg-gray-50 dark:bg-white/5 border border-[#e6dddb] dark:border-[#3a3433]">
          <h4 className={LEGEND}>{t('jobs.drawer.fromJd')} · {selected.title}</h4>
          {selected.skills.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {selected.skills.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 border border-[#e6dddb] dark:border-transparent text-2xs font-bold text-slate-600 dark:text-muted">{s}</span>
              ))}
            </div>
          )}
          {selected.mustHave && selected.mustHave.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-[#181211] dark:text-white flex flex-col gap-0.5">
              {selected.mustHave.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
