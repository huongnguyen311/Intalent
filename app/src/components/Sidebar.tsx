import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isFixtureMode } from '../data/fixtureMockup';
import { isGroupOpen, loadNavState, saveNavState, type NavState } from '../domain/navState';
import { can, type Perm } from '../domain/permissions';
import { useShowNew } from '../hooks';
import { BrandMark } from './BrandMark';
import { useT, type TKey } from '../i18n/i18n';
import { useMe } from '../store/session';
import { useStore } from '../store/store';
import { UserMenu } from './UserMenu';

/** `also` lists extra route prefixes that keep this item highlighted. `perm`: shown only to users who have it (fixture mode shows everything, as the mockup does). */
type Item = { to: string; icon: string; label: TKey; also?: string[]; newTab?: boolean; perm?: Perm; badge?: number };
/** `flat` groups render without a fold header. */
type Group = { title: TKey; items: Item[]; flat?: boolean };

const DASH: Item = { to: '/', icon: 'dashboard', label: 'nav.dashboard' };
const POOL: Item = { to: '/candidates', icon: 'groups', label: 'nav.candidatePool' };
const UPLOAD: Item = { to: '/upload', icon: 'cloud_upload', label: 'nav.uploadCvs' };
const ULTRA: Item = { to: '/upload-ultra', icon: 'widgets', label: 'nav.ultraUpload' };
const SEARCH: Item = { to: '/assistant', icon: 'person_search', label: 'nav.aiSearch' };
const JDS: Item = { to: '/jds', icon: 'description', label: 'nav.jdManagement' };
const MATCH: Item = { to: '/jd-matching', icon: 'fact_check', label: 'nav.jdMatching' };

const CONFIG: Group = {
  title: 'nav.group.configuration',
  items: [
    { to: '/taxonomy', icon: 'category', label: 'nav.taxonomy', perm: 'config' },
    { to: '/system-config', icon: 'settings', label: 'nav.systemConfig', perm: 'config' },
    { to: '/users', icon: 'manage_accounts', label: 'nav.userManagement', perm: 'config' },
    { to: '/ta-contribution', icon: 'leaderboard', label: 'nav.cvByTa', perm: 'reports' },
  ],
};

/** Exactly the static mockup's sidebar. */
const FIXTURE_GROUPS: Group[] = [
  { title: 'nav.group.platform', items: [DASH, POOL, UPLOAD, ULTRA, SEARCH, JDS, MATCH] },
  CONFIG,
];

/** App-only configuration items (the mockup sidebar keeps CONFIG as is). */
const APP_CONFIG: Group = {
  ...CONFIG,
  items: [
    ...CONFIG.items,
    { to: '/settings', icon: 'domain', label: 'nav.companySettings', perm: 'config' },
    { to: '/audit', icon: 'policy', label: 'nav.audit', perm: 'privacy' },
  ],
};

const GROUPS: Group[] = [
  { title: 'nav.group.platform', items: [{ ...DASH, perm: 'pool' }], flat: true },
  {
    title: 'nav.group.recruitment',
    items: [
      { to: '/jobs', icon: 'work', label: 'nav.jobs', perm: 'pipeline' },
      // JDs are the reusable requirement library behind jobs, so they sit next to Jobs.
      // JD Matching has no menu item: it always needs a JD, so it opens from a JD or a job and highlights JD Management.
      { ...JDS, also: ['/jd-matching'], perm: 'jd.edit' },
      { to: '/pipeline', icon: 'view_kanban', label: 'nav.pipeline', perm: 'pipeline' },
      { to: '/my-interviews', icon: 'event', label: 'nav.myInterviews', perm: 'scorecard' },
      { to: '/campaigns', icon: 'campaign', label: 'nav.campaigns', perm: 'campaign' },
      // The public page listing every open job; there is no separate admin screen for it.
      { to: '/careers', icon: 'public', label: 'nav.published', newTab: true },
    ],
  },
  {
    title: 'nav.group.talentPool',
    items: [
      { to: '/pool-overview', icon: 'insights', label: 'nav.poolOverview', perm: 'pool' },
      { ...POOL, also: ['/notes'], perm: 'pool' },
      { ...UPLOAD, label: 'nav.uploadCv', also: ['/upload-ultra'], perm: 'pool' },
      { ...SEARCH, perm: 'pool' },
    ],
  },
  APP_CONFIG,
];

const BASE = 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors';
/** App mode: a denser row so the menu takes less room. */
const BASE_COMPACT = 'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors';
const IDLE = 'text-[#e6dddb] hover:bg-white/5 hover:text-white';
const ACTIVE = 'bg-primary text-white';

