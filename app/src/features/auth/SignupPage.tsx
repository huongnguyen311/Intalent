import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BrandMark } from '../../components/BrandMark';
import { toast } from '../../components/Toast';
import { newWorkspaceState } from '../../data/workspace';
import { COUNTRIES, DEFAULT_COMPANY, isValidSlug, slugify, TIMEZONES, type CompanySettings } from '../../domain/company';
import { normalizeEmail } from '../../domain/normalize';
import { homeFor, ROLES, type Role } from '../../domain/permissions';
import type { Lang, User } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { pickData, PERSIST_VERSION } from '../../store/persist';
import {
  activeWorkspaceId, checkToken, consumeToken, demoHash, enterWorkspace, registerWorkspace, setActiveWorkspace, slugTaken,
  tokenUsed, workspaceBySlug, writeWorkspaceData, type TokenCheck,
} from '../../store/platform';
import { signInAs } from '../../store/session';
import { useStore } from '../../store/store';
import { findAccounts, sendInvitation, sendPasswordReset, sendVerification } from './accounts';

const FIELD = 'w-full h-11 px-4 rounded-lg bg-[#f8f6f6] ring-1 ring-gray-200 focus:ring-2 focus:ring-primary outline-none text-sm';
const LABEL = 'text-sm font-semibold text-[#181211]';
const PRIMARY = 'h-11 px-6 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-sm disabled:opacity-50';
const GHOST = 'h-11 px-5 rounded-lg border border-[#e6dddb] text-sm font-bold text-[#896a61] hover:text-[#181211] inline-flex items-center';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_ROLES = ROLES.filter((r) => r !== 'Super Admin' && r !== 'Candidate');
const DRAFT_KEY = 'intalent-signup-draft';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background-light flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">
        <div className="flex items-center gap-3">
          <BrandMark className="h-9" />
          <span className="text-xl font-bold tracking-tight text-[#181211]">InTalent</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#181211]">{title}</h1>
          {subtitle && <p className="text-sm text-[#896a61] mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Link to the demo mailbox, where every email the product sends lands. */
export function InboxLink({ email }: { email?: string }) {
  const t = useT();
  return (
    <a href={`/inbox${email ? `?to=${encodeURIComponent(normalizeEmail(email))}` : ''}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">mail</span>{t('inbox.open')}
    </a>
  );
}

type Draft = { token: string; name: string; email: string; passwordHash: string; verified?: boolean };
const readDraft = (): Draft | null => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
  } catch {
    return null;
  }
};
const saveDraft = (d: Draft | null) => {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
};

type Invite = { email: string; role: Role };
const STEPS = ['account', 'verify', 'workspace', 'invite'] as const;

/**
 * PRD 4.1 company onboarding (FE-01): account -> email verification (link sent to the demo mailbox) -> workspace ->
 * invite teammates -> first job. The new workspace is a separate tenant: it starts empty unless sample data is asked for.
 */
export function SignupPage() {
  const t = useT();
  const [params] = useSearchParams();
  const resumed = readDraft();
  const resumeVerified = !!resumed && params.get('verified') === resumed.token && tokenUsed(resumed.token);
  const [step, setStep] = useState(resumeVerified ? 2 : 0);
  const [account, setAccount] = useState({ name: resumed?.name ?? '', email: resumed?.email ?? '', password: '' });
  const [draft, setDraft] = useState<Draft | null>(resumeVerified ? resumed : null);
  const [ws, setWs] = useState<Omit<CompanySettings, 'workspaceId'>>({
    name: '', logoText: '', country: 'VN', language: 'en' as Lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', careersSlug: '',
  });
  const [sample, setSample] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([{ email: '', role: 'Recruiter' }]);
  const [error, setError] = useState('');

  // Step 2 waits for the link in the demo mailbox to be opened (in this tab or another one).
  useEffect(() => {
    if (step !== 1 || !draft) return;
    const check = () => {
      if (tokenUsed(draft.token)) {
        setStep(2);
        setError('');
      }
    };
    const timer = window.setInterval(check, 1000);
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
    };
  }, [step, draft]);

  const submitAccount = (e: FormEvent) => {
    e.preventDefault();
    const email = normalizeEmail(account.email);
    if (!account.name.trim() || !EMAIL.test(email) || account.password.length < 8) return setError(t('signup.err.account'));
    setError('');
    const token = sendVerification(email, account.name.trim());
    const d: Draft = { token, name: account.name.trim(), email, passwordHash: demoHash(account.password) };
    saveDraft(d);
    setDraft(d);
    setStep(1);
  };
  const resend = () => {
    if (!draft) return;
    const token = sendVerification(draft.email, draft.name);
    const d = { ...draft, token };
    saveDraft(d);
    setDraft(d);
    toast(t('signup.resent'));
  };
  const submitWorkspace = (e: FormEvent) => {
    e.preventDefault();
    if (!ws.name.trim() || !isValidSlug(ws.careersSlug)) return setError(t('signup.err.workspace'));
    if (slugTaken(ws.careersSlug)) return setError(t('signup.err.slugTaken'));
    setError('');
    setStep(3);
  };
  const finish = () => {
    if (!draft || !tokenUsed(draft.token)) return setError(t('signup.err.unverified'));
    const now = new Date().toISOString();
    const suffix = Math.random().toString(36).slice(2, 6);
    const workspaceId = `ws-${ws.careersSlug}-${suffix}`;
    const company: CompanySettings = {
      ...DEFAULT_COMPANY, ...ws, workspaceId, name: ws.name.trim(),
      logoText: (ws.logoText || ws.name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2)).toUpperCase(),
    };
    const owner: User = { id: `u-${suffix}-owner`, name: draft.name, email: draft.email, role: 'Super Admin', status: 'Active', createdAt: now, passwordHash: draft.passwordHash };
    const state = newWorkspaceState({ company, owner, sampleData: sample });
    const valid = invites
      .map((i) => ({ ...i, email: normalizeEmail(i.email) }))
      .filter((i, idx, all) => EMAIL.test(i.email) && i.email !== draft.email && all.findIndex((x) => x.email === i.email) === idx);
    const invited: User[] = valid.map((i, n) => ({ id: `u-${suffix}-${n + 1}`, name: i.email.split('@')[0], email: i.email, role: i.role, status: 'Invited', createdAt: now }));
    state.users = [...state.users.filter((u) => !valid.some((i) => normalizeEmail(u.email) === i.email)), ...invited];
    state.activities = [
      ...state.activities,
      ...invited.map((u) => ({ type: 'user_invited' as const, userId: u.id, by: owner.id, at: now, detail: `${u.email} as ${u.role}` })),
    ];
    writeWorkspaceData(workspaceId, pickData(state), PERSIST_VERSION);
    registerWorkspace({ id: workspaceId, name: company.name, slug: company.careersSlug, createdAt: now });
    for (const u of invited) sendInvitation(u, owner.name, company);
    saveDraft(null);
    setActiveWorkspace(workspaceId);
    // PRD 4.1 step 6: the workspace is ready once the first job exists, so land on a new job form.
    window.location.assign('/jobs/new');
  };

  const progress = (
    <ol className="flex gap-2" aria-label={t('signup.progress')}>
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === step ? 'step' : undefined} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-primary' : 'bg-gray-200'}`} title={t(`signup.step.${s}`)} />
      ))}
    </ol>
  );

  if (step === 0) {
    return (
      <AuthShell title={t('signup.title')} subtitle={t('signup.subtitle')}>
        {progress}
        <form onSubmit={submitAccount} className="space-y-4" noValidate>
          <label className="block space-y-1"><span className={LABEL}>{t('signup.name')}</span><input className={FIELD} value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} /></label>
          <label className="block space-y-1"><span className={LABEL}>{t('signup.email')}</span><input type="email" className={FIELD} value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} /></label>
          <label className="block space-y-1"><span className={LABEL}>{t('signup.password')}</span><input type="password" className={FIELD} value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} /></label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center justify-between">
            <Link to="/login" className="text-sm font-bold text-primary hover:underline">{t('signup.haveAccount')}</Link>
            <button className={PRIMARY}>{t('signup.continue')}</button>
          </div>
        </form>
      </AuthShell>
    );
  }
  if (step === 1) {
    return (
      <AuthShell title={t('signup.verifyTitle')} subtitle={t('signup.verifyBody', { email: draft?.email ?? '' })}>
        {progress}
        <div className="rounded-lg bg-[#f8f6f6] px-4 py-3 text-sm text-[#896a61] space-y-2">
          <p>{t('signup.verifyWaiting')}</p>
          <InboxLink email={draft?.email} />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-between">
          <button className={GHOST} onClick={() => setStep(0)}>{t('signup.back')}</button>
          <button className={GHOST} onClick={resend}>{t('signup.resend')}</button>
        </div>
      </AuthShell>
    );
  }
  if (step === 2) {
    return (
      <AuthShell title={t('signup.workspaceTitle')} subtitle={t('signup.workspaceBody')}>
        {progress}
        <p role="status" className="text-xs rounded-lg bg-emerald-50 text-emerald-800 px-3 py-2">{t('signup.verifiedOk', { email: draft?.email ?? '' })}</p>
        <form onSubmit={submitWorkspace} className="space-y-4" noValidate>
          <label className="block space-y-1">
            <span className={LABEL}>{t('company.name')}</span>
            <input className={FIELD} value={ws.name} onChange={(e) => setWs({ ...ws, name: e.target.value, careersSlug: ws.careersSlug && ws.careersSlug !== slugify(ws.name) ? ws.careersSlug : slugify(e.target.value) })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className={LABEL}>{t('company.country')}</span>
              <select className={FIELD} value={ws.country} onChange={(e) => setWs({ ...ws, country: e.target.value })}>
                {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className={LABEL}>{t('company.language')}</span>
              <select className={FIELD} value={ws.language} onChange={(e) => setWs({ ...ws, language: e.target.value as Lang })}>
                <option value="en">English</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className={LABEL}>{t('company.timezone')}</span>
            <select className={FIELD} value={ws.timezone} onChange={(e) => setWs({ ...ws, timezone: e.target.value })}>
              {[...new Set([ws.timezone, ...TIMEZONES])].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className={LABEL}>{t('company.slug')}</span>
            <input className={FIELD} value={ws.careersSlug} onChange={(e) => setWs({ ...ws, careersSlug: e.target.value.toLowerCase() })} />
          </label>
          <p className="text-xs text-[#896a61] -mt-2">/c/{ws.careersSlug || '…'}</p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary" checked={sample} onChange={(e) => setSample(e.target.checked)} />
            <span>{t('signup.sample')}</span>
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-between">
            <button type="button" className={GHOST} onClick={() => setStep(1)}>{t('signup.back')}</button>
            <button className={PRIMARY}>{t('signup.continue')}</button>
          </div>
        </form>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t('signup.inviteTitle')} subtitle={t('signup.inviteBody')}>
      {progress}
      <div className="space-y-2">
        {invites.map((inv, i) => (
          <div key={i} className="grid grid-cols-[1fr_150px] gap-2">
            <input aria-label={t('signup.inviteEmail', { n: i + 1 })} placeholder="name@company.com" className={FIELD} value={inv.email} onChange={(e) => setInvites(invites.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
            <select aria-label={t('signup.inviteRole', { n: i + 1 })} className={FIELD} value={inv.role} onChange={(e) => setInvites(invites.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)))}>
              {INVITE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        ))}
        <button className="text-sm font-bold text-primary hover:underline" onClick={() => setInvites([...invites, { email: '', role: 'Recruiter' }])}>+ {t('signup.addInvite')}</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-between">
        <button className={GHOST} onClick={() => setStep(2)}>{t('signup.back')}</button>
        <button className={PRIMARY} onClick={finish}>{t('signup.finish')}</button>
      </div>
    </AuthShell>
  );
}

function TokenProblem({ check }: { check: Exclude<TokenCheck, { ok: true }> }) {
  const t = useT();
  return (
    <AuthShell title={t('token.invalidTitle')} subtitle={t(`token.${check.reason}`)}>
      <Link to="/login" className="text-sm font-bold text-primary hover:underline">{t('forgot.back')}</Link>
    </AuthShell>
  );
}

/** Target of the link in the verification email. */
export function VerifyEmailPage() {
  const t = useT();
  const [params] = useSearchParams();
  const token = params.get('token');
  // Read during render, consume in an effect: render may run twice (StrictMode) and must not use the link up.
  const [check] = useState(() => checkToken(token, 'verify'));
  useEffect(() => {
    if (check.ok) consumeToken(check.token.token);
  }, [check]);
  if (!check.ok) return <TokenProblem check={check} />;
  const draft = readDraft();
  return (
    <AuthShell title={t('verify.title')} subtitle={t('verify.body', { email: check.token.email })}>
      {draft?.token === check.token.token ? (
        <Link to={`/signup?verified=${check.token.token}`} className={`${PRIMARY} inline-flex items-center`}>{t('verify.continue')}</Link>
      ) : (
        <p className="text-sm text-[#896a61]">{t('verify.otherTab')}</p>
      )}
    </AuthShell>
  );
}

/** FE-01 forgot password: always answers the same way so it never reveals whether an account exists. */
export function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <AuthShell title={t('forgot.title')} subtitle={t('forgot.subtitle')}>
      {sent ? (
        <div className="space-y-2">
          <p role="status" className="text-sm rounded-lg bg-emerald-50 text-emerald-800 px-3 py-2">{t('forgot.sent', { email: normalizeEmail(email) })}</p>
          <InboxLink email={email} />
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (!EMAIL.test(normalizeEmail(email))) return; sendPasswordReset(email); setSent(true); }} className="space-y-4" noValidate>
          <label className="block space-y-1"><span className={LABEL}>{t('signup.email')}</span><input type="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className={`${PRIMARY} w-full`}>{t('forgot.send')}</button>
        </form>
      )}
      <Link to="/login" className="block text-sm font-bold text-primary hover:underline">{t('forgot.back')}</Link>
    </AuthShell>
  );
}

