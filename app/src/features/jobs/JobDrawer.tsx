import { useEffect, useState, type ReactNode } from 'react';
import { Drawer } from '../../components/Drawer';
import { toast } from '../../components/Toast';
import { stageLabel } from '../../domain/stages';
import type { Job } from '../../domain/types';
import { assignableUsers, CURRENT_USER_ID } from '../../domain/users';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { DEFAULT_SLA, EMPLOYMENTS, inferLevel, LEVELS, SLA_STAGES } from './jobForm';

const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';
const BTN_PRIMARY = 'px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors';
const BTN_GHOST =
  'px-4 py-2 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white rounded-lg hover:border-primary/50 transition-colors';

const slaText = (v: Job['stageSla']): Record<string, string> =>
  Object.fromEntries(SLA_STAGES.map((s) => [s, String(v[s] ?? '')]));

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-[#896a61]">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

type Props = { open: boolean; jdId?: string; job?: Job; onClose: () => void; onSaved?: (job: Job) => void };

/** Create a job (optionally prefilled from a JD) or edit one, in a slide-over. */
export function JobDrawer({ open, jdId, job, onClose, onSaved }: Props) {
  const t = useT();
  const [lang] = useLang();
  const jds = useStore((s) => s.jds);
  const jobs = useStore((s) => s.jobs);
  const users = useStore((s) => s.users);
  const [jd, setJd] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [level, setLevel] = useState('');
  const [employment, setEmployment] = useState(EMPLOYMENTS[0]);
  const [manager, setManager] = useState(CURRENT_USER_ID);
  const [sla, setSla] = useState<Record<string, string>>(slaText(DEFAULT_SLA));
  const [jdError, setJdError] = useState('');
  const [slaErrors, setSlaErrors] = useState<Record<string, string>>({});
  const [publish, setPublish] = useState(false);
  const [error, setError] = useState('');

  const pickJd = (id: string) => {
    setJd(id);
    const picked = jds.find((j) => j.id === id);
    if (!picked) return;
    setTitle(picked.title);
    setLevel(inferLevel(picked.title));
    setError('');
    setJdError('');
  };

  useEffect(() => {
    if (!open) return;
    setError('');
    setJdError('');
    setSlaErrors({});
    if (job) {
      setJd(job.jdId); setTitle(job.title); setDepartment(job.department); setLocation(job.location);
      setLevel(job.level); setEmployment(job.employment); setManager(job.hiringManager);
      setSla(slaText({ ...DEFAULT_SLA, ...job.stageSla })); setPublish(job.status === 'open');
      return;
    }
    setJd(''); setTitle(''); setDepartment(''); setLocation(''); setLevel('');
    setEmployment(EMPLOYMENTS[0]); setManager(CURRENT_USER_ID); setSla(slaText(DEFAULT_SLA)); setPublish(false);
    if (jdId) pickJd(jdId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jdId, job]);

  const selected = jds.find((j) => j.id === jd);
  const levels = level && !LEVELS.includes(level) ? [...LEVELS, level] : LEVELS;
  const departments = [...new Set(jobs.map((j) => j.department))];
  const locations = [...new Set(jobs.map((j) => j.location))];

  const save = () => {
    const errs = Object.fromEntries(
      SLA_STAGES.filter((s) => !/^[1-9]\d*$/.test(sla[s].trim())).map((s) => [s, t('jobs.drawer.err.sla')]),
    );
    setJdError(jd ? '' : t('jobs.drawer.err.jd'));
    setError(title.trim() ? '' : t('jobs.drawer.err.title'));
    setSlaErrors(errs);
    if (!jd || !title.trim() || Object.keys(errs).length > 0) return;
    const stageSla = Object.fromEntries(SLA_STAGES.map((s) => [s, Number(sla[s])])) as Job['stageSla'];
    const fields = { jdId: jd, title, department, location, level, employment, hiringManager: manager, stageSla };
    const { createJob, updateJob, setJobStatus } = useStore.getState();
    const status: Job['status'] = publish ? 'open' : job?.status === 'open' ? 'draft' : (job?.status ?? 'draft');
    if (job) {
      updateJob(job.id, fields);
      if (status !== job.status) setJobStatus(job.id, status);
      toast(t('jobs.toast.saved'));
      onSaved?.({ ...job, ...fields, status });
    } else {
      const created = createJob({ ...fields, status });
      toast(t('jobs.toast.created', { title: created.title }));
      onSaved?.(created);
    }
    onClose();
  };

  return (
    <Drawer open={open} title={t(job ? 'jobs.drawer.edit' : 'jobs.drawer.create')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field id="job-jd" label={t('jobs.drawer.jd')} error={jdError}>
          <select id="job-jd" className={FIELD} value={jd} onChange={(e) => pickJd(e.target.value)}>
            <option value="">{t('jobs.drawer.jdNone')}</option>
            {jds.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </Field>
        {selected && selected.skills.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[#896a61]">{t('jobs.drawer.stack')}</span>
            <div className="flex gap-1.5 flex-wrap">
              {selected.skills.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-[10px] font-bold text-slate-600 dark:text-gray-400">{s}</span>
              ))}
            </div>
          </div>
        )}
        <Field id="job-title" label={t('jobs.drawer.title')} error={error}>
          <input id="job-title" className={FIELD} value={title} onChange={(e) => { setTitle(e.target.value); setError(''); }} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="job-department" label={t('jobs.drawer.department')}>
            <input id="job-department" list="job-departments" className={FIELD} value={department} onChange={(e) => setDepartment(e.target.value)} />
            <datalist id="job-departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
          </Field>
          <Field id="job-location" label={t('jobs.drawer.location')}>
            <input id="job-location" list="job-locations" className={FIELD} value={location} onChange={(e) => setLocation(e.target.value)} />
            <datalist id="job-locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
          </Field>
          <Field id="job-level" label={t('jobs.drawer.level')}>
            <select id="job-level" className={FIELD} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value=""></option>
              {levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field id="job-employment" label={t('jobs.drawer.employment')}>
            <select id="job-employment" className={FIELD} value={employment} onChange={(e) => setEmployment(e.target.value)}>
              {EMPLOYMENTS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
        </div>
        <Field id="job-manager" label={t('jobs.drawer.manager')}>
          <select id="job-manager" className={FIELD} value={manager} onChange={(e) => setManager(e.target.value)}>
            {assignableUsers(users).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold text-[#896a61] mb-1">{t('jobs.drawer.sla')}</legend>
          <div className="grid grid-cols-4 gap-3">
            {SLA_STAGES.map((s) => (
              <Field key={s} id={`job-sla-${s}`} label={stageLabel(s, lang)} error={slaErrors[s]}>
                <input
                  id={`job-sla-${s}`} type="number" min={1} step={1} className={FIELD} value={sla[s]}
                  onChange={(e) => { setSla({ ...sla, [s]: e.target.value }); setSlaErrors({ ...slaErrors, [s]: '' }); }}
                />
              </Field>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm text-[#181211] dark:text-white">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary" />
          {t('jobs.drawer.publish')}
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={BTN_GHOST}>{t('common.cancel')}</button>
          <button type="button" onClick={save} className={BTN_PRIMARY}>{t('jobs.drawer.save')}</button>
        </div>
      </div>
    </Drawer>
  );
}
