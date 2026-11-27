import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Avatar, toneFor } from '../../components/Avatar';
import { Drawer } from '../../components/Drawer';
import { toast } from '../../components/Toast';
import { isFixtureMode } from '../../data/fixtureMockup';
import { estimateYears, hasCriteria, parseQuery, scoreCandidate, searchCandidates } from '../../domain/scoring';
import type { Candidate, ChatMessage } from '../../domain/types';
import { useT, type TKey } from '../../i18n/i18n';
import { CURRENT_USER_ID } from '../../domain/users';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';

/** Example queries; each exercises criteria the search understands (skill, seniority, years, domain, English). */
const EXAMPLES = ['assistant.example.1', 'assistant.example.2', 'assistant.example.3'] as const;
/** Popular standalone queries shown above the composer once a conversation is open (each query is searched on its own). */
const POPULAR = [...EXAMPLES, 'assistant.example.4', 'assistant.example.5'] as const;

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
  const groups = (['today', 'yesterday', 'older'] as const).map((g) => [g, sessions.filter((s) => groupOf(s.at, now) === g)] as const).filter(([, list]) => list.length > 0);
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
                  <span aria-hidden className="material-symbols-outlined text-[16px] shrink-0 text-gray-400">
                    chat_bubble
                  </span>
                  <span className="flex-1 text-xs font-medium truncate text-slate-700 dark:text-gray-300">{s.title}</span>
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 p-0.5 text-muted dark:text-gray-400 hover:text-red-500 transition-all shrink-0"
                  title={t('assistant.delete')}
                  aria-label={t('assistant.delete')}
                >
                  <span aria-hidden className="material-symbols-outlined text-[16px]">
                    delete
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentAvatar() {
  return (
    <div aria-hidden className="size-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-orange-400 text-white flex items-center justify-center shadow-sm">
      <span className="material-symbols-outlined text-[18px] icon-filled">smart_toy</span>
    </div>
  );
}

function UserBubble({ text, name, last }: { text: string; name: string; last: boolean }) {
  return (
    <div data-last-question={last || undefined} className="flex items-start justify-end gap-3 scroll-mt-4">
      <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-primary text-white text-sm font-medium whitespace-pre-wrap">{text}</div>
      <div className="mt-0.5">
        <Avatar name={name} tone={toneFor(name)} small />
      </div>
    </div>
  );
}

