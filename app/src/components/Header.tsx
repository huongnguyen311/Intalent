import type { ReactNode } from 'react';
import { isFixtureMode } from '../data/fixtureMockup';
import { TodoBell } from '../features/todo/TodoList';
import { BackButton } from './BackButton';
import { useLang } from '../i18n/i18n';

export type Back = { label: string; onClick: () => void };
type Props = { title: string; subtitle?: string; actions?: ReactNode; back?: Back };

export function Header({ title, subtitle, actions, back }: Props) {
  return (
    <header className="h-16 bg-white dark:bg-dark-surface border-b border-line dark:border-dark-raised px-8 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {back && <BackButton size="sm" label={back.label} onClick={back.onClick} />}
        {subtitle ? (
          <div>
            <h2 className="text-xl font-bold text-ink dark:text-white">{title}</h2>
            <p className="text-gray-500 font-medium text-sm">{subtitle}</p>
          </div>
        ) : (
          <h2 className="text-xl font-bold text-ink dark:text-white">{title}</h2>
        )}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        {/* The static mockup has no bell; the app shows the to-do count on every page. */}
        {!isFixtureMode() && <LangToggle />}
        {!isFixtureMode() && <TodoBell />}
      </div>
    </header>
  );
}

/** EN / VI switch, kept next to the bell so it's one click from any page. */
function LangToggle() {
  const [lang, setLang] = useLang();
  return (
    <div role="group" aria-label="Language" className="flex items-center p-0.5 rounded-lg bg-background-light dark:bg-white/5 border border-line dark:border-dark-raised">
      {(['en', 'vi'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 h-7 rounded-md text-xs font-semibold transition-colors ${lang === l ? 'bg-white dark:bg-dark-raised text-ink dark:text-white shadow-sm' : 'text-ink-muted hover:text-ink dark:hover:text-white'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
