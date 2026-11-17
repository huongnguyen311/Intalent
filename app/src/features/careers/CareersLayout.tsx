import { Link, Outlet } from 'react-router-dom';
import type { Lang } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';

const LANGS: Lang[] = ['vi', 'en'];

/** Public shell for the careers site: InApps header with a language toggle, centered content, footer. */
export function CareersLayout() {
  const t = useT('careers');
  const [lang, setLang] = useLang('careers');
  return (
    <div className="min-h-screen flex flex-col bg-background-light text-[#181211]">
      <header className="bg-white border-b border-[#e6dddb] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/careers" className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-full bg-primary flex items-center justify-center text-white shadow-sm shrink-0">
              <span className="material-symbols-outlined icon-filled text-[22px]">hub</span>
            </div>
            <span className="text-lg font-bold tracking-tight truncate">{t('careers.brand')}</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            <Link to="/careers/status" className="hidden sm:inline text-sm font-medium text-[#896a61] hover:text-primary">
              {t('careers.nav.status')}
            </Link>
            <div role="group" aria-label={t('careers.lang.label')} className="flex rounded-full border border-[#e6dddb] p-0.5 text-xs font-bold">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded-full uppercase ${lang === l ? 'bg-primary text-white' : 'text-[#896a61]'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Outlet />
      </main>
      <footer className="border-t border-[#e6dddb] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-xs text-[#896a61] flex flex-wrap items-center justify-between gap-2">
          <span>{t('careers.footer')}</span>
          <Link to="/careers/status" className="sm:hidden font-medium hover:text-primary">{t('careers.nav.status')}</Link>
        </div>
      </footer>
    </div>
  );
}
