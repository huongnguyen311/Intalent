import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { normalizeRole } from '../../domain/permissions';
import type { Lang } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { BrandMark } from '../../components/BrandMark';
import { signInAs, useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { companyOf, DEFAULT_COMPANY } from '../../domain/company';

const LANGS: Lang[] = ['vi', 'en'];
const NAV = 'text-sm font-medium text-white/70 hover:text-white transition-colors';

/**
 * Public shell for the careers site: dark InTalent header with a language toggle, page content, dark footer.
 * The careers home runs full width (its sections set their own width); every other page sits in a centered column.
 */
export function CareersLayout() {
  const t = useT('careers');
  const [lang, setLang] = useLang('careers');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isHome = pathname.replace(/\/$/, '') === '/careers';
  const isCandidate = normalizeRole(useMe().role) === 'Candidate';
  // Company settings (PRD 3.1) brand the careers site; the original demo keeps the InTalent look.
  const stored = useStore((s) => s.company);
  const company = companyOf({ company: stored });
  const custom = company.name !== DEFAULT_COMPANY.name || company.logoText !== DEFAULT_COMPANY.logoText;
  return (
    <div className="min-h-screen flex flex-col bg-background-light text-[#181211]">
      <header className="bg-sidebar-dark/95 backdrop-blur border-b border-white/10 sticky top-0 z-30 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <Link to="/careers" className="flex items-center gap-2.5 min-w-0">
            {custom ? (
              <span aria-hidden="true" className="size-8 rounded-lg bg-primary text-white text-xs font-bold flex items-center justify-center">{company.logoText}</span>
            ) : (
              <BrandMark className="h-8" />
            )}
            {/* Phones show the mark alone rather than a cut-off "I…". */}
            <span className="hidden sm:inline text-lg font-bold tracking-tight truncate">{custom ? t('careers.brandOf', { company: company.name }) : t('careers.brand')}</span>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6 shrink-0">
            <Link to="/careers#jobs" className={`hidden md:inline ${NAV}`}>{t('careers.nav.jobs')}</Link>
            {isCandidate ? (
              <>
                <Link to="/me" className="text-sm font-semibold text-white hover:text-brand-light">{t('portal.nav.profile')}</Link>
                <button type="button" onClick={() => { signInAs(undefined); navigate('/careers'); }} className={NAV}>
                  {t('portal.nav.logout')}
                </button>
              </>
            ) : (
              <Link to="/careers/login" className="text-sm font-semibold px-4 h-9 inline-flex items-center rounded-full bg-white/10 hover:bg-white/15 ring-1 ring-white/15">
                {t('portal.nav.login')}
              </Link>
            )}
            <div role="group" aria-label={t('careers.lang.label')} className="flex rounded-full ring-1 ring-white/15 p-0.5 text-xs font-bold">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                  className={`px-2.5 py-1 rounded-full uppercase ${lang === l ? 'bg-primary text-white' : 'text-white/60 hover:text-white'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>
      <main className={isHome ? 'flex-1 w-full' : 'flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12'}>
        <Outlet />
      </main>
      <footer className="bg-sidebar-dark text-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <BrandMark className="h-7" />
            <div>
              <p className="text-sm font-semibold text-white">{t('careers.brand')}</p>
              <p className="text-xs">{t('careers.footer.tagline')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link to="/careers#jobs" className="hover:text-white">{t('careers.nav.jobs')}</Link>
            <Link to={isCandidate ? '/me' : '/careers/login'} className="hover:text-white">{t(isCandidate ? 'portal.nav.profile' : 'portal.nav.login')}</Link>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-xs">{t('careers.footer')}</p>
        </div>
      </footer>
    </div>
  );
}
