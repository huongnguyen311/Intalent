import { describe, expect, it } from 'vitest';
import { fillTemplate, nextInterview, salaryRange, scorecardAverage, stageTemplate, TEMPLATE } from '../domain/hiring';
import type { InterviewInput, OfferInput } from '../domain/types';
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

const NOW = '2026-11-16T10:00:00.000Z';
const IV: InterviewInput = { round: 'Technical', at: '2026-11-20T10:00', durationMin: 60, mode: 'online', place: 'https://meet.example.com/x', interviewers: ['u-thu'] };
const OFFER: OfferInput = { salary: 45_000_000, currency: 'VND', startDate: '2026-12-15', contract: 'Full-time', validUntil: '2026-11-25' };
const SCORES = { technical: 4, communication: 5, problem: 3, culture: 4 };

function withApp() {
  const store = createDemoStore(memoryStorage(), () => NOW);
  store.setState({ applications: [], activities: [], emails: [] });
  const candidate = store.getState().candidates.find((c) => c.email)!;
  const r = store.getState().addToPipeline(candidate.id, 'job-1', { via: 'manual', source: 'Manual', by: 'u-admin' });
  if (!r.ok) throw new Error('expected ok');
  const find = () => store.getState().applications.find((a) => a.id === r.application.id)!;
  return { store, id: r.application.id, find, candidate, s: () => store.getState() };
}

describe('domain helpers', () => {
  it('fills known placeholders and keeps unknown or empty ones visible', () => {
    expect(fillTemplate('Hi {{name}}, {{job}} at {{time}}', { name: 'An', job: 'Dev', time: '' })).toBe('Hi An, Dev at {{time}}');
  });
  it('formats salary ranges per currency', () => {
    expect(salaryRange({ salaryMin: 3000, salaryMax: 4500, currency: 'USD' })).toBe('$3,000 – $4,500');
    expect(salaryRange({})).toBeUndefined();
  });
  it('suggests a template per stage', () => {
    expect(stageTemplate('rejected')).toBe(TEMPLATE.rejection);
    expect(stageTemplate('hired')).toBeUndefined();
  });
  it('averages a scorecard and finds the next upcoming interview', () => {
    expect(scorecardAverage({ scores: SCORES })).toBe(4);
    const base = { durationMin: 60, mode: 'online' as const, place: '', interviewers: [], scorecards: [], createdBy: 'u' };
    const app = { interviews: [
      { ...base, id: 'a', round: 'old', at: '2026-01-01T10:00', status: 'scheduled' as const },
      { ...base, id: 'b', round: 'late', at: '2026-12-02T10:00', status: 'scheduled' as const },
      { ...base, id: 'c', round: 'soon', at: '2026-12-01T10:00', status: 'scheduled' as const },
      { ...base, id: 'd', round: 'gone', at: '2026-11-30T10:00', status: 'cancelled' as const },
    ] };
    expect(nextInterview(app, new Date(2026, 10, 18))?.id).toBe('c');
  });
});

describe('sendEmail', () => {
  it('logs the email and an activity', () => {
    const { s, id, candidate } = withApp();
    const mail = s().sendEmail({ candidateId: candidate.id, applicationId: id, subject: ' Hello ', body: 'Body' }, 'u-admin');
    expect(mail).toMatchObject({ to: candidate.email, subject: 'Hello', applicationId: id, at: NOW });
    expect(s().emails).toHaveLength(1);
    expect(s().activities.slice(-1)[0]).toMatchObject({ type: 'email_sent', applicationId: id });
  });
  it('refuses candidates without an email and blank messages', () => {
    const { s, candidate, store } = withApp();
    expect(s().sendEmail({ candidateId: candidate.id, subject: '', body: 'x' }, 'u-admin')).toBeNull();
    store.setState({ candidates: s().candidates.map((c) => (c.id === candidate.id ? { ...c, email: '' } : c)) });
    expect(s().sendEmail({ candidateId: candidate.id, subject: 'Hi', body: 'x' }, 'u-admin')).toBeNull();
    expect(s().emails).toHaveLength(0);
  });
});

