import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { campaignLinks, campaignStats, CHANNELS, channelFromSource, CHANNEL_SOURCE, parseSrc, trackingLink } from './campaigns';
import type { Application } from './types';

const camps = [{ id: 'camp-1' }, { id: 'cmp-9f2e-ab' }];

describe('tracking links', () => {
  it('tracking link round-trips through parseSrc', () => {
    for (const campaign of camps) {
      for (const channel of CHANNELS) {
        const url = trackingLink(campaign, channel, 'job-1', 'https://x.test');
        expect(url).toBe(`https://x.test/careers/job-1?src=${campaign.id}-${channel}`);
        expect(parseSrc(new URL(url).searchParams.get('src')!, camps)).toEqual({ campaignId: campaign.id, channel });
      }
    }
  });

  it('rejects unknown campaigns, unknown channels and malformed values', () => {
    expect(parseSrc('camp-7-linkedin', camps)).toBeNull();
    expect(parseSrc('camp-1-twitter', camps)).toBeNull();
    expect(parseSrc('linkedin', camps)).toBeNull();
    expect(parseSrc('-linkedin', camps)).toBeNull();
    expect(parseSrc('', camps)).toBeNull();
  });

  it('builds one link per job and channel', () => {
    const links = campaignLinks({ id: 'c', jobIds: ['j1', 'j2'], channels: ['facebook', 'topcv'] }, 'https://x.test');
    expect(links.map((l) => l.url)).toEqual([
      'https://x.test/careers/j1?src=c-facebook', 'https://x.test/careers/j1?src=c-topcv',
      'https://x.test/careers/j2?src=c-facebook', 'https://x.test/careers/j2?src=c-topcv',
    ]);
  });
});

describe('campaignStats', () => {
  const base = buildSeed();
  const app = (id: string, over: Partial<Application>): Application => ({ ...base.applications[0], id, ...over });
  const state = {
    campaigns: base.campaigns,
    applications: [
      app('a1', { campaignId: 'camp-1', source: 'LinkedIn', stage: 'new' }),
      app('a2', { campaignId: 'camp-1', source: 'LinkedIn', stage: 'hired' }),
      app('a3', { campaignId: 'camp-1', source: CHANNEL_SOURCE.facebook, stage: 'screening' }),
      app('a4', { campaignId: 'camp-2', source: 'LinkedIn', stage: 'hired' }),
      app('a5', { campaignId: undefined, source: 'LinkedIn', stage: 'hired', via: 'careers' }),
    ],
  };

  it('stats count applications by channel', () => {
    const s = campaignStats(state, 'camp-1');
    expect(s.applicants).toBe(3);
    expect(s.hires).toBe(1);
    expect(s.byChannel).toMatchObject({ linkedin: 2, facebook: 1, topcv: 0, other: 0 });
    expect(s.views).toBe(1240);
    expect(s.conversion).toBeCloseTo(3 / 1240);
  });

  it('simulates views from the id, never below the applicant count', () => {
    const c = { ...base.campaigns[0], id: 'camp-new', stats: { views: 0 } };
    const s = { campaigns: [c], applications: [] };
    const first = campaignStats(s, 'camp-new').views;
    expect(first).toBe(campaignStats(s, 'camp-new').views);
    expect(first).toBeGreaterThanOrEqual(300);
    expect(campaignStats(s, 'camp-other').views).not.toBe(first);
    expect(campaignStats({ campaigns: [], applications: [] }, 'nope')).toMatchObject({ applicants: 0, hires: 0, conversion: 0 });
  });

  it('maps sources to channels, defaulting to other', () => {
    expect(channelFromSource('fb_groups')).toBe('fb_groups');
    expect(channelFromSource('vietnamworks')).toBe('vietnamworks');
    expect(channelFromSource('TopCV')).toBe('topcv');
    expect(channelFromSource('Zalo')).toBe('other');
  });
});
