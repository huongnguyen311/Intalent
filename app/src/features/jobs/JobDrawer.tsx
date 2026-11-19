import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AiTextField } from '../../components/AiTextField';
import { Drawer } from '../../components/Drawer';
import { toast } from '../../components/Toast';
import { stageLabel } from '../../domain/stages';
import { CURRENCIES, EDUCATIONS, WORKPLACES, type Currency, type Education, type Job, type JobQuestion, type JobTemplateFields, type Workplace } from '../../domain/types';
import { assignableUsers, userName } from '../../domain/users';
import { CONTENT_TEMPLATE, draftAdditionalInfo } from '../../domain/jdWriter';
import { can, seesAllJobs } from '../../domain/permissions';
import { useLang, useT } from '../../i18n/i18n';
import { JdEditor } from '../jds/JdEditor';
import { me, useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { DEFAULT_SLA, EMPLOYMENTS, inferLevel, LEVELS, SLA_STAGES } from './jobForm';

const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';
const BTN_PRIMARY = 'px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors';
const BTN_GHOST =
  'px-4 py-2 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white rounded-lg hover:border-primary/50 transition-colors';

/** Select value that opens the JD editor instead of picking a JD. */
const NEW_JD = '__new__';

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

/** `job` edits it; `copyFrom` opens a new draft prefilled from another job (Duplicate). */
type Props = { open: boolean; jdId?: string; job?: Job; copyFrom?: Job; onClose: () => void; onSaved?: (job: Job) => void };

/** Create a job (optionally prefilled from a JD) or edit one, in a slide-over. */
export function JobDrawer({ open, jdId, job, copyFrom, onClose, onSaved }: Props) {
  const t = useT();
  const [lang] = useLang();
  const jds = useStore((s) => s.jds);
  const jobs = useStore((s) => s.jobs);
  const users = useStore((s) => s.users);
  const user = useMe();
  const canNewJd = can(user, 'jd.edit');
  const canApprove = can(user, 'job.approve');
  const templates = useStore((s) => s.jobTemplates ?? []);
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState('');
  const [minYears, setMinYears] = useState('');
  const [education, setEducation] = useState<Education | ''>('');
  const [jdEditorOpen, setJdEditorOpen] = useState(false);
  const [jd, setJd] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [level, setLevel] = useState('');
  const [employment, setEmployment] = useState(EMPLOYMENTS[0]);
  const [workplace, setWorkplace] = useState<Workplace>('onsite');
  const [headcount, setHeadcount] = useState('1');
  const [manager, setManager] = useState(me());
  const [sla, setSla] = useState<Record<string, string>>(slaText(DEFAULT_SLA));
  const [jdError, setJdError] = useState('');
  const [slaErrors, setSlaErrors] = useState<Record<string, string>>({});
  const [publish, setPublish] = useState(false);
  const [error, setError] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [currency, setCurrency] = useState<Currency>('VND');
  const [showSalary, setShowSalary] = useState(false);
  const [salaryError, setSalaryError] = useState('');
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [questions, setQuestions] = useState<JobQuestion[]>([]);
  const [whyLove, setWhyLove] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const template = (id: string) => useStore.getState().prompts.find((p) => p.id === id)?.text ?? '';
  /** Title the last picked JD filled in, so picking another JD only replaces a title the user did not type. */
  const jdTitle = useRef('');
  // A Recruiter only sees jobs they manage or collaborate on: naming someone else as manager keeps them on as collaborator.
  const keepsMe = !seesAllJobs(user) && manager !== me();

  const pickJd = (id: string) => {
    if (id === NEW_JD) return setJdEditorOpen(true);
    setJd(id);
    // Read the store directly: a JD created a moment ago is not in this render's `jds` yet.
    const picked = useStore.getState().jds.find((j) => j.id === id);
    if (!picked) return;
    // Only replace a title the user has not typed themselves (blank, or the previous JD's title).
    const prev = jdTitle.current;
    setTitle((cur) => (!cur.trim() || cur === prev ? picked.title : cur));
    setLevel((cur) => cur || inferLevel(picked.title));
    jdTitle.current = picked.title;
    setError('');
    setJdError('');
  };

  /** Loads a job, a duplicate source or a template into the form (missing fields keep their blank defaults). */
  const fill = (src: Partial<JobTemplateFields> & { title?: string; jdId?: string }) => {
    jdTitle.current = '';
    setJd(src.jdId ?? ''); setTitle(src.title ?? ''); setDepartment(src.department ?? ''); setLocation(src.location ?? '');
    setLevel(src.level ?? ''); setEmployment(src.employment ?? EMPLOYMENTS[0]); setManager(src.hiringManager ?? me());
    setWorkplace(src.workplace ?? 'onsite'); setHeadcount(String(src.headcount ?? 1));
    setSla(slaText({ ...DEFAULT_SLA, ...src.stageSla }));
    setSalaryMin(src.salaryMin ? String(src.salaryMin) : ''); setSalaryMax(src.salaryMax ? String(src.salaryMax) : '');
    setCurrency(src.currency ?? 'VND'); setShowSalary(!!src.showSalary); setSalaryError('');
    setCollaborators(src.collaborators ?? []);
    // Fresh ids so a duplicate's answers never collide with the source job's.
    setQuestions((src.questions ?? []).map((q) => (job ? q : { ...q, id: `q-${crypto.randomUUID().slice(0, 8)}` })));
    // New jobs start from the company's default perks; additional info is drafted on demand.
    setWhyLove(src.whyLove ?? (job ? '' : template(CONTENT_TEMPLATE.whyLove))); setAdditionalInfo(src.additionalInfo ?? '');
    setMinYears(src.minYears ? String(src.minYears) : ''); setEducation(src.education ?? '');
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((x) => x.id === id);
    const keep = { jdId: jd, title };
    fill(tpl ? { ...keep, ...tpl.fields, ...(tpl.fields.jdId ? {} : { jdId: jd }), ...(tpl.fields.title ? {} : { title }) } : keep);
  };

  useEffect(() => {
    if (!open) return;
    setError('');
    setJdError('');
    setSlaErrors({});
    setTemplateId(''); setTemplateName(null); setTemplateError('');
    if (job) {
      fill(job);
      setPublish(job.status === 'open' || job.status === 'pending_approval');
      return;
    }
    setPublish(false);
    if (copyFrom) {
      fill({ ...copyFrom, title: `${copyFrom.title} ${t('jobs.drawer.copySuffix')}` });
      return;
    }
    fill({});
    if (jdId) pickJd(jdId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jdId, job, copyFrom]);

  const selected = jds.find((j) => j.id === jd);
  const approvalFree = canApprove || job?.status === 'open' || job?.status === 'on_hold' || job?.status === 'closed';
  const rejected = job?.status === 'draft' ? job.approval?.rejectedReason : undefined;
  const levels = level && !LEVELS.includes(level) ? [...LEVELS, level] : LEVELS;
  // Interviewers only sit on panels; Hiring Managers come first since they usually own the job.
  const managerOptions = assignableUsers(users)
    .filter((u) => u.role !== 'Interviewer' || u.id === manager)
    .sort((a, b) => Number(b.role === 'Hiring Manager') - Number(a.role === 'Hiring Manager'));
  const departments = [...new Set(jobs.map((j) => j.department))];
  const locations = [...new Set(jobs.map((j) => j.location))];

  /** Everything the form holds except identity/status; shared by Save and Save as template. */
  const collect = () => {
    const num = (v: string) => Number(v.replace(/[^\d]/g, '')) || undefined;
    const stageSla = Object.fromEntries(SLA_STAGES.map((s) => [s, Number(sla[s]) || DEFAULT_SLA[s]])) as Job['stageSla'];
    const lo = num(salaryMin);
    const hi = num(salaryMax);
    return {
      jdId: jd, title, department, location, level, employment, workplace, headcount: Math.max(1, Math.floor(Number(headcount)) || 1), hiringManager: manager, stageSla,
      salaryMin: lo, salaryMax: hi, currency, showSalary: showSalary && !!(lo || hi),
      collaborators: [...new Set([...collaborators, ...(keepsMe ? [me()] : [])])].filter((c) => c !== manager),
      questions: questions.filter((q) => q.label.trim()).map((q) => ({ ...q, label: q.label.trim() })),
      whyLove: whyLove.trim(), additionalInfo: additionalInfo.trim(),
      minYears: num(minYears), education: education || undefined,
    };
  };

  const saveTemplate = () => {
    const name = (templateName ?? '').trim();
    if (!name) return setTemplateError(t('jobs.drawer.templateNameRequired'));
    // A template is reusable across titles/JDs, so neither is stored.
    const { jdId: _jd, title: _title, ...fields } = collect();
    useStore.getState().saveJobTemplate(name, fields);
    toast(t('jobs.toast.templateSaved', { name }));
    setTemplateName(null);
  };

  const save = () => {
    const errs = Object.fromEntries(
      SLA_STAGES.filter((s) => !/^[1-9]\d*$/.test(sla[s].trim())).map((s) => [s, t('jobs.drawer.err.sla')]),
    );
    setJdError(jd ? '' : t('jobs.drawer.err.jd'));
    setError(title.trim() ? '' : t('jobs.drawer.err.title'));
    setSlaErrors(errs);
    const num = (v: string) => Number(v.replace(/[^\d]/g, '')) || undefined;
    const lo = num(salaryMin);
    const hi = num(salaryMax);
    const badSalary = !!lo && !!hi && lo > hi;
    setSalaryError(badSalary ? t('jobs.drawer.err.salary') : '');
    const cleanQuestions = questions.filter((q) => q.label.trim()).map((q) => ({ ...q, label: q.label.trim() }));
    if (!jd || !title.trim() || Object.keys(errs).length > 0 || badSalary) {
      // The form is long: bring the first problem into view instead of failing silently off-screen.
      const first = !jd ? 'job-jd' : !title.trim() ? 'job-title' : badSalary ? 'job-salary-min' : `job-sla-${Object.keys(errs)[0]}`;
      requestAnimationFrame(() => {
        const el = document.getElementById(first);
        el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        el?.focus({ preventScroll: true });
      });
      return;
    }
    const fields = { ...collect(), questions: cleanQuestions };
    const { createJob, updateJob, setJobStatus, requestJobApproval } = useStore.getState();
    const status: Job['status'] = publish
      ? (job?.status === 'open' || job?.status === 'pending_approval' ? job.status : approvalFree ? 'open' : 'pending_approval')
      : job?.status === 'open' || job?.status === 'pending_approval' ? 'draft' : (job?.status ?? 'draft');
    if (job) {
      updateJob(job.id, fields);
      if (status === 'pending_approval' && job.status === 'draft') requestJobApproval(job.id);
      else if (status !== job.status) setJobStatus(job.id, status);
      toast(t('jobs.toast.saved'));
      onSaved?.({ ...job, ...fields, status });
    } else {
      const created = createJob({ ...fields, status });
      // A draft is not on the careers site yet: say what publishes it.
      toast(t(status === 'draft' ? 'jobs.toast.createdDraft' : 'jobs.toast.created', { title: created.title }));
      onSaved?.(created);
    }
    onClose();
  };

  return (
    <>
      <Drawer open={open} title={t(job ? 'jobs.drawer.edit' : copyFrom ? 'jobs.drawer.duplicate' : 'jobs.drawer.create')} onClose={onClose} guardUnsaved variant="center">
        <div className="flex flex-col gap-4">
          {rejected && job?.approval?.decidedBy && (
            <div role="alert" className="flex gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              <span className="material-symbols-outlined text-[18px]">undo</span>
              {t('jobs.approval.rejected', { name: userName(users, job.approval.decidedBy), reason: rejected })}
            </div>
          )}
          {!job && templates.length > 0 && (
            <Field id="job-template" label={t('jobs.drawer.template')}>
              <div className="flex gap-2">
                <select id="job-template" className={FIELD} value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">{t('jobs.drawer.templateNone')}</option>
                  {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                {templateId && (
                  <button
                    type="button"
                    aria-label={t('jobs.drawer.templateDelete')}
                    title={t('jobs.drawer.templateDelete')}
                    onClick={() => { useStore.getState().deleteJobTemplate(templateId); setTemplateId(''); toast(t('jobs.toast.templateDeleted')); }}
                    className="px-2 text-[#896a61] hover:text-red-500"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
              </div>
            </Field>
          )}
          <Field id="job-jd" label={t('jobs.drawer.jd')} error={jdError}>
            <select id="job-jd" className={FIELD} value={jd} onChange={(e) => pickJd(e.target.value)}>
              <option value="">{t('jobs.drawer.jdNone')}</option>
              {jds.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              {canNewJd && <option value={NEW_JD}>{t('jobs.drawer.jdNew')}</option>}
            </select>
          </Field>
          {selected && selected.skills.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[#896a61]">{t('jobs.drawer.stack')}</span>
              <div className="flex gap-1.5 flex-wrap">
                {selected.skills.map((s) => (
                  <span key={s} className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-2xs font-bold text-slate-600 dark:text-muted">{s}</span>
                ))}
              </div>
            </div>
          )}
          <Field id="job-title" label={t('jobs.drawer.title')} error={error}>
            <input id="job-title" className={FIELD} maxLength={120} value={title} onChange={(e) => { setTitle(e.target.value); setError(''); }} />
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
            <Field id="job-workplace" label={t('jobs.drawer.workplace')}>
              <select id="job-workplace" className={FIELD} value={workplace} onChange={(e) => setWorkplace(e.target.value as Workplace)}>
                {WORKPLACES.map((w) => <option key={w} value={w}>{t(`workplace.${w}`)}</option>)}
              </select>
            </Field>
            <Field id="job-headcount" label={t('jobs.drawer.headcount')}>
              <input id="job-headcount" type="number" min={1} className={FIELD} value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-[#896a61] mb-1">{t('jobs.drawer.requirements')}</legend>
            <div className="grid grid-cols-2 gap-4">
              <Field id="job-min-years" label={t('jobs.drawer.minYears')}>
                <input id="job-min-years" type="number" min={0} max={40} className={FIELD} value={minYears} onChange={(e) => setMinYears(e.target.value)} />
              </Field>
              <Field id="job-education" label={t('jobs.drawer.education')}>
                <select id="job-education" className={FIELD} value={education} onChange={(e) => setEducation(e.target.value as Education | '')}>
                  <option value=""></option>
                  {EDUCATIONS.map((x) => <option key={x} value={x}>{t(`education.${x}`)}</option>)}
                </select>
              </Field>
            </div>
          </fieldset>
          <Field id="job-manager" label={t('jobs.drawer.manager')}>
            <select id="job-manager" className={FIELD} value={manager} onChange={(e) => setManager(e.target.value)}>
              {managerOptions.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
            </select>
            {keepsMe && <p className="text-xs text-[#896a61] mt-1">{t('jobs.drawer.keepsMe')}</p>}
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-[#896a61] mb-1">{t('jobs.drawer.collaborators')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {assignableUsers(users).filter((u) => u.id !== manager).map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm text-[#181211] dark:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    // The creator stays on as collaborator when someone else manages the job (see keepsMe).
                    checked={collaborators.includes(u.id) || (keepsMe && u.id === me())}
                    disabled={keepsMe && u.id === me()}
                    onChange={() => setCollaborators((c) => (c.includes(u.id) ? c.filter((x) => x !== u.id) : [...c, u.id]))}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  {u.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-[#896a61] mb-1">{t('jobs.drawer.salary')}</legend>
            <div className="grid grid-cols-[1fr_1fr_110px] gap-3">
              <Field id="job-salary-min" label={t('jobs.drawer.salaryMin')}>
                <input id="job-salary-min" inputMode="numeric" className={FIELD} value={salaryMin} onChange={(e) => { setSalaryMin(e.target.value); setSalaryError(''); }} />
              </Field>
              <Field id="job-salary-max" label={t('jobs.drawer.salaryMax')}>
                <input id="job-salary-max" inputMode="numeric" className={FIELD} value={salaryMax} onChange={(e) => { setSalaryMax(e.target.value); setSalaryError(''); }} />
              </Field>
              <Field id="job-currency" label={t('offer.currency')}>
                <select id="job-currency" className={FIELD} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            {salaryError && <p className="text-xs text-red-600">{salaryError}</p>}
            <label className="flex items-center gap-2 text-sm text-[#181211] dark:text-white">
              <input type="checkbox" checked={showSalary} onChange={(e) => setShowSalary(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary" />
              {t('jobs.drawer.showSalary')}
            </label>
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend className="text-xs font-semibold text-[#896a61] mb-1">{t('jobs.drawer.content')}</legend>
            <AiTextField
              id="job-why-love"
              label={t('jobs.drawer.whyLove')}
              value={whyLove}
              onChange={setWhyLove}
              draft={() => template(CONTENT_TEMPLATE.whyLove)}
            />
            <AiTextField
              id="job-additional-info"
              label={t('jobs.drawer.additionalInfo')}
              rows={4}
              value={additionalInfo}
              onChange={setAdditionalInfo}
              draft={() => draftAdditionalInfo({ location, employment, level }, template(CONTENT_TEMPLATE.additionalInfo))}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-[#896a61] mb-1">{t('jobs.drawer.questions')}</legend>
            {questions.length === 0 && <p className="text-xs text-[#896a61]">{t('jobs.drawer.questionsNone')}</p>}
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-2">
                <input
                  aria-label={t('jobs.drawer.questionLabel', { n: i + 1 })}
                  className={FIELD}
                  value={q.label}
                  placeholder={t('jobs.drawer.questionPlaceholder')}
                  onChange={(e) => setQuestions(questions.map((x) => (x.id === q.id ? { ...x, label: e.target.value } : x)))}
                />
                <select
                  aria-label={t('jobs.drawer.questionType')}
                  className={`${FIELD} !w-28`}
                  value={q.type}
                  onChange={(e) => setQuestions(questions.map((x) => (x.id === q.id ? { ...x, type: e.target.value as JobQuestion['type'] } : x)))}
                >
                  <option value="text">{t('jobs.drawer.qtype.text')}</option>
                  <option value="yesno">{t('jobs.drawer.qtype.yesno')}</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-[#896a61] whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => setQuestions(questions.map((x) => (x.id === q.id ? { ...x, required: e.target.checked } : x)))}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  {t('jobs.drawer.required')}
                </label>
                <button
                  type="button"
                  aria-label={t('jobs.drawer.removeQuestion')}
                  onClick={() => setQuestions(questions.filter((x) => x.id !== q.id))}
                  className="text-[#896a61] hover:text-red-500"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setQuestions([...questions, { id: `q-${crypto.randomUUID().slice(0, 8)}`, label: '', type: 'text', required: false }])}
              className="self-start text-sm font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>{t('jobs.drawer.addQuestion')}
            </button>
          </fieldset>
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
            {t(approvalFree ? 'jobs.drawer.publish' : 'jobs.drawer.submit')}
          </label>
          {templateName !== null && (
            <div className="flex flex-col gap-1">
              <label htmlFor="job-template-name" className="text-xs font-semibold text-[#896a61]">{t('jobs.drawer.templateName')}</label>
              <div className="flex gap-2">
                <input id="job-template-name" autoFocus className={FIELD} value={templateName} onChange={(e) => { setTemplateName(e.target.value); setTemplateError(''); }} />
                <button type="button" onClick={saveTemplate} className={BTN_GHOST}>{t('jobs.drawer.save')}</button>
              </div>
              {templateError && <p className="text-xs text-red-600">{templateError}</p>}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            {templateName === null && (
              <button type="button" onClick={() => setTemplateName('')} className="mr-auto text-sm font-semibold text-primary hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">bookmark_add</span>{t('jobs.drawer.saveTemplate')}
              </button>
            )}
            <button type="button" onClick={onClose} className={BTN_GHOST}>{t('common.cancel')}</button>
            <button type="button" onClick={save} className={BTN_PRIMARY}>{t('jobs.drawer.save')}</button>
          </div>
        </div>
      </Drawer>
      {/* Rendered after the job drawer so it stacks on top; the new JD is picked as soon as it is saved. */}
      <JdEditor open={open && jdEditorOpen} onClose={() => setJdEditorOpen(false)} onSaved={(created) => pickJd(created.id)} />
    </>
  );
}
