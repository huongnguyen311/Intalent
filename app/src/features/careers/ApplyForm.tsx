import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { mulberry32 } from '../../data/seed';
import { cvPrefill, hashString, parseReport, UPLOAD_LIMITS, validateFiles } from '../../domain/parseCv';
import { useT, type TKey } from '../../i18n/i18n';
import type { CandidateInput } from '../../domain/types';
import { useStore } from '../../store/store';
import { JobUnavailable } from './JobBits';

const INPUT = 'w-full h-12 px-4 rounded-lg bg-[#f8f6f6] ring-1 ring-gray-200 focus:ring-2 focus:ring-primary outline-none text-sm';
const CV_LIMITS = { ...UPLOAD_LIMITS, extensions: ['pdf', 'docx'] };
const LINKEDIN = /^(https?:\/\/|(www\.)?linkedin\.com\/)/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<'name' | 'contact' | 'email' | 'linkedin' | 'cv' | 'consent', TKey>>;

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wide">{label}</label>
      {children}
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

type Draft = { form: { name: string; email: string; phone: string; linkedin: string }; answers: Record<string, string> };
const draftKey = (jobId: string) => `intalent-apply-draft-${jobId}`;

/** What the applicant typed for this job earlier in the tab (the CV file itself cannot be kept). */
function loadDraft(jobId: string | undefined): Draft | undefined {
  try {
    const raw = jobId ? sessionStorage.getItem(draftKey(jobId)) : null;
    return raw ? (JSON.parse(raw) as Draft) : undefined;
  } catch {
    return undefined;
  }
}

