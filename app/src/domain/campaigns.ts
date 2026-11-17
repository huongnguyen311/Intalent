import type { Campaign, CampaignLink, DemoState } from './types';

export const CHANNELS = ['facebook', 'linkedin', 'fb_groups', 'vietnamworks', 'topcv', 'referral', 'other'] as const;
export type Channel = (typeof CHANNELS)[number];

export const isChannel = (v: string): v is Channel => (CHANNELS as readonly string[]).includes(v);

/** Material Symbols icon per channel (brand-neutral). */
export const CHANNEL_ICON: Record<Channel, string> = {
  facebook: 'thumb_up',
  linkedin: 'work',
  fb_groups: 'groups',
  vietnamworks: 'travel_explore',
  topcv: 'description',
  referral: 'diversity_3',
  other: 'link',
};

/** English name written to Application.source for applicants arriving through a channel. */
export const CHANNEL_SOURCE: Record<Channel, string> = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  fb_groups: 'Facebook Groups',
  vietnamworks: 'VietnamWorks',
  topcv: 'TopCV',
  referral: 'Referral',
  other: 'Other',
};

export const DEMO_ORIGIN = 'https://careers.company.demo';

export const trackingLink = (campaign: Pick<Campaign, 'id'>, channel: Channel, jobId: string, origin: string): string =>
  `${origin}/careers/${jobId}?src=${campaign.id}-${channel}`;

/** Channel ids never contain '-', so the channel is whatever follows the last '-'; the campaign id (which may contain '-') must be known. */
export function parseSrc(
  src: string,
  campaigns: Pick<Campaign, 'id'>[],
): { campaignId: string; channel: Channel } | null {
  const cut = src.lastIndexOf('-');
  if (cut < 1) return null;
  const campaignId = src.slice(0, cut);
  const channel = src.slice(cut + 1);
  if (!isChannel(channel) || !campaigns.some((c) => c.id === campaignId)) return null;
  return { campaignId, channel };
}

/** Maps a stored Application.source (channel id or its English name) back to a channel; anything else is `other`. */
export function channelFromSource(source: string): Channel {
  if (isChannel(source)) return source;
  const s = source.trim().toLowerCase();
  return CHANNELS.find((c) => CHANNEL_SOURCE[c].toLowerCase() === s) ?? 'other';
}

/** One tracking link per job and channel. */
export function campaignLinks(
  campaign: Pick<Campaign, 'id' | 'jobIds' | 'channels'>,
  origin: string,
): Array<CampaignLink & { jobId: string }> {
  return campaign.jobIds.flatMap((jobId) =>
    campaign.channels.filter(isChannel).map((channel) => ({ channel, jobId, url: trackingLink(campaign, channel, jobId, origin) })),
  );
}

/** FNV-1a: stable across renders and reloads. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface CampaignStats {
  views: number;
  applicants: number;
  /** applicants / views, 0..1 */
  conversion: number;
  hires: number;
  byChannel: Record<Channel, number>;
}

export function campaignStats(
  state: Pick<DemoState, 'applications' | 'campaigns'>,
  campaignId: string,
): CampaignStats {
  const campaign = state.campaigns.find((c) => c.id === campaignId);
  const apps = state.applications.filter((a) => a.campaignId === campaignId);
  const byChannel = Object.fromEntries(CHANNELS.map((c) => [c, 0])) as Record<Channel, number>;
  for (const a of apps) byChannel[channelFromSource(a.source)] += 1;
  // Seeded campaigns carry their own view count; others get a stable one derived from the id.
  const base = campaign && campaign.stats.views > 0 ? campaign.stats.views : 300 + (hash(campaignId) % 1700);
  const views = Math.max(base, apps.length);
  return {
    views,
    applicants: apps.length,
    conversion: views ? apps.length / views : 0,
    hires: apps.filter((a) => a.stage === 'hired').length,
    byChannel,
  };
}
