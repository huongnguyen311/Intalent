import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../../i18n/i18n';
import { signInAs } from '../../store/session';
import { useStore } from '../../store/store';
import { Avatar, toneFor } from '../../components/Avatar';
import '../careers/careers.css';

const PERKS = [
  { icon: 'timeline', key: 'portal.login.perk.status' },
  { icon: 'description', key: 'portal.login.perk.cv' },
  { icon: 'auto_awesome', key: 'portal.login.perk.match' },
] as const;

/**
 * Candidate sign-in on the careers site by email or phone (demo: no password or OTP).
 * Split card: a dark brand panel explaining what the portal gives, and the form on the right.
 */
export function CandidateLogin() {
  const t = useT('careers');
  const navigate = useNavigate();
  const demo = useStore((s) => s.users.filter((u) => u.candidateId && u.status === 'Active').slice(0, 2));
  const [email, setEmail] = useState('');
  const [error, setError] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const user = useStore.getState().candidateSignIn(email);
    if (!user) return setError(true);
    signInAs(user.id);
    navigate('/me');
  };

  return (
    <div className="max-w-5xl mx-auto grid md:grid-cols-[1.05fr_1fr] rounded-3xl overflow-hidden bg-white ring-1 ring-stone-200 shadow-[0_24px_60px_-30px_rgb(12_10_9/0.35)]">
      {/* Brand panel */}
      <aside className="order-last md:order-none relative overflow-hidden careers-dark text-white p-8 sm:p-10 flex flex-col">
        <div aria-hidden="true" className="absolute inset-0 careers-grid" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80">
            <span className="size-1.5 rounded-full bg-amber-400" />
            {t('portal.login.eyebrow')}
          </span>
          <h2 className="mt-5 text-2xl sm:text-3xl font-bold tracking-tight leading-tight max-w-sm">{t('portal.login.headline')}</h2>
          <ul className="mt-8 space-y-4">
            {PERKS.map((p) => (
              <li key={p.key} className="flex items-start gap-3">
                <span className="size-9 shrink-0 grid place-items-center rounded-xl careers-gradient shadow-lg shadow-orange-900/30">
                  <span className="material-symbols-outlined text-[20px]">{p.icon}</span>
                </span>
                <span className="text-sm text-white/80 leading-relaxed pt-1.5">{t(p.key)}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-10 md:mt-auto pt-8 flex items-center gap-2 text-xs text-white/50">
          <span className="material-symbols-outlined text-[16px]">lock</span>
          {t('portal.login.secure')}
        </p>
      </aside>

      {/* Form */}
      <section className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center">
        <h1 className="text-2xl font-bold tracking-tight">{t('portal.login.title')}</h1>
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">{t('portal.login.subtitle')}</p>
        <form noValidate onSubmit={submit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label htmlFor="cl-email" className="block text-sm font-semibold">{t('portal.login.id')}</label>
            <div className="relative">
              <span aria-hidden="true" className={`material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] ${error ? 'text-red-500' : 'text-stone-400'}`}>alternate_email</span>
              <input
                id="cl-email"
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="name@example.com"
                aria-invalid={error || undefined}
                aria-describedby={error ? 'cl-email-error' : undefined}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(false); }}
                className={`w-full h-12 border-0 pl-11 pr-4 rounded-xl bg-stone-50 ring-1 outline-none text-sm transition placeholder:text-stone-400 focus:bg-white focus:ring-2 ${error ? 'ring-red-300 focus:ring-red-500' : 'ring-stone-200 focus:ring-primary'}`}
              />
            </div>
            {error && (
              <p id="cl-email-error" role="alert" className="flex items-start gap-1.5 text-xs text-red-600">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {t('portal.login.notFound')}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="group w-full h-12 rounded-xl careers-gradient text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-orange-600/25 hover:brightness-105 active:brightness-95 transition"
          >
            {t('portal.login.submit')}
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stone-100 text-sm text-ink-muted">
          {t('portal.login.noProfile')}{' '}
          <Link to="/careers" className="font-bold text-primary hover:underline">{t('careers.applied.browse')}</Link>
        </div>

        {demo.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">{t('portal.login.demo')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {demo.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setEmail(u.email); setError(false); }}
                  className="inline-flex items-center gap-2 rounded-full bg-stone-50 ring-1 ring-stone-200 hover:ring-primary hover:bg-white pl-1 pr-3 py-1 text-xs transition"
                  title={u.email}
                >
                  <Avatar name={u.name} tone={toneFor(u.name)} small />
                  <span className="font-semibold text-ink">{u.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
