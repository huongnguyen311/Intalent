import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

const INPUT =
  'w-full h-12 px-4 pr-11 rounded-lg bg-[#f8f6f6] border-none ring-1 transition-all duration-200 outline-none text-sm ring-gray-200 focus:ring-2 focus:ring-[#ef5125]';

/** Demo login: there is no auth, both Log In and Google sign-in just open the dashboard. */
export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className="h-screen bg-[#f0f2f5] flex items-center justify-center p-8">
      <div className="w-full max-w-6xl h-full max-h-[calc(100vh-4rem)] flex rounded-3xl overflow-hidden shadow-xl bg-white border border-gray-100 flex-col lg:flex-row">
        <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-12 flex flex-col justify-center overflow-y-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-10 h-10 bg-[#ef5125]/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-[#ef5125]" style={{ fontSize: 26 }}>hub</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#181211]">InApps Talent Pool</h1>
            </div>
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
                <input id="email" className={INPUT} placeholder="name@company.com" type="email" name="email" />
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">mail</span>
              </div>
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
                  className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#ef5125] transition-colors text-[20px]"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'visibility_off' : 'visibility'}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input className="w-4 h-4 rounded border-gray-300 text-[#ef5125] focus:ring-[#ef5125]" type="checkbox" name="rememberMe" />
                <span className="text-sm text-[#896a61]">Remember me</span>
              </label>
              <button type="button" className="text-sm font-bold text-[#ef5125] hover:underline disabled:opacity-50">Forgot Password?</button>
            </div>
            <button
              type="submit"
              className="w-full h-12 bg-[#ef5125] hover:bg-[#d64018] text-white font-bold rounded-lg shadow-lg shadow-[#ef5125]/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
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
              onClick={() => navigate('/')}
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
              Don&apos;t have an account? <span className="text-[#ef5125] font-bold hover:underline cursor-pointer">Sign Up</span>
            </p>
          </div>
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
