import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Drawer } from '../../components/Drawer';
import { NotFoundState } from '../../components/NotFoundState';
import { jobsInScope } from '../../domain/permissions';
import type { Job } from '../../domain/types';
import { userName } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { CareersPreviewTab } from './JobTabs';
import { CompensationStep } from './steps/CompensationStep';
import { DetailsStep } from './steps/DetailsStep';
import { PublishStep } from './steps/PublishStep';
import { RequirementsStep } from './steps/RequirementsStep';
import { TeamStep } from './steps/TeamStep';
import { BTN_GHOST, BTN_PRIMARY, CHECKBOX } from './steps/ui';
import { useJobForm, type JobFormMode } from './useJobForm';

const PREVIEW_BTN =
  'ml-auto shrink-0 items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full border border-[#e6dddb] dark:border-[#3a3433] text-[#896a61] hover:text-primary hover:border-primary/50';
/** Candidate-facing parts first, then the internal hiring team. */
const SECTIONS = [
  { key: 'details', label: 'jobs.drawer.step.details' },
  { key: 'requirements', label: 'jobs.drawer.step.requirements' },
  { key: 'compensation', label: 'jobs.section.compensation' },
  { key: 'careers', label: 'jobs.section.careers' },
  { key: 'team', label: 'jobs.section.team' },
] as const;
const TITLE = { create: 'jobs.drawer.create', edit: 'jobs.drawer.edit', duplicate: 'jobs.drawer.duplicate' } as const;

/** Create / Edit / Duplicate Job as a full page: `/jobs/new[?fromJd=]`, `/jobs/:id/edit`, `/jobs/:id/duplicate`. */
export function JobEditorPage({ mode }: { mode: JobFormMode }) {
  const t = useT();
  const { id } = useParams();
  const fromJd = useSearchParams()[0].get('fromJd') ?? '';
  const user = useMe();
  // Looked up in the user's scope: a Recruiter must not edit a job they cannot open.
  const job = useStore((s) => (id ? jobsInScope(user, s.jobs).find((j) => j.id === id) : undefined));
  if (mode !== 'create' && !job) {
    const exists = useStore.getState().jobs.some((j) => j.id === id);
    return (
      <AppLayout title={t('nav.jobs')}>
        <NotFoundState
          icon={exists ? 'lock' : 'search_off'}
          message={t(exists ? 'jobs.detail.noAccess' : 'jobs.detail.notFound')}
          backTo="/jobs"
          backLabel={t('jobs.detail.back')}
        />
      </AppLayout>
    );
  }
  // Keyed by the whole starting point (incl. the source JD) so moving between editor URLs starts a fresh form and draft offer.
  return <Editor key={`${user.id}:${mode}:${id ?? ''}:${fromJd}`} mode={mode} job={job} />;
}

