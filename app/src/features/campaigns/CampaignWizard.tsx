import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Drawer } from '../../components/Drawer';
import { toast } from '../../components/Toast';
import { campaignLinks, CHANNELS, isChannel } from '../../domain/campaigns';
import type { Campaign } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { LinkRow, SECONDARY_BTN, useChannelLabel } from './CampaignBits';

const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';
const PRIMARY = 'px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors';

const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-[#896a61]">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

type Props = { open: boolean; campaign?: Campaign; onClose: () => void; onSaved?: (c: Campaign) => void };

/** Create (or edit) a campaign in three steps: jobs + goal + dates, channels, review with links and post previews. */
export function CampaignWizard({ open, campaign, onClose, onSaved }: Props) {
  const t = useT();
  const channelLabel = useChannelLabel();
  const jobs = useStore((s) => s.jobs);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [goal, setGoal] = useState('20');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Fixed per opening so the review step shows the links the campaign will really have.
  const [draftId, setDraftId] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setErrors({});
    setDraftId(`camp-${crypto.randomUUID()}`);
    setName(campaign?.name ?? '');
    setJobIds(campaign?.jobIds ?? []);
    setGoal(String(campaign?.goal ?? 20));
    setStart(campaign?.start.slice(0, 10) ?? isoDay(0));
    setEnd(campaign?.end.slice(0, 10) ?? isoDay(30));
    setChannels(campaign?.channels ?? []);
  }, [open, campaign]);

  const selectableJobs = jobs.filter((j) => j.status === 'open' || jobIds.includes(j.id));
  const id = campaign?.id ?? draftId;
  const origin = typeof location === 'undefined' ? '' : location.origin;
  const draft = useMemo(() => ({ id, jobIds, channels }), [id, jobIds, channels]);
  const links = useMemo(() => campaignLinks(draft, origin), [draft, origin]);
  const jobTitle = (jobId: string) => jobs.find((j) => j.id === jobId)?.title ?? jobId;
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const chosenChannels = CHANNELS.filter((c) => channels.includes(c));

  const next = () => {
    const errs: Record<string, string> = {};
    if (step === 1) {
      if (!name.trim()) errs.name = t('campaigns.err.name');
      if (jobIds.length === 0) errs.jobs = t('campaigns.err.jobs');
      if (!/^[1-9]\d*$/.test(goal.trim())) errs.goal = t('campaigns.err.goal');
      if (!start || !end) errs.dates = t('campaigns.err.dates');
      else if (end < start) errs.dates = t('campaigns.err.order');
    } else if (chosenChannels.length === 0) {
      errs.channels = t('campaigns.err.channels');
    }
    setErrors(errs);
    if (Object.keys(errs).length === 0) setStep(step + 1);
  };

  const save = () => {
    const fields = { name, jobIds, channels: chosenChannels as string[], goal: Number(goal), start, end };
    const { createCampaign, updateCampaign } = useStore.getState();
    if (campaign) {
      updateCampaign(campaign.id, fields);
      toast(t('campaigns.toast.saved'));
      onSaved?.({ ...campaign, ...fields });
    } else {
      const created = createCampaign(fields, draftId);
      toast(t('campaigns.toast.created', { name: created.name }));
      onSaved?.(created);
    }
    onClose();
  };

  const postText = (channel: string) => {
    const intro = channel === 'referral' ? t('campaigns.post.introReferral', { name }) : t('campaigns.post.intro', { name });
    const lines = links.filter((l) => l.channel === channel).map((l) => t('campaigns.post.line', { title: jobTitle(l.jobId), link: l.url }));
    return [intro, ...lines].join('\n');
  };

  return (
    <Drawer open={open} title={t(campaign ? 'campaigns.wizard.edit' : 'campaigns.wizard.create')} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#896a61]">
          <span>{t('campaigns.wizard.step', { n: step })}</span>
          <span>·</span>
          <span className="text-primary">{t(`campaigns.wizard.step${step}` as 'campaigns.wizard.step1')}</span>
        </div>

        {step === 1 && (
          <>
            <Field id="camp-name" label={t('campaigns.wizard.name')} error={errors.name}>
              <input id="camp-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-semibold text-[#896a61] mb-1">{t('campaigns.wizard.jobs')}</legend>
              {selectableJobs.map((j) => (
                <label key={j.id} className="flex items-center gap-2 text-sm text-[#181211] dark:text-white">
                  <input type="checkbox" checked={jobIds.includes(j.id)} onChange={() => setJobIds(toggle(jobIds, j.id))} className="rounded border-gray-300 text-primary focus:ring-primary" />
                  {j.title}
                </label>
              ))}
              {errors.jobs && <p className="text-xs text-red-600">{errors.jobs}</p>}
            </fieldset>
            <Field id="camp-goal" label={t('campaigns.wizard.goal')} error={errors.goal}>
              <input id="camp-goal" type="number" min={1} step={1} className={FIELD} value={goal} onChange={(e) => setGoal(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id="camp-start" label={t('campaigns.wizard.start')}>
                <input id="camp-start" type="date" className={FIELD} value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field id="camp-end" label={t('campaigns.wizard.end')}>
                <input id="camp-end" type="date" className={FIELD} value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
              {errors.dates && <p className="col-span-2 text-xs text-red-600 -mt-2">{errors.dates}</p>}
            </div>
          </>
        )}

        {step === 2 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-bold text-[#181211] dark:text-white mb-2">{t('campaigns.wizard.channels')}</legend>
            {CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-[#181211] dark:text-white">
                <input type="checkbox" checked={channels.includes(c)} onChange={() => setChannels(toggle(channels, c))} className="rounded border-gray-300 text-primary focus:ring-primary" />
                {channelLabel(c)}
              </label>
            ))}
            {errors.channels && <p className="text-xs text-red-600">{errors.channels}</p>}
          </fieldset>
        )}

        {step === 3 && (
          <>
            <section>
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('campaigns.wizard.links')}</h4>
              <div className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                {links.map((l) => <LinkRow key={`${l.jobId}-${l.channel}`} channel={l.channel} jobTitle={jobTitle(l.jobId)} url={l.url} />)}
              </div>
            </section>
            <section className="flex flex-col gap-3">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('campaigns.wizard.posts')}</h4>
              {chosenChannels.filter(isChannel).map((c) => (
                <div key={c} className="rounded-xl border border-[#e6dddb] dark:border-[#3a3433] p-4">
                  <div className="text-xs font-bold text-[#896a61] mb-2">{channelLabel(c)}</div>
                  <p className="whitespace-pre-line break-words text-sm text-[#181211] dark:text-white">{postText(c)}</p>
                </div>
              ))}
            </section>
          </>
        )}

        <div className="flex justify-between gap-3 pt-2">
          {step > 1 ? (
            <button type="button" onClick={() => { setErrors({}); setStep(step - 1); }} className={SECONDARY_BTN}>{t('common.back')}</button>
          ) : (
            <button type="button" onClick={onClose} className={SECONDARY_BTN}>{t('common.cancel')}</button>
          )}
          {step < 3 ? (
            <button type="button" onClick={next} className={PRIMARY}>{t('campaigns.wizard.next')}</button>
          ) : (
            <button type="button" onClick={save} className={PRIMARY}>{t(campaign ? 'campaigns.wizard.save' : 'campaigns.wizard.submit')}</button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
