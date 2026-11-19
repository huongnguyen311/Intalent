import { useStageName } from './jobStageContext';
import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { REJECT_CODES } from '../../domain/pipelineConfig';
import type { RejectCode, Stage } from '../../domain/types';
import { useT } from '../../i18n/i18n';

type Props = {
  open: boolean;
  name: string;
  to: Stage;
  /** Shows "Email the candidate" when this stage has a template and the candidate has an address. */
  canEmail?: boolean;
  onCancel: () => void;
  onConfirm: (note: string, notify: boolean, code?: RejectCode) => void;
};

const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';

/**
 * Every stage move asks for a note (optional). Rejecting asks for a reason category, plus a note when the category is "Other".
 * `name` may be a single candidate or "N candidates" for a bulk move. Cancel leaves the cards where they were.
 */
export function MoveDialog({ open, name, to, canEmail = false, onCancel, onConfirm }: Props) {
  const t = useT();
  const label = useStageName();
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(false);
  const [code, setCode] = useState<RejectCode | ''>('');
  useEffect(() => {
    if (open) {
      setNote('');
      setNotify(false);
      setCode('');
    }
  }, [open]);
  const trimmed = note.trim();
  const reject = to === 'rejected';
  const blocked = reject && (!code || (code === 'other' && !trimmed));

  return (
    <Modal
      open={open}
      title={reject ? t('pipeline.reject.title') : t('pipeline.move.title', { stage: label(to) })}
      onClose={onCancel}
      footer={
        <>
          {/* Say what still blocks Reject instead of only greying the button out. */}
          {blocked && <span className="mr-auto text-xs text-[#896a61]">{t(!code ? 'pipeline.reject.needCode' : 'pipeline.reject.needReason')}</span>}
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white rounded-lg hover:border-primary/50 transition-colors">
            {t('common.cancel')}
          </button>
          <button
            disabled={blocked}
            onClick={() => onConfirm(trimmed, canEmail && notify, reject && code ? code : undefined)}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${reject ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-hover'}`}
          >
            {t(reject ? 'pipeline.reject.confirm' : 'pipeline.move.confirm')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[#896a61]">{t(reject ? 'pipeline.reject.desc' : 'pipeline.move.desc', { name, stage: label(to) })}</p>
        {reject && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[#896a61]"><label htmlFor="reject-code">{t('pipeline.reject.category')}</label><span aria-hidden="true" className="text-red-500"> *</span></span>
            <select id="reject-code" className={FIELD} value={code} onChange={(e) => setCode(e.target.value as RejectCode | '')}>
              <option value="">{t('pipeline.reject.pick')}</option>
              {REJECT_CODES.map((c) => <option key={c} value={c}>{t(`reject.${c}`)}</option>)}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#896a61]"><label htmlFor="move-note">{t(reject ? (code === 'other' ? 'pipeline.reject.reason' : 'pipeline.reject.detail') : 'pipeline.move.note')}</label>{reject && code === 'other' && <span aria-hidden="true" className="text-red-500"> *</span>}</span>
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
        {canEmail && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary" />
            {t(reject ? 'pipeline.move.notifyReject' : 'pipeline.move.notify')}
          </label>
        )}
      </div>
    </Modal>
  );
}
