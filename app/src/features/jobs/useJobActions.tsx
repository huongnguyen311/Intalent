import { useState, type ReactNode } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { can } from '../../domain/permissions';
import type { Job } from '../../domain/types';
import { useT, type TKey } from '../../i18n/i18n';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { FIELD } from '../../components/ui';

export interface JobAction {
  id: 'publish' | 'submit' | 'approve' | 'reject' | 'withdraw' | 'hold' | 'close' | 'reopen';
  label: string;
  icon: string;
  /** The one action worth a filled button on the detail page. */
  primary?: boolean;
  run: () => void;
}


/**
 * Status actions a user may take on a job, shared by the Jobs list and the job page.
 * Without `job.approve`, a draft goes to "Pending approval" instead of straight to the careers site.
 */
export function useJobActions(): { actionsFor: (job: Job) => JobAction[]; dialog: ReactNode } {
  const t = useT();
  const user = useMe();
  const canEdit = can(user, 'job.edit');
  const canApprove = can(user, 'job.approve');
  const [rejecting, setRejecting] = useState<Job | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const act = (id: JobAction['id'], icon: string, label: TKey, run: () => void, msg: TKey, primary?: boolean): JobAction => ({
    id, icon, label: t(label), primary, run: () => { run(); if (msg) toast(t(msg)); },
  });

  const actionsFor = (job: Job): JobAction[] => {
    const s = useStore.getState();
    const out: JobAction[] = [];
    if (job.status === 'pending_approval') {
      if (canApprove) {
        out.push(act('approve', 'verified', 'jobs.menu.approve', () => s.approveJob(job.id), 'jobs.toast.approved', true));
        out.push({ id: 'reject', icon: 'undo', label: t('jobs.menu.reject'), run: () => { setReason(''); setError(''); setRejecting(job); } });
      } else if (canEdit) {
        out.push(act('withdraw', 'undo', 'jobs.menu.withdraw', () => s.setJobStatus(job.id, 'draft'), 'jobs.toast.withdrawn'));
      }
      return out;
    }
    if (!canEdit) return out;
    if (job.status === 'draft') {
      out.push(canApprove
        ? act('publish', 'publish', 'jobs.menu.publish', () => s.setJobStatus(job.id, 'open'), 'jobs.toast.published', true)
        : act('submit', 'send', 'jobs.menu.submit', () => s.requestJobApproval(job.id), 'jobs.toast.submitted', true));
    }
    if (job.status === 'open') out.push(act('hold', 'pause_circle', 'jobs.menu.hold', () => s.setJobStatus(job.id, 'on_hold'), 'jobs.toast.onHold'));
    if (job.status === 'open' || job.status === 'on_hold') out.push(act('close', 'lock', 'jobs.menu.close', () => s.setJobStatus(job.id, 'closed'), 'jobs.toast.closed'));
    if (job.status === 'on_hold' || job.status === 'closed') out.push(act('reopen', 'publish', 'jobs.menu.reopen', () => s.setJobStatus(job.id, 'open'), 'jobs.toast.published', true));
    return out;
  };

  const confirmReject = () => {
    if (!rejecting) return;
    if (!reason.trim()) return setError(t('jobs.reject.required'));
    useStore.getState().rejectJob(rejecting.id, reason);
    toast(t('jobs.toast.rejected'));
    setRejecting(null);
  };

  const dialog = (
    <Modal
      open={rejecting !== null}
      title={t('jobs.reject.title')}
      onClose={() => setRejecting(null)}
      footer={
        <>
          <button type="button" onClick={() => setRejecting(null)} className="px-4 py-2 text-sm font-medium border border-line dark:border-dark-line rounded-lg">{t('common.cancel')}</button>
          <button type="button" onClick={confirmReject} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg">{t('jobs.reject.confirm')}</button>
        </>
      }
    >
      <label htmlFor="job-reject-reason" className="text-xs font-semibold text-ink-muted">{t('jobs.reject.label')}</label>
      <textarea id="job-reject-reason" rows={3} className={`${FIELD} mt-1`} value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {rejecting && <p className="text-xs text-ink-muted mt-2">{rejecting.title}</p>}
    </Modal>
  );

  return { actionsFor, dialog };
}
