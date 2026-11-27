import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/BackButton';
import { normalizePhone } from '../../domain/normalize';
import { toast } from '../../components/Toast';
import { isFixtureMode } from '../../data/fixtureMockup';
import { shortDate } from '../../domain/hiring';
import { estimateYears } from '../../domain/scoring';
import { EMPLOYMENT_TYPES, WORK_MODES, type Candidate, type CandidatePatch, type CvProject, type EducationEntry, type EmploymentType, type WorkExperience, type WorkMode } from '../../domain/types';
import { contactErrors } from '../../domain/contact';
import { userName } from '../../domain/users';
import { useShowNew } from '../../hooks';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { EmailComposer } from '../hiring/EmailComposer';
import { candidateInScope, contactAccess, homeFor } from '../../domain/permissions';
import { NotFoundState } from '../../components/NotFoundState';
import { WhatsAppIcon, ZaloIcon } from '../../components/BrandIcons';
import { me, useCan, useMe } from '../../store/session';
import { ActivityHistory } from './ActivityHistory';
import { ChipsField, ChoiceChips, EducationEditor, ExperienceEditor, ProjectsEditor } from './ProfileEditors';
import { ProfileHero } from './ProfileHero';
import { ApplicationHistory } from './ApplicationHistory';
import { AddToPipelineModal } from './AddToPipelineModal';
import { CvVersions, ParseReview, SuggestionsReview } from './SelfServicePanels';
import { PrivacyPanel } from './PrivacyPanel';
import { CvDocument } from './CvDocument';
import { OwnerControls } from './OwnerControls';

/**
 * Inline (what-you-see-is-what-you-get) fields: they read as plain text and show a box on hover / focus.
 * `-mx-3` + wider width keeps the text aligned with its label while the box gets padding.
 */
// Editable fields always show an input box, so it is clear what can be changed; system data is plain text.
const INLINE_EDIT =
  'block w-full py-2 px-3 rounded-lg border border-line dark:border-dark-line bg-white dark:bg-dark-canvas text-sm text-ink dark:text-white placeholder-gray-400 dark:placeholder-gray-500 cursor-text hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors ';
const INLINE_STATIC =
  'block w-full px-0 py-1 border-0 bg-transparent text-sm text-ink dark:text-white cursor-default focus:outline-none focus:ring-0 ';
const LABEL = 'block text-xs font-semibold text-ink-muted dark:text-gray-300';
const SECTION_H3 = 'text-base font-semibold text-ink dark:text-white flex items-center gap-2';
const CARD = 'rounded-2xl border border-line dark:border-dark-line bg-white dark:bg-dark-surface p-5 sm:p-6';
const CONTACT_BTN =
  'size-7 inline-flex items-center justify-center rounded-lg border border-line dark:border-dark-line bg-white dark:bg-dark-canvas hover:border-primary/40 hover:bg-background-light dark:hover:bg-dark-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const PILL_PRIMARY =
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
const PILL_SECONDARY =
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700';

const ZOOM_STEP = 0.25;
const VIEW_BTN = 'size-8 flex items-center justify-center text-ink-muted hover:text-primary hover:bg-background-light dark:hover:bg-dark-canvas disabled:opacity-40 disabled:pointer-events-none transition-colors';

/** Vietnamese numbers (0xxx / +84xxx) as the international digits chat apps expect. */
const intlPhone = (phone?: string) => { const d = normalizePhone(phone ?? ''); return d.startsWith('0') ? `84${d.slice(1)}` : d; };
const zaloUrl = (phone?: string) => (phone ? `https://zalo.me/${normalizePhone(phone)}` : undefined);
const whatsappUrl = (phone?: string) => (phone ? `https://wa.me/${intlPhone(phone)}` : undefined);

