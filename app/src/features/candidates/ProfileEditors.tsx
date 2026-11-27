import { useState } from 'react';
import type { CvProject, EducationEntry, WorkExperience } from '../../domain/types';
import { useT } from '../../i18n/i18n';

const CARD = 'group relative p-4 rounded-xl border border-line dark:border-dark-line bg-background-light dark:bg-dark-surface';
const SUB_LABEL = 'block text-xs font-medium text-ink-muted';
// Same look as the profile page: editable = input box, read-only = plain text.
const SUB_INPUT_RO = 'block w-full px-0 py-1 border-0 bg-transparent text-sm text-ink dark:text-white cursor-default focus:outline-none focus:ring-0';
const SUB_INPUT_EDIT = 'block w-full rounded-lg border border-line dark:border-dark-line bg-white dark:bg-dark-canvas text-sm text-ink dark:text-white p-2 cursor-text hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors';
const ADD_BTN = 'flex items-center gap-1 text-sm font-semibold text-primary hover:underline';
const REMOVE_BTN = 'opacity-60 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center size-7 rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors';

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
      {label && <label className="block text-sm font-medium text-ink dark:text-[#e6dddb] mb-2">{label}</label>}
      <div className="flex flex-wrap items-center gap-2">
        {values.length === 0 && !editing && <span className="text-sm text-ink-muted">{emptyText ?? '—'}</span>}
        {values.map((s) => (
          <span key={s} className={`${chipClass} group/chip`}>
            {s}
            {editing && (
              <button type="button" aria-label={t('profile.chip.remove', { value: s })} onClick={() => onChange(values.filter((x) => x !== s))} className="flex items-center hover:text-red-600 opacity-40 group-hover/chip:opacity-100 focus:opacity-100">
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
            placeholder={placeholder ?? t('profile.chip.addShort')}
            aria-label={label ? `${label}: ${t('profile.chip.add')}` : t('profile.chip.add')}
            className="min-w-[140px] flex-1 px-2 py-1 text-sm rounded-lg border border-dashed border-line dark:border-dark-line hover:border-primary/50 bg-transparent text-ink dark:text-white placeholder-gray-400 focus:border-primary focus:ring-0"
          />
        )}
      </div>
    </div>
  );
}

function SubInput({ label, value, editing, onChange, area, type, disabled }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void; area?: boolean;
  /** Input type while editing (e.g. "month"); read-only shows plain text. */
  type?: string;
  disabled?: boolean;
}) {
  const cls = (editing && !disabled ? SUB_INPUT_EDIT : SUB_INPUT_RO) + (disabled ? ' opacity-60' : '');
  return (
    <div className="space-y-1">
      <label className={SUB_LABEL}>{label}</label>
      {area ? (
        <textarea readOnly={!editing} rows={3} aria-label={label} className={cls + ' resize-none'} value={editing ? value : value || '—'} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input readOnly={!editing || disabled} aria-label={label} className={cls} type={editing && !disabled && type ? type : 'text'} value={value} onChange={(e) => onChange(e.target.value)} />
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
      {items.length === 0 && !editing && <p className="text-sm text-ink-muted">—</p>}
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
            <SubInput label={t('profile.exp.start')} type="month" value={x.start} editing={editing} onChange={(v) => onChange(update(items, i, { start: v }))} />
            <div className="space-y-1">
              {/* An empty end date means "still working here" (estimateYears counts it up to today). */}
              <SubInput label={t('profile.exp.end')} type="month" value={x.end || t('profile.cv.present')} disabled={!x.end && editing} editing={editing} onChange={(v) => onChange(update(items, i, { end: v }))} />
              {editing && (
                <label className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-line text-primary focus:ring-primary"
                    checked={!x.end}
                    onChange={(e) => onChange(update(items, i, { end: e.target.checked ? '' : x.start || new Date().toISOString().slice(0, 7) }))}
                  />
                  {t('profile.exp.current')}
                </label>
              )}
            </div>
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
      {items.length === 0 && !editing && <p className="text-sm text-ink-muted">—</p>}
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

/** Key projects from the CV: name, role, period, tech and what the candidate did. */
export function ProjectsEditor({ items, editing, onChange, techChipClass }: { items: CvProject[]; editing: boolean; onChange: (v: CvProject[]) => void; techChipClass: string }) {
  const t = useT();
  return (
    <div className="space-y-4">
      {items.length === 0 && !editing && <p className="text-sm text-ink-muted">—</p>}
      {items.map((p, i) => (
        <div key={i} className={CARD}>
          {editing && (
            <div className="flex justify-end -mt-2 -mr-2 mb-1">
              <button type="button" className={REMOVE_BTN} aria-label={t('profile.proj.remove')} title={t('profile.proj.remove')} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <SubInput label={t('profile.proj.name')} value={p.name} editing={editing} onChange={(v) => onChange(update(items, i, { name: v }))} />
            <SubInput label={t('profile.proj.role')} value={p.role} editing={editing} onChange={(v) => onChange(update(items, i, { role: v }))} />
            <SubInput label={t('profile.proj.period')} value={p.period} editing={editing} onChange={(v) => onChange(update(items, i, { period: v }))} />
          </div>
          <div className="mb-4">
            <ChipsField label={t('profile.proj.tech')} values={p.tech} editing={editing} onChange={(v) => onChange(update(items, i, { tech: v }))} chipClass={techChipClass} />
          </div>
          <SubInput label={t('profile.proj.desc')} value={p.description} editing={editing} area onChange={(v) => onChange(update(items, i, { description: v }))} />
        </div>
      ))}
      {editing && (
        <button type="button" className={ADD_BTN} onClick={() => onChange([...items, { name: '', role: '', period: '', description: '', tech: [] }])}>
          <span className="material-symbols-outlined text-[18px]">add</span>{t('profile.proj.add')}
        </button>
      )}
    </div>
  );
}

/** A fixed set of options shown as toggle chips (several may be on). Read-only shows only the chosen ones. */
export function ChoiceChips<T extends string>({ label, options, values, editing, onChange, labelFor }: {
  label: string; options: readonly T[]; values: T[]; editing: boolean; onChange: (v: T[]) => void; labelFor: (v: T) => string;
}) {
  const shown = editing ? options : options.filter((o) => values.includes(o));
  return (
    <div role="group" aria-label={label}>
      <span className="block text-sm font-medium text-ink dark:text-white mb-2">{label}</span>
      <div className="flex flex-wrap gap-2">
        {shown.length === 0 && <span className="text-sm text-ink-muted">—</span>}
        {shown.map((o) => {
          const on = values.includes(o);
          return editing ? (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? values.filter((x) => x !== o) : [...values, o])}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${on ? 'bg-primary/10 text-primary border-primary/40' : 'border-line dark:border-dark-line text-ink-muted hover:border-primary/50'}`}
            >
              {on && <span className="material-symbols-outlined text-[14px]">check</span>}{labelFor(o)}
            </button>
          ) : (
            <span key={o} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">{labelFor(o)}</span>
          );
        })}
      </div>
    </div>
  );
}
