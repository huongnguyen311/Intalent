import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeFor, normalizeRole, ROLES } from '../domain/permissions';
import { CURRENT_USER_ID } from '../domain/users';
import { useShowNew } from '../hooks';
import { useLang, useT } from '../i18n/i18n';
import { signInAs, signOut, useIsDemoWorkspace, useMe } from '../store/session';
import { useStore } from '../store/store';
import { Modal } from './Modal';
import { isFixtureMode } from '../data/fixtureMockup';
import { toast } from './Toast';
import { companyOf } from '../domain/company';
import { findAccounts } from '../features/auth/accounts';
import { activeWorkspaceId, enterWorkspace, setPendingLogin } from '../store/platform';

const ITEM = 'w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-ink dark:text-white hover:bg-background-light dark:hover:bg-white/5';
const SECTION = 'px-3 pt-1.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-ink-muted';

export function UserMenu({ rail = false }: { rail?: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lang, setLang] = useLang();
  const navigate = useNavigate();
  const t = useT();
  const showNew = useShowNew();
  const user = useMe();
  const users = useStore((s) => s.users);
  const demoWorkspace = useIsDemoWorkspace();
  const isDemoAdmin = user.id === CURRENT_USER_ID;
  // The demo admin keeps the mockup's exact label; anyone else shows their name and role.
  const name = isDemoAdmin ? 'Super Admin' : user.name;
  const subtitle = isDemoAdmin ? 'SuperAdmin' : user.role;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  // One demo account per role, so every role can be tried in two clicks.
  const switchable = ROLES.map((r) => users.find((u) => u.status === 'Active' && normalizeRole(u.role) === r)).filter((u): u is NonNullable<typeof u> => !!u);
  const switchTo = (id: string) => {
    signInAs(id === CURRENT_USER_ID ? undefined : id);
    setOpen(false);
    const next = users.find((u) => u.id === id);
    toast(t('session.switched', { name: next?.name ?? '', role: next ? normalizeRole(next.role) : '' }));
    navigate(homeFor(next));
  };

  const stored = useStore((s) => s.company);
  const company = companyOf({ company: stored });
  // Other workspaces this person belongs to (same email); switching reloads into that tenant.
  const others = open && showNew && user.email ? findAccounts(user.email).filter((a) => a.workspace.id !== activeWorkspaceId()) : [];
  const switchWorkspace = (id: string) => {
    setPendingLogin(user.email);
    enterWorkspace(id, '/login?resume=1');
  };

  const reset = () => {
    useStore.getState().resetDemo();
    setConfirming(false);
    setOpen(false);
    toast('Demo data reset');
  };

  return (
    <div className={`${rail ? 'p-2' : showNew ? 'p-2' : 'p-4'} border-t border-dark-raised relative`}>
      {open && (
        <div className={`absolute bottom-full ${showNew ? 'left-2' : 'left-4'} ${rail ? 'w-60' : 'right-2 min-w-[232px]'} mb-2 p-1.5 bg-white dark:bg-dark-surface text-ink dark:text-white border border-line dark:border-dark-raised rounded-xl shadow-2xl flex flex-col z-50`}>
          {/* The language switch lives in the page header; the static mockup has no header switch, so keep it here. */}
          {isFixtureMode() && (
            <div className="flex gap-1 p-1">
              {(['en', 'vi'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`flex-1 px-2 py-1 rounded-md text-xs font-semibold ${lang === l ? 'bg-primary text-white' : 'text-ink-muted hover:bg-background-light dark:hover:bg-white/5'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          {showNew && (
            <div className="pb-1">
              <p className={SECTION}>{t('ws.label')}</p>
              <p className="px-3 pb-1.5 text-sm font-semibold truncate">{company.name}</p>
              {others.map((a) => (
                <button key={a.workspace.id} onClick={() => switchWorkspace(a.workspace.id)} className={`${ITEM} flex items-center gap-2`}>
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-ink-muted">swap_horiz</span>
                  <span className="truncate">{a.workspace.name}</span>
                </button>
              ))}
              <button className={`${ITEM} flex items-center gap-2`} onClick={() => navigate('/signup')}>
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-ink-muted">add_business</span>{t('ws.create')}
              </button>
              <a className={`${ITEM} flex items-center gap-2`} href="/inbox" target="_blank" rel="noreferrer">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-ink-muted">mail</span>{t('ws.inbox')}
              </a>
            </div>
          )}
          {/* "View as" is a demo tool: in a real tenant anyone could switch to Super Admin with it. */}
          {showNew && demoWorkspace && (
            <div className="border-y border-line dark:border-dark-raised py-1 my-1">
              <p className={SECTION}>{t('session.viewAs')}</p>
              {switchable.map((u) => {
                const active = u.id === user.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => switchTo(u.id)}
                    aria-current={active || undefined}
                    className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${active ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-background-light dark:hover:bg-white/5'}`}
                  >
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className={`text-sm leading-tight truncate ${active ? 'font-semibold text-primary' : 'font-medium'}`}>{normalizeRole(u.role)}</span>
                      <span className="text-xs text-gray-500 dark:text-ink-muted leading-tight truncate">{u.name}</span>
                    </span>
                    {active && <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">check</span>}
                  </button>
                );
              })}
            </div>
          )}
          <button className={`${ITEM} flex items-center gap-2`} onClick={() => setConfirming(true)}>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-ink-muted">restart_alt</span>Reset demo data
          </button>
          <button className={`${ITEM} flex items-center gap-2`} onClick={() => { signOut(); navigate('/login'); }}>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-ink-muted">logout</span>Log out
          </button>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label={name} className={`flex items-center ${showNew ? 'gap-2.5 p-1.5' : 'gap-3 p-2'} w-full rounded-lg transition-colors text-left group hover:bg-white/5 ${rail ? 'justify-center' : ''}`}>
        <div className={`${showNew ? 'size-8' : 'size-9'} shrink-0 rounded-full bg-cover bg-center border border-[#3a3433] bg-gradient-to-br from-primary to-orange-400 group-hover:border-primary transition-colors flex items-center justify-center`}>
          <span className="text-white text-sm font-bold">{initials}</span>
        </div>
        {!rail && (
          <>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate text-white">{name}</span>
              <span className="text-xs truncate text-ink-muted">{subtitle}</span>
            </div>
            <span className="material-symbols-outlined ml-auto text-lg text-ink-muted">expand_more</span>
          </>
        )}
      </button>
      <Modal
        open={confirming}
        title="Reset demo data"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <button onClick={() => setConfirming(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-line dark:border-dark-line">Cancel</button>
            <button onClick={reset} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white">Reset</button>
          </>
        }
      >
        This restores all candidates, jobs and notes to the original demo data. Your changes will be lost.
      </Modal>
    </div>
  );
}