describe('interviews', () => {
  it('schedules a round and moves a New card to Interview', () => {
    const { s, id, find } = withApp();
    const iv = s().scheduleInterview(id, IV, 'u-admin');
    expect(iv).toMatchObject({ round: 'Technical', status: 'scheduled' });
    expect(find().interviews).toHaveLength(1);
    expect(find().stage).toBe('interview');
  });
  it('refuses missing fields, no interviewers and rejected applications', () => {
    const { s, id, find } = withApp();
    expect(s().scheduleInterview(id, { ...IV, round: ' ' }, 'u-admin')).toBeNull();
    expect(s().scheduleInterview(id, { ...IV, at: '2026-11-20' }, 'u-admin')).toBeNull();
    expect(s().scheduleInterview(id, { ...IV, interviewers: [] }, 'u-admin')).toBeNull();
    s().moveStage(id, 'rejected', 'u-admin', 'No fit');
    expect(s().scheduleInterview(id, IV, 'u-admin')).toBeNull();
    expect(find().interviews).toBeUndefined();
  });
  it('cancels a scheduled round', () => {
    const { s, id, find } = withApp();
    const iv = s().scheduleInterview(id, IV, 'u-admin')!;
    expect(s().cancelInterview(id, iv.id, 'u-admin')).toBe(true);
    expect(find().interviews![0].status).toBe('cancelled');
    expect(s().cancelInterview(id, iv.id, 'u-admin')).toBe(false);
  });
  it('keeps one scorecard per interviewer and marks the round done', () => {
    const { s, id, find } = withApp();
    const iv = s().scheduleInterview(id, IV, 'u-admin')!;
    expect(s().submitScorecard(id, iv.id, { scores: SCORES, recommendation: 'yes' }, 'u-thu')).toBe(true);
    expect(s().submitScorecard(id, iv.id, { scores: { ...SCORES, technical: 5 }, recommendation: 'strong_yes' }, 'u-thu')).toBe(true);
    const round = find().interviews![0];
    expect(round.status).toBe('done');
    expect(round.scorecards).toHaveLength(1);
    expect(round.scorecards[0]).toMatchObject({ recommendation: 'strong_yes', scores: { technical: 5 } });
  });
  it('refuses scores outside 1-5', () => {
    const { s, id } = withApp();
    const iv = s().scheduleInterview(id, IV, 'u-admin')!;
    expect(s().submitScorecard(id, iv.id, { scores: { ...SCORES, culture: 0 }, recommendation: 'no' }, 'u-thu')).toBe(false);
  });
});

