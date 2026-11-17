import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { stageLabel } from '../../domain/stages';
import type { Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';

type Props = { open: boolean; name: string; to: Stage; onCancel: () => void; onConfirm: (note: string) => void };

const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';

/** Every stage move asks for a note: optional, but required when rejecting. Cancel leaves the card where it was. */
export function MoveDialog({ open, name, to, onCancel, onConfirm }: Props) {
  const t = useT();
  const [lang] = useLang();
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) setNote('');
  }, [open]);
  const trimmed = note.trim();
  const reject = to === 'rejected';

  return (
    <Modal
      open={open}
      title={reject ? t('pipeline.reject.title') : t('pipeline.move.title', { stage: stageLabel(to, lang) })}
      onClose={onCancel}
      footer={
        <>
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white rounded-lg hover:border-primary/50 transition-colors">
            {t('common.cancel')}
          </button>
          <button
            disabled={reject && !trimmed}
            onClick={() => onConfirm(trimmed)}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${reject ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-hover'}`}
          >
            {t(reject ? 'pipeline.reject.confirm' : 'pipeline.move.confirm')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[#896a61]">{t(reject ? 'pipeline.reject.desc' : 'pipeline.move.desc', { name, stage: stageLabel(to, lang) })}</p>
        <div className="flex flex-col gap-1">
          <label htmlFor="move-note" className="text-xs font-semibold text-[#896a61]">{t(reject ? 'pipeline.reject.reason' : 'pipeline.move.note')}</label>
          <textarea
            id="move-note"
            rows={3}
            autoFocus
            className={FIELD}
            placeholder={t(reject ? 'pipeline.reject.placeholder' : 'pipeline.move.placeholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
