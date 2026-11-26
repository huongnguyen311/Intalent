import { useState } from 'react';
import { Pagination } from '../../components/Pagination';
import type { Prompt } from '../../domain/types';
import { useT, type TKey } from '../../i18n/i18n';
import { PromptEditor } from './PromptEditor';

const PAGE_SIZE = 10;
const TH = 'px-6 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]  ';

/** "3/24/2026, 3:30:21 PM" */
const stamp = (iso: string) => new Date(iso).toLocaleString('en-US');

function PenIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pen" aria-hidden="true">
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path>
    </svg>
  );
}

/** One editable list (system prompts or email templates) with its heading. */
export function PromptsTable({ items, title, desc, noun }: { items: Prompt[]; title: TKey; desc: TKey; noun: string }) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const rows = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="ty-section text-lg font-semibold text-gray-900 dark:text-white">{t(title)}</h2>
          <p className="text-sm text-gray-500">{t(desc)}</p>
        </div>
      </div>
      <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-[#e6dddb] dark:border-[#2a2423] shadow-sm flex flex-col ">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-274px)] custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] sticky top-0 z-10">
              <tr>
                {(['systemConfig.col.key', 'systemConfig.col.description', 'systemConfig.col.updated', 'systemConfig.col.actions'] as const).map((k) => (
                  <th key={k} className={TH}><div className="flex items-center gap-1">{t(k)}</div></th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ">
                  <td className="px-6 py-4 whitespace-nowrap "><span className="font-medium">{p.name}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap "><span className="text-gray-600 dark:text-gray-400">{p.description}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap "><span>{stamp(p.updatedAt)}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap ">
                    <button onClick={() => setEditing(p)} className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors" title={t('systemConfig.editTitle')} aria-label={`${t('systemConfig.editTitle')}: ${p.name}`}>
                      <PenIcon />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-[#896a61]">{t('systemConfig.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} noun={noun} onPage={setPage} />
      </div>
      {editing && <PromptEditor key={editing.id} prompt={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
