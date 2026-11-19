import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { activeWorkspaceId, DEFAULT_WS, enterWorkspace, setPendingLogin, takePendingLogin } from '../../store/platform';
import { findAccounts, passwordMatches } from './accounts';
import { normalizeEmail } from '../../domain/normalize';
import { homeFor, normalizeRole, ROLES } from '../../domain/permissions';
import { CURRENT_USER_ID } from '../../domain/users';
import { BrandMark } from '../../components/BrandMark';
import { useShowNew } from '../../hooks';
import { signInAs } from '../../store/session';
import { useStore } from '../../store/store';

const INPUT =
  'w-full h-12 px-4 pr-11 rounded-lg bg-[#f8f6f6] border-none ring-1 transition-all duration-200 outline-none text-sm ring-gray-200 focus:ring-2 focus:ring-primary';

/**
 * Demo login, no password check: a staff email signs in as that user (so each role can be tried); a candidate
 * account is sent to the careers sign-in; an unknown email gets an error. Google sign-in opens the demo Super Admin.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const showNew = useShowNew();
  const [showPassword, setShowPassword] = useState(false);
  const [params] = useSearchParams();
  const [emailValue, setEmailValue] = useState(() => params.get('email') ?? '');
  const [emailError, setEmailError] = useState(false);
  const [loginError, setLoginError] = useState('');
  /** Shows the "Applying for a job? Candidate sign-in" link next to a failed sign in. */
  const [candidateHint, setCandidateHint] = useState(false);

  /** Signs a member of the active workspace in; an invited user's first sign in accepts the invitation (PRD 3.1). */
  const enter = (email: string): boolean => {
    const st = useStore.getState();
    const member = st.users.find((u) => u.status !== 'Inactive' && normalizeEmail(u.email) === email);
    if (!member) return false;
    if (member.status === 'Invited') st.acceptInvitation(member.id);
    signInAs(member.id === CURRENT_USER_ID ? undefined : member.id);
    // Back to the page that sent the visitor here (same-site paths only), else the role's start page.
    const next = params.get('next');
    navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(member));
    return true;
  };

  // Back from the reload into another workspace: finish the sign in there.
  useEffect(() => {
    if (params.get('resume') !== '1') return;
    const email = takePendingLogin();
    if (email && !enter(email)) setLoginError('That account is no longer active in this workspace.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const users = useStore((s) => s.users);
  // One active staff account per role, so a demo audience can try every role (candidates use the careers site).
  const demo = ROLES.filter((r) => r !== 'Candidate')
    .map((r) => users.find((u) => u.status === 'Active' && !u.candidateId && normalizeRole(u.role) === r))
    .filter((u): u is NonNullable<typeof u> => !!u);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = normalizeEmail(String(new FormData(e.currentTarget).get('email') ?? ''));
    setCandidateHint(false);
    // The app asks for an email rather than silently opening the most powerful account; the mockup keeps its old behaviour.
    if (showNew && !email) {
      setEmailError(true);
      return;
    }
    if (!showNew) {
      const user = email ? useStore.getState().users.find((u) => u.status === 'Active' && normalizeEmail(u.email) === email) : undefined;
      signInAs(user && user.id !== CURRENT_USER_ID ? user.id : undefined);
      navigate(homeFor(user));
      return;
    }
    const password = String(new FormData(e.currentTarget).get('password') ?? '');
    // The account may live in another workspace (tenant): look it up there, then reload into it.
    const account = findAccounts(email)[0];
    if (!account) {
      // An unknown email never opens an account (it used to open the demo Super Admin, so a candidate typing their
      // own email here landed in the admin console). Candidates are pointed to their own sign-in.
      const isCandidate = useStore.getState().candidates.some((c) => c.email && normalizeEmail(c.email) === email);
      setCandidateHint(true);
      setLoginError(
        isCandidate
          ? 'This email belongs to a candidate profile. Candidates sign in on the careers site.'
          : 'No staff account with this email. Check the address or ask your admin for an invitation.',
      );
      return;
    }
    if (!passwordMatches(account.user, password)) {
      setLoginError('Wrong password. Try again or reset it.');
      return;
    }
    setLoginError('');
    if (account.workspace.id !== activeWorkspaceId()) {
      setPendingLogin(email);
      enterWorkspace(account.workspace.id, '/login?resume=1');
      return;
    }
    enter(email);
  };
  const google = () => {
    if (showNew && activeWorkspaceId() !== DEFAULT_WS) {
      setLoginError('Google sign-in is not set up for this workspace. Use your email and password.');
      return;
    }
    signInAs(undefined);
    navigate('/');
  };

  return (
    <div className={`h-screen ${showNew ? "bg-background-light" : "bg-[#f0f2f5]"} flex items-center justify-center p-8`}>
      <div className="w-full max-w-6xl h-full max-h-[calc(100vh-4rem)] flex rounded-3xl overflow-hidden shadow-xl bg-white border border-gray-100 flex-col lg:flex-row">
        <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-12 flex flex-col justify-center overflow-y-auto">
          <div className="mb-8">
            {showNew ? (
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-10 h-10 flex items-center justify-center">
                  <BrandMark className="h-9" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[#181211]">InTalent</h1>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 26 }}>hub</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[#181211]">InApps Talent Pool</h1>
              </div>
            )}
            <p className="text-xs text-[#896a61] font-medium ml-[52px]">Internal tool for authorized staff only.</p>
          </div>
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-[#181211] mb-2">Welcome back</h2>
            <p className="text-base text-[#896a61]">Manage CVs and find the perfect match with AI.</p>
          </div>
          <form className="space-y-4 w-full" onSubmit={submit}>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#181211] uppercase tracking-wide" htmlFor="email">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="email"
                  className={INPUT}
                  placeholder="name@company.com"
                  type="email"
                  name="email"
                  value={emailValue}
                  onChange={(e) => { setEmailValue(e.target.value); setEmailError(false); }}
                  aria-invalid={emailError || undefined}
                />
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">mail</span>
              </div>
              {emailError && <p role="alert" className="text-xs text-red-500">Enter your work email</p>}
              {loginError && (
                <p role="alert" className="text-xs text-red-500">
                  {loginError}
                  {candidateHint && (
                    <> <Link to="/careers/login" className="font-bold text-primary hover:underline">Go to candidate sign-in</Link></>
                  )}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#181211] uppercase tracking-wide" htmlFor="password">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input id="password" className={INPUT} placeholder="••••••••" type={showPassword ? 'text' : 'password'} name="password" />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors text-[20px]"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'visibility_off' : 'visibility'}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" type="checkbox" name="rememberMe" />
                <span className="text-sm text-[#896a61]">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => showNew && navigate('/forgot-password')}
                className="text-sm font-bold text-primary hover:underline disabled:opacity-50"
              >
                Forgot Password?
              </button>
            </div>
            <button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg shadow-lg shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Log In<span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </form>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#e6dddb]"></div>
            <span className="text-xs text-[#896a61]">or</span>
            <div className="flex-1 h-px bg-[#e6dddb]"></div>
          </div>
          <div className="w-full relative">
            <button
              type="button"
              onClick={google}
              className="w-full h-12 flex items-center rounded-lg border border-[#747775] bg-white hover:bg-[#f2f2f2] active:bg-[#e8e8e8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#747775]"
            >
              <div className="flex items-center justify-center w-full px-3">
                <svg className="shrink-0" width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
                <span className="ml-[10px] text-sm font-medium text-[#1F1F1F]" style={{ fontFamily: 'Roboto, sans-serif' }}>Sign in with Google</span>
              </div>
            </button>
          </div>
          <div className="mt-6 text-center text-[#896a61]">
            <p className="text-sm">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => showNew && navigate('/signup')}
                className="text-primary font-bold hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </p>
            {showNew && (
              <p className="text-xs mt-2">
                Applying for a job?{' '}
                <Link to="/careers/login" className="text-primary font-bold hover:underline">Candidate sign-in</Link>
              </p>
            )}
          </div>
          {showNew && demo.length > 0 && (
            <div className="mt-4 rounded-xl bg-[#f8f6f6] px-4 py-3 text-xs text-[#896a61]">
              <p className="font-bold mb-1">Demo accounts: pick a role to fill the email (any password)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                {demo.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setEmailValue(u.email); setEmailError(false); }}
                    className="text-left py-0.5 hover:text-primary"
                  >
                    <span className="font-semibold text-[#181211]">{normalizeRole(u.role)}</span> · {u.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="hidden lg:block lg:w-1/2 bg-[#0a192f] relative">
          <div
            className="absolute inset-0 z-0 bg-cover bg-center"
            style={{ backgroundImage: 'url("/assets/images/login-background.jpg")' }}
          ></div>
        </div>
      </div>
    </div>
  );
}
