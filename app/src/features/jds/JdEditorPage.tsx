import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Field, TagField } from '../../components/TagField';
import { NotFoundState } from '../../components/NotFoundState';
import { toast } from '../../components/Toast';
import { extractJd, jdRequirements } from '../../domain/jdExtract';
import { CERT_OPTIONS, domainOptions, LANGUAGE_OPTIONS, skillOptions, suggestDomains, suggestMustHave, suggestNiceToHave, suggestSkills } from '../../domain/jdSuggest';
import { generateJdFromTitle, rewriteJdStandard } from '../../domain/jdWriter';
import { EDUCATIONS, type Education, type Jd, type JdInput, type TaxonomyItem } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';

const INPUT =
  'w-full px-4 py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-xl text-sm text-[#181211] dark:text-white placeholder-[#b5a7a3] focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';
// Compact footer buttons, the same size as the JD detail action bar.
const BTN_BAR = 'h-8 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors';
const BTN_GHOST = `${BTN_BAR} border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white hover:bg-gray-50 dark:hover:bg-[#332d2c]`;
const BTN_PRIMARY = `${BTN_BAR} font-bold text-white bg-brand-vivid hover:bg-[#e65e00] shadow-sm`;
const BTN_SM_PRIMARY =
  'px-4 py-1.5 text-sm font-semibold bg-brand-accent hover:bg-brand-strong text-white rounded-full transition-colors inline-flex items-center gap-1 disabled:opacity-40';
const BTN_SM_GHOST =
  'px-4 py-1.5 text-sm font-semibold border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white rounded-full hover:border-primary/50 transition-colors inline-flex items-center gap-1';
const MODELS = ['Onsite', 'Hybrid', 'Remote'] as const;
/** One-click starting points for "Create with AI". */
const EXAMPLES = ['Senior Backend Engineer', 'QA Engineer', 'Junior Mobile Developer', 'Growth Marketing Manager'];

/** One short line (a job title, not a JD): AI writes a draft instead of reading one. */
export const isJobTitle = (text: string): boolean => {
  const t = text.trim();
  return Boolean(t) && !/\r?\n/.test(t) && t.length <= 80 && t.split(/\s+/).length <= 8;
};

type Model = (typeof MODELS)[number];
type Form = {
  title: string; client: string; skills: string[]; mustHave: string[]; niceToHave: string[];
  seniority: string; minYears: string; english: string; availableFrom: string; domains: string[]; location: string; workingModel: Model;
  responsibilities: string; body: string;
  summary: string; aboutTeam: string; education: Education | ''; major: string;
  languages: string[]; certifications: string[]; otherRequirements: string; criticalSkills: string[];
};

const lines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
/** Responsibilities and daily tasks are one list now: older JDs (and AI drafts) keep both, so fold them together. */
const duties = (...lists: Array<string[] | undefined>) => [...new Set(lists.flatMap((l) => l ?? []))];
const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? undefined : Number(s));
const str = (n?: number) => (n === undefined ? '' : String(n));

function formOf(jd: Jd | undefined, today: string, taxonomy: TaxonomyItem[]): Form {
  // Older JDs have no structured fields: start from what their text implies, as matching does.
  const req = jd ? jdRequirements(jd, taxonomy) : undefined;
  return {
    title: jd?.title ?? '', client: jd?.client ?? '', skills: jd?.skills ?? [], mustHave: jd?.mustHave ?? [], niceToHave: jd?.niceToHave ?? [],
    // New JDs start where prod does: Senior, 5 years, Advanced English, Hybrid, available today.
    seniority: req ? req.seniority ?? '' : 'Senior', minYears: req ? str(req.years) : '5', english: req ? req.english ?? '' : 'Advanced',
    availableFrom: jd ? jd.availableFrom ?? '' : today, domains: jd?.domains ?? [], location: jd?.location ?? '',
    workingModel: jd?.workingModel ?? 'Hybrid', responsibilities: duties(jd?.responsibilities, jd?.dailyTasks).join('\n'),
    body: jd?.body ?? '',
    summary: jd ? jd.summary ?? extractJd(jd.body).summary ?? '' : '', aboutTeam: jd?.aboutTeam ?? '',
    education: jd?.education ?? '', major: jd?.major ?? '', languages: jd?.languages ?? [],
    certifications: jd?.certifications ?? [], otherRequirements: jd?.otherRequirements ?? '', criticalSkills: jd?.criticalSkills ?? [],
  };
}

