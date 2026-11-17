import { campaignLinks, DEMO_ORIGIN } from '../../domain/campaigns';
import type { Campaign } from '../../domain/types';
import type { DemoActions, Env, Get, Set } from './types';

const originNow = () => (typeof location !== 'undefined' && location.origin !== 'null' ? location.origin : DEMO_ORIGIN);

const withLinks = (c: Campaign): Campaign => ({
  ...c,
  links: campaignLinks(c, originNow()).map(({ channel, url }) => ({ channel, url })),
});

export function campaignActions(
  set: Set,
  get: Get,
  env: Env,
): Pick<DemoActions, 'createCampaign' | 'updateCampaign' | 'setCampaignStatus'> {
  const touch = (id: string, change: (c: Campaign) => Campaign): boolean => {
    if (!get().campaigns.some((c) => c.id === id)) return false;
    set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? change(c) : c)) }));
    return true;
  };

  return {
    createCampaign(input, id) {
      const campaign = withLinks({
        ...input, id: id ?? env.id('camp'), name: input.name.trim(), status: 'active', links: [], stats: { views: 0 },
      });
      set((s) => ({ campaigns: [campaign, ...s.campaigns] }));
      return campaign;
    },

    updateCampaign: (id, patch) =>
      touch(id, (c) => withLinks({ ...c, ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) })),

    setCampaignStatus: (id, status) => touch(id, (c) => ({ ...c, status })),
  };
}
