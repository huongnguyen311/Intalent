import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import type { Prompt } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';

const FIELD = 'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] focus:border-primary focus:ring-0 rounded-lg text-sm text-[#181211] dark:text-white';
const LABEL = 'block text-xs font-bold text-[#896a61] uppercase tracking-wider mb-1';

/** Edits a prompt or email template; the text is saved, never executed. */
export function PromptEditor({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const t = useT();
  const [description, setDescription] = useState(prompt.description);
  const [text, setText] = useState(prompt.text);

  const save = () => {
    useStore.getState().updatePrompt(prompt.id, { description: description.trim(), text });
    toast(t('systemConfig.saved'));
    onClose();
  };

  return (
    <Modal
      open
      title={t('systemConfig.edit', { name: prompt.name })}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#5a4a46] hover:text-[#181211]">{t('common.cancel')}</button>
          <button onClick={save} className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-semibold text-sm transition-colors">{t('systemConfig.save')}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL} htmlFor="prompt-description">{t('systemConfig.col.description')}</label>
          <input id="prompt-description" className={FIELD} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="prompt-text">{t('systemConfig.field.text')}</label>
          <textarea id="prompt-text" rows={10} className={`${FIELD} font-mono`} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
