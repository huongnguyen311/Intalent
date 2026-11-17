import { useState, type ReactNode } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { PromptsTable } from './PromptsTable';
import { UsageTab } from './UsageTab';

type Tab = 'prompts' | 'email' | 'usage';

const TAB_ON = 'flex items-center gap-2 px-6 py-3 border-b-2 transition-colors border-primary text-primary font-medium';
const TAB_OFF = 'flex items-center gap-2 px-6 py-3 border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';

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

const TABS: Array<{ id: Tab; label: TKey; icon: () => ReactNode }> = [
  { id: 'prompts', label: 'systemConfig.tab.prompts', icon: CpuIcon },
  { id: 'email', label: 'systemConfig.tab.email', icon: MailIcon },
  { id: 'usage', label: 'systemConfig.tab.usage', icon: ChartIcon },
];

export function SystemConfigPage() {
  const t = useT();
  const prompts = useStore((s) => s.prompts);
  const [tab, setTab] = useState<Tab>('prompts');
  // Email templates share the prompt store and are told apart by their `email-` id prefix.
  const isEmail = (id: string) => id.startsWith('email-');

  return (
    <AppLayout title={t('systemConfig.title')}>
      <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6">
              {TABS.map(({ id, label, icon: TabIcon }) => (
                <button key={id} onClick={() => setTab(id)} className={id === tab ? TAB_ON : TAB_OFF}>
                  <TabIcon />
                  {t(label)}
                </button>
              ))}
            </div>
            <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-sm border border-[#e6dddb] dark:border-[#2a2423] p-6">
              {tab === 'prompts' && (
                <PromptsTable items={prompts.filter((p) => !isEmail(p.id))} title="systemConfig.prompts.title" desc="systemConfig.prompts.desc" noun="items" />
              )}
              {tab === 'email' && (
                <PromptsTable items={prompts.filter((p) => isEmail(p.id))} title="systemConfig.email.title" desc="systemConfig.email.desc" noun="items" />
              )}
              {tab === 'usage' && <UsageTab prompts={prompts.filter((p) => !isEmail(p.id))} />}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
