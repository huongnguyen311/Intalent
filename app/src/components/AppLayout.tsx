import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { isFixtureMode } from '../data/fixtureMockup';
import { useAiQueue } from '../features/pipeline/useAiQueue';
import { useCan } from '../store/session';
import { AiButton } from './AiButton';
import { Header, type Back } from './Header';
import { Sidebar } from './Sidebar';

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** A round back arrow left of the title, for child pages such as editors. */
  back?: Back;
  /** The page renders its own header inside `children` (e.g. the candidate profile breadcrumb). */
  bare?: boolean;
  /** Pinned under the scrolling content, e.g. a form's Save bar. */
  footer?: ReactNode;
  children: ReactNode;
};

export function AppLayout({ title, subtitle, actions, back, bare, footer, children }: Props) {
  useAiQueue();
  const { pathname } = useLocation();
  const fixture = isFixtureMode();
  // The static mockup only shows the floating AI button on the candidate screens.
  // AI Search is a Talent Pool tool: roles without pool access would only land on "No access".
  const canPool = useCan()('pool');
  const showAi = canPool && (!fixture || pathname.startsWith('/candidates'));
  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-dark-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {!bare && <Header title={title} subtitle={subtitle} actions={actions} back={back} />}
        {/* 18px + the page's own 32px = 50px under the last box on every page. */}
        <main className={`flex-1 overflow-y-auto custom-scrollbar ${showAi && !fixture && !footer ? 'pb-[18px]' : ''}`}>{children}</main>
        {footer && <div className="shrink-0">{footer}</div>}
      </div>
      {showAi && <AiButton search={fixture ? '?fixture=mockup' : ''} />}
    </div>
  );
}