function toInput(f: Form): JdInput {
  return {
    title: f.title.trim(), client: f.client.trim(), skills: f.skills, mustHave: f.mustHave, niceToHave: f.niceToHave, domains: f.domains,
    seniority: f.seniority || undefined, minYears: num(f.minYears), english: f.english || undefined,
    availableFrom: f.availableFrom || undefined, location: f.location.trim() || undefined, workingModel: f.workingModel,
    // Daily tasks live in responsibilities; the careers page lists requirements from must-have, not a prose block.
    responsibilities: lines(f.responsibilities), body: f.body, skillsExperience: '',
    summary: f.summary.trim() || undefined, aboutTeam: f.aboutTeam.trim() || undefined, dailyTasks: [],
    education: f.education || undefined, major: f.major.trim() || undefined,
    languages: f.languages, certifications: f.certifications, otherRequirements: f.otherRequirements.trim() || undefined,
    // Only skills still in the stack can be critical.
    criticalSkills: f.criticalSkills.filter((c) => f.skills.includes(c)),
  };
}


/** A numbered form block, styled like the Job editor's sections. */
function Section({ n, id, title, hint, badge, children }: { n: number; id: string; title: string; hint: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`jd-section-${id}`} className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-[#e6dddb] dark:border-[#2a2423] p-6 lg:p-8 shadow-sm flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`jd-section-${id}`} className="flex items-center gap-2 text-base font-bold text-[#181211] dark:text-white">
            <span aria-hidden="true" className="size-6 grid place-items-center rounded-full bg-primary/10 text-primary text-xs">{n}</span>
            {title}
          </h2>
          <p className="mt-1 ml-8 text-xs text-[#896a61]">{hint}</p>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function SectionHead({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#5b4a45] dark:text-gray-300">
      <span className={`size-1.5 rounded-full ${active ? 'bg-brand-accent' : 'bg-[#896a61]'}`}></span>{children}
    </h4>
  );
}

/** Create (`/jds/new`) or edit (`/jds/:id/edit`) a JD as a full page, laid out like prod's /jds/create. */
export function JdEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const t = useT();
  const { id } = useParams();
  const jd = useStore((s) => (id ? s.jds.find((j) => j.id === id) : undefined));
  if (mode === 'edit' && !jd) {
    return (
      <AppLayout title={t('nav.jdManagement')}>
        <NotFoundState icon="search_off" message={t('jds.page.notFound')} backTo="/jds" backLabel={t('jds.page.backList')} />
      </AppLayout>
    );
  }
  return <Editor key={jd?.id ?? 'new'} jd={jd} />;
}

function Editor({ jd }: { jd?: Jd }) {
  const t = useT();
  const navigate = useNavigate();
  const taxonomy = useStore((s) => s.taxonomy);
  const jds = useStore((s) => s.jds);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState<Form>(() => formOf(jd, today, taxonomy));
  const [touched, setTouched] = useState(false);
  const [source, setSource] = useState('');
  // What the form was last filled from; the AI card folds into a slim bar until the user starts over.
  // The last AI fill: where it came from, what it filled per section, and the form before it (for Undo).
  const [filled, setFilled] = useState<{ from: string; summary: Array<[number, string, string]>; before: Form } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [asking, setAsking] = useState(false);
  // "Rewrite to standard": the tidied JD waits here for review; nothing reaches the form until the user applies it.
  const [review, setReview] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm((f) => ({ ...f, [k]: v })); setTouched(true); };
  const options = (kind: 'seniority' | 'english', current: string) => {
    const labels = taxonomy.filter((x) => x.kind === kind && x.active).map((x) => x.label);
    return current && !labels.includes(current) ? [current, ...labels] : labels;
  };
  const candidates = useStore((s) => s.candidates);
  const allSkills = useMemo(() => skillOptions(candidates, jds), [candidates, jds]);
  const allDomains = useMemo(() => domainOptions(taxonomy), [taxonomy]);
  const mustLibrary = useMemo(() => [...new Set(jds.flatMap((j) => j.mustHave ?? []))], [jds]);
  const clients = [...new Set(jds.map((j) => j.client).filter(Boolean))].sort();

  useEffect(() => {
    if (!touched) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [touched]);

  // Opened from Create Job ("+ Create a new JD"): Cancel goes back there, and saving returns with the new JD picked.
  const location = useLocation();
  const returnTo = jd ? undefined : (location.state as { returnTo?: string } | null)?.returnTo;
  const from = jd ? `/jds/${jd.id}` : returnTo ?? '/jds';
  const leave = () => (touched ? setAsking(true) : navigate(from));
  const backLabel = jd ? t('common.backTo', { name: jd.title }) : returnTo ? t('jds.page.backToJob') : t('jds.page.backList');

  // What matching reads; Publish also needs what candidates read first.
  const forMatch = {
    title: !form.title.trim(), skills: !form.skills.length, mustHave: !form.mustHave.length, seniority: !form.seniority,
    minYears: num(form.minYears) === undefined, english: !form.english, domains: !form.domains.length,
  };
  const missing = { ...forMatch, summary: !form.summary.trim(), responsibilities: !lines(form.responsibilities).length };
  // Required fields still empty, per section in form order (shown on the AI result bar).
  const gaps: string[][] = [
    [missing.title && t('jds.page.title'), missing.domains && t('jds.page.domain')],
    [missing.summary && t('jds.page.summary'), missing.responsibilities && t('jds.page.duties')],
    [missing.seniority && t('jds.page.seniority'), missing.minYears && t('jds.page.years'), missing.english && t('jds.page.english'),
      missing.skills && t('jds.page.stack'), missing.mustHave && t('jds.page.must')],
  ].map((xs) => xs.filter((x): x is string => Boolean(x)));
  // One-click ideas under each tag field; they follow what is already filled in.
  const ideas = {
    skills: suggestSkills(form.title, form.skills, candidates, allSkills),
    domains: suggestDomains(`${form.title}\n${form.summary}\n${form.body}`, form.domains, taxonomy),
    mustHave: suggestMustHave({
      title: form.title, skills: form.skills, critical: form.criticalSkills, minYears: num(form.minYears),
      english: form.english || undefined, domains: form.domains, seniority: form.seniority,
    }, form.mustHave, [], 4),
    niceToHave: suggestNiceToHave(form.title, form.skills, form.niceToHave, allSkills),
  };
  const err = (k: keyof typeof missing) => showErrors && missing[k];

  const canRun = Boolean(source.trim());
  // Typed text that is just a title is drafted from; anything longer is read as a JD.
  const generating = isJobTitle(source);
  /** One click: read the title or JD, fill the sections, and jump to section 1 so the user reviews from the top. */
  const readSource = (text = source) => (isJobTitle(text) ? generateJdFromTitle(text, form.seniority || undefined) : extractJd(text, taxonomy));
  /** Rewrites the title or JD into the standard sections and shows it for review; the form stays untouched. */
  const rewrite = () => setReview(rewriteJdStandard(readSource()));
  const fillWithAi = (fromReview?: string) => {
    const x = fromReview !== undefined ? extractJd(fromReview, taxonomy) : readSource();
    setFilled({ from: fromReview !== undefined ? t('jds.ai.fromRewrite') : generating ? source.trim() : t('jds.ai.fromText'), summary: aiSummary(x), before: form });
    setReview(null);
    setForm((f) => ({
      ...f,
      title: x.title || f.title, skills: x.skills.length ? x.skills : f.skills, domains: x.domains.length ? x.domains : f.domains,
      mustHave: x.mustHave?.length ? x.mustHave : f.mustHave, niceToHave: x.niceToHave?.length ? x.niceToHave : f.niceToHave,
      seniority: x.seniority ?? f.seniority, minYears: x.minYears !== undefined ? String(x.minYears) : f.minYears,
      english: x.english ?? f.english, workingModel: x.workingModel ?? f.workingModel,
      responsibilities: x.responsibilities?.length || x.dailyTasks?.length ? duties(x.responsibilities, x.dailyTasks).join('\n') : f.responsibilities,
      body: x.body || f.body,
      summary: x.summary ?? f.summary, aboutTeam: x.aboutTeam ?? f.aboutTeam,
      education: x.education ?? f.education,
      major: x.major ?? f.major, certifications: x.certifications?.length ? x.certifications : f.certifications,
    }));
    setTouched(true);
    requestAnimationFrame(() => document.getElementById('jd-section-basic')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  };
  /** Puts back the form as it was before the AI fill; the typed text stays so it can be tweaked and run again. */
  const undoFill = () => {
    if (!filled) return;
    setForm(filled.before);
    setFilled(null);
    toast(t('jds.ai.undone'), 'info');
  };

  /** Per section (in form order): what the AI draft would fill, or '' when it found nothing. */
  const aiSummary = (x: JdInput): Array<[number, string, string]> => {
    const join = (...xs: Array<string | false | undefined>) => xs.filter(Boolean).join(' · ');
    const nDuties = duties(x.responsibilities, x.dailyTasks).length;
    return [
      [1, t('jds.sec.basic'), join(x.title, x.domains.join(', '), x.workingModel && t(`jds.page.model.${x.workingModel}`))],
      [2, t('jds.sec.overview'), join(!!x.summary && t('jds.page.summary'),
        nDuties > 0 && t('jds.ai.n.duties', { n: nDuties }), !!x.aboutTeam && t('jds.page.team'))],
      [3, t('jds.sec.requirements'), join(x.seniority,
        x.skills.length > 0 && t('jds.ai.n.skills', { n: x.skills.length }), !!x.mustHave?.length && t('jds.ai.n.must', { n: x.mustHave.length }),
        !!x.niceToHave?.length && t('jds.ai.n.nice', { n: x.niceToHave.length }), x.minYears !== undefined && t('jd.yrs', { n: x.minYears }),
        x.english, x.education && t(`education.${x.education}`))],
    ];
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) return toast(t('jds.page.std.fileUnsupported'), 'error');
    const text = await file.text();
    setSource(text);
    toast(t('jds.page.std.fileLoaded', { name: file.name }), 'info');
  };

  /** Draft needs a title; Run Match needs the matching fields. Publishing happens from the JD list menu. */
  const save = (kind: 'draft' | 'match') => {
    const full = kind === 'match';
    if (missing.title || (full && Object.values(forMatch).some(Boolean))) {
      setShowErrors(true);
      if (full && !missing.title) toast(t('jds.page.err.fixMatch'), 'error');
      return;
    }
    const input = toInput(form);
    const { createJd, updateJd } = useStore.getState();
    let saved: Jd;
    if (jd) {
      updateJd(jd.id, input);
      saved = { ...jd, ...input };
      toast(t('jds.toast.saved'));
    } else {
      // Saving never changes the status: a new JD starts as a draft, an edited one keeps its own.
      saved = createJd({ ...input, status: 'Draft' });
      toast(t('jds.toast.created', { code: saved.code }));
    }
    setTouched(false);
    if (returnTo && kind !== 'match') return navigate(`${returnTo}?fromJd=${saved.id}`, { replace: true });
    navigate(kind === 'match' ? `/jd-matching?jd=${saved.id}` : `/jds/${saved.id}`, { replace: true });
  };

  const select = (id: string, value: string, onChange: (v: string) => void, opts: string[], label = (o: string) => o) => (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none pr-10 cursor-pointer`}>
        {!value && <option value="">—</option>}
        {opts.map((o) => <option key={o} value={o}>{label(o)}</option>)}
      </select>
      <span aria-hidden="true" className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#896a61] pointer-events-none">expand_more</span>
    </div>
  );

  // Always on screen, like the Job editor. Saving is the main action (far right); Save & Match saves, then opens matching.
  const footer = (
    <div className="bg-white dark:bg-[#1e1e1e] border-t border-[#e6dddb] dark:border-[#2a2423] shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      {/* Right padding keeps the buttons clear of the floating AI button. */}
      <div className="max-w-[1400px] mx-auto pl-8 pr-20 py-2 flex items-center gap-2 flex-wrap">
        <button type="button" onClick={leave} className={BTN_GHOST}>{t('common.cancel')}</button>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => save('match')} className={BTN_GHOST}>
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">play_arrow</span>{t('jds.page.runMatch')}
          </button>
          <button type="button" onClick={() => save('draft')} className={BTN_PRIMARY}>
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">save</span>
            {t(jd?.status === 'Published' ? 'jds.page.saveChanges' : 'jds.page.saveDraft')}
          </button>
        </div>
      </div>
    </div>
  );

  const aiBadge = <span className="shrink-0 px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-500/15 text-2xs font-bold text-orange-600 dark:text-orange-300">{t('jds.sec.aiBadge')}</span>;

  return (
    <AppLayout title={t(jd ? 'jds.page.editTitle' : 'jds.page.createTitle')} subtitle={t('jds.page.subtitle')} back={{ label: backLabel, onClick: leave }} footer={footer}>
      <div className="min-h-full bg-[#fbf9f8] dark:bg-background-dark">
        {asking && (
          <div role="alertdialog" aria-label={t('drawer.discard.title')} className="sticky top-0 z-20 px-8 py-3 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 flex items-center gap-3 text-sm">
            <span className="flex-1 font-semibold text-amber-900 dark:text-amber-100">{t('drawer.discard.title')}</span>
            <button type="button" onClick={() => setAsking(false)} className="px-3 py-1.5 rounded-full border border-[#e6dddb] bg-white dark:bg-transparent dark:text-white font-bold">{t('drawer.discard.keep')}</button>
            <button type="button" onClick={() => navigate(from)} className="px-3 py-1.5 rounded-full bg-red-600 text-white font-bold">{t('drawer.discard.confirm')}</button>
          </div>
        )}
        <div className="p-8 max-w-[1400px] mx-auto flex flex-col gap-5">
          {/* Option 1, Create with AI: type a title or paste / drop a JD -> AI fills the sections -> review, or Undo. */}
          {filled ? (
            <section aria-labelledby="jd-section-ai" className="rounded-xl border border-green-200 dark:border-green-700/50 bg-green-50/70 dark:bg-green-900/15 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span aria-hidden="true" className="size-8 shrink-0 rounded-lg bg-green-500 text-white grid place-items-center">
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </span>
                <div className="flex-1 min-w-0">
                  <h2 id="jd-section-ai" className="text-[15px] font-bold text-[#181211] dark:text-white">{t('jds.ai.appliedTitle', { from: filled.from })}</h2>
                  <p className="text-xs text-[#5b4a45] dark:text-gray-400">{t('jds.ai.appliedHint')}</p>
                </div>
                <button type="button" onClick={undoFill} className={`${BTN_SM_GHOST} bg-white dark:bg-transparent`}>
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">undo</span>{t('jds.ai.undo')}
                </button>
                <button type="button" onClick={() => { setFilled(null); setSource(''); }} className={`${BTN_SM_GHOST} bg-white dark:bg-transparent`}>
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">refresh</span>{t('jds.ai.again')}
                </button>
              </div>
              {/* Per section: what AI filled, or a nudge to fill it by hand. */}
              <dl className="ml-[42px] grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-x-4 gap-y-1 text-xs">
                {filled.summary.map(([n, title, found]) => (
                  <div key={n} className="contents">
                    <dt className="text-[#896a61]">{n}. {title}</dt>
                    <dd className="text-[#181211] dark:text-gray-200">
                      {found ? <><span aria-hidden="true" className="text-green-600">✓ </span>{found}</> : <span className="text-[#b5a7a3]">{t('jds.ai.nothing')}</span>}
                      {gaps[n - 1].length > 0 && <span className="ml-2 text-amber-700 dark:text-amber-300 font-semibold">{t('jds.ai.missing', { fields: gaps[n - 1].join(', ') })}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : (
            <section aria-labelledby="jd-section-ai" className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50/60 dark:bg-orange-500/5 p-5 lg:p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span aria-hidden="true" className="size-8 shrink-0 rounded-lg bg-white dark:bg-[#1e1e1e] border border-orange-200 dark:border-orange-500/30 text-orange-500 grid place-items-center">
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                </span>
                <h2 id="jd-section-ai" className="text-[15px] font-bold text-[#181211] dark:text-white">{t('jds.page.std.title')}</h2>
                <span className="text-xs text-[#896a61]">{t('jds.page.std.hint')}</span>
              </div>

              {review !== null ? (
                <div className="flex flex-col gap-2.5">
                  <div className="rounded-xl bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                    <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-[#f0ebe9] dark:border-[#3a3433]">
                      <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-orange-500">spellcheck</span>
                      <span className="text-sm font-bold text-[#181211] dark:text-white">{t('jds.ai.reviewTitle')}</span>
                      <span className="text-xs text-[#896a61]">{t('jds.ai.reviewHint')}</span>
                    </div>
                    <textarea aria-label={t('jds.ai.reviewTitle')} rows={16} value={review} onChange={(e) => setReview(e.target.value)}
                      className="w-full block resize-y bg-transparent border-0 px-4 py-3 text-sm leading-relaxed text-[#181211] dark:text-white focus:ring-0 focus:outline-none" />
                    <div className="flex flex-wrap items-center gap-2 px-2.5 pb-2.5">
                      <button type="button" onClick={() => setReview(null)} className={BTN_SM_GHOST}>
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_back</span>{t('jds.ai.backToSource')}
                      </button>
                      <button type="button" onClick={rewrite} className={BTN_SM_GHOST}>
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">refresh</span>{t('jds.ai.rewriteAgain')}
                      </button>
                      <button type="button" onClick={() => fillWithAi(review)} disabled={!review.trim()} className={`${BTN_SM_PRIMARY} ml-auto`}>
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">check</span>{t('jds.ai.applyRewrite')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
              /* One box for a title or a whole JD; files can be attached or dropped on it. */
                <div className="flex flex-col gap-2.5">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files?.[0]); }}
                    className={`rounded-xl bg-white dark:bg-[#251f1e] border transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${dragging ? 'border-primary border-dashed' : 'border-[#e6dddb] dark:border-[#3a3433]'}`}
                  >
                    <textarea aria-label={t('jds.page.std.pasteLabel')} rows={Math.min(Math.max(source.split('\n').length, 3), 18)} value={source}
                      onChange={(e) => setSource(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canRun) fillWithAi(); }}
                      placeholder={t('jds.page.std.pastePlaceholder')}
                      className="w-full block resize-y bg-transparent border-0 rounded-t-xl px-4 pt-3 pb-1 text-sm text-[#181211] dark:text-white placeholder-[#b5a7a3] focus:ring-0 focus:outline-none" />
                    <div className="flex flex-wrap items-center gap-2 px-2.5 pb-2.5">
                      <label className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#896a61] hover:text-[#181211] hover:bg-[#f4f1f0] dark:hover:bg-white/10 dark:hover:text-white cursor-pointer">
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">attach_file</span>{t('jds.ai.attach')}
                        <input type="file" accept=".txt,.md,.pdf,.doc,.docx" className="sr-only" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
                      </label>
                      {source.trim() && (
                        <span role="status" className="inline-flex items-center gap-1 text-xs text-orange-700 dark:text-orange-300">
                          <span aria-hidden="true" className="material-symbols-outlined text-[15px]">{generating ? 'edit_square' : 'manage_search'}</span>
                          {t(generating ? 'jds.page.std.modeTitle' : 'jds.page.std.modeJd')}
                        </span>
                      )}
                      <button type="button" onClick={rewrite} disabled={!canRun} className={`${BTN_SM_GHOST} ml-auto disabled:opacity-40`}>
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">spellcheck</span>{t('jds.ai.rewrite')}
                      </button>
                      <button type="button" onClick={() => fillWithAi()} disabled={!canRun} className={BTN_SM_PRIMARY}>
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">auto_fix_high</span>{t('jds.ai.fill')}
                      </button>
                    </div>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[#896a61]">
                    {t('jds.ai.try')}
                    {EXAMPLES.map((x, i) => (
                      <span key={x} className="inline-flex items-center gap-1.5">
                        {i > 0 && <span aria-hidden="true">·</span>}
                        <button type="button" onClick={() => setSource(x)} className="font-medium text-[#5b4a45] dark:text-gray-300 hover:text-primary hover:underline underline-offset-2">{x}</button>
                      </span>
                    ))}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* The other way in: fill the sections by hand. */}
          {!filled && (
            <div role="separator" aria-label={t('jds.page.orManual')} className="flex items-center gap-3 text-xs text-[#896a61]">
              <span className="flex-1 border-t border-[#e6dddb] dark:border-[#3a3433]"></span>
              {t('jds.page.orManual')}
              <span className="flex-1 border-t border-[#e6dddb] dark:border-[#3a3433]"></span>
            </div>
          )}

          <Section n={1} id="basic" title={t('jds.sec.basic')} hint={t('jds.sec.basicHint')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              <Field id="jd-title" label={t('jds.page.title')} required error={err('title')}>
                <input id="jd-title" className={INPUT} value={form.title} placeholder={t('jds.page.titlePlaceholder')} onChange={(e) => set('title', e.target.value)} />
              </Field>
              <Field id="jd-client" label={t('jds.page.clientPlaceholder')}>
                <input id="jd-client" list="jd-client-list" className={INPUT} value={form.client} placeholder={t('jds.page.clientHint')} onChange={(e) => set('client', e.target.value)} />
                <datalist id="jd-client-list">{clients.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <div className="md:col-span-2">
                <TagField id="jd-domain" label={t('jds.page.domain')} required placeholder={t('jds.page.domainAdd')} values={form.domains} onChange={(v) => set('domains', v)} options={allDomains} quick={ideas.domains} error={err('domains')} />
              </div>
            </div>
            {/* Where and when: working conditions on one row. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
              <Field id="jd-location" label={t('jds.page.location')}>
                <input id="jd-location" className={INPUT} placeholder={t('jds.page.locationPlaceholder')} value={form.location} onChange={(e) => set('location', e.target.value)} />
              </Field>
              <Field id="jd-model" label={t('jds.page.model')}>
                {select('jd-model', form.workingModel, (v) => set('workingModel', v as Model), [...MODELS], (o) => t(`jds.page.model.${o as Model}`))}
              </Field>
              <Field id="jd-available" label={t('jds.page.available')}>
                <input id="jd-available" type="date" className={INPUT} value={form.availableFrom} onChange={(e) => set('availableFrom', e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* What the role is comes before what it needs, as candidates (and the standard rewrite) read it. */}
          <Section n={2} id="overview" title={t('jds.sec.overview')} hint={t('jds.sec.overviewHint')}>
            <Field id="jd-summary" label={t('jds.page.summary')} required error={err('summary')}>
              <textarea id="jd-summary" rows={3} className={INPUT} placeholder={t('jds.page.summaryPlaceholder')} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
            </Field>
            <Field id="jd-duties" label={t('jds.page.duties')} required error={err('responsibilities')}>
              <textarea id="jd-duties" rows={6} className={INPUT} placeholder={t('jds.page.dutiesPlaceholder')} value={form.responsibilities} onChange={(e) => set('responsibilities', e.target.value)} />
            </Field>
            <Field id="jd-team" label={t('jds.page.team')}>
              <textarea id="jd-team" rows={2} className={INPUT} placeholder={t('jds.page.teamPlaceholder')} value={form.aboutTeam} onChange={(e) => set('aboutTeam', e.target.value)} />
            </Field>
          </Section>

          <Section n={3} id="requirements" title={t('jds.sec.requirements')} hint={t('jds.sec.requirementsHint')} badge={aiBadge}>
            <SectionHead active>{t('jds.page.core')}</SectionHead>
            {/* Level, years and English go together (Senior ~ 5 yrs): one row, ahead of the lists. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
              <Field id="jd-seniority" label={t('jds.page.seniority')} required error={err('seniority')}>
                {select('jd-seniority', form.seniority, (v) => set('seniority', v), options('seniority', form.seniority))}
              </Field>
              <Field id="jd-years" label={t('jds.page.years')} required error={err('minYears')}>
                <input id="jd-years" type="number" min={0} max={40} className={INPUT} value={form.minYears} onChange={(e) => set('minYears', e.target.value)} />
              </Field>
              <Field id="jd-english" label={t('jds.page.english')} required error={err('english')}>
                {select('jd-english', form.english, (v) => set('english', v), options('english', form.english))}
              </Field>
            </div>
            <TagField id="jd-stack" label={t('jds.page.stack')} required placeholder={t('jds.page.stackAdd')} values={form.skills} onChange={(v) => set('skills', v)} error={err('skills')} options={allSkills} quick={ideas.skills}
              starred={form.criticalSkills} hint={t('jds.page.criticalHint')}
              onStar={(v) => set('criticalSkills', form.criticalSkills.includes(v) ? form.criticalSkills.filter((x) => x !== v) : [...form.criticalSkills, v])} />
            <TagField id="jd-must" label={t('jds.page.must')} required placeholder={t('jds.page.mustAdd')} values={form.mustHave} onChange={(v) => set('mustHave', v)} error={err('mustHave')} list options={mustLibrary} quick={ideas.mustHave} />
            <TagField id="jd-nice" label={t('jds.page.nice')} placeholder={t('jds.page.niceAdd')} values={form.niceToHave} onChange={(v) => set('niceToHave', v)} list quick={ideas.niceToHave} />
            <div className="pt-6 border-t border-[#f0ebe9] dark:border-[#2a2423] flex flex-col gap-6">
              <SectionHead>{t('jds.page.qualifications')}</SectionHead>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                <Field id="jd-education" label={t('jds.page.education')}>
                  {select('jd-education', form.education, (v) => set('education', v as Education | ''), [...EDUCATIONS], (o) => t(`education.${o as Education}`))}
                </Field>
                <Field id="jd-major" label={t('jds.page.major')}>
                  <input id="jd-major" className={INPUT} placeholder={t('jds.page.majorPlaceholder')} value={form.major} onChange={(e) => set('major', e.target.value)} />
                </Field>
              </div>
              <TagField id="jd-certs" label={t('jds.page.certs')} placeholder={t('jds.page.certsAdd')} values={form.certifications} onChange={(v) => set('certifications', v)} options={CERT_OPTIONS} />
              <TagField id="jd-languages" label={t('jds.page.languages')} placeholder={t('jds.page.languagesAdd')} values={form.languages} onChange={(v) => set('languages', v)} options={LANGUAGE_OPTIONS} />
              <Field id="jd-other" label={t('jds.page.other')} aside={<span className="text-2xs text-[#896a61]">{t('jds.page.otherAside')}</span>}>
                <textarea id="jd-other" rows={3} className={INPUT} placeholder={t('jds.page.otherPlaceholder')} value={form.otherRequirements} onChange={(e) => set('otherRequirements', e.target.value)} />
              </Field>
            </div>
          </Section>
        </div>
      </div>
    </AppLayout>
  );
}
