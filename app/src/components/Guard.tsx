import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { can, homeFor, normalizeRole, type Perm } from '../domain/permissions';
import { useT } from '../i18n/i18n';
import { isGuest, useMe } from '../store/session';
import { AppLayout } from './AppLayout';

/**
 * Shows the page only when the signed-in user has one of `perms`.
 * Candidate accounts never see internal pages: they are sent to their own profile.
 */
export function Guard({ perms, redirect, children }: { perms: Perm[]; redirect?: boolean; children: ReactNode }) {
  const user = useMe();
  const { pathname, search } = useLocation();
  // Keep the link the visitor opened (e.g. a to-do or a shared pipeline card) so sign-in can return there.
  if (isGuest(user)) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  if (normalizeRole(user.role) === 'Candidate') return <Navigate to="/me" replace />;
  if (perms.some((p) => can(user, p))) return <>{children}</>;
  // `redirect`: send the user to their own start page instead (used for the dashboard at "/"), unless that is
  // this very page (an account whose role is unknown has no permissions and would bounce forever).
  const home = homeFor(user);
  return redirect && home !== pathname ? <Navigate to={home} replace /> : <NoAccess home={home} />;
}

function NoAccess({ home }: { home: string }) {
  const t = useT();
  return (
    <AppLayout title={t('access.title')}>
      <div className="p-12 flex flex-col items-center text-center gap-3">
        <span className="size-14 rounded-full bg-orange-50 text-brand-accent flex items-center justify-center">
          <span className="material-symbols-outlined text-[28px]">lock</span>
        </span>
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">{t('access.title')}</h2>
        <p className="text-sm text-ink-muted max-w-md">{t('access.desc')}</p>
        <Link to={home} className="mt-2 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold">{t('access.home')}</Link>
      </div>
    </AppLayout>
  );
}