function Editor({ mode, job }: { mode: JobFormMode; job?: Job }) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const jds = useStore((s) => s.jds);
  const users = useStore((s) => s.users);
  // `?fromJd=` picks a JD: from a JD page on create, or a JD just made via "+ Create a new JD" in any mode.
  const fromJd = params.get('fromJd') ?? undefined;
  const jdId = fromJd && jds.some((j) => j.id === fromJd) ? fromJd : undefined;
  const [previewPanel, setPreviewPanel] = useState(false);
  /** Where the page is about to go once unsaved changes are discarded; set while the "Discard?" bar shows. */
  const [leaveTo, setLeaveTo] = useState<{ to: string; state?: unknown } | null>(null);

  // Where Back / Cancel go: the page the user came from, else the list (create) or the job (edit / duplicate).
  const stateFrom = (location.state as { from?: string } | null)?.from;
  const toJob = job && mode !== 'create';
  const from = stateFrom ?? (toJob ? `/jobs/${job.id}` : '/jobs');
  const backLabel = stateFrom ? t('common.back') : t('common.backTo', { name: toJob ? job.title : t('nav.jobs') });

  const form = useJobForm({
    open: true, mode, job, jdId,
    // Replace, so Back from the saved job does not reopen the editor.
    onSaved: (saved) => navigate(`/jobs/${saved.id}`, { replace: true }),
  });
  const { editing, touched } = form;

  // Reload / closing the tab: the browser's own "Leave site?" prompt.
  useEffect(() => {
    if (!touched) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [touched]);

  const go = (to: string, state?: unknown) => (touched ? setLeaveTo({ to, state }) : navigate(to, { state }));
  const leave = () => go(from);
  // "+ Create a new JD" opens the full JD page; saving there comes back here with the new JD picked.
  const newJd = () => go('/jds/new', { returnTo: location.pathname });

  // The careers post as it would look if saved now, with the picked JD's body and skills.
  const preview = <CareersPreviewTab job={form.draftJob()} jd={form.selected} compact />;

  const bodies = {
    details: <DetailsStep form={form} onNewJd={newJd} />,
    requirements: <RequirementsStep form={form} />,
    compensation: <CompensationStep form={form} />,
    careers: <PublishStep form={form} />,
    team: <TeamStep form={form} />,
  };

  // Always on screen: the publish decision and the save buttons.
  const footer = (
    <div className="bg-white dark:bg-[#1e1e1e] border-t border-[#e6dddb] dark:border-[#2a2423] shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      {/* Right padding keeps the buttons clear of the floating AI button. */}
      <div className="max-w-[1400px] mx-auto pl-8 pr-20 py-3 flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-[#181211] dark:text-white">
          <input type="checkbox" checked={form.values.publish} onChange={(e) => form.set.publish(e.target.checked)} className={CHECKBOX} />
          {t(form.approvalFree ? 'jobs.drawer.publish' : 'jobs.drawer.submit')}
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={leave} className={BTN_GHOST}>{t('common.cancel')}</button>
          {!editing && <button type="button" onClick={() => form.save(true)} className={BTN_GHOST}>{t('jobs.drawer.saveDraft')}</button>}
          <button type="button" onClick={() => form.save()} className={BTN_PRIMARY}>{t('jobs.drawer.save')}</button>
        </div>
      </div>
    </div>
  );

  return (
    <AppLayout
      title={t(TITLE[mode])}
      back={{ label: backLabel, onClick: leave }}
      footer={footer}
      actions={
        // The careers-post preview opens in a side panel, like a candidate's details.
        <button type="button" onClick={() => setPreviewPanel(true)} className={`${PREVIEW_BTN} inline-flex`}>
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">visibility</span>{t('jobs.editor.preview')}
        </button>
      }
    >
      <div data-testid="job-editor" className="min-h-full bg-[#fbf9f8] dark:bg-background-dark">
        {leaveTo && (
          <div role="alertdialog" aria-label={t('drawer.discard.title')} className="sticky top-0 z-20 px-8 py-3 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 flex items-center gap-3 text-sm">
            <span className="flex-1 font-semibold text-amber-900 dark:text-amber-100">{t('drawer.discard.title')}</span>
            <button type="button" onClick={() => setLeaveTo(null)} className="px-3 py-1.5 rounded-full border border-[#e6dddb] bg-white dark:bg-transparent dark:text-white font-bold">{t('drawer.discard.keep')}</button>
            <button type="button" onClick={() => navigate(leaveTo.to, { state: leaveTo.state })} className="px-3 py-1.5 rounded-full bg-red-600 text-white font-bold">{t('drawer.discard.confirm')}</button>
          </div>
        )}
        <div className="p-8 max-w-[1400px] mx-auto flex flex-col gap-5">
          {form.rejected && job?.approval?.decidedBy && (
            <div role="alert" className="flex gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">undo</span>
              {t('jobs.approval.rejected', { name: userName(users, job.approval.decidedBy), reason: form.rejected })}
            </div>
          )}
          {SECTIONS.map(({ key, label }, i) => (
            <section
              key={key}
              aria-labelledby={`job-section-${key}`}
              className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-[#e6dddb] dark:border-[#2a2423] p-6 lg:p-8 shadow-sm flex flex-col gap-4"
            >
              <h2 id={`job-section-${key}`} className="flex items-center gap-2 text-base font-bold text-[#181211] dark:text-white">
                <span aria-hidden="true" className="size-6 grid place-items-center rounded-full bg-primary/10 text-primary text-xs">{i + 1}</span>
                {t(label)}
              </h2>
              {bodies[key]}
            </section>
          ))}
        </div>
      </div>
      <Drawer open={previewPanel} title={t('jobs.editor.preview')} onClose={() => setPreviewPanel(false)}>{preview}</Drawer>
    </AppLayout>
  );
}
