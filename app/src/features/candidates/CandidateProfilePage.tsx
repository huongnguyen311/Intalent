import { useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/BackButton';
import { normalizePhone } from '../../domain/normalize';
import { toast } from '../../components/Toast';
import { isFixtureMode } from '../../data/fixtureMockup';
import { shortDate } from '../../domain/hiring';
import { estimateYears } from '../../domain/scoring';
import type { Candidate, EducationEntry, WorkExperience } from '../../domain/types';
import { userName } from '../../domain/users';
import { useShowNew } from '../../hooks';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { EmailComposer } from '../hiring/EmailComposer';
import { candidateInScope, homeFor } from '../../domain/permissions';
import { NotFoundState } from '../../components/NotFoundState';
import { me, useCan, useMe } from '../../store/session';
import { ActivityHistory } from './ActivityHistory';
import { ChipsField, EducationEditor, ExperienceEditor } from './ProfileEditors';
import { AddToPipelineModal } from './AddToPipelineModal';
import { CvVersions, ParseReview, SuggestionsReview } from './SelfServicePanels';
import { PrivacyPanel } from './PrivacyPanel';
import { CvDocument } from './CvDocument';
import { OwnerControls } from './OwnerControls';
import { UsedIn } from './UsedIn';

const INPUT =
  'w-full py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-xl text-sm text-[#181211] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed pl-4 pr-4 hover:border-primary/50 ';
const READONLY = 'cursor-default !bg-gray-100 dark:!bg-gray-700 ';
const SECRET_INPUT =
  'w-full py-2.5 bg-gray-100 dark:bg-gray-700 border border-[#e6dddb] dark:border-[#3a3433] rounded-xl text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all pr-10 pl-4 cursor-default  ';
const SECRET_INPUT_EDIT =
  'w-full py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-xl text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all pr-10 pl-4 hover:border-primary/50 ';
const TEXTAREA =
  'w-full py-2.5 px-4 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-xl text-sm text-[#181211] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary/50 ';
const LABEL = 'text-sm font-semibold text-[#181211] dark:text-white';
const SECTION_H3 = 'text-sm font-bold text-[#896a61] uppercase tracking-wider mb-4 flex items-center gap-2';
const SECTION_H3_ROW = 'text-sm font-bold text-[#896a61] uppercase tracking-wider flex items-center gap-2';
const HR = 'border-[#e6dddb] dark:border-[#2a2423]';
const PILL_PRIMARY =
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
const PILL_SECONDARY =
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
const BTN_EDIT = 'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg shadow-sm transition-colors bg-primary hover:bg-primary-hover text-white';
const BTN_GHOST =
  'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white hover:border-primary/50 transition-colors';

const ZOOM_STEP = 0.25;

/** Vietnamese numbers (0xxx / +84xxx) as the international digits chat apps expect. */
const intlPhone = (phone?: string) => { const d = normalizePhone(phone ?? ''); return d.startsWith('0') ? `84${d.slice(1)}` : d; };
const zaloUrl = (phone?: string) => (phone ? `https://zalo.me/${normalizePhone(phone)}` : undefined);
const whatsappUrl = (phone?: string) => (phone ? `https://wa.me/${intlPhone(phone)}` : undefined);

/** The rendered CV page as a standalone HTML document (what Download saves and Open in new tab shows). */
function cvHtml(node: HTMLElement | null, name: string): string {
  const pages = node?.querySelector('[data-cv-pages]')?.outerHTML ?? '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${name} - CV</title></head><body style="margin:0;padding:24px 0;background:#525659">${pages}</body></html>`;
}

function cvBlobUrl(node: HTMLElement | null, name: string): string {
  return URL.createObjectURL(new Blob([cvHtml(node, name)], { type: 'text/html' }));
}

function downloadCv(node: HTMLElement | null, name: string) {
  const a = document.createElement('a');
  a.href = cvBlobUrl(node, name);
  a.download = `${name.replace(/\s+/g, '-').toLowerCase()}-cv.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function openCv(node: HTMLElement | null, name: string) {
  window.open(cvBlobUrl(node, name), '_blank', 'noopener');
}

type Draft = Pick<Candidate, 'name' | 'title' | 'email' | 'phone' | 'seniority' | 'english' | 'domains' | 'tags'> & {
  summary: string; location: string; linkedin: string; openToWork: boolean;
  primary: string[]; secondary: string[]; techStack: string[];
  experience: WorkExperience[]; education: EducationEntry[];
};

const toDraft = (c: Candidate): Draft => ({
  name: c.name, title: c.title, email: c.email, phone: c.phone, summary: c.summary ?? '', seniority: c.seniority, english: c.english,
  location: c.location ?? '', linkedin: c.linkedin ?? '', openToWork: Boolean(c.openToWork),
  domains: c.domains, tags: c.tags, primary: c.primarySkills ?? c.skills, secondary: c.secondarySkills ?? [], techStack: c.techStack ?? [],
  experience: c.experience ?? [], education: c.education ?? [],
});

const CHIP_TAG = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary';
const CHIP_DOMAIN = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-white dark:bg-[#1e1e1e] border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white';
const CHIP_TECH = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-[#1e1e1e] border border-[#e6dddb] dark:border-[#3a3433] text-sm text-[#181211] dark:text-white';

function TextField({ label, value, editing, onChange, testId }: {
  label: string; value: string; editing: boolean; onChange?: (v: string) => void; testId?: string;
}) {
  const editable = editing && Boolean(onChange);
  return (
    <div className="space-y-1.5 ">
      <label className={LABEL}>{label} </label>
      <div className="relative group">
        <input
          className={INPUT + (editable ? '' : READONLY)}
          readOnly={!editable}
          data-testid={testId}
          aria-label={label}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    </div>
  );
}

function SecretField({ label, value, editing, onChange, locked = false }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void;
  /** No contact-data permission: always masked, no reveal button. */
  locked?: boolean;
}) {
  const t = useT();
  const unlocked = useStore((s) => s.ui.piiUnlocked);
  const [shown, setShown] = useState(false);
  const visible = !locked && (shown || unlocked || editing);
  return (
    <div className="space-y-1.5 ">
      <label className={`${LABEL} flex items-center gap-1`}>{label}</label>
      <div className="relative group">
        <input
          readOnly={!editing}
          aria-label={label}
          className={editing ? SECRET_INPUT_EDIT : SECRET_INPUT}
          type={visible ? 'text' : 'password'}
          value={locked ? '••••••••' : value}
          onChange={(e) => onChange(e.target.value)}
        />
        {!locked && <button
          type="button"
          aria-label={t(visible ? 'profile.hide' : 'profile.show')}
          onClick={() => setShown(!shown)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors material-symbols-outlined text-[20px]"
        >
          {visible ? 'visibility' : 'visibility_off'}
        </button>}
        {locked && <span title={t('access.pii')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined text-[20px]">lock</span>}
      </div>
    </div>
  );
}


const SectionTitle = ({ icon, children }: { icon: string; children: string }) => (
  <h3 className={SECTION_H3}>
    <span className="material-symbols-outlined text-[18px]">{icon}</span> {children}
  </h3>
);

export function CandidateProfilePage() {
  const t = useT();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const showNew = useShowNew();
  const user = useMe();
  // Hiring Managers and Interviewers only reach candidates of their own jobs / interviews.
  const candidate = useStore((s) => {
    const c = s.candidates.find((x) => x.id === id);
    return c && candidateInScope(user, c.id, s.applications, s.jobs) ? c : undefined;
  });
  const perm = useCan();
  const full = perm('pool');
  const pii = perm('pii');
  const users = useStore((s) => s.users);
  const [editing, setEditing] = useState(params.get('edit') === '1');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [zoom, setZoom] = useState(1);
  const cvRef = useRef<HTMLDivElement>(null);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [mailing, setMailing] = useState(false);
  const fixture = isFixtureMode();
  const search = fixture ? '?fixture=mockup' : '';
  // Opened from the pool: the breadcrumb returns to the same filters and page.
  const poolSearch = (useLocation().state as { poolSearch?: string } | null)?.poolSearch ?? search;

  if (!candidate) {
    // Someone outside the user's scope (a Hiring Manager or Interviewer) is "no access", not "not found".
    const exists = useStore.getState().candidates.some((x) => x.id === id);
    return (
      <AppLayout title={t('profile.title')}>
        <NotFoundState
          icon={exists ? 'lock' : 'search_off'}
          message={t(exists ? 'profile.noAccess' : 'profile.notFound')}
          backTo={homeFor(user)}
          backLabel={t('profile.backHome')}
        />
      </AppLayout>
    );
  }
  const c = candidate;
  const form = editing ? (draft ?? toDraft(c)) : toDraft(c);
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setDraft({ ...form, [k]: v });

  const startEdit = () => {
    setDraft(toDraft(c));
    setEditing(true);
  };
  const stopEdit = () => {
    setDraft(null);
    setEditing(false);
  };
  const save = () => {
    const res = useStore.getState().updateCandidate(c.id, {
      name: form.name.trim() || c.name,
      title: form.title.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      seniority: form.seniority.trim(),
      english: form.english.trim(),
      summary: form.summary.trim(),
      location: form.location.trim(),
      linkedin: form.linkedin.trim(),
      openToWork: form.openToWork,
      tags: form.tags,
      domains: form.domains,
      primarySkills: form.primary,
      secondarySkills: form.secondary,
      // Search and matching read `skills`: keep it as every skill the profile lists.
      skills: [...new Set([...form.primary, ...form.secondary])],
      techStack: form.techStack,
      experience: form.experience.filter((x) => x.title.trim() || x.company.trim()),
      education: form.education.filter((x) => x.degree.trim() || x.institution.trim()),
    }, me());
    if (!res.ok) {
      toast(t('profile.err.duplicate'), 'error');
      return;
    }
    toast(t('profile.saved'));
    stopEdit();
  };

  // Last edit stamp; older records fall back to the latest thing logged about the candidate.
  const lastLog = useStore.getState().activities
    .filter((a) => a.candidateId === c.id)
    .reduce<{ by: string; at: string } | undefined>((best, a) => (!best || a.at > best.at ? { by: a.by, at: a.at } : best), undefined);
  const lastEdit = c.updatedBy && c.updatedAt ? { by: c.updatedBy, at: c.updatedAt } : lastLog;
  const lastEditText = lastEdit ? `${userName(users, lastEdit.by) || lastEdit.by} · ${shortDate(lastEdit.at)}` : '—';
  const years = c.experience?.length ? estimateYears(c) : 0;

  return (
    <AppLayout title={t('profile.title')} bare>
      <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
        <header className="bg-white dark:bg-[#1e1e1e] flex-shrink-0 z-20 border-b border-[#e6dddb] dark:border-[#2a2423]">
          <div className="h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <nav className="flex items-center text-sm font-medium text-[#896a61]">
                {full ? (
                  <>
                    <button className="hover:text-primary transition-colors" onClick={() => navigate({ pathname: '/candidates', search: poolSearch })}>{t('nav.candidatePool')}</button>
                    <span className="material-symbols-outlined text-[16px] mx-2">chevron_right</span>
                  </>
                ) : (
                  // Without Talent Pool access this goes back where the user came from.
                  <span className="mr-3"><BackButton size="sm" label={t('common.back')} onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(homeFor(user)))} /></span>
                )}
                <span className="text-[#181211] dark:text-white">{c.name}</span>
              </nav>
              <div className="h-6 w-px bg-gray-100 dark:bg-gray-700 mx-1"></div>
              <h2 className="ty-section text-lg font-bold text-[#181211] dark:text-white">{t('profile.title')}</h2>
            </div>
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 overflow-y-auto custom-scrollbar bg-white dark:bg-[#1e1e1e] border-r border-[#e6dddb] dark:border-[#2a2423]">
            <div className="p-8 max-w-3xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-300 text-xs font-medium w-fit">
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>{t('profile.aiNote')}
                </div>
                {full && <div className="flex items-center gap-3">
                  {showNew && (
                    <button className={BTN_GHOST} onClick={() => setPipelineOpen(true)}>
                      <span className="material-symbols-outlined text-[18px]">add_task</span>{t('atp.title')}
                    </button>
                  )}
                  {editing ? (
                    <>
                      <button className={BTN_GHOST} onClick={stopEdit}>{t('common.cancel')}</button>
                      <button className={BTN_EDIT} onClick={save}>
                        <span className="material-symbols-outlined text-[18px]">check</span>{t('profile.save')}
                      </button>
                    </>
                  ) : (
                    <button className={BTN_EDIT} title={t('profile.editTitle')} onClick={startEdit}>
                      <span className="material-symbols-outlined text-[18px]">edit</span>{t('profile.edit')}
                    </button>
                  )}
                </div>}
              </div>
              {showNew && full && <SuggestionsReview candidate={c} />}
              {showNew && full && <ParseReview candidate={c} />}
              <section>
                <SectionTitle icon="person">{t('profile.section.personal')}</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TextField label={t('profile.field.fullName')} value={form.name} editing={editing} onChange={set('name')} />
                  <TextField label={t('profile.field.role')} value={form.title} editing={editing} onChange={set('title')} />
                  <SecretField label={t('profile.field.email')} value={form.email} editing={editing} onChange={set('email')} locked={!pii} />
                  {pii && perm('email.send') ? <div className="flex items-end">
                    <button onClick={() => setMailing(true)} className="w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm transition-all whitespace-nowrap bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20" title={t('profile.tip.sendEmail')}>
                      <span className="material-symbols-outlined text-[20px]">mail</span>{t('profile.sendEmail')}
                    </button>
                  </div> : <div></div>}
                  <SecretField label={t('profile.field.phone')} value={form.phone} editing={editing} onChange={set('phone')} locked={!pii} />
                  <div></div>
                  {pii && <><a href={zaloUrl(c.phone)} target="_blank" rel="noopener noreferrer" aria-disabled={!c.phone || undefined} className={`${c.phone ? "" : "pointer-events-none opacity-50 "}h-auto flex-1 flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm transition-all whitespace-nowrap bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-green-500/20`} title={t('profile.tip.zalo')}>
                    <span className="material-symbols-outlined text-[20px]">open_in_new</span>{t('profile.openZalo')}
                  </a>
                  <a href={whatsappUrl(c.phone)} target="_blank" rel="noopener noreferrer" aria-disabled={!c.phone || undefined} className={`${c.phone ? "" : "pointer-events-none opacity-50 "}flex-1 flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm transition-all whitespace-nowrap bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-emerald-500/20`} title={t('profile.tip.whatsapp')}>
                    <span className="material-symbols-outlined text-[20px]">call</span>{t('profile.openWhatsapp')}
                  </a></>}
                  <TextField label={t('profile.field.location')} value={form.location} editing={editing} onChange={set('location')} />
                  <div className="space-y-1.5">
                    <TextField label={t('profile.field.linkedin')} value={form.linkedin} editing={editing} onChange={set('linkedin')} />
                    {!editing && c.linkedin && (
                      <a href={c.linkedin.startsWith('http') ? c.linkedin : `https://${c.linkedin}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>{t('profile.openLinkedin')}
                      </a>
                    )}
                  </div>
                  <TextField label={t('profile.field.source')} value={c.source || '—'} editing={false} />
                  <TextField label={t('profile.field.createdAt')} value={shortDate(c.createdAt)} editing={false} />
                </div>
              </section>
              {showNew && full && <CvVersions candidate={c} />}
              {showNew && full && <PrivacyPanel candidate={c} />}
              <hr className={HR} />
              <section>
                <SectionTitle icon="short_text">{t('profile.section.summary')}</SectionTitle>
                <div className="space-y-1.5 ">
                  <div className="relative group">
                    <textarea
                      className={TEXTAREA + (editing ? '' : READONLY)}
                      readOnly={!editing}
                      aria-label={t('profile.section.summary')}
                      rows={4}
                      value={form.summary}
                      onChange={(e) => set('summary')(e.target.value)}
                    />
                  </div>
                </div>
              </section>
              <hr className={HR} />
              <section>
                <SectionTitle icon="star">{t('profile.section.skills')}</SectionTitle>
                <div className="space-y-4">
                  <ChipsField label={t('profile.skills.primary')} values={form.primary} editing={editing} onChange={set('primary')} chipClass={PILL_PRIMARY} />
                  {(editing || form.secondary.length > 0) && (
                    <ChipsField label={t('profile.skills.secondary')} values={form.secondary} editing={editing} onChange={set('secondary')} chipClass={PILL_SECONDARY} />
                  )}
                </div>
              </section>
              <hr className={HR} />
              <section>
                <SectionTitle icon="sell">{t('profile.section.tags')}</SectionTitle>
                <ChipsField values={form.tags} editing={editing} onChange={set('tags')} chipClass={CHIP_TAG} emptyText={t('profile.tags.empty')} />
              </section>
              <hr className={HR} />
              <section>
                <SectionTitle icon="tune">{t('profile.section.attributes')}</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TextField label={t('profile.field.seniority')} value={form.seniority} editing={editing} onChange={set('seniority')} />
                  <TextField label={t('profile.field.english')} value={form.english} editing={editing} onChange={set('english')} />
                  <div className="space-y-1.5">
                    <label className={LABEL}>{t('profile.field.openToWork')}</label>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex flex-col gap-2 ">
                        <div className="flex items-center gap-3 mt-1">
                          <label className={`relative inline-flex items-center ${editing ? 'cursor-pointer' : 'cursor-default'}`}>
                            <input className="sr-only peer" disabled={!editing} type="checkbox" checked={form.openToWork} onChange={(e) => set('openToWork')(e.target.checked)} aria-label={t('profile.field.openToWork')} />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-[#2a2423] peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <TextField label={t('profile.field.years')} value={years > 0 ? t('candidates.years', { n: years }) : '—'} editing={false} />
                  <div className="space-y-1 md:col-span-2">
                    <div className="w-full rounded-lg border border-[#e6dddb] dark:border-[#3a3433] bg-[#f8f6f6] dark:bg-[#251f1e] p-2.5">
                      <ChipsField label={t('profile.field.domain')} values={form.domains} editing={editing} onChange={set('domains')} chipClass={CHIP_DOMAIN} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <TextField label={t('profile.field.availability')} value="" editing={false} />
                  <TextField label={t('profile.field.rate')} value="" editing={false} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div className="space-y-2">
                    <TextField label={t('profile.field.cvOwner')} value={userName(users, c.cvOwner)} editing={false} testId="candidate-detail-cvowner-input" />
                    {full && <OwnerControls c={c} fixture={fixture} />}
                  </div>
                  <TextField label={t('profile.field.lastUpdatedBy')} value={lastEditText} editing={false} testId="candidate-detail-lastupdatedby-input" />
                </div>
              </section>
              <hr className={HR} />
              <section>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <SectionTitle icon="code">{t('profile.section.techStack')}</SectionTitle>
                    <div className="p-3 rounded-lg border border-[#e6dddb] dark:border-[#3a3433] bg-[#f8f6f6] dark:bg-[#251f1e]">
                      <ChipsField values={form.techStack} editing={editing} onChange={set('techStack')} chipClass={CHIP_TECH} />
                    </div>
                  </div>
                </div>
              </section>
              <hr className={HR} />
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={SECTION_H3_ROW}>
                    <span className="material-symbols-outlined text-[18px]">work</span> {t('profile.section.experience')}
                  </h3>
                </div>
                <ExperienceEditor items={form.experience} editing={editing} onChange={set('experience')} />
              </section>
              <hr className={HR} />
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={SECTION_H3_ROW}>
                    <span className="material-symbols-outlined text-[18px]">school</span> {t('profile.section.education')}
                  </h3>
                </div>
                <EducationEditor items={form.education} editing={editing} onChange={set('education')} />
              </section>
              {showNew && (
                <>
                  <hr className={HR} />
                  <UsedIn candidateId={c.id} />
                </>
              )}
              {showNew && full && (
                <>
                  <hr className={HR} />
                  <ActivityHistory candidateId={c.id} />
                </>
              )}
              <div className="h-8"></div>
            </div>
          </div>
          <div className="w-1/2 flex flex-col bg-gray-100 dark:bg-[#0f0a09]">
            <div className="h-12 bg-white dark:bg-[#1e1e1e] border-b border-[#e6dddb] dark:border-[#2a2423] flex items-center justify-between px-4 shadow-sm z-10">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#896a61]">{t('profile.doc.original')}</span>
                <span className="text-sm font-bold text-[#181211] dark:text-white flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-red-500">picture_as_pdf</span>{c.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#f8f6f6] dark:bg-[#251f1e] rounded-lg border border-[#e6dddb] dark:border-[#3a3433] p-1">
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - ZOOM_STEP))} className="size-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-[#1e1e1e] text-[#896a61] transition-colors" title={t('profile.doc.zoomOut')}>
                    <span className="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <button onClick={() => setZoom(1)} className="text-xs font-medium min-w-[40px] px-2 text-center text-[#181211] dark:text-white hover:text-primary transition-colors" title={t('profile.doc.resetZoom')}>
                    {Math.round(zoom * 100)}%
                  </button>
                  <button onClick={() => setZoom((z) => Math.min(2, z + ZOOM_STEP))} className="size-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-[#1e1e1e] text-[#896a61] transition-colors" title={t('profile.doc.zoomIn')}>
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
                {pii && <a href="#" onClick={(e) => { e.preventDefault(); openCv(cvRef.current, c.name); }} className="size-8 flex items-center justify-center rounded-lg hover:bg-[#f8f6f6] dark:hover:bg-[#251f1e] text-[#896a61] transition-colors" title={t('profile.doc.openTab')}>
                  <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                </a>}
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar flex justify-center bg-[#525659] dark:bg-[#121212]">
              <div className="relative w-full h-full" style={{ overflow: 'hidden' }}>
                <div ref={cvRef}><CvDocument c={c} zoom={zoom} maskContact={!pii} /></div>
                {/* The original file carries contact data, so only users allowed to see it can download it. */}
                {pii && <a href="#" onClick={(e) => { e.preventDefault(); downloadCv(cvRef.current, c.name); }} className="absolute top-4 right-4 size-10 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-shadow text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer z-10" title={t('profile.doc.download')}>
                  <span className="material-symbols-outlined text-[20px]">download</span>
                </a>}
              </div>
            </div>
          </div>
        </div>
      </div>
      {showNew && <AddToPipelineModal open={pipelineOpen} onClose={() => setPipelineOpen(false)} candidateIds={[c.id]} />}
      {mailing && <EmailComposer open candidateId={c.id} onClose={() => setMailing(false)} />}
    </AppLayout>
  );
}