/** Opens the token's workspace first (a reload), so the change is written to the right tenant. */
function useWorkspaceOf(check: TokenCheck): boolean {
  const ws = check.ok ? check.token.workspaceId : undefined;
  const elsewhere = !!ws && activeWorkspaceId() !== ws;
  useEffect(() => {
    if (elsewhere && ws) enterWorkspace(ws, window.location.pathname + window.location.search);
  }, [elsewhere, ws]);
  return !elsewhere;
}

/** Target of the link in the reset email. */
export function ResetPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [check] = useState(() => checkToken(params.get('token'), 'reset'));
  const ready = useWorkspaceOf(check);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  if (!check.ok) return <TokenProblem check={check} />;
  if (!ready) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError(t('reset.err.short'));
    if (pw !== pw2) return setError(t('reset.err.match'));
    const r = useStore.getState().setUserPassword(check.token.userId ?? '', demoHash(pw));
    if (!r.ok) return setError(t('token.unknown'));
    consumeToken(check.token.token);
    toast(t('reset.done'));
    navigate(`/login?email=${encodeURIComponent(check.token.email)}`);
  };
  return (
    <AuthShell title={t('reset.title')} subtitle={check.token.email}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block space-y-1"><span className={LABEL}>{t('reset.new')}</span><input type="password" className={FIELD} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label className="block space-y-1"><span className={LABEL}>{t('reset.confirm')}</span><input type="password" className={FIELD} value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button className={`${PRIMARY} w-full`}>{t('reset.save')}</button>
      </form>
    </AuthShell>
  );
}

