import { canEdit, effectiveStatus, launchStatus, nextCampaignCode } from '../../domain/campaigns';
import type { Campaign, CampaignStatus } from '../../domain/types';
import type { DemoActions, Env, Get, Set } from './types';

/** The only status moves the detail page offers; Launch (draft -> scheduled/active) has its own action. */
const MOVES: Partial<Record<CampaignStatus, CampaignStatus[]>> = {
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'completed', 'cancelled'],
  draft: ['cancelled'],
  scheduled: ['cancelled'],
};

export function campaignActions(
  set: Set,
  get: Get,
  env: Env,
): Pick<DemoActions, 'createCampaign' | 'updateCampaign' | 'launchCampaign' | 'setCampaignStatus'> {
  const today = () => env.now().slice(0, 10);
  const touch = (id: string, change: (c: Campaign) => Campaign | null): boolean => {
    const current = get().campaigns.find((c) => c.id === id);
    const next = current && change(current);
    if (!next) return false;
    set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? next : c)) }));
    return true;
  };

  return {
    createCampaign(input, { launch, id }) {
      const createdAt = env.now();
      const campaign: Campaign = {
        ...input,
        id: id ?? env.id('camp'),
        code: nextCampaignCode(get().campaigns, createdAt),
        name: input.name.trim(),
        status: launch ? launchStatus(input.start, today()) : 'draft',
        stats: { views: 0 },
        createdAt,
      };
      set((s) => ({ campaigns: [campaign, ...s.campaigns] }));
      return campaign;
    },

    updateCampaign: (id, patch) =>
      touch(id, (c) => (canEdit(c) ? { ...c, ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) } : null)),

    launchCampaign: (id) =>
      touch(id, (c) => (c.status === 'draft' && c.end.slice(0, 10) >= today() ? { ...c, status: launchStatus(c.start, today()) } : null)),

    // A scheduled campaign past its start is running, so it moves like an active one.
    setCampaignStatus: (id, status) => touch(id, (c) => (MOVES[effectiveStatus(c, today())]?.includes(status) ? { ...c, status } : null)),
  };
}
