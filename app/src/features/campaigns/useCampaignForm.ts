import { useMemo, useState } from 'react';
import { toast } from '../../components/Toast';
import { todayIso } from '../../domain/jobUrgency';
import type { Campaign, CampaignInput, CampaignPriority, Currency } from '../../domain/types';
import { useT, type TKey } from '../../i18n/i18n';
import { me } from '../../store/session';
import { useStore } from '../../store/store';

/** What the inputs hold; numbers stay strings until saved. Jobs join from the job form, not here. */
export type CampaignFormValues = {
  name: string; description: string; owner: string; priority: CampaignPriority | '';
  start: string; end: string; deadline: string;
  targetApplicants: string; budget: string; currency: Currency;
};

export type CampaignErrorKey = 'name' | 'owner' | 'dates' | 'deadline' | 'targetApplicants' | 'budget';

const day = (offset: number) => todayIso(new Date(Date.now() + offset * 86_400_000));
const str = (n?: number) => (n === undefined ? '' : String(n));
const NUMBER_FIELDS = ['targetApplicants', 'budget'] as const;

function fromCampaign(c?: Campaign): CampaignFormValues {
  return {
    name: c?.name ?? '', description: c?.description ?? '', owner: c?.owner ?? me(), priority: c?.priority ?? '',
    start: c?.start.slice(0, 10) ?? day(0), end: c?.end.slice(0, 10) ?? day(30), deadline: c?.applicationDeadline?.slice(0, 10) ?? '',
    targetApplicants: str(c?.goals.targetApplicants), budget: str(c?.goals.budget), currency: c?.goals.currency ?? 'VND',
  };
}

/** State, validation and saving of the campaign editor page. */
export function useCampaignForm({ campaign }: { campaign?: Campaign }) {
  const t = useT();
  const [values, setValues] = useState<CampaignFormValues>(() => fromCampaign(campaign));
  const [errors, setErrors] = useState<Partial<Record<CampaignErrorKey, TKey>>>({});
  const [touched, setTouched] = useState(false);

  const set = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(fromCampaign()) as (keyof CampaignFormValues)[]).map((k) => [k, (v: unknown) => {
          setValues((cur) => ({ ...cur, [k]: v }));
          setTouched(true);
        }]),
      ) as { [K in keyof CampaignFormValues]: (v: CampaignFormValues[K]) => void },
    [],
  );

  const v = values;

  const validate = (launching: boolean) => {
    const e: Partial<Record<CampaignErrorKey, TKey>> = {};
    if (!v.name.trim()) e.name = 'campaigns.err.name';
    if (!v.owner) e.owner = 'campaigns.err.owner';
    if (!v.start || !v.end) e.dates = 'campaigns.err.dates';
    else if (v.end < v.start) e.dates = 'campaigns.err.order';
    else if (launching && v.end < todayIso()) e.dates = 'campaigns.err.launchEnded';
    if (v.deadline && v.start && v.end && (v.deadline < v.start || v.deadline > v.end)) e.deadline = 'campaigns.err.deadline';
    for (const k of NUMBER_FIELDS) {
      const raw = v[k].trim();
      if (raw && !(Number(raw) >= 0)) e[k] = 'campaigns.err.number';
    }
    return e;
  };

  const collect = (): CampaignInput => {
    const n = (s: string) => (s.trim() ? Number(s) : undefined);
    return {
      name: v.name, description: v.description.trim() || undefined, owner: v.owner, priority: v.priority || undefined,
      start: v.start, end: v.end, applicationDeadline: v.deadline.trim() || undefined,
      goals: { targetApplicants: n(v.targetApplicants), budget: n(v.budget), currency: v.currency },
    };
  };

  /** Creates (draft or launched) or saves the edit; returns the saved campaign, or null when the form has errors. */
  const submit = (mode: 'draft' | 'launch' | 'save', draftId?: string): Campaign | null => {
    const e = validate(mode === 'launch');
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return null;
    }
    const input = collect();
    const { createCampaign, updateCampaign } = useStore.getState();
    if (campaign) {
      updateCampaign(campaign.id, input);
      toast(t('campaigns.toast.saved'));
      return useStore.getState().campaigns.find((c) => c.id === campaign.id) ?? null;
    }
    const created = createCampaign(input, { launch: mode === 'launch', id: draftId });
    toast(t('campaigns.toast.created', { name: created.name }));
    return created;
  };

  return {
    values: v, set, touched, submit,
    err: (k: CampaignErrorKey) => (errors[k] ? t(errors[k]!) : undefined),
  };
}

export type CampaignForm = ReturnType<typeof useCampaignForm>;
