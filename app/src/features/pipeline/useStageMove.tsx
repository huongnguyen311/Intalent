import { useState } from 'react';
import { toast } from '../../components/Toast';
import { stageTemplate } from '../../domain/hiring';
import { can } from '../../domain/permissions';
import { jobStageLabel } from '../../domain/pipelineConfig';
import type { RejectCode, Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { currentUser, me } from '../../store/session';
import { useStore } from '../../store/store';
import { sendTemplate } from '../hiring/emailVars';
import { JobStageProvider } from './jobStageContext';
import { MoveDialog } from './MoveDialog';
import { commitMove, handleDrop } from './moves';

/**
 * Stage moves with the note dialog, shared by every screen that offers "Move to…" (pipeline board/list, My interviews).
 * `move` validates one move and opens the dialog; `moveMany` does the same for a bulk selection (cards that cannot
 * move are skipped and reported). `dialog` must be rendered once by the caller.
 */
export function useStageMove() {
  const t = useT();
  const [lang] = useLang();
  const [pending, setPending] = useState<{ appIds: string[]; to: Stage; onDone?: () => void } | null>(null);
  const applications = useStore((s) => s.applications);
  const candidates = useStore((s) => s.candidates);
  const jobs = useStore((s) => s.jobs);
  const jobOf = (appId: string) => jobs.find((j) => j.id === applications.find((a) => a.id === appId)?.jobId);
  const stageLabel = (to: Stage, appId: string) => jobStageLabel(jobOf(appId), to, lang);

  const candidateOf = (appId: string) => {
    const app = applications.find((a) => a.id === appId);
    return app ? candidates.find((c) => c.id === app.candidateId) : undefined;
  };
  const nameOf = (appId: string) => candidateOf(appId)?.name ?? appId;

  const move = (appId: string, to: Stage | null) => {
    if (!to) return;
    const outcome = handleDrop(appId, to);
    if (outcome === 'needs_note') setPending({ appIds: [appId], to });
    else if (outcome === 'locked') toast(t('pipeline.toast.locked', { name: nameOf(appId) }), 'info');
    else if (outcome === 'forbidden') toast(t('access.move', { stage: stageLabel(to, appId) }), 'error');
  };

  /** Bulk move; `onDone` runs after a confirmed move (e.g. to clear the selection). */
  const moveMany = (appIds: string[], to: Stage, onDone?: () => void) => {
    const movable = appIds.filter((id) => handleDrop(id, to) === 'needs_note');
    if (movable.length === 0) {
      toast(t('pipeline.bulk.none', { stage: stageLabel(to, appIds[0]) }), 'info');
      return;
    }
    setPending({ appIds: movable, to, onDone });
    if (movable.length < appIds.length) toast(t('pipeline.bulk.skipped', { n: appIds.length - movable.length }), 'info');
  };

  const confirm = (note: string, notify: boolean, code?: RejectCode) => {
    if (!pending) return;
    const { appIds, to, onDone } = pending;
    let moved = 0;
    let mailed = 0;
    for (const appId of appIds) {
      if (!commitMove(appId, to, note, me(), code)) continue;
      moved++;
      const tpl = notify ? stageTemplate(to) : undefined;
      if (tpl && candidateOf(appId)?.email?.trim() && sendTemplate(tpl, appId, me(), lang)) mailed++;
    }
    if (appIds.length === 1 && moved === 1) {
      const appId = appIds[0];
      const msg = to === 'rejected' ? t('pipeline.toast.rejected', { name: nameOf(appId) }) : t('pipeline.toast.moved', { name: nameOf(appId), stage: stageLabel(to, appId) });
      toast(mailed ? `${msg} ${t('pipeline.toast.mailed')}` : msg);
    } else if (moved > 0) {
      const msg = t('pipeline.bulk.moved', { n: moved, stage: stageLabel(to, appIds[0]) });
      toast(mailed ? `${msg} ${t('pipeline.bulk.mailed', { n: mailed })}` : msg);
    }
    if (moved > 0) onDone?.();
    setPending(null);
  };

  // Offer the email when at least one card in the move has an address and the stage has a template.
  const canEmail =
    can(currentUser(), 'email.send') && !!pending && !!stageTemplate(pending.to) && pending.appIds.some((id) => !!candidateOf(id)?.email?.trim());

  const pendingJob = pending ? jobOf(pending.appIds[0]) : undefined;
  const dialogEl = (
    <MoveDialog
      open={!!pending}
      name={!pending ? '' : pending.appIds.length === 1 ? nameOf(pending.appIds[0]) : t('pipeline.bulk.count', { n: pending.appIds.length })}
      to={pending?.to ?? 'new'}
      canEmail={canEmail}
      onCancel={() => setPending(null)}
      onConfirm={confirm}
    />  );
  // The dialog names the target column the way that job names it.
  const dialog = pendingJob ? <JobStageProvider job={pendingJob}>{dialogEl}</JobStageProvider> : dialogEl;


  return { move, moveMany, dialog };
}
