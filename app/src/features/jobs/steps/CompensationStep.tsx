import { CURRENCIES, type Currency } from '../../../domain/types';
import { useT } from '../../../i18n/i18n';
import type { JobForm } from '../useJobForm';
import { CHECKBOX, Field, FIELD, LEGEND } from './ui';

/** Compensation section: salary range and whether candidates see it. */
export function CompensationStep({ form }: { form: JobForm }) {
  const t = useT();
  const { values: v, set } = form;
  return (
    <div className="lg:w-2/3">
        <fieldset className="flex flex-col gap-3">
          <legend className={`${LEGEND} !mb-3`}>{t('jobs.drawer.salary')}</legend>
          <div className="grid grid-cols-[1fr_1fr_120px] gap-4">
            <Field id="job-salary-min" label={t('jobs.drawer.salaryMin')}>
              <input id="job-salary-min" inputMode="numeric" className={FIELD} value={v.salaryMin} onChange={(e) => set.salaryMin(e.target.value)} />
            </Field>
            <Field id="job-salary-max" label={t('jobs.drawer.salaryMax')}>
              <input id="job-salary-max" inputMode="numeric" className={FIELD} value={v.salaryMax} onChange={(e) => set.salaryMax(e.target.value)} />
            </Field>
            <Field id="job-currency" label={t('offer.currency')}>
              <select id="job-currency" className={FIELD} value={v.currency} onChange={(e) => set.currency(e.target.value as Currency)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          {form.err('salary') && <p className="text-xs text-red-600">{form.err('salary')}</p>}
          <label className="flex items-center gap-2 text-sm text-[#181211] dark:text-white">
            <input type="checkbox" checked={v.showSalary} onChange={(e) => set.showSalary(e.target.checked)} className={CHECKBOX} />
            {t('jobs.drawer.showSalary')}
          </label>
        </fieldset>
    </div>
  );
}
