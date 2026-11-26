import { campaignPickable } from '../../../domain/campaigns';
import { can } from '../../../domain/permissions';
import { HIRING_PRIORITIES, WORKPLACES, type HiringPriority, type Workplace } from '../../../domain/types';
import { useT } from '../../../i18n/i18n';
import { useMe } from '../../../store/session';
import { useStore } from '../../../store/store';
import { EMPLOYMENTS, LEVELS } from '../jobForm';
import type { JobForm } from '../useJobForm';
import { Field, FIELD, GROUP, GROUPS } from './ui';

/** Select value that opens the JD editor instead of picking a JD. */
const NEW_JD = '__new__';

/** Step 1: JD, title and the basics. `onNewJd` opens the JD editor ("+ Create a new JD"). */
export function DetailsStep({ form, onNewJd }: { form: JobForm; onNewJd: () => void }) {
  const t = useT();
  const jds = useStore((s) => s.jds);
  const jobs = useStore((s) => s.jobs);
  const allCampaigns = useStore((s) => s.campaigns);
  const canNewJd = can(useMe(), 'jd.edit');
  const { values: v, set } = form;
  const levels = v.level && !LEVELS.includes(v.level) ? [...LEVELS, v.level] : LEVELS;
  const departments = [...new Set(jobs.map((j) => j.department))];
  const locations = [...new Set(jobs.map((j) => j.location))];
  // Unfinished campaigns, plus the job's current one even if it has finished since.
  const campaigns = allCampaigns.filter((c) => campaignPickable(c) || c.id === v.campaignId);
  return (
    <div className={GROUPS}>
      {/* The role: what the job is (JD + title), then where it sits and how many people. */}
      <div className={GROUP}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field id="job-jd" label={t('jobs.drawer.jd')} error={form.err('jd')}>
            <select id="job-jd" className={FIELD} value={v.jd} onChange={(e) => (e.target.value === NEW_JD ? onNewJd() : form.pickJd(e.target.value))}>
              <option value="">{t('jobs.drawer.jdNone')}</option>
              {jds.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              {canNewJd && <option value={NEW_JD}>{t('jobs.drawer.jdNew')}</option>}
            </select>
          </Field>
          <Field id="job-title" label={t('jobs.drawer.title')} error={form.err('title')}>
            <input id="job-title" className={FIELD} maxLength={120} value={v.title} onChange={(e) => set.title(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <Field id="job-department" label={t('jobs.drawer.department')}>
            <input id="job-department" list="job-departments" className={FIELD} value={v.department} onChange={(e) => set.department(e.target.value)} />
            <datalist id="job-departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
          </Field>
          <Field id="job-level" label={t('jobs.drawer.level')}>
            <select id="job-level" className={FIELD} value={v.level} onChange={(e) => set.level(e.target.value)}>
              <option value=""></option>
              {levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field id="job-headcount" label={t('jobs.drawer.headcount')}>
            <input id="job-headcount" type="number" min={1} className={FIELD} value={v.headcount} onChange={(e) => set.headcount(e.target.value)} />
          </Field>
          <Field id="job-location" label={t('jobs.drawer.location')}>
            <input id="job-location" list="job-locations" className={FIELD} value={v.location} onChange={(e) => set.location(e.target.value)} />
            <datalist id="job-locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
          </Field>
          <Field id="job-workplace" label={t('jobs.drawer.workplace')}>
            <select id="job-workplace" className={FIELD} value={v.workplace} onChange={(e) => set.workplace(e.target.value as Workplace)}>
              {WORKPLACES.map((w) => <option key={w} value={w}>{t(`workplace.${w}`)}</option>)}
            </select>
          </Field>
          <Field id="job-employment" label={t('jobs.drawer.employment')}>
            <select id="job-employment" className={FIELD} value={v.employment} onChange={(e) => set.employment(e.target.value)}>
              {EMPLOYMENTS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
        </div>
      </div>
      {/* Internal planning: how pressing it is, by when, and which campaign it counts toward. */}
      <div className={GROUP}>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 items-start">
          <Field id="job-priority" label={t('jobs.drawer.priority')}>
            <select id="job-priority" className={FIELD} value={v.hiringPriority} onChange={(e) => set.hiringPriority(e.target.value as HiringPriority)}>
              {HIRING_PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
            </select>
          </Field>
          <Field id="job-target-date" label={t('jobs.drawer.targetDate')} error={form.err('targetDate')}>
            <input id="job-target-date" type="date" className={FIELD} value={v.targetHiringDate} onChange={(e) => set.targetHiringDate(e.target.value)} />
          </Field>
          <div className="col-span-2 lg:col-span-1">
            <Field id="job-campaign" label={t('jobs.drawer.campaign')}>
              <select id="job-campaign" className={FIELD} value={v.campaignId} onChange={(e) => set.campaignId(e.target.value)}>
                <option value="">{t('jobs.drawer.campaignNone')}</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          {v.hiringPriority !== 'normal' && (
            <div className="col-span-2 lg:col-span-3">
              <Field id="job-urgency-reason" label={t('jobs.drawer.urgencyReason')}>
                <textarea id="job-urgency-reason" rows={2} maxLength={300} className={FIELD} placeholder={t('jobs.drawer.urgencyReasonHint')}
                  value={v.urgencyReason} onChange={(e) => set.urgencyReason(e.target.value)} />
              </Field>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
