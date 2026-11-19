import { useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { toast } from '../../components/Toast';
import { companyOf, COUNTRIES, isValidSlug, TIMEZONES, type CompanySettings } from '../../domain/company';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { slugTaken } from '../../store/platform';

const FIELD = 'w-full h-10 rounded-xl border border-[#e6dddb] dark:border-[#3a3433] bg-white dark:bg-[#2a2423] px-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-primary';
const LABEL = 'text-xs font-semibold text-[#896a61]';
const CARD = 'bg-white dark:bg-[#1e1e1e] rounded-2xl border border-[#e6dddb] dark:border-[#2a2423] p-6';

/** PRD 3.1 "Company settings" / BE-02: company profile, locale, timezone and careers page slug. */
export function CompanySettingsPage() {
  const t = useT();
  const stored = useStore((s) => s.company);
  const saved = companyOf({ company: stored });
  const [form, setForm] = useState<CompanySettings>(saved);
  const [errors, setErrors] = useState<{ name?: boolean; slug?: boolean; taken?: boolean }>({});
  const set = <K extends keyof CompanySettings>(k: K) => (v: CompanySettings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const careersUrl = `${window.location.origin}/c/${form.careersSlug}`;

  const save = () => {
    const next = { name: !form.name.trim(), slug: !isValidSlug(form.careersSlug), taken: slugTaken(form.careersSlug, form.workspaceId) };
    setErrors(next);
    if (next.name || next.slug || next.taken) return;
    const patch = Object.fromEntries(
      (Object.keys(form) as (keyof CompanySettings)[]).filter((k) => form[k] !== saved[k]).map((k) => [k, typeof form[k] === 'string' ? (form[k] as string).trim() : form[k]]),
    ) as Partial<CompanySettings>;
    if (Object.keys(patch).length) useStore.getState().updateCompany(patch);
    toast(t('company.saved'));
  };

  return (
    <AppLayout title={t('nav.companySettings')} subtitle={t('company.subtitle')}>
      <div className="p-8 max-w-[900px] mx-auto space-y-6">
        <section className={`${CARD} space-y-4`}>
          <h2 className="ty-section font-bold text-slate-900 dark:text-white">{t('company.section.profile')}</h2>
          <div className="flex items-center gap-4">
            <div aria-label={t('company.logo')} className="size-16 rounded-2xl bg-primary text-white flex items-center justify-center text-xl font-bold">{form.logoText || '?'}</div>
            <label className="flex flex-col gap-1 w-32">
              <span className={LABEL}>{t('company.logo')}</span>
              <input className={FIELD} maxLength={3} value={form.logoText} onChange={(e) => set('logoText')(e.target.value.toUpperCase())} />
            </label>
            <p className="text-xs text-[#896a61] flex-1">{t('company.logoHint')}</p>
          </div>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t('company.name')}</span>
            <input className={FIELD} value={form.name} onChange={(e) => set('name')(e.target.value)} aria-invalid={errors.name} />
            {errors.name && <span className="text-xs text-red-600">{t('company.err.name')}</span>}
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t('company.country')}</span>
              <select className={FIELD} value={form.country} onChange={(e) => set('country')(e.target.value)}>
                {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t('company.language')}</span>
              <select className={FIELD} value={form.language} onChange={(e) => set('language')(e.target.value as CompanySettings['language'])}>
                <option value="en">English</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>{t('company.timezone')}</span>
              <select className={FIELD} value={form.timezone} onChange={(e) => set('timezone')(e.target.value)}>
                {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className={`${CARD} space-y-4`}>
          <h2 className="ty-section font-bold text-slate-900 dark:text-white">{t('company.section.careers')}</h2>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t('company.slug')}</span>
            <input className={FIELD} value={form.careersSlug} onChange={(e) => set('careersSlug')(e.target.value.toLowerCase())} aria-invalid={errors.slug} />
            {errors.slug && <span className="text-xs text-red-600">{t('company.err.slug')}</span>}
            {errors.taken && <span className="text-xs text-red-600">{t('signup.err.slugTaken')}</span>}
          </label>
          <p className="text-sm text-[#896a61]">
            {t('company.careersUrl')}{' '}
            <a className="text-primary font-semibold hover:underline break-all" href={`/c/${form.careersSlug}`} target="_blank" rel="noreferrer">{careersUrl}</a>
          </p>
        </section>

        <section className={`${CARD} space-y-2`}>
          <h2 className="ty-section font-bold text-slate-900 dark:text-white">{t('company.section.workspace')}</h2>
          <p className="text-sm text-[#896a61]">{t('company.workspaceId', { id: form.workspaceId })}</p>
          <p className="text-sm text-[#896a61]">{t('company.isolation')}</p>
        </section>

        <div className="flex justify-end">
          <button onClick={save} className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-sm hover:bg-primary-hover">{t('profile.save')}</button>
        </div>
      </div>
    </AppLayout>
  );
}
