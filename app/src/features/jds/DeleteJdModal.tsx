import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import type { Jd } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';

type Props = { jd: Jd | null; onClose: () => void; onDeleted?: () => void };

/** Confirmation before a JD is deleted; refuses (with a toast) while jobs still use it. */
export function DeleteJdModal({ jd, onClose, onDeleted }: Props) {
  const t = useT();
  // Jobs pointing at this JD block the delete; say so before the user tries.
  const used = useStore((s) => (jd ? s.jobs.filter((j) => j.jdId === jd.id).length : 0));
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
          <button onClick={confirm} disabled={used > 0} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600">
            {t('jds.menu.delete')}
          </button>
        </>
      }
    >
      {jd && (used > 0 ? (
        <p className="flex gap-2 text-sm text-amber-800 dark:text-amber-300">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          {t('jds.delete.blocked', { title: jd.title, count: used })}
        </p>
      ) : t('jds.delete.confirm', { title: jd.title }))}
    </Modal>
  );
}