/** The rendered CV page as a standalone HTML document (what Download saves and Open in new tab shows). */
function cvHtml(node: HTMLElement | null, name: string): string {
  const pages = node?.querySelector('[data-cv-pages]')?.outerHTML ?? '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${name} - CV</title></head><body style="margin:0;padding:24px 0;background:#f3f4f6">${pages}</body></html>`;
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
  /** Digits only; empty means "Contact for rate". */
  rate: string;
  /** YYYY-MM-DD or empty. */
  available: string;
  github: string; portfolio: string;
  primary: string[]; secondary: string[]; techStack: string[];
  certifications: string[]; languages: string[]; projects: CvProject[];
  workModes: WorkMode[]; employmentTypes: EmploymentType[]; relocate: boolean;
  experience: WorkExperience[]; education: EducationEntry[];
};

const toDraft = (c: Candidate): Draft => ({
  name: c.name, title: c.title, email: c.email, phone: c.phone, summary: c.summary ?? '', seniority: c.seniority, english: c.english,
  location: c.location ?? '', linkedin: c.linkedin ?? '', openToWork: Boolean(c.openToWork), rate: c.expectedRate ? String(c.expectedRate) : '', available: c.availableFrom ?? '',
  domains: c.domains, tags: c.tags, primary: c.primarySkills ?? c.skills, secondary: c.secondarySkills ?? [], techStack: c.techStack ?? [],
  github: c.github ?? '', portfolio: c.portfolio ?? '',
  certifications: c.certifications ?? [], languages: c.languages ?? [], projects: c.projects ?? [],
  workModes: c.workModes ?? [], employmentTypes: c.employmentTypes ?? [], relocate: Boolean(c.willingToRelocate),
  experience: c.experience ?? [], education: c.education ?? [],
});

/** The store fields one edited draft field writes. Blank rows of the list editors are dropped here. */
function toPatch(k: keyof Draft, d: Draft, c: Candidate): CandidatePatch {
  switch (k) {
    case 'name': return { name: d.name.trim() || c.name };
    case 'title': case 'email': case 'phone': case 'seniority': case 'english': case 'summary': case 'location': case 'linkedin':
      return { [k]: d[k].trim() };
    // JD Matching's Max Rate filter reads this; blank or 0 clears it.
    case 'rate': return { expectedRate: Number(d.rate) > 0 ? Math.round(Number(d.rate)) : undefined };
    case 'available': return { availableFrom: d.available || undefined };
    case 'github': case 'portfolio': return { [k]: d[k].trim() || undefined };
    case 'relocate': return { willingToRelocate: d.relocate };
    // Search and matching read `skills`: keep it as every skill the profile lists.
    case 'primary': case 'secondary':
      return { primarySkills: d.primary, secondarySkills: d.secondary, skills: [...new Set([...d.primary, ...d.secondary])] };
    case 'projects': return { projects: d.projects.filter((p) => p.name.trim() || p.description.trim()) };
    case 'experience': return { experience: d.experience.filter((x) => x.title.trim() || x.company.trim()) };
    case 'education': return { education: d.education.filter((x) => x.degree.trim() || x.institution.trim()) };
    default: return { [k]: d[k] };
  }
}

