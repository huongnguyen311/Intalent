import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import type { Jd } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';

type Props = { jd: Jd | null; onClose: () => void; onDeleted?: () => void };

/** Confirmation before a JD is deleted; refuses (with a toast) while jobs still use it. */
export function DeleteJdModal({ jd, onClose, onDeleted }: Props) {
  const t = useT();
  const confirm = () => {
    if (!jd) return;
    const r = useStore.getState().deleteJd(jd.id);
    if (r.ok) {
      toast(t('jds.toast.deleted'));
      onDeleted?.();
    } else if (r.reason === 'in_use') {
      toast(t('jds.delete.inUse', { count: r.jobs }), 'error');
    }
    onClose();
  };
  return (
    <Modal
      open={jd !== null}
      title={t('jds.delete.title')}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white rounded-lg hover:border-primary/50 transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={confirm} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors">
            {t('jds.menu.delete')}
          </button>
        </>
      }
    >
      {jd && t('jds.delete.confirm', { title: jd.title })}
    </Modal>
  );
}
