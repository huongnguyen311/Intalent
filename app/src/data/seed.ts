import { evaluateApplication, requirementsForJob } from '../domain/aiEvaluation';
import type {
  Activity, Application, ApplicationComment, ApplicationRating, Campaign, Candidate, DemoState, Interview, Job, Jd, Note,
  Offer, Prompt, Stage, StageHistoryEntry, TaxonomyItem, User, Via,
} from '../domain/types';
import { nextCampaignCode } from '../domain/campaigns';
import { SOURCE_CAREERS, SOURCE_CV_UPLOAD, SOURCE_MANUAL, SOURCE_REFERRAL, SOURCE_TALENT_POOL } from '../domain/sources';
import { HANDOFF_TARGET } from '../domain/hiring';
import { STAGES } from '../domain/stages';
import { normalizeEmail } from '../domain/normalize';
import { withFlowDetail, withProfiles } from './seedDetail';
import { buildShowcaseJd, buildShowcaseJob } from './showcaseJob';
import { withDemoJobs } from './demoJobs';
import { withJdDetails, withJobPosts } from './jobPosts';
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

/** Demo clients for the regular seed; the mockup fixture keeps prod's empty client column. JD-2026-001 stays internal. */
const JD_CLIENTS: Record<string, string> = { 'jd-2026-004': 'Northwind Retail', 'jd-2026-003': 'Acme SaaS', 'jd-2026-002': 'MediCore Health' };
const withClients = (jds: Jd[]): Jd[] => jds.map((j) => ({ ...j, client: JD_CLIENTS[j.id] ?? '' }));

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
  const sign = '\n\nThe InTalent team';
  return [
    row('application-received', 'Application Received', 'Sent when a candidate applies on the careers site',
      `Hi {{name}},\n\nThanks for applying for {{job}}. We received your application and will be in touch soon.${sign}`),
    row('interview-invite', 'Interview Invitation', 'Sent when an interview is scheduled',
      `Hi {{name}},\n\nWe would like to invite you to an interview for {{job}}.\n\nTime: {{time}}\nWhere: {{place}}\n\nPlease reply to confirm.${sign}`),
    row('offer', 'Offer Letter', 'Sent with the job offer',
      `Hi {{name}},\n\nWe are happy to offer you the {{job}} position.\n\nSalary: {{salary}} (gross / month)\nStart date: {{startDate}}\n\nThis offer is valid until {{validUntil}}.\n\nAccept or decline online: {{portalLink}} (sign in with this email address), or simply reply to this email.${sign}`),
    row('stage-update', 'Application Update', 'General update when the application moves forward',
      `Hi {{name}},\n\nA quick update on your application for {{job}}: you are now at the {{stage}} step. We will be in touch with next steps.${sign}`),
    row('rejection', 'Rejection', 'Sent when a candidate is moved to Rejected',
      `Hi {{name}},\n\nThank you for your interest in {{job}}. We will not move forward this time, but we will keep your profile on file.${sign}`),
  ];
}

