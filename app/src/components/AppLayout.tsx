import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { isFixtureMode } from '../data/fixtureMockup';
import { AiButton } from './AiButton';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** The page renders its own header inside `children` (e.g. the candidate profile breadcrumb). */
  bare?: boolean;
  children: ReactNode;
};

export function AppLayout({ title, subtitle, actions, bare, children }: Props) {
  const { pathname } = useLocation();
  const fixture = isFixtureMode();
  // The static mockup only shows the floating AI button on the candidate screens.
  const showAi = !fixture || pathname.startsWith('/candidates');
  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {!bare && <Header title={title} subtitle={subtitle} actions={actions} />}
        <main className="flex-1 overflow-y-auto custom-scrollbar">{children}</main>
      </div>
      {showAi && <AiButton search={fixture ? '?fixture=mockup' : ''} />}
    </div>
  );
}
