import type {
  Activity, Application, ApplicationComment, ApplicationRating, Campaign, Candidate, DemoState, Job, Jd, Note,
  Prompt, Stage, StageHistoryEntry, TaxonomyItem, User, Via,
} from '../domain/types';
import { campaignLinks, CHANNEL_SOURCE, DEMO_ORIGIN, type Channel } from '../domain/campaigns';
import { SOURCE_CAREERS, SOURCE_CV_UPLOAD, SOURCE_MANUAL, SOURCE_REFERRAL, SOURCE_TALENT_POOL } from '../domain/sources';
import { STAGES } from '../domain/stages';
import { normalizeEmail } from '../domain/normalize';
import {
  COMMENTS, DOMAINS, ENGLISH, FIRST_NAMES, GROUPS, LAST_NAMES, MIDDLE_NAMES, NOTE_TEXTS,
  REJECT_REASONS, SENIORITY, SKILLS, TAGS, TITLES,
} from './names';

export type Rng = () => number;

/** Small deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Default reference "now": a given rng and base always yield identical timestamps. */
export const SEED_BASE_TIME = Date.parse('2026-11-16T09:00:00.000Z');
const HOUR = 3_600_000;

/** Timestamps relative to the seed's reference time. */
interface Clock {
  iso(offsetHours: number): string;
  daysAgo(days: number): string;
}
const clockAt = (base: number): Clock => {
  const iso = (offsetHours: number) => new Date(base + offsetHours * HOUR).toISOString();
  return { iso, daysAgo: (d) => iso(-24 * d) };
};

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
function sample<T>(rng: Rng, xs: readonly T[], n: number): T[] {
  const pool = [...xs];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

// The four JDs, the english-level taxonomy and the four prompts the mockup shows.
const JD_ROWS: Array<Pick<Jd, 'id' | 'code' | 'title' | 'domains' | 'skills' | 'createdAt' | 'updatedAt'>> = [
  {
    id: 'jd-2026-004', code: 'JD-2026-004', title: 'Senior Growth Marketing Lead',
    domains: ['Software Development', 'IT Services', 'Digital Marketing'],
    skills: ['Google Ads', 'GA4', 'Meta Ads', 'SEO', 'Email Marketing', 'HubSpot', 'Looker Studio', 'A/B Testing', 'CRO', 'SQL', 'Funnel Analysis', 'Marketing Automation'],
    createdAt: '2026-07-08', updatedAt: '2026-07-08',
  },
  {
    id: 'jd-2026-003', code: 'JD-2026-003', title: 'Tech Lead / Senior Engineer',
    domains: ['SaaS', 'B2B Sales Technology'],
    skills: ['ReactJS', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'GraphQL', 'CI/CD', 'System Design', 'Code Review', 'Mentoring', 'Redis'],
    createdAt: '2026-06-11', updatedAt: '2026-06-11',
  },
  {
    id: 'jd-2026-002', code: 'JD-2026-002', title: 'Senior Frontend Developer',
    domains: ['Healthcare', 'SaaS'],
    skills: ['React', 'TypeScript', 'Vue'],
    createdAt: '2026-06-08', updatedAt: '2026-06-08',
  },
  {
    id: 'jd-2026-001', code: 'JD-2026-001', title: 'Senior Flutter & Java Engineer',
    domains: ['Robotics', 'Mobile Applications'],
    skills: ['Flutter', 'Java', 'Dart', 'Kotlin', 'REST APIs'],
    createdAt: '2026-04-10', updatedAt: '2026-04-10',
  },
];

export function buildJds(): Jd[] {
  return JD_ROWS.map((r) => ({
    ...r,
    client: '',
    status: 'Published',
    body:
      `${r.title.toUpperCase()}\n\nABOUT THE ROLE\nWe are looking for a ${r.title} to join our team ` +
      `in ${r.domains.join(' and ')}.\n\nTECH STACK\n${r.skills.join(', ')}\n\nMUST-HAVE SKILLS\n` +
      '- 5+ years of relevant professional experience\n- Strong written and spoken communication',
  }));
}

/** Email templates live beside the prompts (id prefix `email-`); the System Config page splits them by that prefix. */
export function buildEmailTemplates(): Prompt[] {
  const row = (id: string, name: string, description: string, text: string): Prompt =>
    ({ id: `email-${id}`, name, description, text, updatedAt: '2026-03-10T09:00:00' });
  const sign = '\n\nThe InApps Talent team';
  return [
    row('application-received', 'Application Received', 'Sent when a candidate applies on the careers site',
      `Hi {{name}},\n\nThanks for applying for {{job}}. We received your application and will be in touch soon.${sign}`),
    row('interview-invite', 'Interview Invitation', 'Sent when a candidate moves to Interview',
      `Hi {{name}},\n\nWe would like to invite you to an interview for {{job}}. Please reply with a time that suits you.${sign}`),
    row('rejection', 'Rejection', 'Sent when a candidate is moved to Rejected',
      `Hi {{name}},\n\nThank you for your interest in {{job}}. We will not move forward this time, but we will keep your profile on file.${sign}`),
  ];
}

export function buildPrompts(): Prompt[] {
  const row = (id: string, name: string, description: string, updatedAt: string, text: string): Prompt =>
    ({ id, name, description, text, updatedAt });
  return [
    row('prompt-candidate-evaluation', 'Candidate Evaluation', 'Used for evaluating candidates in AI Chat', '2026-03-24T15:30:21',
      'You are a recruiting assistant. Evaluate the candidate against the question and answer concisely with evidence from the CV.'),
    row('prompt-jd-matching', 'Jd Matching', 'Used for AI ranking of candidates against a job description', '2026-03-24T15:25:53',
      'Rank candidates by how well their skills, seniority and domains match the job description. Return a score from 0 to 100 and a one-line reason.'),
    row('prompt-jd-generation', 'Jd Generation', 'Used for generating Job Descriptions from text or file input', '2026-03-13T16:51:04',
      'Turn the provided notes into a structured job description with role summary, tech stack and must-have skills.'),
    row('prompt-cv-extraction-batch', 'Cv Extraction Batch', 'Used for extracting structured data from multiple CVs in batch', '2026-03-24T10:33:40',
      'Extract name, contact details, title, seniority, skills, domains and English level from each CV as JSON.'),
  ];
}

const taxItem = (kind: TaxonomyItem['kind'], label: string, usage: number): TaxonomyItem => ({
  id: `tax-${kind}-${fold(label).replace(/[^a-z0-9]+/g, '-')}`,
  kind, label, active: true, usage, updatedAt: '2026-02-24',
});

/** English levels as the mockup's taxonomy page lists them; usage is 0 there. */
export function buildEnglishTaxonomy(): TaxonomyItem[] {
  return ['Advanced', 'Intermediate', 'Basic', 'Fluent'].map((l) => taxItem('english', l, 0));
}

function buildTaxonomy(candidates: Candidate[]): TaxonomyItem[] {
  return [
    ...buildEnglishTaxonomy().map((t) => ({ ...t, usage: candidates.filter((c) => c.english === t.label).length })),
    ...DOMAINS.map((d) => taxItem('domain', d, candidates.filter((c) => c.domains.includes(d)).length)),
    ...SENIORITY.map((s) => taxItem('seniority', s, candidates.filter((c) => c.seniority === s).length)),
  ];
}

const USER_ROWS: Array<[id: string, name: string, email: string, role: string]> = [
  ['u-admin', 'Super Admin', 'admin@company.demo', 'Super Admin'],
  ['u-thu', 'Mai Anh Thu', 'thu.mai@company.demo', 'Admin'],
  ['u-huy', 'Pham Gia Huy', 'huy.pham@company.demo', 'User'],
  ['u-linh', 'Do Khanh Linh', 'linh.do@company.demo', 'User'],
  ['u-nam', 'Vu Hoang Nam', 'nam.vu@company.demo', 'User'],
  ['u-tam', 'Bui Thanh Tam', 'tam.bui@company.demo', 'Admin'],
  ['u-quang', 'Ly Quoc Quang', 'quang.ly@company.demo', 'User'],
  ['u-chau', 'Dang Minh Chau', 'chau.dang@company.demo', 'User'],
];
const STAFF = USER_ROWS.slice(1).map((u) => u[0]);

function buildUsers(clock: Clock): User[] {
  return USER_ROWS.map(([id, name, email, role], i) => ({
    id, name, email, role, status: 'Active', createdAt: clock.daysAgo(300 - i * 20).slice(0, 10),
  }));
}

const JOB_ROWS: Array<[id: string, jdId: string, title: string, status: Job['status'], department: string, level: string]> = [
  ['job-1', 'jd-2026-002', 'Senior Frontend Developer', 'open', 'Engineering', 'Senior'],
  ['job-2', 'jd-2026-003', 'Tech Lead / Senior Engineer', 'open', 'Engineering', 'Lead'],
  ['job-3', 'jd-2026-001', 'Senior Flutter & Java Engineer', 'open', 'Engineering', 'Senior'],
  ['job-4', 'jd-2026-004', 'Senior Growth Marketing Lead', 'open', 'Marketing', 'Senior'],
  ['job-5', 'jd-2026-001', 'Mobile Engineer (Flutter)', 'draft', 'Engineering', 'Middle'],
  ['job-6', 'jd-2026-004', 'Growth Marketing Manager', 'closed', 'Marketing', 'Middle'],
];

function buildJobs(clock: Clock): Job[] {
  return JOB_ROWS.map(([id, jdId, title, status, department, level], i) => ({
    id, jdId, title, department, level, status,
    location: i % 2 ? 'Ho Chi Minh City' : 'Hanoi',
    employment: 'Full-time',
    stageSla: { new: 2, screening: 5, interview: 7, offer: 3 },
    openedAt: clock.daysAgo(90 - i * 10),
    hiringManager: i % 2 ? 'u-nam' : 'u-thu',
  }));
}

function buildCampaigns(clock: Clock): Campaign[] {
  const make = (c: Omit<Campaign, 'links'>): Campaign => ({
    ...c,
    links: campaignLinks(c, DEMO_ORIGIN).map(({ channel, url }) => ({ channel, url })),
  });
  return [
    make({
      id: 'camp-1', name: 'Frontend Summer Push', jobIds: ['job-1', 'job-2'], channels: ['linkedin', 'facebook'],
      goal: 40, start: clock.daysAgo(40), end: clock.daysAgo(-20), status: 'active', stats: { views: 1240 },
    }),
    make({
      id: 'camp-2', name: 'Mobile Talent Hunt', jobIds: ['job-3'], channels: ['linkedin', 'topcv'],
      goal: 25, start: clock.daysAgo(25), end: clock.daysAgo(-35), status: 'active', stats: { views: 860 },
    }),
    make({
      id: 'camp-3', name: 'Growth Marketing Referral', jobIds: ['job-4', 'job-6'], channels: ['referral'],
      goal: 15, start: clock.daysAgo(70), end: clock.daysAgo(10), status: 'ended', stats: { views: 410 },
    }),
  ];
}

/** Unique-contact generator shared by candidates and notes. */
function contactFactory(rng: Rng) {
  const emails = new Set<string>(USER_ROWS.map((u) => normalizeEmail(u[2])));
  const phones = new Set<string>();
  return {
    email(first: string, last: string): string {
      const base = `${fold(first)}.${fold(last)}`;
      let email = `${base}@example.com`;
      for (let n = 2; emails.has(email); n++) email = `${base}${n}@example.com`;
      emails.add(email);
      return email;
    },
    phone(): string {
      for (;;) {
        const d = `09${int(rng, 10_000_000, 99_999_999)}`;
        if (phones.has(d)) continue;
        phones.add(d);
        return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
      }
    },
  };
}
type Contacts = ReturnType<typeof contactFactory>;

const SENIORITY_WEIGHTED = [
  'Intern', 'Junior', 'Junior', 'Middle', 'Middle', 'Middle', 'Senior', 'Senior', 'Senior', 'Senior',
  'Lead', 'Lead', 'Principal', 'Architect',
];

function buildCandidates(rng: Rng, count: number, contacts: Contacts, clock: Clock): Candidate[] {
  const names = new Set<string>();
  return Array.from({ length: count }, (_, i) => {
    let last: string, mid: string, first: string, full: string;
    do {
      last = pick(rng, LAST_NAMES);
      mid = pick(rng, MIDDLE_NAMES);
      first = pick(rng, FIRST_NAMES);
      full = `${last} ${mid} ${first}`;
    } while (names.has(full));
    names.add(full);
    const title = pick(rng, TITLES);
    const seniority = pick(rng, SENIORITY_WEIGHTED);
    const skills = sample(rng, SKILLS, int(rng, 3, 8));
    return {
      id: `cand-${String(i + 1).padStart(3, '0')}`,
      name: full,
      title,
      // Every 25th candidate has no email, as parsed CVs sometimes do.
      email: i % 25 === 24 ? '' : contacts.email(first, last),
      phone: contacts.phone(),
      seniority,
      english: pick(rng, ENGLISH),
      skills,
      domains: sample(rng, DOMAINS, int(rng, 1, 3)),
      tags: rng() < 0.3 ? sample(rng, TAGS, 1) : [],
      groups: rng() < 0.25 ? sample(rng, GROUPS, 1) : [],
      cvOwner: pick(rng, STAFF),
      source: pick(rng, [SOURCE_CV_UPLOAD, SOURCE_CAREERS, SOURCE_REFERRAL, SOURCE_MANUAL]),
      inTalentPool: true as const,
      createdAt: clock.daysAgo(int(rng, 1, 200)),
      cv: `${title} (${seniority}). Skills: ${skills.join(', ')}.`,
    };
  });
}

const STAGE_COUNTS: Record<Stage, number> = { new: 18, screening: 16, interview: 14, offer: 7, hired: 6, rejected: 9 };

function buildApplications(rng: Rng, candidates: Candidate[], jobs: Job[], campaigns: Campaign[], clock: Clock) {
  const openJobs = jobs.filter((j) => j.status === 'open');
  const closedJob = jobs.find((j) => j.status === 'closed')!;
  const stages = sample(rng, STAGES.flatMap((s) => Array<Stage>(STAGE_COUNTS[s]).fill(s)), 70);
  const apps: Application[] = [];
  const activities: Activity[] = [];
  const pairs = new Set<string>();

  stages.forEach((stage, i) => {
    // Finished outcomes sometimes belong to the closed job.
    const jobPool = (stage === 'hired' || stage === 'rejected') && rng() < 0.5 ? [closedJob] : openJobs;
    let cand: Candidate, job: Job;
    do {
      cand = pick(rng, candidates);
      job = pick(rng, jobPool);
    } while (pairs.has(`${cand.id}|${job.id}`));
    pairs.add(`${cand.id}|${job.id}`);

    const camps = campaigns.filter((c) => c.jobIds.includes(job.id));
    const r = rng();
    const via: Via = r < 0.3 ? 'careers' : r < 0.7 ? 'talent_pool' : r < 0.9 && camps.length ? 'campaign' : 'manual';
    const campaign = via === 'campaign' ? pick(rng, camps) : undefined;
    const source =
      via === 'careers' ? SOURCE_CAREERS
      : via === 'talent_pool' ? SOURCE_TALENT_POOL
      : campaign ? CHANNEL_SOURCE[pick(rng, campaign.channels) as Channel]
      : SOURCE_MANUAL;
    const addedBy = pick(rng, STAFF);

    const path: Stage[] = stage === 'rejected'
      ? [...STAGES.slice(0, int(rng, 1, 3)), 'rejected']
      : STAGES.slice(0, STAGES.indexOf(stage) + 1);
    // Same rng draws, in the same order, as before: one for the time in the current stage, then one gap per step.
    const dwellDraw = int(rng, 2, 60);
    const gaps = path.slice(1).map(() => int(rng, 12, 72));
    const sla = job.stageSla[stage];
    // Active stages spread over 0..1.25x (SLA + 1) days, so roughly a fifth of them are overdue.
    const dwellHours = sla === undefined ? 24 * dwellDraw : Math.round(((dwellDraw - 2) / 58) * (sla + 1) * 1.25 * 24);
    let at = -dwellHours - gaps.reduce((n, g) => n + g, 0);
    const history: StageHistoryEntry[] = path.map((s, idx) => {
      if (idx) at += gaps[idx - 1];
      return { stage: s, at: clock.iso(at), by: addedBy };
    });
    const addedAt = history[0].at;
    const last = history[history.length - 1];
    const id = `app-${String(i + 1).padStart(3, '0')}`;
    const comments: ApplicationComment[] =
      stage === 'new' ? [] : [{ by: pick(rng, STAFF), at: last.at, text: pick(rng, COMMENTS) }];
    // Same rng draw as before; the commenting teammate is also the rater.
    const ratings: ApplicationRating[] =
      stage === 'new' ? [] : [{ by: comments[0].by, stars: int(rng, 2, 5), at: last.at }];

    apps.push({
      id, candidateId: cand.id, jobId: job.id, stage, source, via,
      ...(campaign ? { campaignId: campaign.id } : {}),
      addedBy, addedAt, stageEnteredAt: last.at, history,
      ratings,
      comments,
      ...(stage === 'rejected' ? { rejectedReason: pick(rng, REJECT_REASONS) } : {}),
    });
    activities.push({
      type: 'added_to_pipeline', candidateId: cand.id, applicationId: id, jobId: job.id,
      by: addedBy, at: addedAt, detail: `Added to ${job.title} via ${source}`,
    });
    for (const h of history.slice(1)) {
      activities.push({
        type: 'stage_changed', candidateId: cand.id, applicationId: id, jobId: job.id,
        by: h.by, at: h.at, detail: `Moved to ${h.stage}`,
      });
    }
  });
  return { apps, activities };
}

function buildNotes(rng: Rng, contacts: Contacts, clock: Clock): Note[] {
  return Array.from({ length: 10 }, (_, i) => {
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    return {
      id: `note-${String(i + 1).padStart(2, '0')}`,
      name: `${last} ${pick(rng, MIDDLE_NAMES)} ${first}`,
      contact: i % 2 ? contacts.email(`${first}.note`, last) : contacts.phone(),
      text: pick(rng, NOTE_TEXTS),
      createdBy: pick(rng, STAFF),
      createdAt: clock.daysAgo(int(rng, 1, 30)),
    };
  });
}

/**
 * Deterministic demo data for a given rng and reference time. The store passes the load time as `base`
 * so days-in-stage, days-open and recent activity look the same on whatever day the demo runs.
 */
export function buildSeed(rng: Rng = mulberry32(20261116), base: number = SEED_BASE_TIME): DemoState {
  const clock = clockAt(base);
  const contacts = contactFactory(rng);
  const candidates = buildCandidates(rng, 150, contacts, clock);
  const jobs = buildJobs(clock);
  const campaigns = buildCampaigns(clock);
  const { apps, activities } = buildApplications(rng, candidates, jobs, campaigns, clock);
  const notes = buildNotes(rng, contacts, clock);
  const created: Activity[] = candidates.map((c) => ({
    type: 'candidate_created', candidateId: c.id, by: c.cvOwner, at: c.createdAt,
    detail: `Added to Talent Pool via ${c.source}`,
  }));
  const noted: Activity[] = notes.map((n) => ({
    type: 'note_added', by: n.createdBy, at: n.createdAt, detail: `Note added for ${n.name}`,
  }));
  return {
    candidates,
    applications: apps,
    jobs,
    campaigns,
    notes,
    activities: [...created, ...activities, ...noted].sort((a, b) => a.at.localeCompare(b.at)),
    users: buildUsers(clock),
    jds: buildJds(),
    taxonomy: buildTaxonomy(candidates),
    prompts: [...buildPrompts(), ...buildEmailTemplates()],
    chats: [],
    ui: { lang: 'en', careersLang: 'vi', piiUnlocked: false },
  };
}
