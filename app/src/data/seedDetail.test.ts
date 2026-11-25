import { describe, expect, it } from 'vitest';
import { awaitsScorecardFrom } from '../domain/hiring';
import { estimateYears } from '../domain/scoring';
import { SOURCE_MANUAL } from '../domain/sources';
import { buildSeed } from './seed';

const s = buildSeed();
const NOW = Date.parse('2026-11-16T09:00:00.000Z');

describe('seed detail: every flow has demo data', () => {
  it('most candidates carry a full CV profile; some manual adds stay bare', () => {
    const full = s.candidates.filter((c) => c.experience?.length && c.education?.length && c.summary && c.headline);
    expect(full.length).toBeGreaterThan(120);
    const bare = s.candidates.filter((c) => !c.experience);
    expect(bare.length).toBeGreaterThan(0);
    expect(bare.every((c) => c.source === SOURCE_MANUAL)).toBe(true);
    expect(s.candidates.every((c) => !c.linkedin || c.linkedin.startsWith('https://linkedin.example.com/'))).toBe(true);
  });

  it('listed jobs add up to the years the seniority implies', () => {
    for (const c of s.candidates.filter((x) => x.experience && x.seniority === 'Senior')) expect(estimateYears(c)).toBeGreaterThanOrEqual(6);
  });

  it('interview-stage cards cover upcoming, awaiting feedback and cancelled rounds', () => {
    const ivs = s.applications.filter((a) => a.stage === 'interview').flatMap((a) => a.interviews ?? []);
    expect(ivs.some((i) => i.status === 'scheduled')).toBe(true);
    expect(ivs.some((i) => i.status === 'cancelled')).toBe(true);
    expect(ivs.some((i) => i.mode === 'phone')).toBe(true);
    expect(s.applications.some((a) => a.stage === 'interview' && awaitsScorecardFrom(a, 'u-quang') && a.interviews!.some((i) => i.status === 'done'))).toBe(true);
  });

  it('offers exist in every state and drafts were never sent', () => {
    const offers = s.applications.flatMap((a) => (a.offer ? [a.offer] : []));
    for (const st of ['draft', 'sent', 'accepted', 'declined'] as const) expect(offers.some((o) => o.status === st)).toBe(true);
    expect(offers.filter((o) => o.status === 'draft').every((o) => !o.sentAt)).toBe(true);
    expect(offers.filter((o) => o.status === 'declined').every((o) => o.declineReason)).toBe(true);
  });

  it('has an email log with every template, matching email_sent activities', () => {
    expect(new Set(s.emails.map((e) => e.templateId))).toEqual(new Set([
      'email-application-received', 'email-stage-update', 'email-interview-invite', 'email-offer', 'email-rejection',
    ]));
    expect(s.emails.every((e) => !/\{\{\w+\}\}/.test(e.body))).toBe(true);
    expect(s.activities.filter((a) => a.type === 'email_sent')).toHaveLength(s.emails.length);
  });

  it('activity trail covers every activity type and nothing is in the future', () => {
    const types = new Set(s.activities.map((a) => a.type));
    for (const t of ['interview_scheduled', 'interview_cancelled', 'scorecard_submitted', 'offer_updated', 'handed_off',
      'ai_evaluated', 'owner_transferred', 'candidate_merged', 'note_converted', 'candidate_self_update'] as const) expect(types.has(t)).toBe(true);
    expect(s.activities.every((a) => Date.parse(a.at) <= NOW)).toBe(true);
    expect(s.emails.every((e) => Date.parse(e.at) <= NOW)).toBe(true);
  });

  it('careers applications to jobs with questions carry answers', () => {
    const withQs = s.applications.filter((a) => a.via === 'careers' && s.jobs.find((j) => j.id === a.jobId)?.questions?.length);
    expect(withQs.length).toBeGreaterThan(0);
    expect(withQs.every((a) => a.answers?.length)).toBe(true);
  });

  it('AI Search history, linked notes and a paused campaign', () => {
    expect(new Set(s.chats.map((m) => m.sessionId)).size).toBe(3);
    expect(s.chats.some((m) => m.results?.length)).toBe(true);
    expect(s.notes.filter((n) => n.convertedToCandidateId)).toHaveLength(2);
    expect(s.campaigns.some((c) => c.status === 'paused')).toBe(true);
  });
});
