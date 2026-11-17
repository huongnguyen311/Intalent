import { useState, type FormEvent } from 'react';
import { normalizeEmail } from '../../domain/normalize';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';

/** Optional: applicants look up their applications by email and see candidate-friendly stage words. */
export function StatusCheck() {
  const t = useT('careers');
  const [lang] = useLang('careers');
  const candidates = useStore((s) => s.candidates);
  const applications = useStore((s) => s.applications);
  const jobs = useStore((s) => s.jobs);
  const [email, setEmail] = useState('');
  const [searched, setSearched] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearched(normalizeEmail(email));
  };
  const cand = searched ? candidates.find((c) => normalizeEmail(c.email) === searched) : undefined;
  const rows = cand ? applications.filter((a) => a.candidateId === cand.id) : [];
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB');
  return (
    <div className="max-w-xl mx-auto bg-white rounded-3xl border border-[#e6dddb] p-6 sm:p-10">
      <h1 className="text-2xl font-bold tracking-tight">{t('careers.status.title')}</h1>
      <p className="text-sm text-[#896a61] mt-1">{t('careers.status.subtitle')}</p>
      <form onSubmit={submit} className="mt-6 flex flex-col sm:flex-row gap-3">
        <input
          aria-label={t('careers.status.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-12 px-4 rounded-lg bg-[#f8f6f6] ring-1 ring-gray-200 focus:ring-2 focus:ring-primary outline-none text-sm"
        />
        <button type="submit" className="h-12 px-6 rounded-full bg-primary text-white font-bold text-sm shrink-0">{t('careers.status.submit')}</button>
      </form>
      {searched !== null && (
        rows.length === 0 ? (
          <p className="mt-6 text-sm text-[#896a61]">{t('careers.status.none')}</p>
        ) : (
          <ul data-testid="careers-status-list" className="mt-6 divide-y divide-[#e6dddb]">
            {rows.map((a) => (
              <li key={a.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{jobs.find((j) => j.id === a.jobId)?.title ?? a.jobId}</p>
                  <p className="text-xs text-[#896a61]">{t('careers.status.appliedOn', { date: fmt(a.addedAt) })}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">{t(`careers.stage.${a.stage}`)}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
