import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { mulberry32 } from '../../data/seed';
import { cvPrefill, hashString, UPLOAD_LIMITS, validateFiles } from '../../domain/parseCv';
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

/** Public apply form; the CV picker is simulated (type and size are checked, nothing is uploaded). */
export function ApplyForm() {
  const t = useT('careers');
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [params] = useSearchParams();
  const job = useStore((s) => s.jobs.find((j) => j.id === jobId));
  const apply = useStore((s) => s.applyFromCareers);
  const [form, setForm] = useState({ name: '', email: '', phone: '', linkedin: '' });
  const [cv, setCv] = useState<File | null>(null);
  const [parsed, setParsed] = useState<CandidateInput | null>(null);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  if (!job || job.status !== 'open') return <JobUnavailable />;

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
    if (!consent) next.consent = 'careers.apply.err.consent';
    setErrors(next);
    if (Object.keys(next).length) return;
    const { title, seniority, english, skills, domains, cv: cvText } = parsed ?? {};
    const input: CandidateInput = {
      ...(parsed ? { title, seniority, english, skills, domains, cv: cvText } : {}),
      name, email, phone,
      ...(linkedin ? { linkedin } : {}),
    };
    const r = apply(input, job.id, params.get('src') ?? undefined);
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
          <input
            id="ap-cv"
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => pickCv(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:font-bold file:text-primary"
          />
          {cv && <p className="text-xs text-[#896a61]">{cv.name}</p>}
        </Field>
        <div>
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[#ef5125]" />
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