function Thinking() {
  const t = useT();
  return (
    <div className="flex items-start gap-3" role="status" aria-live="polite">
      <AgentAvatar />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-muted dark:text-gray-400 mb-1">{t('assistant.title')}</p>
        <div className="inline-flex items-center gap-3 bg-gray-50 dark:bg-dark-canvas rounded-2xl rounded-tl-sm border border-gray-100 dark:border-dark-raised px-4 py-3">
          <span aria-hidden className="flex items-center gap-1">
            {[0, 150, 300].map((d) => (
              <span key={d} className="size-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
          <span className="text-sm text-ink-muted dark:text-gray-400">{t('assistant.thinking')}</span>
        </div>
      </div>
    </div>
  );
}

/** Cards shown before "Show more"; the reply never lists more than MAX_CARDS. */
const TOP_CARDS = 3;
const MAX_CARDS = 5;

const scoreTone = (s: number) => (s >= 85 ? 'text-emerald-500' : s >= 70 ? 'text-amber-500' : 'text-gray-400');

function ScoreRing({ score }: { score: number }) {
  const t = useT();
  const r = 20;
  const len = 2 * Math.PI * r;
  return (
    <div className="relative size-12 shrink-0" data-testid="assistant-score" title={t('assistant.card.fitHint')}>
      <svg viewBox="0 0 48 48" className="size-12 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="3.5" className="stroke-gray-100 dark:stroke-white/10" />
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" className={scoreTone(score)} strokeDasharray={len} strokeDashoffset={len * (1 - score / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-900 dark:text-white" aria-hidden>
        {score}%
      </span>
      <span className="sr-only">{t('assistant.match', { score })}</span>
    </div>
  );
}

function CandidateCard({ c, rank, score, have, miss, search }: { c: Candidate; rank: number; score: number; have: string[]; miss: string[]; search: string }) {
  const t = useT();
  const facts = [c.seniority, t('assistant.crit.yearsOf', { n: estimateYears(c) }), c.english && t('assistant.crit.english', { level: c.english })].filter(Boolean);
  const best = rank === 1;
  return (
    <Link
      to={{ pathname: `/candidates/${c.id}`, search }}
      className={`group flex flex-col gap-3 p-4 rounded-2xl bg-white dark:bg-dark-surface border transition-all hover:shadow-md ${best ? 'border-primary/30 dark:border-primary/40' : 'border-gray-200 dark:border-dark-raised hover:border-gray-300 dark:hover:border-white/20'}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-gray-400 shrink-0">#{rank}</span>
            <span className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">{c.name}</span>
            {best && (
              <span className="shrink-0 h-5 px-1.5 rounded-md bg-primary/10 text-primary text-2xs font-bold inline-flex items-center">{t('assistant.card.best')}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400 truncate">{c.title}</p>
          <p className="mt-1 text-xs font-medium text-slate-700 dark:text-gray-300 truncate">{facts.join(' · ')}</p>
        </div>
        <ScoreRing score={score} />
      </div>
      {have.length + miss.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-100 dark:border-dark-raised">
          {have.map((s) => (
            <span key={s} className="inline-flex items-center gap-0.5 h-6 pl-1.5 pr-2 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-2xs font-semibold">
              <span aria-hidden className="material-symbols-outlined text-[14px] text-indigo-500 dark:text-indigo-400">
                check
              </span>
              {s}
            </span>
          ))}
          {miss.map((s) => (
            <span key={s} title={t('assistant.card.missing')} className="inline-flex items-center h-6 px-2 rounded-md text-gray-400 dark:text-gray-500 text-2xs font-semibold line-through">
              {s}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function CriteriaChips({ items }: { items: string[] }) {
  return (
    <>
      {items.map((c) => (
        <span key={c} className="inline-flex items-center h-6 px-2 mr-1 mb-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-xs font-semibold text-indigo-700 dark:text-indigo-300 align-middle">
          {c}
        </span>
      ))}
    </>
  );
}

const CLARIFY = ['assistant.unclear.skill', 'assistant.unclear.level', 'assistant.unclear.years', 'assistant.unclear.domain', 'assistant.unclear.english'] as const;

/** Reply when the question has no search criteria: ask the TA for what is missing instead of guessing. */
function Clarify() {
  const t = useT();
  return (
    <>
      <p>{t('assistant.unclear.intro')}</p>
      <ul className="list-disc pl-5 space-y-0.5">
        {CLARIFY.map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>
      <p>
        {t('assistant.unclear.example')} <span className="font-semibold text-slate-900 dark:text-white">“{t('assistant.example.1')}”</span>
      </p>
    </>
  );
}

function AssistantReply({ question, results, search }: { question: string; results: ChatMessage['results']; search: string }) {
  const t = useT();
  const candidates = useStore((s) => s.candidates);
  const taxonomy = useStore((s) => s.taxonomy);
  const [expanded, setExpanded] = useState(false);
  const req = useMemo(() => parseQuery(question, taxonomy), [question, taxonomy]);
  const clear = hasCriteria(req);
  const total = useMemo(() => (clear ? searchCandidates(candidates, req, Infinity).length : 0), [candidates, req, clear]);
  const hits = (results ?? [])
    .map((r) => {
      const c = candidates.find((x) => x.id === r.candidateId);
      return c ? { c, ...scoreCandidate(c, req), score: r.score } : null;
    })
    .filter((h): h is NonNullable<typeof h> => h !== null)
    .slice(0, MAX_CARDS);
  const shown = expanded ? hits : hits.slice(0, TOP_CARDS);

  const criteria = [
    req.seniority,
    ...req.stack,
    req.years && t('assistant.crit.years', { n: req.years }),
    ...(req.domains ?? []),
    req.english && t('assistant.crit.english', { level: req.english }),
  ].filter((x): x is string => Boolean(x));
  // Only English / domain / years: a valid search, but too broad to rank well.
  const broad = clear && req.stack.length === 0 && !req.seniority;

  const top = hits[0];
  const topWhy =
    top && [top.c.seniority, t('assistant.crit.yearsOf', { n: estimateYears(top.c) }), top.have.length ? t('assistant.ans.has', { skills: top.have.join(', ') }) : ''].filter(Boolean).join(', ');
  // The skill most often missing among the listed candidates, if any.
  const missCount = new Map<string, number>();
  for (const h of hits) for (const s of h.miss) missCount.set(s, (missCount.get(s) ?? 0) + 1);
  const [gapSkill, gapCount] = [...missCount.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  return (
    <div className="flex items-start gap-3">
      <AgentAvatar />
      <div className="min-w-0 flex-1 max-w-5xl space-y-3">
        <p className="text-xs font-semibold text-ink-muted dark:text-gray-400">{t('assistant.title')}</p>
        <div className="inline-block max-w-3xl bg-gray-50 dark:bg-dark-canvas rounded-2xl rounded-tl-sm border border-gray-100 dark:border-dark-raised px-4 py-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-gray-300">
          {!clear ? (
            <Clarify />
          ) : hits.length === 0 ? (
            <>
              <p>
                {t('assistant.ans.understood')} <CriteriaChips items={criteria} />
              </p>
              <p>{t('assistant.ans.noneBody')}</p>
            </>
          ) : (
            <>
              <p>
                {t('assistant.ans.understood')} <CriteriaChips items={criteria} />
              </p>
              <p>{t('assistant.ans.summary', { total, shown: hits.length })}</p>
              <p>
                <span className="font-semibold text-slate-900 dark:text-white">{top.c.name}</span> {t('assistant.ans.lead', { score: top.score, why: topWhy })}
              </p>
              {gapSkill && gapCount ? (
                <p className="flex items-start gap-1.5">
                  <span aria-hidden className="material-symbols-outlined text-[18px] text-amber-500 mt-0.5">
                    lightbulb
                  </span>
                  <span>{t('assistant.ans.gap', { count: gapCount, shown: hits.length, skill: gapSkill })}</span>
                </p>
              ) : req.stack.length > 0 ? (
                <p>{t('assistant.ans.allFit', { shown: hits.length })}</p>
              ) : null}
              {broad && (
                <p className="flex items-start gap-1.5">
                  <span aria-hidden className="material-symbols-outlined text-[18px] text-sky-500 mt-0.5">
                    help
                  </span>
                  <span>{t('assistant.ans.broad')}</span>
                </p>
              )}
            </>
          )}
        </div>
        {hits.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-2">
              {shown.map((h, i) => (
                <CandidateCard key={h.c.id} c={h.c} rank={i + 1} score={h.score} have={h.have} miss={h.miss} search={search} />
              ))}
            </div>
            {hits.length > TOP_CARDS && (
              <button onClick={() => setExpanded((v) => !v)} className="h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1 text-primary hover:bg-primary/5 transition-colors">
                {expanded ? t('assistant.ans.less') : t('assistant.ans.more', { n: hits.length - TOP_CARDS })}
                <span aria-hidden className="material-symbols-outlined text-[18px]">
                  {expanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Conversation({ messages, search, pending }: { messages: ChatMessage[]; search: string; pending: string | null }) {
  const me = useMe();
  const myName = me.id === CURRENT_USER_ID ? 'Super Admin' : me.name;
  const lastQuestion = pending ? -1 : messages.map((m) => m.role).lastIndexOf('user');
  return (
    <div className="space-y-6">
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <UserBubble key={i} text={m.text} name={myName} last={i === lastQuestion} />
        ) : (
          <AssistantReply key={i} results={m.results} question={messages[i - 1]?.role === 'user' ? messages[i - 1].text : ''} search={search} />
        ),
      )}
      {pending && (
        <>
          <UserBubble text={pending} name={myName} last />
          <Thinking />
        </>
      )}
    </div>
  );
}

/** Empty state as the agent's opening message, so the page already reads like the chat it becomes. */
function Welcome({ onAsk }: { onAsk: (q: string) => void }) {
  const t = useT();
  const me = useMe();
  const name = me.id === CURRENT_USER_ID ? 'Super Admin' : me.name;
  return (
    <div className="flex items-start gap-3">
      <AgentAvatar />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-muted dark:text-gray-400 mb-1">{t('assistant.title')}</p>
        <div className="inline-block max-w-2xl bg-gray-50 dark:bg-dark-canvas rounded-2xl rounded-tl-sm border border-gray-100 dark:border-dark-raised px-4 py-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('assistant.welcome.greeting', { name })}</p>
          <p className="text-sm text-slate-700 dark:text-gray-300 mt-1">{t('assistant.welcome.body')}</p>
        </div>
        <div className="mt-4 max-w-2xl">
          <p className="mb-2 text-xs font-semibold text-ink-muted dark:text-gray-400">{t('assistant.faqLabel')}</p>
          <ul className="flex flex-col gap-2">
            {POPULAR.map((k) => (
              <li key={k}>
                <button onClick={() => onAsk(t(k))} title={t(k)} className="group w-full h-10 flex items-center gap-3 px-3.5 text-left rounded-lg bg-gray-50 dark:bg-dark-canvas border border-gray-100 dark:border-dark-raised hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-white/5 transition-colors">
                  <span aria-hidden className="material-symbols-outlined shrink-0 text-[18px] text-gray-400 group-hover:text-primary transition-colors">
                    search
                  </span>
                  <span className="flex-1 min-w-0 truncate whitespace-nowrap text-sm text-slate-700 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white">{t(k)}</span>
                  <span aria-hidden className="material-symbols-outlined shrink-0 text-[18px] text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                    arrow_forward
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function AssistantPage() {
  const t = useT();
  const chats = useStore((s) => s.chats);
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sessions = useMemo(() => sessionsOf(chats), [chats]);
  const messages = active ? chats.filter((m) => m.sessionId === active) : [];
  const search = isFixtureMode() ? '?fixture=mockup' : '';

  // Grow the composer with its content, up to ~6 lines, then scroll inside it.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Keep the latest question (and the reply under it) in view.
  useEffect(() => {
    scrollRef.current?.querySelector('[data-last-question]')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [active, messages.length, pending]);

  const ask = (q: string) => {
    const query = q.trim();
    if (!query || pending) return;
    setPending(query);
    setText('');
    inputRef.current?.focus();
    // The search is instant; a short pause makes the reply read as an answer rather than a page swap.
    timer.current = setTimeout(() => {
      setActive(useStore.getState().sendChat(active, query));
      setPending(null);
    }, 900);
  };
  const cancelPending = () => {
    clearTimeout(timer.current);
    setPending(null);
  };
  const remove = (id: string) => {
    useStore.getState().deleteChat(id);
    if (id === active) setActive(null);
  };
  const open = (id: string) => {
    cancelPending();
    setActive(id);
    setHistoryOpen(false);
  };
  const newChat = () => {
    cancelPending();
    setActive(null);
    setText('');
    setHistoryOpen(false);
  };

  const empty = messages.length === 0 && !pending;
  const composer = (
    <div
      className={`bg-gray-50 dark:bg-dark-canvas rounded-2xl border border-gray-200 dark:border-dark-raised transition-colors focus-within:bg-white dark:focus-within:bg-dark-surface focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10`}
    >
      <textarea
        ref={inputRef}
        rows={1}
        aria-label={t('assistant.placeholder')}
        className={`block w-full resize-none bg-transparent border-0 focus:ring-0 px-5 pt-4 pb-1 text-sm leading-6 text-slate-900 dark:text-white placeholder:text-gray-400 custom-scrollbar`}
        placeholder={t('assistant.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            ask(text);
          }
        }}
      />
      <div className="flex items-center gap-2 px-3 pb-3 pt-1">
        <button
          onClick={() => toast(t('assistant.attach'), 'info')}
          title={t('assistant.attachLabel')}
          aria-label={t('assistant.attachLabel')}
          className="size-9 rounded-lg flex items-center justify-center text-muted dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <span aria-hidden className="material-symbols-outlined text-[20px]">
            attach_file
          </span>
        </button>
        <span className="ml-auto hidden sm:inline text-2xs text-muted dark:text-gray-500">{t('assistant.enterHint')}</span>
        <button
          aria-label={t('assistant.send')}
          disabled={!text.trim() || !!pending}
          onClick={() => ask(text)}
          className="size-9 rounded-lg bg-primary hover:bg-primary-hover text-white flex items-center justify-center shadow-sm transition-colors disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-white/10 dark:disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed max-sm:ml-auto"
        >
          <span aria-hidden className="material-symbols-outlined text-[20px]">
            arrow_upward
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <AppLayout title={t('nav.aiSearch')} bare>
      <div className="flex flex-col h-full bg-gray-50 dark:bg-dark-canvas overflow-hidden">
        <div className="px-8 h-16 flex items-center shrink-0 border-b border-gray-100 dark:border-dark-raised bg-white dark:bg-dark-surface z-20 gap-3">
          <h2 className="text-xl font-bold text-ink dark:text-white">{t('assistant.title')}</h2>
          <button
            onClick={() => setHistoryOpen(true)}
            aria-expanded={historyOpen}
            className="ml-auto h-9 px-3 rounded-lg text-sm font-semibold flex items-center gap-1.5 text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <span aria-hidden className="material-symbols-outlined text-[20px]">
              history
            </span>
            {t('assistant.history')}
          </button>
          <button onClick={newChat} className="h-9 px-3.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white shadow-sm transition-colors">
            <span aria-hidden className="material-symbols-outlined text-[20px]">
              add
            </span>
            {t('assistant.newChat')}
          </button>
        </div>
        <div className="flex-1 relative overflow-hidden flex flex-col p-6 max-sm:p-3">
          <Drawer open={historyOpen} size="sm" title={t('assistant.history')} onClose={() => setHistoryOpen(false)}>
            <History sessions={sessions} active={active} onOpen={open} onDelete={remove} />
          </Drawer>
          <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-raised shadow-sm overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-[1400px] w-full mx-auto">{empty ? <Welcome onAsk={ask} /> : <Conversation messages={messages} search={search} pending={pending} />}</div>
          </div>
          <div className="shrink-0 px-8 pt-2 pb-8">
            <div className="max-w-[1400px] mx-auto">
              {!empty && (
                <div className="mb-3 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <span aria-hidden className="shrink-0 material-symbols-outlined text-[16px] text-muted">
                    bolt
                  </span>
                  {POPULAR.map((k) => t(k))
                    .filter((q) => !messages.some((m) => m.role === 'user' && m.text === q))
                    .map((q) => (
                      <button
                        key={q}
                        onClick={() => ask(q)}
                        className="shrink-0 h-8 px-3 rounded-full bg-gray-50 dark:bg-dark-canvas border border-gray-100 dark:border-dark-raised text-xs font-medium text-slate-700 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
                      >
                        {q}
                      </button>
                    ))}
                </div>
              )}
              {composer}
            </div>
          </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
