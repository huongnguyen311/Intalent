import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '../i18n/i18n';

const LABEL = 'text-sm font-semibold text-ink dark:text-white';

/** A labelled form field (JD editor style): label with optional * and aside, the control, and a Required note. */
export function Field({ id, label, required, aside, error, children, labelClass = LABEL }: { id?: string; label: string; required?: boolean; aside?: ReactNode; error?: boolean; children: ReactNode; labelClass?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={labelClass}>
          {label}{required && <span className="text-red-500 ml-0.5" aria-label={t('jds.page.required')}>*</span>}
        </label>
        {aside}
      </div>
      {children}
      {error && <p className="text-xs text-red-600">{t('jds.page.required')}</p>}
    </div>
  );
}

const foldText = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Chips (or, with `list`, one row per item) plus an add box.
 * Typing opens a filtered dropdown of `options` (arrows + Enter, or click); anything else typed is added as-is.
 * `quick` shows one-click suggestions under the box.
 */
export function TagField({ id, label, required, placeholder, values, onChange, options = [], quick = [], error, starred, onStar, hint, list, labelClass }: {
  id: string; label: string; required?: boolean; placeholder: string; values: string[];
  onChange: (v: string[]) => void; options?: string[]; quick?: string[]; error?: boolean;
  /** With `onStar`, each chip gets a ★ toggle (critical skills). */
  starred?: string[]; onStar?: (v: string) => void; hint?: string;
  /** Sentences rather than tags: one per row, and commas stay inside an item. */
  list?: boolean;
  /** Label style of the host form (defaults to the JD editor's). */
  labelClass?: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  // -1: nothing highlighted, so Enter adds exactly what was typed; arrows move into the menu.
  const [active, setActive] = useState(-1);
  const picked = (v: string) => values.some((x) => x.toLowerCase() === v.toLowerCase());
  const q = foldText(draft.trim());
  const matches = options.filter((o) => !picked(o) && (!q || foldText(o).includes(q))).slice(0, 8);
  const showMenu = open && matches.length > 0;
  const addValue = (raw: string) => {
    const v = raw.trim().replace(/,$/, '');
    if (v && !picked(v)) onChange([...values, v]);
    setDraft('');
    setActive(-1);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && matches.length) { e.preventDefault(); setOpen(true); setActive((i) => (i + 1) % matches.length); }
    else if (e.key === 'ArrowUp' && matches.length) { e.preventDefault(); setActive((i) => (i <= 0 ? matches.length : i) - 1); }
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter' || (!list && e.key === ',')) {
      e.preventDefault();
      // An option picked with the arrows wins; otherwise what was typed, spelled like a known option when it matches one exactly.
      const exact = options.find((o) => foldText(o) === q);
      addValue(showMenu && active >= 0 ? matches[active] : exact ?? draft);
    } else if (e.key === 'Backspace' && !draft && values.length && !list) onChange(values.slice(0, -1));
  };
  const remove = (v: string) => (
    <button type="button" aria-label={t('jds.page.remove', { value: v })} onClick={() => onChange(values.filter((x) => x !== v))}
      className="size-5 shrink-0 inline-flex items-center justify-center rounded-full text-ink-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-white/10">
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">close</span>
    </button>
  );
  const input = (
    <span className={`relative flex items-center gap-1 ${list ? 'w-full' : 'flex-1 min-w-[180px]'}`}>
      <input id={id} role="combobox" aria-expanded={showMenu} aria-controls={`${id}-menu`} aria-autocomplete="list"
        aria-activedescendant={showMenu && active >= 0 ? `${id}-opt-${active}` : undefined}
        value={draft} placeholder={placeholder}
        onChange={(e) => { setDraft(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); addValue(draft); }}
        onKeyDown={onKey}
        className="flex-1 min-w-0 bg-transparent border-0 px-1 py-1 text-sm focus:ring-0 focus:outline-none text-ink dark:text-white placeholder-[#b5a7a3]" />
      <button type="button" aria-label={`${t('jds.page.add')} ${label}`} onMouseDown={(e) => e.preventDefault()} onClick={() => addValue(draft)} disabled={!draft.trim()}
        className="size-7 shrink-0 inline-flex items-center justify-center rounded-full text-primary hover:bg-primary/10 disabled:text-gray-300 disabled:hover:bg-transparent">
        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
      </button>
      {showMenu && (
        <ul id={`${id}-menu`} role="listbox" aria-label={label}
          className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded-lg bg-white dark:bg-dark-surface border border-line dark:border-dark-line shadow-lg py-1">
          {matches.map((o, i) => (
            <li key={o} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); addValue(o); }} onMouseEnter={() => setActive(i)}
              className={`px-3 py-1.5 text-sm cursor-pointer ${i === active ? 'bg-primary/10 text-primary' : 'text-ink dark:text-gray-200'}`}>{o}</li>
          ))}
        </ul>
      )}
    </span>
  );
  const ideas = quick.filter((x) => !picked(x));
  return (
    <Field id={id} label={label} required={required} error={error} labelClass={labelClass}>
      <div className={`rounded-xl bg-white dark:bg-dark-surface border px-2.5 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${error ? 'border-red-400' : 'border-line dark:border-dark-line'}`}>
        {list ? (
          <>
            {values.length > 0 && (
              <ul className="mb-1 divide-y divide-hairline dark:divide-dark-raised">
                {values.map((v) => (
                  <li key={v} className="flex items-start gap-2 px-1 py-1.5 text-sm text-ink dark:text-gray-200">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-muted"></span>
                    <span className="flex-1">{v}</span>
                    {remove(v)}
                  </li>
                ))}
              </ul>
            )}
            {input}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {values.map((v) => (
              <span key={v} className={`inline-flex items-center gap-0.5 ${onStar ? 'pl-1' : 'pl-2.5'} pr-1 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-xs font-semibold text-ink dark:text-gray-200 border ${starred?.includes(v) ? 'border-orange-300 bg-orange-50 dark:bg-orange-500/15' : 'border-transparent'}`}>
                {onStar && (
                  <button type="button" aria-pressed={starred?.includes(v) ?? false} aria-label={t('jds.page.critical', { value: v })} onClick={() => onStar(v)}
                    className={`size-5 inline-flex items-center justify-center rounded hover:bg-orange-100 dark:hover:bg-orange-500/30 ${starred?.includes(v) ? 'text-orange-500' : 'text-[#c9b8b3]'}`}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]" style={starred?.includes(v) ? { fontVariationSettings: "'FILL' 1" } : undefined}>star</span>
                  </button>
                )}
                {v}
                {remove(v)}
              </span>
            ))}
            {input}
          </div>
        )}
      </div>
      {ideas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-0.5 text-ink-muted">
            <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-orange-500">auto_awesome</span>{t('jds.suggest.label')}
          </span>
          {ideas.map((x) => (
            <button key={x} type="button" aria-label={t('jds.suggest.add', { value: x })} onClick={() => addValue(x)}
              className="inline-flex items-center gap-0.5 pl-1.5 pr-2 py-0.5 rounded-full border border-dashed border-gray-300 dark:border-dark-line text-gray-600 dark:text-gray-300 font-medium hover:border-primary hover:text-primary hover:bg-primary/5">
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">add</span>{x}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </Field>
  );
}
