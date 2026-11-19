import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BrandMark } from '../../components/BrandMark';
import { normalizeEmail } from '../../domain/normalize';
import { useT } from '../../i18n/i18n';
import { clearMailbox, readMailbox, type MailMessage } from '../../store/platform';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Demo mailbox: stands in for the email provider (PRD BE-09) so every message the product sends can be read and its
 * links (verify email, reset password, accept invitation) clicked. Shared by all workspaces, like real inboxes.
 */
export function InboxPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [mail, setMail] = useState<MailMessage[]>(() => readMailbox());
  const [to, setTo] = useState(params.get('to') ?? '');
  const [openId, setOpenId] = useState<string | null>(null);

  // New mail sent from another tab shows up without a reload.
  useEffect(() => {
    const refresh = () => setMail(readMailbox());
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const shown = useMemo(() => {
    const q = normalizeEmail(to);
    return q ? mail.filter((m) => m.to.includes(q)) : mail;
  }, [mail, to]);
  const open = shown.find((m) => m.id === openId) ?? shown[0];

  return (
    <div className="min-h-screen bg-background-light flex flex-col">
      <header className="h-16 bg-sidebar-dark text-white flex items-center gap-3 px-6">
        <BrandMark className="h-8" />
        <span className="font-bold">{t('inbox.title')}</span>
        <span className="text-xs text-white/60 hidden sm:inline">{t('inbox.subtitle')}</span>
      </header>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[360px_1fr] min-h-0">
        <aside className="border-r border-[#e6dddb] bg-white flex flex-col min-h-0">
          <div className="p-3 flex gap-2 border-b border-[#e6dddb]">
            <input
              type="search" aria-label={t('inbox.filter')} placeholder={t('inbox.filter')} value={to}
              onChange={(e) => { setTo(e.target.value); setParams(e.target.value ? { to: e.target.value } : {}, { replace: true }); }}
              className="flex-1 h-9 rounded-lg bg-[#f8f6f6] ring-1 ring-gray-200 px-3 text-sm outline-none focus:ring-primary"
            />
            <button onClick={() => { clearMailbox(); setMail([]); }} className="px-3 h-9 rounded-lg text-xs font-bold text-[#896a61] hover:text-red-600">{t('inbox.clear')}</button>
          </div>
          <ul className="overflow-y-auto custom-scrollbar flex-1">
            {shown.length === 0 && <li className="p-6 text-sm text-[#896a61] text-center">{t('inbox.empty')}</li>}
            {shown.map((m) => (
              <li key={m.id}>
                <button onClick={() => setOpenId(m.id)} className={`w-full text-left px-4 py-3 border-b border-[#f1ecea] hover:bg-[#f8f6f6] ${open?.id === m.id ? 'bg-primary/5' : ''}`}>
                  <span className="block text-xs text-[#896a61] truncate">{m.to} · {fmt(m.at)}</span>
                  <span className="block text-sm font-bold text-[#181211] truncate">{m.subject}</span>
                  {m.workspace && <span className="block text-xs text-[#896a61] truncate">{m.workspace}</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className="p-6 md:p-10 min-w-0">
          {open ? (
            <article className="max-w-2xl bg-white rounded-2xl border border-[#e6dddb] p-6 space-y-4">
              <div>
                <h1 className="text-xl font-bold text-[#181211]">{open.subject}</h1>
                <p className="text-xs text-[#896a61] mt-1">{t('inbox.to', { to: open.to })} · {fmt(open.at)}</p>
              </div>
              <p className="text-sm whitespace-pre-wrap text-slate-700">{open.body}</p>
              {open.action && (
                <a href={open.action.href} className="inline-flex items-center h-11 px-6 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-sm">{open.action.label}</a>
              )}
            </article>
          ) : (
            <p className="text-sm text-[#896a61]">{t('inbox.pick')}</p>
          )}
        </main>
      </div>
    </div>
  );
}
