import { Link, useLocation } from 'react-router-dom';
import { isFixtureMode } from '../data/fixtureMockup';
import { useShowNew } from '../hooks';
import { useT, type TKey } from '../i18n/i18n';
import { UserMenu } from './UserMenu';

type Item = { to: string; icon: string; label: TKey };
type Group = { title: TKey; items: Item[] };

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
  { title: 'nav.group.platform', items: [DASH] },
  {
    title: 'nav.group.recruitment',
    items: [
      { to: '/jobs', icon: 'work', label: 'nav.jobs' },
      { to: '/pipeline', icon: 'view_kanban', label: 'nav.pipeline' },
      { to: '/campaigns', icon: 'campaign', label: 'nav.campaigns' },
    ],
  },
  {
    title: 'nav.group.talentPool',
    items: [POOL, UPLOAD, ULTRA, SEARCH, { to: '/notes', icon: 'sticky_note_2', label: 'nav.notes' }],
  },
  { title: 'nav.group.jd', items: [JDS, MATCH] },
  CONFIG,
];

const BASE = 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors';
const IDLE = `${BASE} text-[#e6dddb] hover:bg-white/5 hover:text-white`;
const ACTIVE = `${BASE} bg-primary text-white`;

function isActive(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

export function Sidebar() {
  const t = useT();
  const { pathname } = useLocation();
  const showNew = useShowNew();
  // Keep fixture mode sticky across in-app navigation.
  const search = isFixtureMode() ? '?fixture=mockup' : '';
  const groups = showNew ? GROUPS : FIXTURE_GROUPS;

  return (
    <aside className="w-64 bg-sidebar-dark flex flex-col h-full flex-shrink-0 border-r border-border-dark z-30 shadow-2xl">
      <div className="h-16 flex items-center px-6 border-b border-border-dark">
        <Link to={{ pathname: '/', search }} className="flex items-center gap-3 cursor-pointer">
          <div className="size-9 rounded-full bg-primary flex items-center justify-center text-white shadow-sm shrink-0">
            <span className="material-symbols-outlined icon-filled text-[22px]">hub</span>
          </div>
          <h1 className="text-white text-lg font-bold tracking-tight">InApps Talent Pool</h1>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar py-6 px-3 flex flex-col gap-6">
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-1">
            <p className="px-3 text-xs font-semibold text-[#896a61] uppercase tracking-wider mb-2">{t(g.title)}</p>
            {g.items.map((it) => {
              const active = isActive(pathname, it.to);
              return (
                <Link key={it.to} to={{ pathname: it.to, search }} className={active ? ACTIVE : IDLE}>
                  <span className={`material-symbols-outlined text-[20px] ${active ? 'icon-filled' : ''}`}>{it.icon}</span>
                  <span className="text-sm font-medium">{t(it.label)}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <UserMenu />
    </aside>
  );
}
