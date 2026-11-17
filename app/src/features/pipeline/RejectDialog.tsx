import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useT } from '../../i18n/i18n';

type Props = { open: boolean; name: string; onCancel: () => void; onConfirm: (reason: string) => void };

const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';

/** Moving to Rejected needs a reason; cancelling leaves the card where it was. */
export function RejectDialog({ open, name, onCancel, onConfirm }: Props) {
  const t = useT();
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const trimmed = reason.trim();

  return (
    <Modal
      open={open}
      title={t('pipeline.reject.title')}
      onClose={onCancel}
      footer={
        <>
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white rounded-lg hover:border-primary/50 transition-colors">
            {t('common.cancel')}
          </button>
          <button
            disabled={!trimmed}
            onClick={() => onConfirm(trimmed)}
            className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('pipeline.reject.confirm')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[#896a61]">{t('pipeline.reject.desc', { name })}</p>
        <div className="flex flex-col gap-1">
          <label htmlFor="reject-reason" className="text-xs font-semibold text-[#896a61]">{t('pipeline.reject.reason')}</label>
          <textarea
            id="reject-reason"
            rows={3}
            autoFocus
            className={FIELD}
            placeholder={t('pipeline.reject.placeholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
