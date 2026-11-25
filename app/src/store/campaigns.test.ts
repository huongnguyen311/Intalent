import { describe, expect, it } from 'vitest';
import type { CampaignInput, CampaignStatus } from '../domain/types';
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

// Store clock: 2026-11-16.
const setup = () => createDemoStore(memoryStorage(), () => '2026-11-16T10:00:00.000Z');
const input: CampaignInput = {
  name: '  Spring Hiring ', owner: 'u-huy', goals: {},
  start: '2026-12-01', end: '2026-12-31',
};

describe('campaign actions', () => {
  it('save as draft: trimmed name, code and createdAt, prepended; no tracking links', () => {
    const s = setup();
    const c = s.getState().createCampaign(input, { launch: false });
    expect(c).toMatchObject({ name: 'Spring Hiring', status: 'draft', stats: { views: 0 }, createdAt: '2026-11-16T10:00:00.000Z' });
    expect(c.code).toMatch(/^CMP-2026-\d{3}$/);
    expect(c.id).toMatch(/^camp-/);
    expect(s.getState().campaigns[0].id).toBe(c.id);
    expect(c).not.toHaveProperty('links');
    expect(c).not.toHaveProperty('jobs');
  });

  it('codes run on from the highest one that year', () => {
    const s = setup();
    const a = s.getState().createCampaign(input, { launch: false });
    const b = s.getState().createCampaign(input, { launch: false });
    expect(Number(b.code.slice(-3))).toBe(Number(a.code.slice(-3)) + 1);
  });

  it('launch: scheduled for a future start, active from today on', () => {
    const s = setup();
    expect(s.getState().createCampaign(input, { launch: true }).status).toBe('scheduled');
    expect(s.getState().createCampaign({ ...input, start: '2026-11-16' }, { launch: true }).status).toBe('active');
  });

  it('createCampaign keeps a caller-supplied id', () => {
    const s = setup();
    expect(s.getState().createCampaign(input, { launch: false, id: 'camp-draft' }).id).toBe('camp-draft');
  });

  it('launchCampaign launches a draft unless its end date has passed', () => {
    const s = setup();
    const d = s.getState().createCampaign({ ...input, start: '2026-11-01' }, { launch: false });
    expect(s.getState().launchCampaign(d.id)).toBe(true);
    expect(s.getState().campaigns.find((c) => c.id === d.id)!.status).toBe('active');
    expect(s.getState().launchCampaign(d.id)).toBe(false);
    const old = s.getState().createCampaign({ ...input, start: '2026-10-01', end: '2026-11-15' }, { launch: false });
    expect(s.getState().launchCampaign(old.id)).toBe(false);
  });

  it('updateCampaign edits fields; read-only and unknown ids are refused', () => {
    const s = setup();
    const c = s.getState().createCampaign(input, { launch: false });
    expect(s.getState().updateCampaign(c.id, { name: ' Renamed ', goals: { targetApplicants: 9 } })).toBe(true);
    const next = s.getState().campaigns.find((x) => x.id === c.id)!;
    expect(next.name).toBe('Renamed');
    expect(next.code).toBe(c.code);
    expect(next.goals.targetApplicants).toBe(9);
    expect(s.getState().updateCampaign('nope', { name: 'x' })).toBe(false);
    s.getState().setCampaignStatus(c.id, 'cancelled');
    expect(s.getState().updateCampaign(c.id, { name: 'Again' })).toBe(false);
  });

  it('setCampaignStatus allows only the lifecycle moves', () => {
    const allowed: Array<[CampaignStatus, CampaignStatus]> = [
      ['active', 'paused'], ['active', 'completed'], ['active', 'cancelled'],
      ['paused', 'active'], ['paused', 'completed'], ['paused', 'cancelled'],
      ['draft', 'cancelled'], ['scheduled', 'cancelled'],
    ];
    for (const [from, to] of allowed) {
      const s = setup();
      const c = s.getState().createCampaign(input, { launch: false });
      s.setState({ campaigns: s.getState().campaigns.map((x) => (x.id === c.id ? { ...x, status: from } : x)) });
      expect(s.getState().setCampaignStatus(c.id, to)).toBe(true);
      expect(s.getState().campaigns.find((x) => x.id === c.id)!.status).toBe(to);
    }
    const s = setup();
    const c = s.getState().createCampaign(input, { launch: false });
    s.getState().setCampaignStatus(c.id, 'cancelled');
    expect(s.getState().setCampaignStatus(c.id, 'active')).toBe(false);
    expect(s.getState().setCampaignStatus('nope', 'paused')).toBe(false);
  });

  it('a scheduled campaign past its start moves like an active one', () => {
    const s = setup();
    const c = s.getState().createCampaign({ ...input, start: '2026-11-01' }, { launch: false });
    s.setState({ campaigns: s.getState().campaigns.map((x) => (x.id === c.id ? { ...x, status: 'scheduled' } : x)) });
    expect(s.getState().setCampaignStatus(c.id, 'paused')).toBe(true);
    expect(s.getState().campaigns.find((x) => x.id === c.id)!.status).toBe('paused');
    s.setState({ campaigns: s.getState().campaigns.map((x) => (x.id === c.id ? { ...x, status: 'scheduled' } : x)) });
    expect(s.getState().setCampaignStatus(c.id, 'completed')).toBe(true);
  });
});
