import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Avatar, toneFor } from '../../components/Avatar';
import { Drawer } from '../../components/Drawer';
import { toast } from '../../components/Toast';
import { isFixtureMode } from '../../data/fixtureMockup';
import type { ChatMessage } from '../../domain/types';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';

/** Example queries; each exercises criteria the search understands (skill, seniority, years, domain, English). */
const EXAMPLES = ['assistant.example.1', 'assistant.example.2', 'assistant.example.3'] as const;

interface Session {
  id: string;
  title: string;
  at: string;
}

function sessionsOf(chats: ChatMessage[]): Session[] {
  const seen = new Map<string, Session>();
  for (const m of chats) {
    if (!seen.has(m.sessionId)) seen.set(m.sessionId, { id: m.sessionId, title: m.text, at: m.at });
  }
  return [...seen.values()].sort((a, b) => b.at.localeCompare(a.at));
}

const dayKey = (iso: string) => new Date(iso).toDateString();

function groupOf(at: string, now: Date): 'today' | 'yesterday' | 'older' {
  const key = dayKey(at);
  if (key === now.toDateString()) return 'today';
  if (key === new Date(now.getTime() - 86_400_000).toDateString()) return 'yesterday';
  return 'older';
}

function History({ sessions, active, onOpen, onDelete }: { sessions: Session[]; active: string | null; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const t = useT();
  const now = new Date();
  const groups = (['today', 'yesterday', 'older'] as const)
    .map((g) => [g, sessions.filter((s) => groupOf(s.at, now) === g)] as const)
    .filter(([, list]) => list.length > 0);
  if (groups.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">{t('assistant.history.empty')}</p>;
  return (
    <div className="-mx-4 -mt-4">
      {groups.map(([g, list]) => (
        <div key={g} className="mb-3">
          <p className="text-2xs font-bold text-muted uppercase tracking-widest px-2 py-2">{t(`assistant.group.${g}` as TKey)}</p>
          <div className="space-y-0.5">
            {list.map((s) => (
              <div
                key={s.id}
                className={`group/item flex items-center gap-1 pr-2 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-white/5${s.id === active ? ' bg-gray-50 dark:bg-white/5' : ''}`}
              >
                <button onClick={() => onOpen(s.id)} className="flex-1 min-w-0 flex items-center gap-1 pl-2 py-2 text-left rounded-lg">
                  <span aria-hidden className="material-symbols-outlined text-[16px] shrink-0 text-gray-400">chat_bubble</span>
                  <span className="flex-1 text-xs font-medium truncate text-slate-700 dark:text-gray-300">{s.title}</span>
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all shrink-0"
                  title={t('assistant.delete')}
                  aria-label={t('assistant.delete')}
                >
                  <span aria-hidden className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Conversation({ messages, search }: { messages: ChatMessage[]; search: string }) {
  const t = useT();
  const candidates = useStore((s) => s.candidates);
  return (
    <div className="space-y-8">
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[80%] px-5 py-3 rounded-2xl rounded-tr-sm bg-primary text-white text-sm font-medium">{m.text}</div>
          </div>
        ) : (
          <div key={i} className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[18px] icon-filled">person_search</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-gray-300 pt-1.5">{m.text}</p>
            </div>
            <div className="space-y-3 pl-11">
              {(m.results ?? []).map((r) => {
                const c = candidates.find((x) => x.id === r.candidateId);
                if (!c) return null;
                return (
                  <Link
                    key={r.candidateId}
                    to={{ pathname: `/candidates/${c.id}`, search }}
                    className="flex items-start gap-4 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-border-dark shadow-sm hover:border-primary/50 transition-colors"
                  >
                    <Avatar name={c.name} tone={toneFor(c.name)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</span>
                        <span className="text-xs text-[#896a61]">· {c.title}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">
                        <span className="material-symbols-outlined text-[14px] text-purple-500 align-middle">auto_awesome</span> {r.reason}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-bold shrink-0">{t('assistant.match', { score: r.score })}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

export function AssistantPage() {
  const t = useT();
  const chats = useStore((s) => s.chats);
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessions = useMemo(() => sessionsOf(chats), [chats]);
  const messages = active ? chats.filter((m) => m.sessionId === active) : [];
  const search = isFixtureMode() ? '?fixture=mockup' : '';

  const ask = (q: string) => {
    const query = q.trim();
    if (!query) return;
    setActive(useStore.getState().sendChat(active, query));
    setText('');
  };
  const remove = (id: string) => {
    useStore.getState().deleteChat(id);
    if (id === active) setActive(null);
  };
  const open = (id: string) => {
    setActive(id);
    setHistoryOpen(false);
  };
  const newChat = () => {
    setActive(null);
    setText('');
    setHistoryOpen(false);
  };
  const pickExample = (q: string) => {
    setText(q);
    inputRef.current?.focus();
  };

  return (
    <AppLayout title={t('nav.aiSearch')} bare>
      <div className="flex flex-col h-full bg-[#fbf9f8] dark:bg-background-dark overflow-hidden">
        <div className="px-6 h-16 flex items-center shrink-0 border-b border-gray-100 dark:border-border-dark bg-white dark:bg-surface-dark z-20 gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            {t('assistant.title')}
            <span className="px-2 py-0.5 bg-orange-100 text-primary text-2xs font-bold uppercase rounded">{t('assistant.beta')}</span>
          </h2>
          <button
            onClick={() => setHistoryOpen(true)}
            aria-expanded={historyOpen}
            className="ml-auto h-9 px-3 rounded-lg text-sm font-semibold flex items-center gap-1.5 text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <span aria-hidden className="material-symbols-outlined text-[20px]">history</span>
            {t('assistant.history')}
          </button>
          <button
            onClick={newChat}
            className="h-9 px-3.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white shadow-sm transition-colors"
          >
            <span aria-hidden className="material-symbols-outlined text-[20px]">add</span>
            {t('assistant.newChat')}
          </button>
        </div>
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <Drawer open={historyOpen} size="sm" title={t('assistant.history')} onClose={() => setHistoryOpen(false)}>
            <History sessions={sessions} active={active} onOpen={open} onDelete={remove} />
          </Drawer>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-4xl mx-auto space-y-12 pb-48">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                    <span className="material-symbols-outlined text-[48px] icon-filled">person_search</span>
                  </div>
                  <h3 className="ty-title text-2xl font-bold text-slate-900 dark:text-white mb-3">{t('assistant.welcome.title')}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">{t('assistant.welcome.body')}</p>
                  <p className="mt-8 mb-3 text-2xs font-bold text-muted uppercase tracking-widest">{t('assistant.examplesLabel')}</p>
                  <div className="flex flex-wrap justify-center gap-2.5 max-w-2xl">
                    {EXAMPLES.map((k) => (
                      <button
                        key={k}
                        onClick={() => pickExample(t(k))}
                        className="px-4 py-2 bg-white dark:bg-surface-dark rounded-full border border-gray-200 dark:border-border-dark text-sm font-medium text-slate-700 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors shadow-sm"
                      >
                        {t(k)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>{messages.length > 0 && <Conversation messages={messages} search={search} />}</div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-[#fbf9f8] via-[#fbf9f8] to-transparent dark:from-background-dark dark:via-background-dark">
            <div className="max-w-4xl mx-auto">
              <div className="relative group">
                <div className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-border-dark rounded-full shadow-2xl p-2.5 flex items-center gap-2">
                  <button onClick={() => toast(t('assistant.attach'), 'info')} className="p-3 text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[24px]">attach_file</span>
                  </button>
                  <input
                    ref={inputRef}
                    className="flex-1 bg-transparent border-0 focus:ring-0 text-sm font-semibold placeholder:text-gray-400 py-2 disabled:opacity-50"
                    placeholder={t('assistant.placeholder')}
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && ask(text)}
                  />
                  <button aria-label={t('assistant.send')} disabled={!text.trim()} onClick={() => ask(text)} className="size-11 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center shadow-lg transition-all transform active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                    <span className="material-symbols-outlined text-[24px]">arrow_upward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