describe('offer and hand-off', () => {
  it('drafts, sends and accepts an offer, ending in Hired', () => {
    const { s, id, find } = withApp();
    expect(s().saveOffer(id, OFFER, 'u-admin')).toBe(true);
    expect(find()).toMatchObject({ stage: 'offer', offer: { status: 'draft', salary: 45_000_000 } });
    expect(s().markOfferSent(id, 'u-admin')).toBe(true);
    expect(s().respondOffer(id, true, 'u-admin')).toBe(true);
    expect(find()).toMatchObject({ stage: 'hired', offer: { status: 'accepted', respondedAt: NOW } });
    expect(s().saveOffer(id, OFFER, 'u-admin')).toBe(false); // accepted offers are final while Hired
    expect(s().respondOffer(id, false, 'u-admin', 'Changed mind')).toBe(false);
  });
  it('records an answer given outside the system on a draft offer (no email on file)', () => {
    const { s, id, find } = withApp();
    s().saveOffer(id, OFFER, 'u-admin');
    expect(s().respondOffer(id, true, 'u-admin')).toBe(true);
    expect(find()).toMatchObject({ stage: 'hired', offer: { status: 'accepted' } });
  });
  it('reopens an accepted offer once the candidate leaves Hired', () => {
    const { s, id, find } = withApp();
    s().saveOffer(id, OFFER, 'u-admin');
    s().markOfferSent(id, 'u-admin');
    s().respondOffer(id, true, 'u-admin');
    s().moveStage(id, 'offer', 'u-admin');
    expect(s().respondOffer(id, true, 'u-admin')).toBe(false); // already accepted
    expect(s().respondOffer(id, false, 'u-admin', 'Backed out')).toBe(true);
    expect(find().offer).toMatchObject({ status: 'declined', declineReason: 'Backed out' });
    expect(s().saveOffer(id, { ...OFFER, salary: 50_000_000 }, 'u-admin')).toBe(true);
  });
  it('needs a reason to decline, and editing a declined offer makes it a draft again', () => {
    const { s, id, find } = withApp();
    s().saveOffer(id, OFFER, 'u-admin');
    s().markOfferSent(id, 'u-admin');
    expect(s().respondOffer(id, false, 'u-admin', '  ')).toBe(false);
    expect(s().respondOffer(id, false, 'u-admin', 'Took another offer')).toBe(true);
    expect(find().offer).toMatchObject({ status: 'declined', declineReason: 'Took another offer' });
    expect(find().stage).toBe('offer');
    s().saveOffer(id, { ...OFFER, salary: 50_000_000 }, 'u-admin');
    expect(find().offer).toMatchObject({ status: 'draft', salary: 50_000_000 });
    expect(find().offer!.declineReason).toBeUndefined();
  });
  it('hands off only Hired applications, then locks them', () => {
    const { s, id, find } = withApp();
    expect(s().handOff(id, 'u-admin')).toBe(false);
    s().moveStage(id, 'hired', 'u-admin');
    expect(s().handOff(id, 'u-admin')).toBe(true);
    expect(find().handoff).toMatchObject({ by: 'u-admin', at: NOW });
    expect(s().handOff(id, 'u-admin')).toBe(false);
    expect(s().moveStage(id, 'offer', 'u-admin')).toBe(false);
    expect(s().activities.slice(-1)[0]).toMatchObject({ type: 'handed_off' });
  });
});

describe('careers application extras', () => {
  it('stores answers and logs the automatic acknowledgement email', () => {
    const store = createDemoStore(memoryStorage(), () => NOW);
    store.setState({ applications: [], activities: [], emails: [] });
    const answers = [{ questionId: 'q-lead', label: 'How many engineers have you led?', answer: '5' }];
    const r = store.getState().applyFromCareers({ name: 'Le Van Test', email: 'le.test@example.com' }, 'job-2', undefined, answers);
    if (!r.ok) throw new Error('expected ok');
    expect(r.application.answers).toEqual(answers);
    const mail = store.getState().emails[0];
    expect(mail).toMatchObject({ to: 'le.test@example.com', templateId: TEMPLATE.received, applicationId: r.application.id });
    expect(mail.body).toContain('Le Van Test');
    expect(mail.body).not.toMatch(/\{\{/);
  });
});

describe('seed', () => {
  it('gives interview, offer and hired applications matching records', () => {
    const store = createDemoStore(memoryStorage(), () => NOW);
    const apps = store.getState().applications;
    expect(apps.filter((a) => a.stage === 'interview').every((a) => a.interviews?.some((i) => i.status === 'scheduled'))).toBe(true);
    expect(apps.filter((a) => a.stage === 'offer').every((a) => a.offer)).toBe(true);
    expect(apps.filter((a) => a.stage === 'hired').every((a) => a.offer?.status === 'accepted')).toBe(true);
    expect(store.getState().prompts.some((p) => p.id === TEMPLATE.offer)).toBe(true);
  });

  it('keeps the time zone the interview was scheduled in', () => {
    const { store, id, find } = withApp();
    store.getState().scheduleInterview(id, { ...IV, timeZone: 'Asia/Ho_Chi_Minh' }, 'u-admin');
    expect(find().interviews?.[0].timeZone).toBe('Asia/Ho_Chi_Minh');
  });
});
