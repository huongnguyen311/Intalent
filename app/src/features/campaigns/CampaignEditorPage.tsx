import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { NotFoundState } from '../../components/NotFoundState';
import { canEdit } from '../../domain/campaigns';
import { canEditCampaign } from '../../domain/permissions';
import { useMe } from '../../store/session';
import { CAMPAIGN_PRIORITIES, CURRENCIES, type Campaign, type CampaignPriority, type Currency } from '../../domain/types';
import { assignableUsers } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { BTN_GHOST, BTN_PRIMARY, Field, FIELD } from '../jobs/steps/ui';
import { useCampaignForm, type CampaignForm } from './useCampaignForm';

const CARD = 'bg-white dark:bg-dark-surface rounded-xl border border-line dark:border-dark-raised p-6 lg:p-8 shadow-sm flex flex-col gap-4';

/** Create / Edit campaign as a full page: `/campaigns/new`, `/campaigns/:id/edit` (same layout as the job editor). */
export function CampaignEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const t = useT();
  const { id } = useParams();
  const campaign = useStore((s) => (id ? s.campaigns.find((c) => c.id === id) : undefined));
  const user = useMe();
  // Finished campaigns are frozen; other people's are read-only for Recruiters.
  const ownerOk = !campaign || canEditCampaign(user, campaign);
  if (mode === 'edit' && (!campaign || !canEdit(campaign) || !ownerOk)) {
    return (
      <AppLayout title={t('nav.campaigns')}>
        <NotFoundState
          icon={campaign ? 'lock' : 'search_off'}
          message={t(!campaign ? 'campaigns.detail.notFound' : !ownerOk ? 'campaigns.detail.notOwner' : 'campaigns.detail.readOnly')}
          backTo={campaign ? `/campaigns/${campaign.id}` : '/campaigns'}
          backLabel={t('campaigns.detail.back')}
        />
      </AppLayout>
    );
  }
  return <Editor key={`${mode}:${id ?? ''}`} campaign={mode === 'edit' ? campaign : undefined} />;
}