/** "github.com/x" and "https://github.com/x" both open. */
const href = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`);

const TOGGLE =
  "relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-dark-raised peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary";
const CHIP_TAG = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary';
const CHIP_DOMAIN = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-white dark:bg-dark-surface border border-line dark:border-dark-line text-ink dark:text-white';
const CHIP_TECH = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-dark-surface border border-line dark:border-dark-line text-sm text-ink dark:text-white';

/** Enter in a one-line field finishes the edit (and so saves it), like leaving the field. */
const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };

function TextField({ label, value, editing, onChange, onCommit, testId, type, link, placeholder, autoFocus, display }: {
  label: string; value: string; editing: boolean; onChange?: (v: string) => void;
  /** Called when the user leaves the field (or presses Enter): that is when it saves. */
  onCommit?: () => void;
  testId?: string;
  /** An "open" link under the field (LinkedIn, GitHub, portfolio). */
  link?: { href: string; label: string };
  /** Input type while editable (e.g. "date"); read-only fields always show plain text. */
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Formatted text shown while the field is not focused (e.g. "$2,500 / month"); focus shows the raw value. */
  display?: string;
}) {
  const t = useT();
  const [focused, setFocused] = useState(false);
  const editable = editing && Boolean(onChange);
  const shown = editable ? (!focused && display && value ? display : value) : value || '—';
  return (
    <div className="space-y-1 min-w-0">
      <label className={LABEL}>{label}</label>
      <input
        className={editable ? INLINE_EDIT : INLINE_STATIC}
        readOnly={!editable}
        type={editable && type ? type : 'text'}
        data-testid={testId}
        aria-label={label}
        value={shown}
        placeholder={editable ? placeholder ?? t('profile.inline.empty') : undefined}
        autoFocus={autoFocus}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onCommit?.(); }}
        onKeyDown={blurOnEnter}
      />
      {link && (
        <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">open_in_new</span>{link.label}
        </a>
      )}
    </div>
  );
}

/** Seniority / English level: picked from the Taxonomy so pool filters and JD Matching see one spelling. */
function SelectField({ label, value, editing, onChange, options }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void; options: string[];
}) {
  const t = useT();
  if (!editing) return <TextField label={label} value={value} editing={false} />;
  // A legacy value that is no longer in the Taxonomy stays selectable so it is not silently dropped.
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div className="space-y-1 min-w-0">
      <label className={LABEL}>{label}</label>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={INLINE_EDIT + 'cursor-pointer'}>
        <option value="">{t('profile.select.none')}</option>
        {list.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

const FieldError = ({ id, children }: { id: string; children: string }) => (
  <p id={id} role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{children}</p>
);

function SecretField({ label, value, editing, onChange, onCommit, locked = false, onUnlock, error, actions }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void; onCommit?: () => void;
  /** Buttons that act on this value (send email, open chat apps), right of the label. */
  actions?: React.ReactNode;
  /** Shown under the field; also marks the input invalid. */
  error?: string;
  /** No contact-data permission: always masked, no reveal button. */
  locked?: boolean;
  /** Locked, but the user may open it with a logged "show contact" (Recruiters, outside their own jobs). */
  onUnlock?: () => void;
}) {
  const t = useT();
  const unlocked = useStore((s) => s.ui.piiUnlocked);
  const [shown, setShown] = useState(false);
  // Contact data stays masked until revealed; only a revealed value can be edited.
  const visible = !locked && (shown || unlocked || Boolean(error));
  const editable = editing && visible;
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center justify-between gap-2 min-h-[28px]">
        <label className={LABEL}>{label}</label>
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
      <div className="relative">
        <input
          readOnly={!editable}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${label}-err` : undefined}
          className={(editing ? INLINE_EDIT : INLINE_STATIC) + 'pr-10 ' + (editable ? '' : 'cursor-default ') + (error ? '!border-red-500' : '')}
          type={visible ? 'text' : 'password'}
          value={locked ? '••••••••' : value}
          placeholder={editable ? t('profile.inline.empty') : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={blurOnEnter}
        />
        {!locked && <button
          type="button"
          aria-label={t(visible ? 'profile.hide' : 'profile.show')}
          onClick={() => setShown(!shown)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors material-symbols-outlined text-[20px]"
        >
          {visible ? 'visibility' : 'visibility_off'}
        </button>}
        {locked && (onUnlock ? (
          <button
            type="button"
            onClick={onUnlock}
            title={t('profile.revealContact')}
            aria-label={t('profile.revealContact')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors material-symbols-outlined text-[20px]"
          >
            lock_open
          </button>
        ) : (
          <span title={t('access.pii')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined text-[20px]">lock</span>
        ))}
      </div>
      {error && <FieldError id={`${label}-err`}>{error}</FieldError>}
    </div>
  );
}


/** One profile section as a card with its title; `aside` sits right of the title. */
function Section({ icon, title, children, onBlur, aside }: {
  icon: string; title: string; children: React.ReactNode; onBlur?: (e: React.FocusEvent<HTMLElement>) => void; aside?: React.ReactNode;
}) {
  return (
    <section onBlur={onBlur} className={CARD}>
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className={SECTION_H3}>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">{icon}</span>{title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Toggle({ label, checked, editing, onChange }: { label: string; checked: boolean; editing: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-center gap-3 w-fit ${editing ? 'cursor-pointer' : 'cursor-default'}`}>
      <span className="relative inline-flex items-center">
        <input className="sr-only peer" type="checkbox" disabled={!editing} checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={TOGGLE}></span>
      </span>
      <span className="text-sm font-medium text-ink dark:text-white">{label}</span>
    </label>
  );
}

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
  // Contact data: always for Super Admin / Lead and the user's own CVs and jobs; elsewhere in the pool a Recruiter
  // opens it with a logged "show contact"; roles without contact permission never see it.
  const contact = useStore((s) => (candidate ? contactAccess(user, candidate, s.applications, s.jobs, s.activities) : 'none'));
  const pii = contact === 'full';
  const revealContact = contact === 'reveal' && candidate
    ? () => { useStore.getState().revealContact(candidate.id, me()); toast(t('profile.contactRevealed')); }
    : undefined;
  const users = useStore((s) => s.users);
  const taxonomy = useStore((s) => s.taxonomy);
  // Edits not saved yet (a field being typed in, a list being filled). Everything else reads straight from the store,
  // so changes made elsewhere (accepted suggestions, owner transfer) show up at once.
  const [pending, setPendingState] = useState<Partial<Draft>>({});
  const pendingRef = useRef(pending);
  const setPending = (p: Partial<Draft>) => { pendingRef.current = p; setPendingState(p); };
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [forId, setForId] = useState(id);
  if (forId !== id) { setForId(id); setPending({}); setSavedAt(null); }
  const commitRef = useRef<() => void>(() => {});
  // Leaving the page saves whatever is still being edited.
  useEffect(() => () => commitRef.current(), [id]);
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
  // Only Talent Pool staff edit profiles; everyone else sees the same page as plain text.
  const editing = full && !c.anonymizedAt;
  const form: Draft = { ...toDraft(c), ...pending };
  const errors = contactErrors(form.email, form.phone);

  /** Saves every pending field (plus `extra`). An invalid email / phone stays pending with its error; the rest saves. */
  const commit = (extra: Partial<Draft> = {}) => {
    const p = { ...pendingRef.current, ...extra };
    const keys = Object.keys(p) as (keyof Draft)[];
    if (keys.length === 0) return;
    const cur = useStore.getState().candidates.find((x) => x.id === c.id);
    if (!cur) return;
    const next: Draft = { ...toDraft(cur), ...p };
    const errs = contactErrors(next.email, next.phone);
    const held: Partial<Draft> = {
      ...(errs.email && p.email !== undefined ? { email: p.email } : {}),
      ...(errs.phone && p.phone !== undefined ? { phone: p.phone } : {}),
    };
    const patch: CandidatePatch = Object.assign({}, ...keys.filter((k) => !(k in held)).map((k) => toPatch(k, next, cur)));
    const changed = Object.fromEntries(
      Object.entries(patch).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(cur[k as keyof Candidate])),
    ) as CandidatePatch;
    setPending(held);
    if (Object.keys(changed).length === 0) return;
    const res = useStore.getState().updateCandidate(c.id, changed, me());
    if (!res.ok) {
      toast(t('profile.err.duplicate'), 'error');
      return;
    }
    setSavedAt(new Date().toISOString());
  };
  commitRef.current = () => commit();

  /** Typing: keep the value pending until the field is left. */
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setPending({ ...pendingRef.current, [k]: v });
  /** Toggles, selects and chips: one click is one finished edit, so save it right away. */
  const setNow = <K extends keyof Draft>(k: K) => (v: Draft[K]) => commit({ [k]: v } as Partial<Draft>);
  /** List editors (experience, projects, education) save when focus leaves the whole section, not between its inputs. */
  const commitOnLeave = (e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit();
  };
  const field = <K extends keyof Draft>(k: K) => ({ value: form[k] as string, editing, onChange: set(k) as (v: string) => void, onCommit: () => commit() });

  // Last edit stamp; older records fall back to the latest thing logged about the candidate.
  const lastLog = useStore.getState().activities
    .filter((a) => a.candidateId === c.id)
    .reduce<{ by: string; at: string } | undefined>((best, a) => (!best || a.at > best.at ? { by: a.by, at: a.at } : best), undefined);
  const lastEdit = c.updatedBy && c.updatedAt ? { by: c.updatedBy, at: c.updatedAt } : lastLog;
  const lastEditText = lastEdit ? `${userName(users, lastEdit.by) || lastEdit.by} · ${shortDate(lastEdit.at)}` : '—';
  const years = c.experience?.length ? estimateYears(c) : 0;
  const options = (kind: 'seniority' | 'english') => taxonomy.filter((x) => x.kind === kind && x.active).map((x) => x.label);

  const latestCv = c.cvVersions?.[c.cvVersions.length - 1];
  const cvFile = latestCv?.fileName ?? `${c.name} - CV.pdf`;
  const savedText = savedAt ? t('profile.inline.savedAt', { time: new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : '';

  return (
    <AppLayout title={t('profile.title')} bare>
      <div className="flex flex-col h-full bg-background-light dark:bg-dark-canvas overflow-hidden">
        <header className="bg-white dark:bg-dark-surface flex-shrink-0 z-20 border-b border-line dark:border-dark-raised">
          <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <nav className="flex items-center text-sm font-medium text-ink-muted min-w-0">
                {full ? (
                  <>
                    <button className="hover:text-primary transition-colors whitespace-nowrap" onClick={() => navigate({ pathname: '/candidates', search: poolSearch })}>{t('nav.candidatePool')}</button>
                    <span className="material-symbols-outlined text-[16px] mx-2">chevron_right</span>
                  </>
                ) : (
                  // Without Talent Pool access this goes back where the user came from.
                  <span className="mr-3"><BackButton size="sm" label={t('common.back')} onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(homeFor(user)))} /></span>
                )}
                <span aria-current="page" className="text-ink dark:text-white font-semibold truncate">{c.name}</span>
              </nav>
            </div>
            {/* Page-level actions stay in the header, in reach wherever the profile is scrolled to. */}
            <div className="flex items-center gap-4 shrink-0">
              {editing && (
                <span role="status" className={`hidden sm:flex items-center gap-1 text-xs font-medium text-ink-muted transition-opacity ${savedAt ? 'opacity-100' : 'opacity-0'}`}>
                  {savedAt && <><span aria-hidden="true" className="material-symbols-outlined text-[16px] text-green-600">cloud_done</span>{savedText}</>}
                </span>
              )}
            </div>
          </div>
        </header>
        {/* Side by side from lg; below that the profile and the CV stack and the whole page scrolls. */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          <div className="w-full lg:w-1/2 flex flex-col lg:overflow-hidden bg-background-light dark:bg-dark-canvas lg:border-r border-line dark:border-dark-raised">
            <div className="flex-1 lg:overflow-y-auto custom-scrollbar">
            <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
              <ProfileHero
                c={c}
                years={years}
                showPipeline={showNew}
                onAddToPipeline={full ? () => setPipelineOpen(true) : undefined}
              />
              {c.parse && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-300 text-xs font-medium w-fit">
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">auto_awesome</span>{t('profile.aiNote')}
                </div>
              )}
              {showNew && full && <SuggestionsReview candidate={c} />}
              {showNew && full && <ParseReview candidate={c} />}

              <Section icon="person" title={t('profile.section.personal')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <TextField label={t('profile.field.fullName')} {...field('name')} autoFocus={params.get('edit') === '1'} />
                  <TextField label={t('profile.field.role')} {...field('title')} />
                  <SecretField label={t('profile.field.email')} value={form.email} editing={editing} onChange={set('email')} onCommit={() => commit()} locked={!pii} onUnlock={revealContact} error={errors.email ? t('profile.err.email') : undefined}
                    actions={pii && perm('email.send') && (
                      <button onClick={() => setMailing(true)} disabled={!c.email} className={CONTACT_BTN} title={t('profile.tip.sendEmail')} aria-label={t('profile.tip.sendEmail')}>
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-blue-600">mail</span>
                      </button>
                    )}
                  />
                  <SecretField label={t('profile.field.phone')} value={form.phone} editing={editing} onChange={set('phone')} onCommit={() => commit()} locked={!pii} onUnlock={revealContact} error={errors.phone ? t('profile.err.phone') : undefined}
                    actions={pii && (
                      <>
                        <a href={zaloUrl(c.phone)} target="_blank" rel="noopener noreferrer" aria-disabled={!c.phone || undefined} className={`${CONTACT_BTN} ${c.phone ? '' : 'pointer-events-none opacity-40'}`} title={t('profile.tip.zalo')} aria-label={t('profile.tip.zalo')}>
                          <ZaloIcon size={16} />
                        </a>
                        <a href={whatsappUrl(c.phone)} target="_blank" rel="noopener noreferrer" aria-disabled={!c.phone || undefined} className={`${CONTACT_BTN} ${c.phone ? '' : 'pointer-events-none opacity-40'}`} title={t('profile.tip.whatsapp')} aria-label={t('profile.tip.whatsapp')}>
                          <WhatsAppIcon size={16} />
                        </a>
                      </>
                    )}
                  />
                  <TextField label={t('profile.field.location')} {...field('location')} />
                  <TextField label={t('profile.field.linkedin')} {...field('linkedin')} link={c.linkedin ? { href: href(c.linkedin), label: t('profile.openLinkedin') } : undefined} />
                  <TextField label={t('profile.field.github')} {...field('github')} link={c.github ? { href: href(c.github), label: t('profile.openLink') } : undefined} />
                  <TextField label={t('profile.field.portfolio')} {...field('portfolio')} link={c.portfolio ? { href: href(c.portfolio), label: t('profile.openLink') } : undefined} />
                </div>
              </Section>

              {showNew && <div className={CARD}><ApplicationHistory c={c} showFeedback={full} /></div>}

              <Section icon="short_text" title={t('profile.section.summary')}>
                <textarea
                  className={(editing ? INLINE_EDIT : INLINE_STATIC) + 'resize-y min-h-[96px]'}
                  readOnly={!editing}
                  aria-label={t('profile.section.summary')}
                  rows={4}
                  value={editing ? form.summary : form.summary || '—'}
                  placeholder={editing ? t('profile.inline.empty') : undefined}
                  onChange={(e) => set('summary')(e.target.value)}
                  onBlur={() => commit()}
                />
              </Section>

              <Section icon="star" title={t('profile.section.skills')}>
                <div className="space-y-5">
                  <ChipsField label={t('profile.skills.primary')} values={form.primary} editing={editing} onChange={setNow('primary')} chipClass={PILL_PRIMARY} />
                  {(editing || form.secondary.length > 0) && (
                    <ChipsField label={t('profile.skills.secondary')} values={form.secondary} editing={editing} onChange={setNow('secondary')} chipClass={PILL_SECONDARY} />
                  )}
                  <ChipsField label={t('profile.section.techStack')} values={form.techStack} editing={editing} onChange={setNow('techStack')} chipClass={CHIP_TECH} />
                </div>
              </Section>

              <Section icon="tune" title={t('profile.section.attributes')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <SelectField label={t('profile.field.seniority')} value={form.seniority} editing={editing} onChange={setNow('seniority')} options={options('seniority')} />
                  <SelectField label={t('profile.field.english')} value={form.english} editing={editing} onChange={setNow('english')} options={options('english')} />
                  <TextField
                    label={t('profile.field.availability')}
                    type="date"
                    value={editing ? form.available : form.available ? shortDate(form.available) : ''}
                    editing={editing}
                    onChange={set('available')}
                    onCommit={() => commit()}
                  />
                  <TextField
                    label={t('profile.field.rate')}
                    value={editing ? form.rate : form.rate ? t('matching.rate', { n: Number(form.rate).toLocaleString('en-US') }) : t('matching.contactRate')}
                    display={form.rate ? t('matching.rate', { n: Number(form.rate).toLocaleString('en-US') }) : undefined}
                    editing={editing}
                    onChange={(v) => set('rate')(v.replace(/[^\d]/g, ''))}
                    onCommit={() => commit()}
                    placeholder={t('matching.contactRate')}
                  />
                  <div className="md:col-span-2">
                    <ChipsField label={t('profile.field.domain')} values={form.domains} editing={editing} onChange={setNow('domains')} chipClass={CHIP_DOMAIN} />
                  </div>
                  <Toggle label={t('profile.field.openToWork')} checked={form.openToWork} editing={editing} onChange={setNow('openToWork')} />
                </div>
              </Section>

              <Section icon="work_history" title={t('profile.section.preferences')}>
                <div className="space-y-5">
                  <ChoiceChips label={t('profile.pref.workMode')} options={WORK_MODES} values={form.workModes} editing={editing} onChange={setNow('workModes')} labelFor={(v) => t(`profile.workMode.${v}`)} />
                  <ChoiceChips label={t('profile.pref.employment')} options={EMPLOYMENT_TYPES} values={form.employmentTypes} editing={editing} onChange={setNow('employmentTypes')} labelFor={(v) => t(`profile.employment.${v}`)} />
                  <Toggle label={t('profile.pref.relocate')} checked={form.relocate} editing={editing} onChange={setNow('relocate')} />
                </div>
              </Section>

              <Section icon="work" title={t('profile.section.experience')} onBlur={commitOnLeave}>
                <ExperienceEditor items={form.experience} editing={editing} onChange={set('experience')} />
              </Section>
              <Section icon="rocket_launch" title={t('profile.section.projects')} onBlur={commitOnLeave}>
                <ProjectsEditor items={form.projects} editing={editing} onChange={set('projects')} techChipClass={CHIP_DOMAIN} />
              </Section>
              <Section icon="school" title={t('profile.section.education')} onBlur={commitOnLeave}>
                <EducationEditor items={form.education} editing={editing} onChange={set('education')} />
              </Section>
              <Section icon="workspace_premium" title={t('profile.section.certifications')}>
                <ChipsField values={form.certifications} editing={editing} onChange={setNow('certifications')} chipClass={CHIP_TECH} />
              </Section>
              <Section icon="translate" title={t('profile.section.languages')}>
                <ChipsField values={form.languages} editing={editing} onChange={setNow('languages')} chipClass={CHIP_TECH} placeholder={t('profile.languages.placeholder')} />
              </Section>
              <Section icon="sell" title={t('profile.section.tags')}>
                <ChipsField values={form.tags} editing={editing} onChange={setNow('tags')} chipClass={CHIP_TAG} emptyText={t('profile.tags.empty')} />
              </Section>

              {/* Kept by the system, not typed: shown as plain text with a lock so it does not read as editable. */}
              <Section icon="info" title={t('profile.section.record')} aside={<span className="flex items-center gap-1 text-xs text-ink-muted"><span aria-hidden="true" className="material-symbols-outlined text-[14px]">lock</span>{t('profile.record.auto')}</span>}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <TextField label={t('profile.field.source')} value={c.source} editing={false} />
                  <TextField label={t('profile.field.createdAt')} value={shortDate(c.createdAt)} editing={false} />
                  <TextField label={t('profile.field.years')} value={years > 0 ? t('candidates.years', { n: years }) : ''} editing={false} />
                  <TextField label={t('profile.field.lastUpdatedBy')} value={lastEditText} editing={false} testId="candidate-detail-lastupdatedby-input" />
                  <div className="space-y-1 md:col-span-2">
                    <TextField label={t('profile.field.cvOwner')} value={userName(users, c.cvOwner)} editing={false} testId="candidate-detail-cvowner-input" />
                    {full && <OwnerControls c={c} fixture={fixture} />}
                  </div>
                </div>
              </Section>

              {showNew && full && (c.cvVersions?.length ?? 0) > 0 && <div className={CARD}><CvVersions candidate={c} /></div>}
              {showNew && full && <PrivacyPanel candidate={c} />}
              {showNew && full && <div className={CARD}><ActivityHistory candidateId={c.id} /></div>}
              <div className="h-4"></div>
            </div>
            </div>
          </div>
          <div className="w-full lg:w-1/2 h-[85vh] lg:h-auto flex-shrink-0 lg:flex-shrink flex flex-col bg-gray-100 dark:bg-dark-canvas">
            {/* Viewer toolbar: which file this is on the left, view and file actions on the right. */}
            <div className="h-14 bg-white dark:bg-dark-surface border-b border-line dark:border-dark-raised flex items-center justify-between gap-3 px-4">
              <div className="flex items-center gap-3 min-w-0">
                <span aria-hidden="true" className="size-8 shrink-0 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center justify-center material-symbols-outlined text-[18px]">picture_as_pdf</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink dark:text-white truncate" title={cvFile}>{cvFile}</p>
                  <p className="text-xs text-ink-muted truncate">{latestCv ? t('profile.doc.uploaded', { date: shortDate(latestCv.at) }) : t('profile.doc.original')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div role="group" aria-label={t('profile.doc.zoom')} className="flex items-center rounded-lg border border-line dark:border-dark-line">
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - ZOOM_STEP))} disabled={zoom <= 0.5} className={`${VIEW_BTN} rounded-l-lg`} title={t('profile.doc.zoomOut')} aria-label={t('profile.doc.zoomOut')}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <button onClick={() => setZoom(1)} className="h-8 min-w-[48px] px-1 border-x border-line dark:border-dark-line text-xs font-semibold tabular-nums text-ink dark:text-white hover:text-primary transition-colors" title={t('profile.doc.resetZoom')}>
                    {Math.round(zoom * 100)}%
                  </button>
                  <button onClick={() => setZoom((z) => Math.min(2, z + ZOOM_STEP))} disabled={zoom >= 2} className={`${VIEW_BTN} rounded-r-lg`} title={t('profile.doc.zoomIn')} aria-label={t('profile.doc.zoomIn')}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
                {/* The original file carries contact data, so only users allowed to see it can open or download it. */}
                {pii && (
                  <>
                    <span aria-hidden="true" className="mx-1.5 h-5 w-px bg-line dark:bg-dark-line" />
                    <button onClick={() => openCv(cvRef.current, c.name)} className={`${VIEW_BTN} rounded-lg`} title={t('profile.doc.openTab')} aria-label={t('profile.doc.openTab')}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">open_in_new</span>
                    </button>
                    <button onClick={() => downloadCv(cvRef.current, c.name)} className={`${VIEW_BTN} rounded-lg`} title={t('profile.doc.download')} aria-label={t('profile.doc.download')}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">download</span>
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 relative overflow-hidden">
              <div ref={cvRef}><CvDocument c={c} zoom={zoom} maskContact={!pii} /></div>
            </div>
          </div>
        </div>
      </div>
      {showNew && <AddToPipelineModal open={pipelineOpen} onClose={() => setPipelineOpen(false)} candidateIds={[c.id]} />}
      {mailing && <EmailComposer open candidateId={c.id} onClose={() => setMailing(false)} />}
    </AppLayout>
  );
}
