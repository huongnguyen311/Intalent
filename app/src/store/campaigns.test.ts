import { describe, expect, it } from 'vitest';
import { createDemoStore } from './store';

const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
};

const setup = () => createDemoStore(memoryStorage(), () => '2026-11-16T10:00:00.000Z');
const input = { name: '  Spring Hiring ', jobIds: ['job-1', 'job-2'], channels: ['facebook', 'topcv'], goal: 20, start: '2026-12-01', end: '2026-12-31' };

describe('campaign actions', () => {
  it('createCampaign trims the name, starts active with tracking links and prepends', () => {
    const s = setup();
    const c = s.getState().createCampaign(input);
    expect(c).toMatchObject({ name: 'Spring Hiring', status: 'active', stats: { views: 0 } });
    expect(c.id).toMatch(/^camp-/);
    expect(s.getState().campaigns[0].id).toBe(c.id);
    expect(c.links).toHaveLength(4);
    expect(c.links[0].url).toContain(`/careers/job-1?src=${c.id}-facebook`);
  });

  it('createCampaign keeps a caller-supplied id', () => {
    const s = setup();
    expect(s.getState().createCampaign(input, 'camp-draft').id).toBe('camp-draft');
  });

  it('updateCampaign edits fields and regenerates links; unknown id is false', () => {
    const s = setup();
    const c = s.getState().createCampaign(input);
    expect(s.getState().updateCampaign(c.id, { name: ' Renamed ', channels: ['referral'], jobIds: ['job-1'] })).toBe(true);
    const next = s.getState().campaigns[0];
    expect(next.name).toBe('Renamed');
    expect(next.links.map((l) => l.url.split('src=')[1])).toEqual([`${c.id}-referral`]);
    expect(s.getState().updateCampaign('nope', { name: 'x' })).toBe(false);
  });

  it('setCampaignStatus changes only the status', () => {
    const s = setup();
    const c = s.getState().createCampaign(input);
    expect(s.getState().setCampaignStatus(c.id, 'paused')).toBe(true);
    expect(s.getState().campaigns[0]).toMatchObject({ status: 'paused', name: 'Spring Hiring' });
    expect(s.getState().setCampaignStatus('nope', 'ended')).toBe(false);
  });
});
