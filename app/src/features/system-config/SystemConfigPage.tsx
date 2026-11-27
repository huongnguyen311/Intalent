import { useState, type ReactNode } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { useShowNew } from '../../hooks';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { PromptsTable } from './PromptsTable';
import { UsageTab } from './UsageTab';
import { isFixtureMode } from '../../data/fixtureMockup';

type Tab = 'prompts' | 'email' | 'content' | 'usage';

const TAB_ON = 'ui-tab ty-tab flex items-center gap-2 px-6 py-3 border-b-2 transition-colors border-primary text-primary font-medium';
const TAB_OFF = 'ui-tab ty-tab flex items-center gap-2 px-6 py-3 border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';

function Icon({ name, children }: { name: string; children: ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-${name}`} aria-hidden="true">
      {children}
    </svg>
  );
}

const CpuIcon = () => (
  <Icon name="cpu">
    <path d="M12 20v2"></path><path d="M12 2v2"></path><path d="M17 20v2"></path><path d="M17 2v2"></path>
    <path d="M2 12h2"></path><path d="M2 17h2"></path><path d="M2 7h2"></path><path d="M20 12h2"></path>
    <path d="M20 17h2"></path><path d="M20 7h2"></path><path d="M7 20v2"></path><path d="M7 2v2"></path>
    <rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="8" y="8" width="8" height="8" rx="1"></rect>
  </Icon>
);
const MailIcon = () => (
  <Icon name="mail">
    <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"></path>
    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
  </Icon>
);
const ChartIcon = () => (
  <Icon name="chart-column">
    <path d="M3 3v16a2 2 0 0 0 2 2h16"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path>
  </Icon>
);

const DocIcon = () => (
  <Icon name="file-text">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
    <path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>
  </Icon>
);

const TABS: Array<{ id: Tab; label: TKey; icon: () => ReactNode }> = [
  { id: 'prompts', label: 'systemConfig.tab.prompts', icon: CpuIcon },
  { id: 'email', label: 'systemConfig.tab.email', icon: MailIcon },
  { id: 'content', label: 'systemConfig.tab.content', icon: DocIcon },
  { id: 'usage', label: 'systemConfig.tab.usage', icon: ChartIcon },
];

export function SystemConfigPage() {
  const t = useT();
  const prompts = useStore((s) => s.prompts);
  const [tab, setTab] = useState<Tab>('prompts');
  // The mockup has no Job content tab, so fixture mode keeps the original three.
  const tabs = useShowNew() ? TABS : TABS.filter((x) => x.id !== 'content');
  // Email and job-content templates share the prompt store and are told apart by their id prefix.
  const isEmail = (id: string) => id.startsWith('email-');
  const isContent = (id: string) => id.startsWith('content-');
  const isPrompt = (id: string) => !isEmail(id) && !isContent(id);

  return (
    <AppLayout title={t('systemConfig.title')} subtitle={isFixtureMode() ? undefined : t('systemConfig.subtitle')}>
      <div className="flex flex-col h-full bg-background-light dark:bg-dark-canvas overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div role="tablist" className="ui-tabs flex border-b border-gray-200 dark:border-gray-800 mb-6">
              {tabs.map(({ id, label, icon: TabIcon }) => (
                <button key={id} role="tab" aria-selected={id === tab} onClick={() => setTab(id)} className={id === tab ? TAB_ON : TAB_OFF}>
                  <TabIcon />
                  {t(label)}
                </button>
              ))}
            </div>
            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-line dark:border-dark-raised p-6">
              {tab === 'prompts' && (
                <PromptsTable items={prompts.filter((p) => isPrompt(p.id))} title="systemConfig.prompts.title" desc="systemConfig.prompts.desc" noun="items" />
              )}
              {tab === 'email' && (
                <PromptsTable items={prompts.filter((p) => isEmail(p.id))} title="systemConfig.email.title" desc="systemConfig.email.desc" noun="items" />
              )}
              {tab === 'content' && (
                <PromptsTable items={prompts.filter((p) => isContent(p.id))} title="systemConfig.content.title" desc="systemConfig.content.desc" noun="items" />
              )}
              {tab === 'usage' && <UsageTab prompts={prompts.filter((p) => isPrompt(p.id))} />}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