function Section({ n, id, title, children }: { n: number; id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={CARD}>
      <h2 id={id} className="flex items-center gap-2 text-base font-bold text-ink dark:text-white">
        <span aria-hidden="true" className="size-6 grid place-items-center rounded-full bg-primary/10 text-primary text-xs">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Editor({ campaign }: { campaign?: Campaign }) {
  const t = useT();
  const navigate = useNavigate();
  const users = useStore((s) => s.users);
  const [draftId] = useState(() => `camp-${crypto.randomUUID()}`);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const form = useCampaignForm({ campaign });
  const { values: v, set, touched } = form;
  const from = campaign ? `/campaigns/${campaign.id}` : '/campaigns';

  useEffect(() => {
    if (!touched) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [touched]);

  const leave = () => (touched ? setLeaveTo(from) : navigate(from));
  const submit = (mode: 'draft' | 'launch' | 'save') => {
    const saved = form.submit(mode, draftId);
    // Replace, so Back from the campaign does not reopen the editor.
    if (saved) navigate(`/campaigns/${saved.id}`, { replace: true });
  };

  // Assignable people, plus the current owner even if no longer assignable.
  const people = useMemo(() => users.filter((u) => assignableUsers(users).includes(u) || u.id === v.owner), [users, v.owner]);
  const footer = (
    <div className="bg-white dark:bg-dark-surface border-t border-line dark:border-dark-raised shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <div className="max-w-[1400px] mx-auto pl-8 pr-20 py-3 flex items-center justify-end gap-2">
        <button type="button" onClick={leave} className={BTN_GHOST}>{t('common.cancel')}</button>
        {campaign ? (
          <button type="button" onClick={() => submit('save')} className={BTN_PRIMARY}>{t('campaigns.editor.save')}</button>
        ) : (
          <>
            <button type="button" onClick={() => submit('draft')} className={BTN_GHOST}>{t('campaigns.editor.saveDraft')}</button>
            <button type="button" onClick={() => submit('launch')} className={BTN_PRIMARY}>{t('campaigns.editor.launch')}</button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <AppLayout
      title={t(campaign ? 'campaigns.editor.edit' : 'campaigns.editor.create')}
      subtitle={campaign ? `${campaign.code} · ${campaign.name}` : undefined}
      back={{ label: t('common.backTo', { name: campaign ? campaign.name : t('nav.campaigns') }), onClick: leave }}
      footer={footer}
    >
      <div data-testid="campaign-editor" className="min-h-full bg-gray-50 dark:bg-dark-canvas">
        {leaveTo && (
          <div role="alertdialog" aria-label={t('drawer.discard.title')} className="sticky top-0 z-20 px-8 py-3 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 flex items-center gap-3 text-sm">
            <span className="flex-1 font-semibold text-amber-900 dark:text-amber-100">{t('drawer.discard.title')}</span>
            <button type="button" onClick={() => setLeaveTo(null)} className="px-3 py-1.5 rounded-full border border-line bg-white dark:bg-transparent dark:text-white font-bold">{t('drawer.discard.keep')}</button>
            <button type="button" onClick={() => navigate(leaveTo)} className="px-3 py-1.5 rounded-full bg-red-600 text-white font-bold">{t('drawer.discard.confirm')}</button>
          </div>
        )}
        <div className="p-8 max-w-[1400px] mx-auto flex flex-col gap-5">
          <Section n={1} id="camp-section-details" title={t('campaigns.editor.section.details')}>
            <DetailsFields form={form} people={people} />
          </Section>

          <p className="text-sm text-ink-muted -mt-1">{t('campaigns.editor.jobsHint')}</p>

          <Section n={2} id="camp-section-goals" title={t('campaigns.editor.section.goals')}>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <Field id="camp-targetApplicants" label={t('campaigns.field.targetApplicants')} error={form.err('targetApplicants')}>
                <input id="camp-targetApplicants" type="number" min={0} className={FIELD} value={v.targetApplicants} onChange={(e) => set.targetApplicants(e.target.value)} aria-invalid={!!form.err('targetApplicants')} />
              </Field>
              <Field id="camp-budget" label={t('campaigns.field.budget')} error={form.err('budget')}>
                <input id="camp-budget" type="number" min={0} className={FIELD} value={v.budget} onChange={(e) => set.budget(e.target.value)} aria-invalid={!!form.err('budget')} />
              </Field>
              <Field id="camp-currency" label={t('campaigns.field.currency')}>
                <select id="camp-currency" className={FIELD} value={v.currency} onChange={(e) => set.currency(e.target.value as Currency)}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </Section>

        </div>
      </div>
    </AppLayout>
  );
}

function DetailsFields({ form, people }: { form: CampaignForm; people: { id: string; name: string }[] }) {
  const t = useT();
  const { values: v, set } = form;
  return (
    <>
      <Field id="camp-name" label={t('campaigns.wizard.name')} error={form.err('name')}>
        <input id="camp-name" className={FIELD} maxLength={120} placeholder="Q1 2027 – Technology Hiring" value={v.name} onChange={(e) => set.name(e.target.value)} aria-invalid={!!form.err('name')} />
      </Field>
      <Field id="camp-description" label={t('campaigns.field.description')}>
        <textarea id="camp-description" rows={2} className={FIELD} value={v.description} onChange={(e) => set.description(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="camp-owner" label={t('campaigns.field.owner')} error={form.err('owner')}>
          <select id="camp-owner" className={FIELD} value={v.owner} onChange={(e) => set.owner(e.target.value)} aria-invalid={!!form.err('owner')}>
            <option value="">{t('campaigns.field.none')}</option>
            {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field id="camp-priority" label={t('campaigns.field.priority')}>
          <select id="camp-priority" className={FIELD} value={v.priority} onChange={(e) => set.priority(e.target.value as CampaignPriority | '')}>
            <option value="">{t('campaigns.field.none')}</option>
            {CAMPAIGN_PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Field id="camp-start" label={t('campaigns.field.start')} error={form.err('dates')}>
          <input id="camp-start" type="date" className={FIELD} value={v.start} onChange={(e) => set.start(e.target.value)} aria-invalid={!!form.err('dates')} />
        </Field>
        <Field id="camp-end" label={t('campaigns.field.end')}>
          <input id="camp-end" type="date" className={FIELD} value={v.end} onChange={(e) => set.end(e.target.value)} aria-invalid={!!form.err('dates')} />
        </Field>
        <Field id="camp-deadline" label={t('campaigns.field.deadline')} error={form.err('deadline')}>
          <input id="camp-deadline" type="date" className={FIELD} value={v.deadline} onChange={(e) => set.deadline(e.target.value)} aria-invalid={!!form.err('deadline')} />
        </Field>
      </div>
    </>
  );
}