function matches(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

function isActive(pathname: string, it: Item): boolean {
  return matches(pathname, it.to) || (it.also?.some((p) => matches(pathname, p)) ?? false);
}

/** Below the md breakpoint (768px). Without matchMedia (tests, old browsers) the screen counts as wide. */
function useNarrow(): boolean {
  const query = '(max-width: 767px)';
  const [narrow, setNarrow] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return narrow;
}

export function Sidebar() {
  const t = useT();
  const { pathname } = useLocation();
  const showNew = useShowNew();
  const [nav, setNav] = useState<NavState>(() => loadNavState());
  // Keep fixture mode sticky across in-app navigation.
  const search = isFixtureMode() ? '?fixture=mockup' : '';
  const user = useMe();
  // Profiles with changes waiting for HR review, shown as a count on Candidate Pool.
  const pending = useStore((s) => s.candidates.filter((c) => c.suggestions?.length).length);
  const groups = showNew
    ? GROUPS.map((g) => ({
        ...g,
        items: g.items
          .filter((it) => !it.perm || can(user, it.perm))
          .map((it) => (it.to === '/candidates' && pending ? { ...it, badge: pending } : it)),
      })).filter((g) => g.items.length > 0)
    : FIXTURE_GROUPS;
  // Phones: start as an icon rail so pages keep most of the screen; opening it there is temporary and not saved.
  const narrow = useNarrow();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const rail = showNew && (narrow ? !phoneOpen : nav.rail);

  const update = (next: NavState) => {
    setNav(next);
    saveNavState(next);
  };

  const link = (it: Item) => {
    const active = !it.newTab && isActive(pathname, it);
    return (
      <Link
        key={it.to}
        to={{ pathname: it.to, search: it.newTab ? '' : search }}
        {...(it.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        title={rail ? t(it.label) : undefined}
        aria-label={rail ? t(it.label) : undefined}
        className={`${showNew ? BASE_COMPACT : BASE} ${active ? ACTIVE : IDLE} ${rail ? 'justify-center relative' : ''}`}
      >
        <span className={`material-symbols-outlined ${showNew ? 'text-[18px]' : 'text-[20px]'} ${active ? 'icon-filled' : ''}`}>{it.icon}</span>
        {!rail && <span className={`${showNew ? 'text-[13px] truncate' : 'text-sm'} font-medium`}>{t(it.label)}</span>}
        {!rail && it.newTab && <span aria-hidden="true" className="material-symbols-outlined text-[14px] ml-auto opacity-60">open_in_new</span>}
        {!!it.badge && (
          <span title={t('nav.pendingReview', { n: it.badge })} className={`${rail ? 'absolute translate-x-2.5 -translate-y-2.5' : 'ml-auto'} min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-[11px] font-bold text-[#181211] flex items-center justify-center`}>{it.badge}</span>
        )}
      </Link>
    );
  };

  return (
    <aside className={`${rail ? 'w-14' : showNew ? 'w-56' : 'w-64'} bg-sidebar-dark flex flex-col h-full flex-shrink-0 border-r border-border-dark z-30 shadow-2xl`}>
      <div className={`h-16 flex items-center border-b border-border-dark ${rail ? 'justify-center px-2' : showNew ? 'px-3' : 'px-6'}`}>
        {!rail && showNew && (
          <Link to={{ pathname: '/', search }} className="flex items-center gap-2.5 cursor-pointer">
            <BrandMark className="h-7" />
            <h1 className="text-white font-bold tracking-tight text-base whitespace-nowrap">InTalent</h1>
          </Link>
        )}
        {!rail && !showNew && (
          <Link to={{ pathname: '/', search }} className="flex items-center gap-3 cursor-pointer">
            <div className="size-9 rounded-full bg-primary flex items-center justify-center text-white shadow-sm shrink-0">
              <span className="material-symbols-outlined icon-filled text-[22px]">hub</span>
            </div>
            <h1 className="text-white font-bold tracking-tight text-lg">InApps Talent Pool</h1>
          </Link>
        )}
        {showNew && (
          <button
            onClick={() => (narrow ? setPhoneOpen(!phoneOpen) : update({ ...nav, rail: !nav.rail }))}
            title={t(rail ? 'nav.expand' : 'nav.collapse')}
            aria-label={t(rail ? 'nav.expand' : 'nav.collapse')}
            className={`flex items-center p-1 rounded-lg text-[#896a61] hover:bg-white/5 hover:text-white ${rail ? '' : 'ml-auto'}`}
          >
            <span className="material-symbols-outlined text-[20px]">{rail ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}</span>
          </button>
        )}
      </div>
      <div className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col ${showNew ? 'px-2 py-3 gap-3' : 'px-3 py-6 gap-6'}`}>
        {groups.map((g) => {
          const foldable = showNew && !g.flat && !rail;
          const open = !foldable || isGroupOpen(g.title, nav, g.items.some((it) => isActive(pathname, it)));
          return (
            <div key={g.title} className={`flex flex-col ${showNew ? 'gap-0.5' : 'gap-1'}`}>
              {foldable && (
                <button
                  onClick={() => update({ ...nav, folded: { ...nav.folded, [g.title]: open } })}
                  aria-expanded={open}
                  className="px-2.5 py-1 text-[10px] font-semibold text-sidebar-label uppercase tracking-wider flex items-center gap-1 w-full text-left hover:text-white"
                >
                  <span>{t(g.title)}</span>
                  {!open && <span className="font-normal">({g.items.length})</span>}
                  <span className="material-symbols-outlined text-[14px] ml-auto">{open ? 'expand_more' : 'chevron_right'}</span>
                </button>
              )}
              {!showNew && (
                <p className="px-3 text-xs font-semibold text-sidebar-label uppercase tracking-wider mb-2">{t(g.title)}</p>
              )}
              {open && g.items.map(link)}
            </div>
          );
        })}
      </div>
      <UserMenu rail={rail} />
    </aside>
  );
}