/** Public apply form; the CV picker is simulated (type and size are checked, nothing is uploaded). */
export function ApplyForm() {
  const t = useT('careers');
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [params] = useSearchParams();
  const job = useStore((s) => s.jobs.find((j) => j.id === jobId));
  const apply = useStore((s) => s.applyFromCareers);
  // Leaving the form by accident (Back, a link) must not lose what was typed: the draft lives in this tab.
  const [form, setForm] = useState(() => loadDraft(jobId)?.form ?? { name: '', email: '', phone: '', linkedin: '' });
  const [cv, setCv] = useState<File | null>(null);
  const [parsed, setParsed] = useState<CandidateInput | null>(null);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [answers, setAnswers] = useState<Record<string, string>>(() => loadDraft(jobId)?.answers ?? {});
  const [dragOver, setDragOver] = useState(false);
  const [answerErrors, setAnswerErrors] = useState<string[]>([]);
  useEffect(() => {
    if (!jobId) return;
    try {
      sessionStorage.setItem(draftKey(jobId), JSON.stringify({ form, answers } satisfies Draft));
    } catch {
      /* storage blocked: the form still works, it just won't survive leaving the page */
    }
  }, [jobId, form, answers]);
  if (!job || job.status !== 'open') return <JobUnavailable />;
  const questions = job.questions ?? [];
  const answer = (id: string, v: string) => {
    setAnswers({ ...answers, [id]: v });
    setAnswerErrors((e) => e.filter((x) => x !== id));
  };

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const pickCv = (file: File | undefined) => {
    setCv(null);
    setParsed(null);
    const { accepted, rejected } = validateFiles(file ? [file] : [], CV_LIMITS);
    if (accepted.length) {
      setCv(accepted[0]);
      // Simulated parse: only fills what is still empty, never what the applicant typed.
      const p = cvPrefill(accepted[0], mulberry32(hashString(accepted[0].name)));
      setParsed(p);
      setForm((f) => ({ ...f, name: f.name || p.name, phone: f.phone || p.phone || '' }));
    }
    const bad = rejected[0]?.reason;
    setErrors((e) => ({ ...e, cv: bad ? (bad === 'size' ? 'careers.apply.err.size' : 'careers.apply.err.type') : undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const linkedin = form.linkedin.trim();
    const next: Errors = errors.cv ? { cv: errors.cv } : {};
    if (!name) next.name = 'careers.apply.err.name';
    if (!email && !phone) next.contact = 'careers.apply.err.contact';
    else if (email && !EMAIL.test(email)) next.email = 'careers.apply.err.email';
    if (linkedin && !LINKEDIN.test(linkedin)) next.linkedin = 'careers.apply.err.linkedin';
    if (!cv && !next.cv) next.cv = 'careers.apply.err.cvRequired';
    if (!consent) next.consent = 'careers.apply.err.consent';
    setErrors(next);
    const missing = questions.filter((q) => q.required && !answers[q.id]?.trim()).map((q) => q.id);
    setAnswerErrors(missing);
    if (Object.keys(next).length || missing.length) return;
    const { title, seniority, english, skills, domains, cv: cvText } = parsed ?? {};
    const input: CandidateInput = {
      ...(parsed ? { title, seniority, english, skills, domains, cv: cvText } : {}),
      name, email, phone,
      ...(linkedin ? { linkedin } : {}),
    };
    // PRD 4.3 step 5: the CV goes through AI parsing; HR sees confidence and missing fields on the profile.
    if (cv) input.parse = parseReport(cv.name, input, new Date().toISOString());
    const given = questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({ questionId: q.id, label: q.label, answer: q.type === 'yesno' ? t(answers[q.id] === 'yes' ? 'careers.apply.yes' : 'careers.apply.no') : answers[q.id].trim() }));
    const r = apply(input, job.id, params.get('src') ?? undefined, given);
    try {
      sessionStorage.removeItem(draftKey(job.id));
    } catch {
      /* nothing to clear */
    }
    if (!r.ok && r.reason === 'unavailable') return navigate('/careers');
    const q = new URLSearchParams({ job: job.id });
    if (!r.ok) {
      q.set('dup', '1');
      q.set('stage', r.stage);
    }
    navigate(`/careers/applied?${q}`);
  };
  const err = (k: keyof Errors) => (errors[k] ? t(errors[k]) : undefined);

  return (
    <div className="max-w-xl mx-auto bg-white rounded-3xl border border-[#e6dddb] p-6 sm:p-10">
      <h1 className="text-2xl font-bold tracking-tight">{t('careers.apply.title', { job: job.title })}</h1>
      <p className="text-sm text-[#896a61] mt-1">{t('careers.apply.subtitle')}</p>
      <form noValidate onSubmit={submit} className="mt-6 space-y-5">
        <Field id="ap-name" label={t('careers.apply.name')} error={err('name')}>
          <input id="ap-name" className={INPUT} value={form.name} onChange={set('name')} autoComplete="name" />
        </Field>
        <Field id="ap-email" label={t('careers.apply.email')} error={err('email') ?? err('contact')}>
          <input id="ap-email" type="email" className={INPUT} value={form.email} onChange={set('email')} autoComplete="email" />
        </Field>
        <Field id="ap-phone" label={t('careers.apply.phone')}>
          <input id="ap-phone" type="tel" className={INPUT} value={form.phone} onChange={set('phone')} autoComplete="tel" />
        </Field>
        <Field id="ap-linkedin" label={t('careers.apply.linkedin')} error={err('linkedin')}>
          <input id="ap-linkedin" type="url" className={INPUT} value={form.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/in/..." />
        </Field>
        <Field id="ap-cv" label={t('careers.apply.cv')} error={err('cv')}>
          {/* Styled drop zone over a visually hidden input (the browser's own "Choose File" ignores the page language). */}
          <div
            onClick={() => document.getElementById('ap-cv')?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickCv(e.dataTransfer.files?.[0]); }}
            className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-[#e6dddb] hover:border-primary/50'}`}
          >
            <span className="material-symbols-outlined text-[28px] text-primary">{cv ? 'description' : 'upload_file'}</span>
            <div className="min-w-0 flex-1 text-sm">
              {cv ? (
                <p className="font-semibold truncate">{cv.name}</p>
              ) : (
                <p><span className="font-bold text-primary">{t('careers.apply.cvChoose')}</span> <span className="text-[#896a61]">{t('careers.apply.cvDrop')}</span></p>
              )}
              <p className="text-xs text-[#896a61]">{cv ? t('careers.apply.cvReplace') : 'PDF, DOCX · 5 MB'}</p>
            </div>
          </div>
          <input id="ap-cv" type="file" accept=".pdf,.docx" onChange={(e) => pickCv(e.target.files?.[0])} className="sr-only" />
        </Field>
        {questions.map((q) => {
          const id = `ap-q-${q.id}`;
          const label = `${q.label}${q.required ? ' *' : ''}`;
          const error = answerErrors.includes(q.id) ? t('careers.apply.err.answer') : undefined;
          return q.type === 'yesno' ? (
            <fieldset key={q.id} className="space-y-1.5">
              <legend className="block text-xs font-bold uppercase tracking-wide">{label}</legend>
              <div className="flex gap-3">
                {(['yes', 'no'] as const).map((v) => (
                  <label key={v} className={`h-11 px-5 rounded-lg ring-1 flex items-center gap-2 text-sm cursor-pointer ${answers[q.id] === v ? 'ring-2 ring-primary bg-primary/5' : 'ring-gray-200 bg-[#f8f6f6]'}`}>
                    <input type="radio" name={id} checked={answers[q.id] === v} onChange={() => answer(q.id, v)} className="accent-primary" />
                    {t(v === 'yes' ? 'careers.apply.yes' : 'careers.apply.no')}
                  </label>
                ))}
              </div>
              {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
            </fieldset>
          ) : (
            <Field key={q.id} id={id} label={label} error={error}>
              <textarea id={id} rows={3} className={`${INPUT} h-auto py-3`} value={answers[q.id] ?? ''} onChange={(e) => answer(q.id, e.target.value)} />
            </Field>
          );
        })}
        <div>
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-primary" />
            <span>{t('careers.apply.consent')}</span>
          </label>
          {errors.consent && <p role="alert" className="text-xs text-red-500 mt-1.5">{t(errors.consent)}</p>}
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <Link to={`/careers/${job.id}`} className="h-12 px-6 rounded-full border border-[#e6dddb] font-bold text-sm flex items-center justify-center">
            {t('careers.apply.cancel')}
          </Link>
          <button type="submit" className="h-12 px-8 rounded-full bg-primary text-white font-bold text-sm sm:flex-1">
            {t('careers.apply.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
