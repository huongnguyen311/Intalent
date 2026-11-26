import { useState } from 'react';
import { stageLabel } from '../../domain/stages';
import { fold } from '../../domain/techVocab';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';

const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';

type Props = { jobId: string; selected: string[]; onChange: (ids: string[]) => void };

/** Searchable multi-select over the Talent Pool; people already in the job are listed but locked. */
export function PoolSearch({ jobId, selected, onChange }: Props) {
  const t = useT();
  const [lang] = useLang();
  const candidates = useStore((s) => s.candidates);
  const applications = useStore((s) => s.applications);
  const [q, setQ] = useState('');

  const needle = fold(q.trim());
  const matches = candidates.filter((c) => !needle || fold(`${c.name} ${c.title} ${c.email}`).includes(needle));
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-2">
      <input aria-label={t('atp.search')} className={FIELD} placeholder={t('atp.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="max-h-64 overflow-y-auto custom-scrollbar border border-[#e6dddb] dark:border-[#3a3433] rounded-lg divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
        {matches.map((c) => {
          const existing = applications.find((a) => a.candidateId === c.id && a.jobId === jobId);
          return (
            <li key={c.id}>
              <label className={`flex items-center gap-3 px-3 py-2 ${existing ? 'opacity-60' : 'cursor-pointer hover:bg-[#f8f6f6] dark:hover:bg-white/5'}`}>
                <input
                  type="checkbox"
                  className="accent-primary"
                  disabled={!!existing}
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{c.name}</span>
                  <span className="block text-xs text-[#896a61] truncate">{c.title}</span>
                </span>
                {existing && (
                  <span className="text-xs text-amber-700 dark:text-amber-300 whitespace-nowrap">
                    {t('atp.inJob', { stage: stageLabel(existing.stage, lang) })}
                  </span>
                )}
              </label>
            </li>
          );
        })}
        {matches.length === 0 && <li className="px-3 py-6 text-center text-[#896a61]">{t('atp.noMatch')}</li>}
      </ul>
    </div>
  );
}
