import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { interviewTime, nextInterview } from '../../domain/hiring';
import { UPLOAD_LIMITS, validateFiles } from '../../domain/parseCv';
import { normalizeRole } from '../../domain/permissions';
import type { Application, Candidate, SuggestField } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { OfferResponse } from './OfferResponse';

const INPUT = 'w-full h-11 px-4 rounded-lg bg-[#f8f6f6] ring-1 ring-gray-200 focus:ring-2 focus:ring-primary outline-none text-sm';
const CV_LIMITS = { ...UPLOAD_LIMITS, extensions: ['pdf', 'docx'] };
const LEVELS = ['Intern', 'Fresher', 'Junior', 'Middle', 'Senior', 'Lead', 'Manager'];

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-[#e6dddb] p-6 sm:p-8">
      <h2 className="text-lg font-bold">{title}</h2>
      {hint && <p className="text-sm text-[#896a61] mt-1">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

/** Candidate self-service: contact details and CV apply at once; seniority, English and skills go to HR for approval. */
/**
 * What a candidate sees of their applications: the ones they applied for, plus any HR has put in front of them
 * (an interview or a sent offer). A pipeline HR merely added them to stays internal.
 */
function candidateCanSee(a: Application): boolean {
  return a.via === 'careers' || a.via === 'campaign' || (a.interviews?.length ?? 0) > 0 || (!!a.offer && a.offer.status !== 'draft');
}

export function CandidatePortal() {
  const user = useMe();
  const candidate = useStore((s) => s.candidates.find((c) => c.id === user.candidateId));
  if (normalizeRole(user.role) !== 'Candidate' || !candidate) return <Navigate to="/careers/login" replace />;
  return <Portal candidate={candidate} userId={user.id} />;
}

function Portal({ candidate: c, userId }: { candidate: Candidate; userId: string }) {
  const t = useT('careers');
  const [lang] = useLang('careers');
  const taxonomy = useStore((s) => s.taxonomy);
  const applications = useStore((s) => s.applications);
  const jobs = useStore((s) => s.jobs);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const say = (kind: 'ok' | 'err', text: string) => setFlash({ kind, text });

  // Contact: applies immediately.
  const [contact, setContact] = useState({ email: c.email, phone: c.phone, linkedin: c.linkedin ?? '', location: c.location ?? '' });
  useEffect(() => setContact({ email: c.email, phone: c.phone, linkedin: c.linkedin ?? '', location: c.location ?? '' }), [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveContact = () => {
    const r = useStore.getState().selfUpdate(c.id, contact, userId);
    if (r.ok) return say('ok', t('portal.saved'));
    say('err', t(r.reason === 'duplicate' ? 'portal.err.duplicate' : 'portal.err.contact'));
  };
  const toggleOpen = () => {
    useStore.getState().selfUpdate(c.id, { openToWork: !c.openToWork }, userId);
    say('ok', t(c.openToWork ? 'portal.openOff' : 'portal.openOn'));
  };

  // CV: a new version, kept alongside the old ones.
  const upload = (file: File | undefined) => {
    if (!file) return;
    const { accepted } = validateFiles([file], CV_LIMITS);
    if (!accepted.length) return say('err', t('careers.apply.err.type'));
    useStore.getState().uploadCvVersion(c.id, file.name, userId);
    say('ok', t('portal.cv.uploaded', { file: file.name }));
  };

  // Standardised fields: proposals for HR.
  const pending = (f: SuggestField) => c.suggestions?.find((s) => s.field === f);
  const initial = () => ({
    seniority: String(pending('seniority')?.value ?? c.seniority),
    english: String(pending('english')?.value ?? c.english),
    skills: ((pending('skills')?.value as string[] | undefined) ?? c.skills).join(', '),
  });
  const [proposal, setProposal] = useState(initial);
  useEffect(() => setProposal(initial()), [c.id, c.suggestions]); // eslint-disable-line react-hooks/exhaustive-deps
  const englishOptions = useMemo(() => taxonomy.filter((x) => x.kind === 'english' && x.active).map((x) => x.label), [taxonomy]);
  const levels = LEVELS.includes(proposal.seniority) || !proposal.seniority ? LEVELS : [...LEVELS, proposal.seniority];
  const english = englishOptions.includes(proposal.english) || !proposal.english ? englishOptions : [...englishOptions, proposal.english];
  const propose = () => {
    const { suggestChange } = useStore.getState();
    suggestChange(c.id, 'seniority', proposal.seniority);
    suggestChange(c.id, 'english', proposal.english);
    suggestChange(c.id, 'skills', proposal.skills.split(','));
    say('ok', t('portal.proposed'));
  };

  const mine = applications
    .filter((a) => a.candidateId === c.id && candidateCanSee(a))
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB');
  const versions = [...(c.cvVersions ?? [])].reverse();

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="candidate-portal">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('portal.hello', { name: c.name })}</h1>
          <p className="text-sm text-[#896a61] mt-1">{t('portal.subtitle')}</p>
        </div>
        <button
          role="switch"
          aria-checked={!!c.openToWork}
          onClick={toggleOpen}
          className={`h-11 px-5 rounded-full text-sm font-bold flex items-center gap-2 ring-1 ${c.openToWork ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-white text-[#896a61] ring-gray-200'}`}
        >
          <span className={`size-2.5 rounded-full ${c.openToWork ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
          {t('portal.openToWork')}
        </button>
      </div>

      {flash && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm font-medium ${flash.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{flash.text}</p>
      )}

      <Card title={t('portal.apps.title')}>
        {mine.length === 0 ? (
          <p className="text-sm text-[#896a61]">{t('portal.apps.none')} <Link to="/careers" className="font-bold text-primary hover:underline">{t('careers.applied.browse')}</Link></p>
        ) : (
          <ul className="divide-y divide-[#e6dddb]">
            {mine.map((a) => {
              const job = jobs.find((j) => j.id === a.jobId);
              const iv = nextInterview(a);
              const offer = a.offer && a.offer.status !== 'draft' ? a.offer : undefined;
              return (
                <li key={a.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{job?.title ?? a.jobId}</p>
                      <p className="text-xs text-[#896a61]">{t('careers.status.appliedOn', { date: fmt(a.addedAt) })}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary-ink text-xs font-bold shrink-0">{t(`careers.stage.${a.stage}`)}</span>
                  </div>
                  {iv && (
                    <p className="mt-2 text-sm rounded-lg bg-violet-50 text-violet-700 px-3 py-2">
                      {t('portal.apps.interview', { round: iv.round, time: interviewTime(iv.at, lang) })}{iv.place ? ` · ${iv.place}` : ''}
                    </p>
                  )}
                  {offer && <OfferResponse app={a} offer={offer} userId={userId} onDone={(ok, text) => say(ok ? 'ok' : 'err', text)} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title={t('portal.cv.title')} hint={t('portal.instant')}>
        <label className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-primary text-white font-bold text-sm cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">upload_file</span>{t('portal.cv.upload')}
          <input type="file" accept=".pdf,.docx" className="sr-only" aria-label={t('portal.cv.upload')} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {versions.length > 0 && (
          <ul className="mt-4 space-y-2">
            {versions.map((v, i) => (
              <li key={v.id} className="flex items-center gap-3 rounded-lg bg-[#f8f6f6] px-3 py-2 text-sm">
                <span className="material-symbols-outlined text-[18px] text-red-500">picture_as_pdf</span>
                <span className="flex-1 min-w-0 truncate">{v.fileName}</span>
                {i === 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">{t('portal.cv.latest')}</span>}
                <span className="text-xs text-[#896a61]">{fmt(v.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('portal.contact.title')} hint={t('portal.instant')}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field id="pt-email" label={t('careers.apply.email')}>
            <input id="pt-email" type="email" className={INPUT} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
          </Field>
          <Field id="pt-phone" label={t('careers.apply.phone')}>
            <input id="pt-phone" type="tel" className={INPUT} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          </Field>
          <Field id="pt-linkedin" label={t('careers.apply.linkedin')}>
            <input id="pt-linkedin" type="url" className={INPUT} value={contact.linkedin} onChange={(e) => setContact({ ...contact, linkedin: e.target.value })} />
          </Field>
          <Field id="pt-city" label={t('portal.contact.city')}>
            <input id="pt-city" className={INPUT} value={contact.location} onChange={(e) => setContact({ ...contact, location: e.target.value })} />
          </Field>
        </div>
        <button onClick={saveContact} className="mt-5 h-11 px-6 rounded-full bg-primary text-white font-bold text-sm">{t('portal.save')}</button>
      </Card>

      <Card title={t('portal.pro.title')} hint={t('portal.pro.hint')}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field id="pt-seniority" label={t('portal.pro.seniority')}>
            <select id="pt-seniority" className={INPUT} value={proposal.seniority} onChange={(e) => setProposal({ ...proposal, seniority: e.target.value })}>
              <option value=""></option>
              {levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            {pending('seniority') && <Pending />}
          </Field>
          <Field id="pt-english" label={t('portal.pro.english')}>
            <select id="pt-english" className={INPUT} value={proposal.english} onChange={(e) => setProposal({ ...proposal, english: e.target.value })}>
              <option value=""></option>
              {english.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            {pending('english') && <Pending />}
          </Field>
          <div className="sm:col-span-2">
            <Field id="pt-skills" label={t('portal.pro.skills')}>
              <input id="pt-skills" className={INPUT} value={proposal.skills} onChange={(e) => setProposal({ ...proposal, skills: e.target.value })} />
              {pending('skills') && <Pending />}
            </Field>
          </div>
        </div>
        <button onClick={propose} className="mt-5 h-11 px-6 rounded-full border border-primary text-primary font-bold text-sm hover:bg-primary/5">{t('portal.pro.submit')}</button>
      </Card>
    </div>
  );
}

function Pending() {
  const t = useT('careers');
  return (
    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
      <span className="material-symbols-outlined text-[14px]">hourglass_top</span>{t('portal.pending')}
    </p>
  );
}
