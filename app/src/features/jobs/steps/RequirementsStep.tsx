import { TagField } from '../../../components/TagField';
import { EDUCATIONS, type Education } from '../../../domain/types';
import { useT } from '../../../i18n/i18n';
import { useStore } from '../../../store/store';
import type { JobForm } from '../useJobForm';
import { Field, FIELD, PostArea } from './ui';

/** Requirements section: experience and education, then the skills and must-have / nice-to-have lists shown on the post. */
export function RequirementsStep({ form }: { form: JobForm }) {
  const t = useT();
  const { values: v, set } = form;
  const jds = useStore((s) => s.jds);
  const skillOptions = [...new Set(jds.flatMap((j) => j.skills))].sort((a, b) => a.localeCompare(b));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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
      <TagField id="job-skills" label={t('jobs.post.skills')} placeholder={t('jobs.post.skillsPlaceholder')} values={v.skills} onChange={set.skills} options={skillOptions}
        labelClass="text-xs font-semibold text-[#896a61]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <PostArea form={form} id="job-must-have" label={t('jobs.post.mustHave')} field="mustHave" rows={5} perLine />
        <PostArea form={form} id="job-nice-to-have" label={t('jobs.post.niceToHave')} field="niceToHave" rows={5} perLine />
      </div>
    </div>
  );
}
