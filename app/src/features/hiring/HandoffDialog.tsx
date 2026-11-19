import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { formatMoney, HANDOFF_TARGET, shortDate } from '../../domain/hiring';
import type { Application, Candidate, Job } from '../../domain/types';
import { userName } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { me } from '../../store/session';
import { useStore } from '../../store/store';
import { BTN_GHOST, BTN_PRIMARY } from './ui';

type Props = { open: boolean; app: Application; candidate?: Candidate; job: Job; onClose: () => void };

/** Shows the data package the onboarding tool will receive, then marks the hire as handed off. */
export function HandoffDialog({ open, app, candidate, job, onClose }: Props) {
  const t = useT();
  const users = useStore((s) => s.users);
  const offer = app.offer?.status === 'accepted' ? app.offer : undefined;

  const groups: Array<[string, Array<[string, string]>]> = [
    [t('handoff.group.candidate'), [
      [t('profile.field.fullName'), candidate?.name ?? app.candidateId],
      [t('profile.field.email'), candidate?.email || '—'],
      [t('handoff.phone'), candidate?.phone || '—'],
      [t('handoff.id'), app.candidateId],
    ]],
    [t('handoff.group.job'), [
      [t('jobs.drawer.title'), job.title],
      [t('jobs.drawer.department'), job.department],
      [t('jobs.drawer.location'), job.location],
      [t('jobs.drawer.level'), job.level],
      [t('jobs.drawer.manager'), userName(users, job.hiringManager)],
    ]],
    [t('handoff.group.offer'), offer ? [
      [t('offer.salary'), formatMoney(offer.salary, offer.currency)],
      [t('offer.startDate'), shortDate(offer.startDate)],
      [t('offer.contract'), offer.contract],
    ] : []],
  ];

  const confirm = () => {
    if (useStore.getState().handOff(app.id, me())) {
      toast(t('handoff.toast', { name: candidate?.name ?? '', target: HANDOFF_TARGET }));
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      wide
      title={t('handoff.title', { target: HANDOFF_TARGET })}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>{t('common.cancel')}</button>
          <button onClick={confirm} className={BTN_PRIMARY}>{t('handoff.confirm')}</button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[#896a61]">{t('handoff.desc', { target: HANDOFF_TARGET })}</p>
        {groups.map(([title, rows]) => (
          <section key={title}>
            <h4 className="text-xs font-bold text-[#896a61] uppercase tracking-wider mb-2">{title}</h4>
            {rows.length === 0 ? (
              <p className="rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-3 py-2">{t('handoff.noOffer')}</p>
            ) : (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl bg-[#f8f6f6] dark:bg-[#251f1e] px-4 py-3">
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-[#896a61]">{k}</dt>
                    <dd className="font-medium break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}
        <p className="text-xs text-[#896a61]">{t('handoff.lockNote')}</p>
      </div>
    </Modal>
  );
}