/** Company defaults for job-post sections (id prefix `content-`), edited on System Config > Job content. */
export function buildContentTemplates(): Prompt[] {
  const row = (id: string, name: string, description: string, text: string): Prompt =>
    ({ id: `content-${id}`, name, description, text, updatedAt: '2026-03-10T09:00:00' });
  return [
    row('why-love', "Why you'll love working here", 'Prefilled into every new job; editable per job',
      [
        '- Competitive salary with a 13th-month bonus and yearly performance review',
        '- Work with international clients on modern stacks',
        '- Hybrid working and flexible hours',
        '- Premium health insurance and a yearly health check',
        '- Learning budget for courses and certifications',
        '- Team trips, sports clubs and monthly team events',
      ].join('\n')),
    row('additional-info', 'Additional information', 'Added under the job facts when AI drafts the section',
      ['- Working hours: Monday to Friday, 8:30 to 17:30', '- Interview process: HR screening, technical interview, final interview'].join('\n')),
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
  ['u-thu', 'Mai Anh Thu', 'thu.mai@company.demo', 'Recruitment Lead'],
  ['u-huy', 'Pham Gia Huy', 'huy.pham@company.demo', 'Recruiter'],
  ['u-linh', 'Do Khanh Linh', 'linh.do@company.demo', 'Recruiter'],
  ['u-nam', 'Vu Hoang Nam', 'nam.vu@company.demo', 'Hiring Manager'],
  ['u-tam', 'Bui Thanh Tam', 'tam.bui@company.demo', 'Recruitment Lead'],
  ['u-quang', 'Ly Quoc Quang', 'quang.ly@company.demo', 'Interviewer'],
  ['u-chau', 'Dang Minh Chau', 'chau.dang@company.demo', 'Recruiter'],
];
const STAFF = USER_ROWS.slice(1).map((u) => u[0]);
/** The recruiters the Dashboard compares; kept out of STAFF so the rng-driven seed stays unchanged. */
const DASHBOARD_RECRUITER_ROWS: Array<[id: string, name: string, email: string, role: string]> = [
  ['u-hoa', 'Hòa Đặng', 'hoa.dang@company.demo', 'Recruiter'],
  ['u-tien', 'Tiên Nguyễn', 'tien.nguyen@company.demo', 'Recruiter'],
];
export const DASHBOARD_RECRUITERS = DASHBOARD_RECRUITER_ROWS.map((u) => u[0]);

function buildUsers(clock: Clock): User[] {
  return [...USER_ROWS, ...DASHBOARD_RECRUITER_ROWS].map(([id, name, email, role], i) => ({
    id, name, email, role, status: 'Active', createdAt: clock.daysAgo(300 - i * 20).slice(0, 10),
  }));
}

const JOB_ROWS: Array<[id: string, jdId: string, title: string, status: Job['status'], department: string, level: string]> = [
  ['job-1', 'jd-2026-002', 'Senior Frontend Developer', 'open', 'Engineering', 'Senior'],
  ['job-2', 'jd-2026-003', 'Tech Lead / Senior Engineer', 'open', 'Engineering', 'Lead'],
  ['job-3', 'jd-2026-001', 'Senior Flutter & Java Engineer', 'open', 'Engineering', 'Senior'],
  ['job-4', 'jd-2026-004', 'Senior Growth Marketing Lead', 'open', 'Marketing', 'Senior'],
  ['job-5', 'jd-2026-001', 'Mobile Engineer (Flutter)', 'pending_approval', 'Engineering', 'Middle'],
  ['job-6', 'jd-2026-004', 'Growth Marketing Manager', 'closed', 'Marketing', 'Middle'],
];

function buildJobs(clock: Clock): Job[] {
  return JOB_ROWS.map(([id, jdId, title, status, department, level], i) => ({
    id, jdId, title, department, level, status,
    location: i % 2 ? 'Ho Chi Minh City' : 'Hanoi',
    employment: 'Full-time',
    stageSla: { new: 2, ai_screening: 1, screening: 5, interview: 7, assessment: 5, final_interview: 5, offer: 3 },
    openedAt: clock.daysAgo(90 - i * 10),
    hiringManager: i % 2 ? 'u-nam' : 'u-thu',
    ...JOB_EXTRAS[i],
    ...urgency(i, clock),
    ...(JOB_CAMPAIGN[id] ? { campaignId: JOB_CAMPAIGN[id] } : {}),
    ...(JOB_EXTRAS[i].approval ? { approval: { ...JOB_EXTRAS[i].approval!, requestedAt: clock.daysAgo(1) } } : {}),
  }));
}

/** The campaign each job currently runs in (picked on the job form). camp-3 has finished, so its jobs moved on. */
const JOB_CAMPAIGN: Record<string, string> = { 'job-1': 'camp-1', 'job-2': 'camp-1', 'job-3': 'camp-2', 'job-4': 'camp-7', 'job-5': 'camp-4' };

/** Hiring urgency per JOB_ROWS index: two urgent jobs, one of them already overdue (no rng draws). */
function urgency(i: number, clock: Clock): Partial<Job> {
  const due = (days: number) => clock.daysAgo(-days).slice(0, 10);
  return [
    { hiringPriority: 'critical', targetHiringDate: due(25), urgencyReason: 'Client project starts next month and needs two more frontend devs.' },
    { hiringPriority: 'high', targetHiringDate: due(45) },
    { hiringPriority: 'urgent', targetHiringDate: due(-5), urgencyReason: 'Mobile team is short after two resignations. Approved by CTO.' },
    { hiringPriority: 'normal', targetHiringDate: due(60) },
    { hiringPriority: 'normal', targetHiringDate: due(90) },
    { hiringPriority: 'normal', targetHiringDate: due(-20) },
  ][i] as Partial<Job>;
}

const MIL = 1_000_000;
/** Salary, collaborators and application questions per JOB_ROWS index (no rng draws, so the rest of the seed is unchanged). */
const JOB_EXTRAS: Array<Partial<Job>> = [
  { workplace: 'hybrid', headcount: 2, salaryMin: 40 * MIL, salaryMax: 60 * MIL, currency: 'VND', showSalary: true, collaborators: ['u-huy', 'u-linh', 'u-hoa'],
    questions: [
      { id: 'q-notice', label: 'What is your notice period?', type: 'text', required: false },
      { id: 'q-onsite', label: 'Can you work onsite 3 days a week?', type: 'yesno', required: false },
    ] },
  { workplace: 'remote', headcount: 1, salaryMin: 3000, salaryMax: 4500, currency: 'USD', showSalary: false, collaborators: ['u-huy', 'u-tien'],
    questions: [
      { id: 'q-lead', label: 'How many engineers have you led?', type: 'text', required: true },
      { id: 'q-english', label: 'Are you comfortable working in English daily?', type: 'yesno', required: true },
    ] },
  { workplace: 'onsite', headcount: 3, salaryMin: 35 * MIL, salaryMax: 50 * MIL, currency: 'VND', showSalary: true, collaborators: ['u-linh', 'u-hoa'], questions: [] },
  { workplace: 'hybrid', headcount: 1, salaryMin: 30 * MIL, salaryMax: 45 * MIL, currency: 'VND', showSalary: true, collaborators: ['u-chau', 'u-tien'], questions: [] },
  { workplace: 'onsite', headcount: 2, collaborators: ['u-huy', 'u-hoa'], education: 'college', approval: { requestedBy: 'u-huy', requestedAt: '' } },
  { workplace: 'onsite', headcount: 1, collaborators: ['u-chau', 'u-tien'] },
];

/**
 * Two candidates with a login (one in Interview, one at Offer), each with CV versions; the first also has
 * pending proposals so the HR review flow can be demoed straight away. Deterministic, no rng.
 */
function withCandidateAccounts(candidates: Candidate[], apps: Application[], clock: Clock): { candidates: Candidate[]; users: User[] } {
  const withEmail = (a: Application) => !!candidates.find((c) => c.id === a.candidateId)?.email;
  const pickFor = (stage: Stage) => apps.find((a) => a.stage === stage && withEmail(a))?.candidateId;
  // The Offer login needs a sent offer so accept / decline can be demoed (fall back to any Offer card).
  // and only one offer, so the portal shows a single Accept / Decline.
  const offersOf = (cid: string) => apps.filter((a) => a.candidateId === cid && a.offer).length;
  const sentOffer = apps.find((a) => a.stage === 'offer' && a.offer?.status === 'sent' && withEmail(a) && offersOf(a.candidateId) === 1)?.candidateId;
  const ids = [pickFor('interview'), sentOffer ?? pickFor('offer')].filter((x, i, xs): x is string => !!x && xs.indexOf(x) === i);
  const users: User[] = ids.map((cid, i) => {
    const c = candidates.find((x) => x.id === cid)!;
    return { id: `u-cand-${i + 1}`, name: c.name, email: c.email, role: 'Candidate', status: 'Active', createdAt: clock.daysAgo(30).slice(0, 10), candidateId: cid };
  });
  const updated = candidates.map((c) => {
    const i = ids.indexOf(c.id);
    if (i < 0) return c;
    const by = `u-cand-${i + 1}`;
    const file = (v: number) => `${fold(c.name).replace(/\s+/g, '-')}-cv-v${v}.pdf`;
    return {
      ...c,
      cvVersions: [
        { id: `cv-${c.id}-1`, fileName: file(1), at: clock.daysAgo(30), by },
        { id: `cv-${c.id}-2`, fileName: file(2), at: clock.daysAgo(2), by },
      ],
      ...(i === 0
        ? { suggestions: [
            { id: `sg-${c.id}-1`, field: 'seniority' as const, value: c.seniority === 'Senior' ? 'Lead' : 'Senior', at: clock.daysAgo(1) },
            { id: `sg-${c.id}-2`, field: 'skills' as const, value: [...c.skills, 'Docker'], at: clock.daysAgo(1) },
          ] }
        : {}),
    };
  });
  return { candidates: updated, users };
}

/** Interviews, offers and hand-offs that match each seeded application's stage (deterministic, no rng). */
/** Seeded applications were scored when they entered the pipeline: one evaluation each, nothing pending. */
function withAiEvaluations(apps: Application[], candidates: Candidate[], jobs: Job[], jds: Jd[], taxonomy: TaxonomyItem[]): Application[] {
  return apps.map((a) => {
    const c = candidates.find((x) => x.id === a.candidateId);
    const job = jobs.find((j) => j.id === a.jobId);
    if (!c || !job) return a;
    return { ...a, aiEvaluations: [evaluateApplication(c, requirementsForJob(job, jds, taxonomy), a.addedAt, `ai-${a.id}-1`)] };
  });
}

function withHiringRecords(apps: Application[], clock: Clock): Application[] {
  const at = (hoursFromNow: number) => {
    const d = new Date(Date.parse(clock.iso(hoursFromNow)));
    d.setMinutes(0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  };
  return apps.map((a, i) => {
    const interviewer = STAFF[i % STAFF.length];
    const past = (n: number): Interview => ({
      id: `int-${a.id}-${n}`, round: n === 1 ? 'Technical interview' : 'Final interview', at: at(-24 * (6 - n)),
      durationMin: 60, mode: n === 1 ? 'online' : 'onsite', place: n === 1 ? 'https://meet.example.com/intalent' : 'Meeting room 3',
      interviewers: [interviewer], status: 'done', createdBy: a.addedBy,
      scorecards: [{
        by: interviewer, at: clock.iso(-24 * (6 - n) + 2),
        scores: { technical: 4, communication: 3 + (i % 3), problem: 4, culture: 4 }, recommendation: i % 3 ? 'yes' : 'strong_yes',
        note: 'Solid fundamentals, clear communication.',
      }],
    });
    const offer = (status: Offer['status']): Offer => ({
      salary: 45 * MIL, currency: 'VND', startDate: clock.daysAgo(-21).slice(0, 10), contract: 'Full-time',
      validUntil: clock.daysAgo(-5).slice(0, 10), status, createdBy: 'u-thu', updatedAt: clock.daysAgo(2),
      sentAt: clock.daysAgo(2), ...(status === 'accepted' ? { respondedAt: clock.daysAgo(1) } : {}),
    });
    if (a.stage === 'interview') {
      return { ...a, interviews: [{
        id: `int-${a.id}-1`, round: 'Technical interview', at: at(24 * (1 + (i % 4)) + 2), durationMin: 60,
        mode: i % 2 ? 'online' : 'onsite', place: i % 2 ? 'https://meet.example.com/intalent' : 'Meeting room 2',
        interviewers: [interviewer], status: 'scheduled', scorecards: [], createdBy: a.addedBy,
      }] };
    }
    if (a.stage === 'offer') return { ...a, interviews: [past(1), past(2)], offer: offer(i % 2 ? 'sent' : 'draft') };
    if (a.stage === 'hired') {
      return { ...a, interviews: [past(1), past(2)], offer: offer('accepted'),
        ...(i % 2 ? { handoff: { at: clock.daysAgo(1), by: 'u-thu', target: HANDOFF_TARGET } } : {}) };
    }
    return a;
  });
}

/**
 * Jobs that brought applicants to each campaign with seeded traffic (active or completed; draft, scheduled,
 * paused-from-the-start and cancelled ones had none). Fixed, so the seeded applications draw the same numbers.
 */
const SEEDED_TRAFFIC: Record<string, string[]> = { 'camp-1': ['job-1', 'job-2'], 'camp-2': ['job-3'], 'camp-3': ['job-4', 'job-6'] };

function buildCampaigns(clock: Clock): Campaign[] {
  const day = (d: number) => clock.daysAgo(d).slice(0, 10);
  const made: Campaign[] = [];
  const make = (c: Omit<Campaign, 'code' | 'createdAt'>, createdDaysAgo: number) => {
    const createdAt = clock.daysAgo(createdDaysAgo);
    made.push({ ...c, code: nextCampaignCode(made, createdAt), createdAt });
  };
  make({
    id: 'camp-1', name: 'Frontend Summer Push', owner: 'u-huy',
    priority: 'high', description: 'Fill the frontend seats the client project needs before Q1.',
    goals: { targetApplicants: 40, budget: 60_000_000, currency: 'VND' },
    start: day(40), end: day(-20), applicationDeadline: day(-10), status: 'active', stats: { views: 1240 },
  }, 42);
  make({
    id: 'camp-2', name: 'Mobile Talent Hunt', owner: 'u-linh', priority: 'urgent',
    goals: { targetApplicants: 25 },
    // Still active after its end date: the detail page offers to mark it completed.
    start: day(25), end: day(3), status: 'active', stats: { views: 860 },
  }, 27);
  make({
    id: 'camp-3', name: 'Growth Marketing Referral', owner: 'u-chau',
    goals: { targetApplicants: 15, budget: 1500, currency: 'USD' },
    start: day(70), end: day(10), status: 'completed', stats: { views: 410 },
  }, 72);
  make({
    id: 'camp-4', name: 'Graduate Program 2027', owner: 'u-huy', priority: 'medium',
    goals: { targetApplicants: 60 },
    start: day(-15), end: day(-75), applicationDeadline: day(-60), status: 'scheduled', stats: { views: 0 },
  }, 3);
  make({
    id: 'camp-5', name: 'Winter Internship', owner: 'u-linh',
    goals: {},
    start: day(-30), end: day(-90), status: 'draft', stats: { views: 0 },
  }, 1);
  make({
    id: 'camp-6', name: 'Q4 Support Mass Hiring', owner: 'u-chau', priority: 'low',
    description: 'Cancelled: the support team was outsourced.',
    goals: { budget: 20_000_000, currency: 'VND' },
    start: day(20), end: day(-40), status: 'cancelled', stats: { views: 120 },
  }, 22);
  make({
    id: 'camp-7', name: 'Marketing Leads Q4', owner: 'u-huy',
    goals: {},
    start: day(14), end: day(-30), status: 'paused', stats: { views: 95 },
  }, 15);
  return made;
}

/** Unique-contact generator shared by candidates and notes. */
function contactFactory(rng: Rng) {
  const emails = new Set<string>([...USER_ROWS, ...DASHBOARD_RECRUITER_ROWS].map((u) => normalizeEmail(u[2])));
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

/**
 * Give the pool overview's CV-quality block something to show, by index (no rng draws, so the rest of
 * the demo stays the same): most candidates consented, a few lack a phone or English level, some CVs
 * are over a year old, and some AI parses have low-confidence fields awaiting HR review.
 */
function withQualityVariety(candidates: Candidate[], clock: Clock): Candidate[] {
  return candidates.map((c, i) => {
    const createdAt = i % 20 === 9 ? clock.daysAgo(380 + i) : c.createdAt;
    return {
      ...c,
      createdAt,
      phone: i % 30 === 14 ? '' : c.phone,
      english: i % 60 === 33 ? '' : c.english,
      consents: c.consents ?? (i % 5 === 3 ? undefined : [{ purpose: 'recruitment' as const, policyVersion: '2026-01', at: createdAt }]),
      parse: c.parse ?? (i % 15 === 7 ? { model: 'cv-extract', at: createdAt, confidence: { seniority: 0.45, english: 0.8, skills: 0.9 }, missing: [] } : undefined),
    };
  });
}

/** The original six-stage order; seed paths keep it so the rng draws (and so the demo data) stay the same. */
const LEGACY_PATH: Stage[] = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];

/** A few interviews move on to the 2nd interview so every default column has demo cards (optional columns start empty). */
const EXTRA_STAGES: [from: Stage, to: Stage, count: number][] = [
  ['interview', 'final_interview', 4],
];

/** Demo applications across the open jobs (cut 30% from 70 so the All jobs board stays readable). */
const APP_COUNT = 49;

const STAGE_COUNTS: Record<Stage, number> = {
  new: 13, ai_screening: 0, screening: 11, interview: 10, assessment: 0, final_interview: 0, custom_1: 0, custom_2: 0, custom_3: 0, custom_4: 0, custom_5: 0, custom_6: 0, offer: 5, hired: 4, rejected: 6, withdrawn: 0,
};

function buildApplications(rng: Rng, candidates: Candidate[], jobs: Job[], campaigns: Campaign[], clock: Clock) {
  const openJobs = jobs.filter((j) => j.status === 'open');
  const closedJob = jobs.find((j) => j.status === 'closed')!;
  const stages = sample(rng, STAGES.flatMap((s) => Array<Stage>(STAGE_COUNTS[s]).fill(s)), APP_COUNT);
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

    const camps = campaigns.filter((c) => SEEDED_TRAFFIC[c.id]?.includes(job.id));
    const r = rng();
    const via: Via = r < 0.3 ? 'careers' : r < 0.7 ? 'talent_pool' : r < 0.9 && camps.length ? 'campaign' : 'manual';
    const campaign = via === 'campaign' ? pick(rng, camps) : undefined;
    const source =
      via === 'careers' ? SOURCE_CAREERS
      : via === 'talent_pool' ? SOURCE_TALENT_POOL
      // A campaign applicant's source is the campaign name. rng() stands in for the former channel pick so later seed draws stay the same.
      : campaign && rng() >= 0 ? campaign.name
      : SOURCE_MANUAL;
    const addedBy = pick(rng, STAFF);

    const path: Stage[] = stage === 'rejected'
      ? [...LEGACY_PATH.slice(0, int(rng, 1, 3)), 'rejected']
      : LEGACY_PATH.slice(0, LEGACY_PATH.indexOf(stage) + 1);
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

  for (const [from, to, count] of EXTRA_STAGES) {
    for (const app of apps.filter((a) => a.stage === from).slice(-count)) {
      // A withdrawal replaces the rejection rather than following it.
      if (from === 'rejected') app.history.pop();
      const last = app.history[app.history.length - 1];
      const at = new Date(Date.parse(last.at) + 3_600_000).toISOString();
      app.stage = to;
      app.stageEnteredAt = at;
      app.history.push({ stage: to, at, by: last.by });
      if (to === 'withdrawn') delete app.rejectedReason;
      activities.push({
        type: 'stage_changed', candidateId: app.candidateId, applicationId: app.id, jobId: app.jobId,
        by: last.by, at, detail: `Moved to ${to}`,
      });
    }
  }
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
  // Full CV profiles go on before the AI evaluations run, so the stored scores match what the profile shows.
  const candidates = withQualityVariety(withProfiles(buildCandidates(rng, 150, contacts, clock), base), clock);
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
  const jds = withClients(buildJds());
  // Full JD details go on after the AI evaluations below (which read `jds`), so seeded scores stay the same.
  const detailedJds = withJdDetails(jds);
  const taxonomy = buildTaxonomy(candidates);
  const applications = withAiEvaluations(withHiringRecords(apps, clock), candidates, jobs, jds, taxonomy);
  const portal = withCandidateAccounts(candidates, applications, clock);
  return withFlowDetail(withDemoJobs({
    candidates: portal.candidates,
    applications,
    // Full job posts and JD details go on after the AI evaluations, so the seeded applicants and scores stay the same.
    // The showcase job goes on last so it draws no rng and has no applicants.
    jobs: [...withJobPosts(jobs, detailedJds), buildShowcaseJob(clock.daysAgo)],
    campaigns,
    notes,
    activities: [...created, ...activities, ...noted].sort((a, b) => a.at.localeCompare(b.at)),
    users: [...buildUsers(clock), ...portal.users],
    jds: [...detailedJds, buildShowcaseJd()],
    taxonomy,
    prompts: [...buildPrompts(), ...buildEmailTemplates(), ...buildContentTemplates()],
    chats: [],
    emails: [],
    ui: { lang: 'en', careersLang: 'vi', piiUnlocked: false },
  }, base, (a) => withHiringRecords(a, clock)), base);
}