/** Target of the link in the invitation email: choose a name and password, then land in the workspace. */
export function AcceptInvitePage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [check] = useState(() => checkToken(params.get('token'), 'invite'));
  const ready = useWorkspaceOf(check);
  const user = useStore((s) => (check.ok ? s.users.find((u) => u.id === check.token.userId) : undefined));
  const company = useStore((s) => s.company?.name ?? DEFAULT_COMPANY.name);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  if (!check.ok) return <TokenProblem check={check} />;
  if (!ready) return null;
  if (!user || user.status !== 'Invited') return <TokenProblem check={{ ok: false, reason: 'used' }} />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError(t('reset.err.short'));
    const r = useStore.getState().acceptInvitation(user.id, { name: name || user.name, passwordHash: demoHash(pw) });
    if (!r.ok) return setError(t('token.used'));
    consumeToken(check.token.token);
    signInAs(user.id);
    toast(t('users.joined', { name: r.user.name }));
    navigate(homeFor(r.user));
  };
  return (
    <AuthShell title={t('invite.title', { company })} subtitle={t('invite.body', { email: user.email, role: user.role })}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block space-y-1"><span className={LABEL}>{t('signup.name')}</span><input className={FIELD} placeholder={user.name} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block space-y-1"><span className={LABEL}>{t('signup.password')}</span><input type="password" className={FIELD} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button className={`${PRIMARY} w-full`}>{t('invite.join')}</button>
      </form>
    </AuthShell>
  );
}

/** Public careers URL per tenant (PRD 3.7): /c/<slug> opens that workspace's careers page. */
export function CareersSlugRedirect() {
  const { slug = '' } = useParams();
  const t = useT();
  const ws = workspaceBySlug(slug);
  const moving = !!ws && activeWorkspaceId() !== ws.id;
  useEffect(() => {
    if (ws && moving) {
      // A visitor of another company's careers page is not signed in there.
      enterWorkspace(ws.id, '/careers');
    }
  }, [ws, moving]);
  if (!ws) {
    return (
      <AuthShell title={t('careers.slug.unknownTitle')} subtitle={t('careers.slug.unknown', { slug })}>
        <Link to="/careers" className="text-sm font-bold text-primary hover:underline">{t('careers.slug.home')}</Link>
      </AuthShell>
    );
  }
  return moving ? null : <Navigate to="/careers" replace />;
}

/** Exposed for the login page: accounts across workspaces. */
export { findAccounts };
