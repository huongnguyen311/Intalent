import { useState } from 'react';
import type { EducationEntry, WorkExperience } from '../../domain/types';
import { useT } from '../../i18n/i18n';

const CARD = 'p-4 rounded-xl border border-[#e6dddb] dark:border-[#3a3433] bg-[#f8f6f6] dark:bg-[#251f1e]';
const SUB_LABEL = 'block text-xs font-medium text-[#896a61]';
const SUB_INPUT_RO =
  'w-full rounded border-[#e6dddb] dark:border-[#3a3433] bg-gray-100 dark:bg-gray-700 text-sm text-[#181211] dark:text-white focus:ring-0 focus:border-[#e6dddb] dark:focus:border-[#3a3433] p-2 cursor-default';
const SUB_INPUT_EDIT =
  'w-full rounded border border-[#e6dddb] dark:border-[#3a3433] bg-white dark:bg-[#1e1e1e] text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary p-2 hover:border-primary/50';
const ADD_BTN = 'flex items-center gap-1 text-sm font-semibold text-primary hover:underline';
const REMOVE_BTN = 'flex items-center justify-center size-7 rounded-lg text-[#896a61] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors';

/** A list of short values (skills, tags, domains) shown as chips; editable chips get a remove button and an add box. */
export function ChipsField({ label, values, editing, onChange, chipClass, emptyText, placeholder }: {
  label?: string;
  values: string[];
  editing: boolean;
  onChange: (v: string[]) => void;
  chipClass: string;
  emptyText?: string;
  placeholder?: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div>
      {label && <label className="block text-sm font-medium text-[#181211] dark:text-[#e6dddb] mb-2">{label}</label>}
      <div className="flex flex-wrap items-center gap-2">
        {values.length === 0 && !editing && <span className="text-sm text-[#896a61]">{emptyText ?? '—'}</span>}
        {values.map((s) => (
          <span key={s} className={chipClass}>
            {s}
            {editing && (
              <button type="button" aria-label={t('profile.chip.remove', { value: s })} onClick={() => onChange(values.filter((x) => x !== s))} className="flex items-center hover:text-red-600">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </span>
        ))}
        {editing && (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
            }}
            onBlur={add}
            placeholder={placeholder ?? t('profile.chip.add')}
            aria-label={label ? `${label}: ${t('profile.chip.add')}` : t('profile.chip.add')}
            className="min-w-[140px] flex-1 px-2 py-1 text-sm rounded-lg border border-dashed border-[#e6dddb] dark:border-[#3a3433] bg-transparent text-[#181211] dark:text-white focus:border-primary focus:ring-0"
          />
        )}
      </div>
    </div>
  );
}

function SubInput({ label, value, editing, onChange, area }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void; area?: boolean;
}) {
  const cls = editing ? SUB_INPUT_EDIT : SUB_INPUT_RO;
  return (
    <div className="space-y-1">
      <label className={SUB_LABEL}>{label}</label>
      {area ? (
        <textarea readOnly={!editing} rows={3} aria-label={label} className={cls} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input readOnly={!editing} aria-label={label} className={cls} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function update<T>(list: T[], i: number, patch: Partial<T>): T[] {
  return list.map((x, j) => (j === i ? { ...x, ...patch } : x));
}

export function ExperienceEditor({ items, editing, onChange }: { items: WorkExperience[]; editing: boolean; onChange: (v: WorkExperience[]) => void }) {
  const t = useT();
  return (
    <div className="space-y-4">
      {items.length === 0 && !editing && <p className="text-sm text-[#896a61]">—</p>}
      {items.map((x, i) => (
        <div key={i} className={CARD}>
          {editing && (
            <div className="flex justify-end -mt-2 -mr-2 mb-1">
              <button type="button" className={REMOVE_BTN} aria-label={t('profile.exp.remove')} title={t('profile.exp.remove')} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <SubInput label={t('profile.exp.title')} value={x.title} editing={editing} onChange={(v) => onChange(update(items, i, { title: v }))} />
            <SubInput label={t('profile.exp.company')} value={x.company} editing={editing} onChange={(v) => onChange(update(items, i, { company: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <SubInput label={t('profile.exp.start')} value={x.start} editing={editing} onChange={(v) => onChange(update(items, i, { start: v }))} />
            <SubInput label={t('profile.exp.end')} value={x.end} editing={editing} onChange={(v) => onChange(update(items, i, { end: v }))} />
          </div>
          <SubInput label={t('profile.exp.desc')} value={x.description} editing={editing} area onChange={(v) => onChange(update(items, i, { description: v }))} />
        </div>
      ))}
      {editing && (
        <button type="button" className={ADD_BTN} onClick={() => onChange([...items, { title: '', company: '', start: '', end: '', description: '' }])}>
          <span className="material-symbols-outlined text-[18px]">add</span>{t('profile.exp.add')}
        </button>
      )}
    </div>
  );
}

export function EducationEditor({ items, editing, onChange }: { items: EducationEntry[]; editing: boolean; onChange: (v: EducationEntry[]) => void }) {
  const t = useT();
  return (
    <div className="space-y-4">
      {items.length === 0 && !editing && <p className="text-sm text-[#896a61]">—</p>}
      {items.map((e, i) => (
        <div key={i} className={CARD}>
          {editing && (
            <div className="flex justify-end -mt-2 -mr-2 mb-1">
              <button type="button" className={REMOVE_BTN} aria-label={t('profile.edu.remove')} title={t('profile.edu.remove')} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SubInput label={t('profile.edu.degree')} value={e.degree} editing={editing} onChange={(v) => onChange(update(items, i, { degree: v }))} />
            <SubInput label={t('profile.edu.institution')} value={e.institution} editing={editing} onChange={(v) => onChange(update(items, i, { institution: v }))} />
            <SubInput label={t('profile.edu.year')} value={e.year} editing={editing} onChange={(v) => onChange(update(items, i, { year: v }))} />
          </div>
        </div>
      ))}
      {editing && (
        <button type="button" className={ADD_BTN} onClick={() => onChange([...items, { degree: '', institution: '', year: '' }])}>
          <span className="material-symbols-outlined text-[18px]">add</span>{t('profile.edu.add')}
        </button>
      )}
    </div>
  );
}
