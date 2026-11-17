import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isFixtureMode } from '../data/fixtureMockup';
import { isGroupOpen, loadNavState, saveNavState, type NavState } from '../domain/navState';
import { useShowNew } from '../hooks';
import { useT, type TKey } from '../i18n/i18n';
import { UserMenu } from './UserMenu';

/** `also` lists extra route prefixes that keep this item highlighted. */
type Item = { to: string; icon: string; label: TKey; also?: string[] };
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
    { to: '/taxonomy', icon: 'category', label: 'nav.taxonomy' },
    { to: '/system-config', icon: 'settings', label: 'nav.systemConfig' },
    { to: '/users', icon: 'manage_accounts', label: 'nav.userManagement' },
    { to: '/ta-contribution', icon: 'leaderboard', label: 'nav.cvByTa' },
  ],
};

/** Exactly the static mockup's sidebar. */
const FIXTURE_GROUPS: Group[] = [
  { title: 'nav.group.platform', items: [DASH, POOL, UPLOAD, ULTRA, SEARCH, JDS, MATCH] },
  CONFIG,
];

const GROUPS: Group[] = [
  { title: 'nav.group.platform', items: [DASH], flat: true },
  {
    title: 'nav.group.recruitment',
    items: [
      { to: '/jobs', icon: 'work', label: 'nav.jobs' },
      { to: '/pipeline', icon: 'view_kanban', label: 'nav.pipeline' },
      { to: '/campaigns', icon: 'campaign', label: 'nav.campaigns' },
      { to: '/published', icon: 'public', label: 'nav.published' },
    ],
  },
  {
    title: 'nav.group.talentPool',
    items: [
      { ...POOL, also: ['/notes'] },
      { ...UPLOAD, label: 'nav.uploadCv', also: ['/upload-ultra'] },
      SEARCH,
    ],
  },
  { title: 'nav.group.jd', items: [JDS, MATCH] },
  CONFIG,
];

const BASE = 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors';
const IDLE = `${BASE} text-[#e6dddb] hover:bg-white/5 hover:text-white`;
const ACTIVE = `${BASE} bg-primary text-white`;

function matches(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

function isActive(pathname: string, it: Item): boolean {
  return matches(pathname, it.to) || (it.also?.some((p) => matches(pathname, p)) ?? false);
}

export function Sidebar() {
  const t = useT();
  const { pathname } = useLocation();
  const showNew = useShowNew();
  const [nav, setNav] = useState<NavState>(() => loadNavState());
  // Keep fixture mode sticky across in-app navigation.
  const search = isFixtureMode() ? '?fixture=mockup' : '';
  const groups = showNew ? GROUPS : FIXTURE_GROUPS;
  const rail = showNew && nav.rail;

  const update = (next: NavState) => {
    setNav(next);
    saveNavState(next);
  };

  const link = (it: Item) => {
    const active = isActive(pathname, it);
    return (
      <Link
        key={it.to}
        to={{ pathname: it.to, search }}
        title={rail ? t(it.label) : undefined}
        aria-label={rail ? t(it.label) : undefined}
        className={`${active ? ACTIVE : IDLE} ${rail ? 'justify-center' : ''}`}
      >
        <span className={`material-symbols-outlined text-[20px] ${active ? 'icon-filled' : ''}`}>{it.icon}</span>
        {!rail && <span className="text-sm font-medium">{t(it.label)}</span>}
      </Link>
    );
  };

  return (
    <aside className={`${rail ? 'w-[72px]' : 'w-64'} bg-sidebar-dark flex flex-col h-full flex-shrink-0 border-r border-border-dark z-30 shadow-2xl`}>
      <div className={`h-16 flex items-center border-b border-border-dark ${rail ? 'justify-center px-3' : 'px-6'}`}>
        <Link to={{ pathname: '/', search }} title={rail ? 'InApps Talent Pool' : undefined} className="flex items-center gap-3 cursor-pointer">
          <div className="size-9 rounded-full bg-primary flex items-center justify-center text-white shadow-sm shrink-0">
            <span className="material-symbols-outlined icon-filled text-[22px]">hub</span>
          </div>
          {!rail && <h1 className="text-white text-lg font-bold tracking-tight">InApps Talent Pool</h1>}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar py-6 px-3 flex flex-col gap-6">
        {showNew && (
          <button
            onClick={() => update({ ...nav, rail: !nav.rail })}
            title={t(rail ? 'nav.expand' : 'nav.collapse')}
            aria-label={t(rail ? 'nav.expand' : 'nav.collapse')}
            className={`flex items-center px-3 py-1 rounded-lg text-[#896a61] hover:bg-white/5 hover:text-white ${rail ? 'justify-center' : 'justify-end'}`}
          >
            <span className="material-symbols-outlined text-[20px]">{rail ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}</span>
          </button>
        )}
        {groups.map((g) => {
          const foldable = showNew && !g.flat && !rail;
          const open = !foldable || isGroupOpen(g.title, nav, g.items.some((it) => isActive(pathname, it)));
          return (
            <div key={g.title} className="flex flex-col gap-1">
              {foldable && (
                <button
                  onClick={() => update({ ...nav, folded: { ...nav.folded, [g.title]: open } })}
                  aria-expanded={open}
                  className="px-3 text-xs font-semibold text-[#896a61] uppercase tracking-wider mb-2 flex items-center gap-1 w-full text-left hover:text-white"
                >
                  <span>{t(g.title)}</span>
                  {!open && <span className="font-normal">({g.items.length})</span>}
                  <span className="material-symbols-outlined text-[16px] ml-auto">{open ? 'expand_more' : 'chevron_right'}</span>
                </button>
              )}
              {!showNew && (
                <p className="px-3 text-xs font-semibold text-[#896a61] uppercase tracking-wider mb-2">{t(g.title)}</p>
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
