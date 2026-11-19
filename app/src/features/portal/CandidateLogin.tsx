import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../../i18n/i18n';
import { signInAs } from '../../store/session';
import { useStore } from '../../store/store';

/** Candidate sign-in on the careers site by email or phone (demo: no password or OTP). */
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
    <div className="max-w-md mx-auto bg-white rounded-3xl border border-[#e6dddb] p-6 sm:p-10">
      <h1 className="text-2xl font-bold tracking-tight">{t('portal.login.title')}</h1>
      <p className="text-sm text-[#896a61] mt-1">{t('portal.login.subtitle')}</p>
      <form noValidate onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="cl-email" className="block text-xs font-bold uppercase tracking-wide">{t('portal.login.id')}</label>
          <input
            id="cl-email"
            type="text"
            autoComplete="username"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(false); }}
            className="w-full h-12 px-4 rounded-lg bg-[#f8f6f6] ring-1 ring-gray-200 focus:ring-2 focus:ring-primary outline-none text-sm"
          />
          {error && <p role="alert" className="text-xs text-red-500">{t('portal.login.notFound')}</p>}
        </div>
        <button type="submit" className="w-full h-12 rounded-full bg-primary text-white font-bold text-sm">{t('portal.login.submit')}</button>
      </form>
      <p className="mt-4 text-xs text-[#896a61]">
        {t('portal.login.noProfile')} <Link to="/careers" className="font-bold text-primary hover:underline">{t('careers.applied.browse')}</Link>
      </p>
      {demo.length > 0 && (
        <div className="mt-6 rounded-xl bg-[#f8f6f6] px-4 py-3 text-xs text-[#896a61]">
          <p className="font-bold mb-1">{t('portal.login.demo')}</p>
          {demo.map((u) => (
            <button key={u.id} type="button" onClick={() => { setEmail(u.email); setError(false); }} className="block hover:text-primary">
              {u.email} <span className="opacity-70">({u.name})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
