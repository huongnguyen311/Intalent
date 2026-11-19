import { useState } from 'react';
import { rewritePoints } from '../domain/jdWriter';
import { useT } from '../i18n/i18n';

const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';
const AI_BTN =
  'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors';

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Builds a first draft from the surrounding form. */
  draft: () => string;
  rows?: number;
  placeholder?: string;
};

/** Textarea with simulated-AI "Draft" and "Rewrite" actions; the last AI change can be undone. */
export function AiTextField({ id, label, value, onChange, draft, rows = 6, placeholder }: Props) {
  const t = useT();
  const [undo, setUndo] = useState<string | null>(null);
  const apply = (next: string) => {
    setUndo(value);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-[#896a61]">{label}</label>
        <div className="flex items-center gap-1">
          {undo !== null && (
            <button type="button" onClick={() => { onChange(undo); setUndo(null); }} className={AI_BTN}>
              <span className="material-symbols-outlined text-[16px]">undo</span>{t('ai.write.undo')}
            </button>
          )}
          <button type="button" onClick={() => apply(draft())} className={AI_BTN} aria-label={`${t('ai.write.draft')}: ${label}`}>
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>{t('ai.write.draft')}
          </button>
          <button type="button" disabled={!value.trim()} onClick={() => apply(rewritePoints(value))} className={AI_BTN} aria-label={`${t('ai.write.rewrite')}: ${label}`}>
            <span className="material-symbols-outlined text-[16px]">edit_note</span>{t('ai.write.rewrite')}
          </button>
        </div>
      </div>
      <textarea
        id={id}
        rows={rows}
        className={FIELD}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setUndo(null); }}
      />
    </div>
  );
}
