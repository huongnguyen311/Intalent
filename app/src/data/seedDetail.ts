import { fillTemplate, formatMoney, interviewTime, shortDate, TEMPLATE } from '../domain/hiring';
import { hasCriteria, parseQuery, searchCandidates } from '../domain/scoring';
import { CAREERS_ACTOR, SOURCE_CV_UPLOAD, SOURCE_MANUAL } from '../domain/sources';
import { stageLabel } from '../domain/stages';
import { translate } from '../i18n/translate';
import type {
  Activity, Application, Candidate, ChatMessage, DemoState, EducationEntry, Interview, Job, Offer,
  Recommendation, Scorecard, SentEmail, WorkExperience,
} from '../domain/types';

/**
 * Demo detail on top of the base seed so every screen and flow has something to show: full CV profiles,
 * interview rounds in every state, offers in every state, the email log, the activity trail, AI Search history.
 * Deterministic and rng-free, so the base seed's random draws (and every figure built from them) are unchanged.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MIL = 1_000_000;
/** Same id as AI_ACTOR in features/pipeline/useAiQueue (not imported: that module pulls in the store). */
const AI_ACTOR = 'InTalent AI';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (ms: number) => new Date(ms).toISOString();
/** Local "YYYY-MM-DDTHH:00", the zone-less stamp interviews use. */
const localHour = (ms: number) => {
  // Interviews happen in office hours (09:00-17:00): a slot that would fall at night or before work moves later to
  // the next working hour, so the demo never shows a 04:00 or 22:00 interview (and an upcoming one stays upcoming).
  const d = new Date(ms);
  const h = d.getHours();
  if (h >= 18) d.setDate(d.getDate() + 1);
  if (h >= 18 || h < 9) d.setHours(9 + (h % 3));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
};
/** "YYYY-MM" for `back` months before `base`. */
const monthsBack = (base: number, back: number) => {
  const d = new Date(base);
  const idx = d.getFullYear() * 12 + d.getMonth() - back;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
};
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-');

// ---------------------------------------------------------------- profiles

const RANKS = ['Intern', 'Junior', 'Middle', 'Senior', 'Lead', 'Principal', 'Architect'];
/** Matches YEARS_BY_SENIORITY in domain/scoring, so listing the jobs does not move anyone's experience score. */
const YEARS = [0, 1, 3, 6, 9, 12, 14];
const COMPANIES: Record<string, string[]> = {
  'E-commerce': ['Mekong Bytes', 'Sunrise Cart'],
  SaaS: ['Saigon Cloudworks', 'Lotus Peak Software'],
  Fintech: ['BlueRiver Pay', 'Hanoi Ledger Lab'],
  Healthcare: ['Medilink Care', 'CareBridge Clinic Tech'],
  Logistics: ['Truong Son Freight Tech', 'PortLink Lanes'],
  Education: ['EduSprout', 'Bright Classroom'],
  Robotics: ['Kite Robotics', 'Red River Automation'],
};
const CITIES = ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Ho Chi Minh City', 'Hanoi', 'Can Tho'];
const BUSINESS_TITLES = new Set([
  'Growth Marketer', 'Sales Executive', 'Product Manager', 'Business Analyst', 'Project Manager', 'Customer Success Manager',
]);
const TECH_SCHOOLS = [
  'Hanoi University of Science and Technology', 'Ho Chi Minh City University of Technology',
  'University of Information Technology (VNU-HCM)', 'Posts and Telecommunications Institute of Technology', 'FPT University',
];
const BUSINESS_SCHOOLS = ['Foreign Trade University', 'University of Economics Ho Chi Minh City', 'National Economics University'];

function education(c: Candidate, i: number, base: number): EducationEntry[] {
  const business = BUSINESS_TITLES.has(c.title);
  const degree = c.title === 'UI/UX Designer' ? 'B.A. Graphic Design' : business ? 'B.A. Business Administration' : i % 2 ? 'B.Eng. Software Engineering' : 'B.Sc. Computer Science';
  const schools = business ? BUSINESS_SCHOOLS : TECH_SCHOOLS;
  const rank = Math.max(0, RANKS.indexOf(c.seniority));
  return [{ degree, institution: schools[i % schools.length], year: String(new Date(base).getFullYear() - YEARS[rank] - (rank ? 0 : -1)) }];
}

function experience(c: Candidate, i: number, base: number): WorkExperience[] {
  const rank = RANKS.indexOf(c.seniority);
  const total = rank < 0 ? 3 : YEARS[rank];
  const months = Math.max(4, total * 12);
  const parts = total <= 1 ? [months] : total <= 6 ? [Math.round(months * 0.6)] : [Math.round(months * 0.5), Math.round(months * 0.3)];
  parts.push(months - parts.reduce((n, p) => n + p, 0));
  if (parts[parts.length - 1] <= 0) parts.pop();
  const domains = c.domains.length ? c.domains : ['SaaS'];
  const [s1, s2 = s1, s3 = s2] = c.skills;
  let back = 0;
  return parts.map((len, k) => {
    const domain = domains[k % domains.length];
    const company = COMPANIES[domain]?.[(i + k) % 2] ?? 'Saigon Cloudworks';
    const level = rank <= 0 ? '' : RANKS[Math.max(1, rank - k)];
    const title = rank === 0 ? `${c.title} Intern` : level === 'Middle' ? c.title : `${level} ${c.title}`;
    const lead = k === 0 && rank >= 4 ? ` Led a team of ${3 + (i % 5)} people and ran weekly reviews.` : '';
    const entry: WorkExperience = {
      title,
      company,
      start: monthsBack(base, back + len),
      end: k === 0 ? '' : monthsBack(base, back),
      description: `Delivered ${domain} products using ${s1} and ${s2}. Worked with ${s3} day to day in a cross-functional team.${lead}`,
    };
    back += len;
    return entry;
  });
}

/**
 * Full CV profile (headline, summary, jobs, education...) for every candidate except about half of the
 * manually added ones, which stay bare the way a quick intake form leaves them.
 */
export function withProfiles(candidates: Candidate[], base: number): Candidate[] {
  return candidates.map((c, i) => {
    if (c.source === SOURCE_MANUAL && i % 2 === 0) return c;
    const rank = RANKS.indexOf(c.seniority);
    const years = rank < 0 ? 3 : YEARS[rank];
    const focus = c.skills.slice(0, 3).join(', ');
    return {
      ...c,
      headline: `${c.seniority} ${c.title} · ${focus}`,
      location: CITIES[i % CITIES.length],
      summary: years
        ? `${c.seniority} ${c.title} with ${years}+ years in ${c.domains.join(' and ')}. Works mainly with ${focus}.`
        : `${c.title} intern in ${c.domains.join(' and ')}, learning ${focus}.`,
      linkedin: `https://linkedin.example.com/in/${slug(c.name)}-${c.id.slice(-3)}`,
      primarySkills: c.skills.slice(0, 3),
      secondarySkills: c.skills.slice(3),
      openToWork: i % 4 !== 3,
      experience: experience(c, i, base),
      education: education(c, i, base),
    };
  });
}

// ---------------------------------------------------------------- interviews and offers

const scorecard = (by: string, at: number, k: number, recommendation: Recommendation, note: string): Scorecard => ({
  by, at: iso(at), recommendation, note,
  scores: { technical: 3 + (k % 3 === 0 ? 1 : 0), communication: 3 + (k % 2), problem: 4 - (k % 3 === 2 ? 1 : 0), culture: 4 },
});

/**
 * Interview-stage cards rotate through four situations: a passed phone screen with the technical round coming
 * up, a finished round still waiting for one panel member's scorecard, a cancelled-and-rebooked round, and a
 * round later today. The Interviewer account (u-quang) sits on all of them, so "My interviews" is full.
 */
function interviewRounds(a: Application, k: number, now: number): Interview[] {
  const entered = Date.parse(a.stageEnteredAt);
  const mid = Math.floor((entered + now) / 2);
  const lead = a.interviews?.[0]?.interviewers[0] ?? 'u-huy';
  const panel = (...ids: string[]) => [...new Set(ids)];
  const base = { durationMin: 60, createdBy: a.addedBy, scorecards: [] as Scorecard[] };
  const id = (n: number) => `int-${a.id}-${n}`;
  const meet = 'https://meet.example.com/intalent';
  switch (k % 4) {
    case 0:
      return [
        { ...base, id: id(1), round: 'HR screening call', at: localHour(mid), durationMin: 30, mode: 'phone', place: '', interviewers: [a.addedBy], status: 'done',
          scorecards: [scorecard(a.addedBy, Math.min(now, mid + HOUR), k, 'yes', 'Motivated, salary expectation in range. Move to technical round.')] },
        { ...base, id: id(2), round: 'Technical interview', at: localHour(now + DAY * (1 + (k % 3)) + 2 * HOUR), mode: 'online', place: meet,
          interviewers: panel(lead, 'u-quang', 'u-admin'), status: 'scheduled' },
      ];
    case 1:
      return [
        { ...base, id: id(1), round: 'Technical interview', at: localHour(mid), mode: 'onsite', place: 'Meeting room 2',
          interviewers: ['u-quang', 'u-nam'], status: 'done',
          scorecards: [scorecard('u-nam', Math.min(now, mid + 2 * HOUR), k, k % 8 === 1 ? 'strong_yes' : 'yes', 'Good system design answers; a bit quiet in the live coding part.')] },
        { ...base, id: id(2), round: 'Final interview', at: localHour(now + DAY * (2 + (k % 3)) + 4 * HOUR), mode: 'onsite', place: 'Meeting room 1',
          interviewers: ['u-nam'], status: 'scheduled' },
      ];
    case 2:
      return [
        { ...base, id: id(1), round: 'Technical interview', at: localHour(entered + DAY), mode: 'onsite', place: 'Meeting room 3',
          interviewers: panel(lead, 'u-quang'), status: 'cancelled' },
        { ...base, id: id(2), round: 'Technical interview', at: localHour(now + 2 * DAY + 3 * HOUR), mode: 'online', place: meet,
          interviewers: panel(lead, 'u-quang'), status: 'scheduled' },
      ];
    default:
      return [
        { ...base, id: id(1), round: 'Technical interview', at: localHour(now + 3 * HOUR), mode: 'online', place: meet,
          interviewers: panel('u-quang', lead), status: 'scheduled' },
      ];
  }
}

/**
 * 2nd-interview cards: the technical round is behind them (scored, or still waiting on the Interviewer) and the
 * final round with the hiring manager is today, tomorrow or next week, so "My interviews" has both halves filled.
 */
function finalRounds(a: Application, k: number, now: number): Interview[] {
  const base = { durationMin: 60, createdBy: a.addedBy, scorecards: [] as Scorecard[] };
  const id = (n: number) => `int-${a.id}-${n}`;
  const tech = Date.parse(localHour(now - DAY * (3 + k)));
  const scored = k % 2 === 0;
  const upcoming = [now + 2 * HOUR, now + DAY + HOUR, now + 6 * DAY, now + 2 * DAY + 5 * HOUR][k % 4];
  return [
    { ...base, id: id(1), round: 'Technical interview', at: localHour(tech), mode: k % 2 ? 'onsite' : 'online',
      place: k % 2 ? 'Meeting room 2' : 'https://meet.example.com/intalent', interviewers: ['u-quang', 'u-huy', 'u-admin'], status: 'done',
      scorecards: [
        scorecard('u-huy', tech + 2 * HOUR, k, 'yes', 'Clear on fundamentals; asked good questions about the team.'),
        // The Super Admin sat in too: scored half of them, so their own "My interviews" shows both states.
        ...(k % 2 ? [scorecard('u-admin', tech + 4 * HOUR, k + 2, 'yes', 'Good culture fit; salary expectation within budget.')] : []),
        ...(scored ? [scorecard('u-quang', tech + 3 * HOUR, k + 1, k % 4 === 0 ? 'strong_yes' : 'yes', 'Strong debugging; solid on testing and code review habits.')] : []),
      ] },
    { ...base, id: id(2), round: 'Final interview', at: localHour(upcoming), mode: k % 3 === 2 ? 'phone' : 'onsite',
      place: k % 3 === 2 ? '' : 'Meeting room 1', interviewers: ['u-nam', 'u-quang', 'u-admin'], status: 'scheduled' },
  ];
}

/** Candidates turned down after interviewing keep the round and the "no" scorecards that led to it. */
function rejectedRounds(a: Application, k: number): Interview[] {
  const at = Date.parse(localHour(Date.parse(a.stageEnteredAt) - 2 * DAY));
  const strong = k % 2 === 1;
  return [{
    id: `int-${a.id}-1`, round: 'Technical interview', at: localHour(at), durationMin: 60, mode: 'online',
    place: 'https://meet.example.com/intalent', interviewers: ['u-quang', 'u-nam', 'u-admin'], status: 'done', createdBy: a.addedBy,
    scorecards: [
      { ...scorecard('u-admin', at + HOUR, k, 'no', 'Agree with the panel: not ready for this level yet.'), scores: { technical: 2, communication: 3, problem: 2, culture: 3 } },
      { ...scorecard('u-quang', at + 2 * HOUR, k, strong ? 'strong_no' : 'no', strong
        ? 'Could not explain the projects on the CV; struggled with basic data structures.'
        : 'Fine on syntax but weak on system design for this level.'), scores: { technical: 2, communication: 3, problem: 2, culture: 3 } },
      ...(k % 3 === 0 ? [] : [{ ...scorecard('u-nam', at + 3 * HOUR, k, 'no', 'Not the seniority we need right now; keep in the pool.'), scores: { technical: 2, communication: 3, problem: 3, culture: 4 } }]),
    ],
  }];
}

function offerAmount(job: Job | undefined, k: number): Pick<Offer, 'salary' | 'currency'> {
  if (job?.currency === 'USD') return { salary: 3500 + 250 * (k % 4), currency: 'USD' };
  const lo = job?.salaryMin ?? 40 * MIL;
  const hi = job?.salaryMax ?? 50 * MIL;
  return { salary: Math.round((lo + (hi - lo) * (0.4 + 0.15 * (k % 4))) / MIL) * MIL, currency: 'VND' };
}

/** Offer-stage cards rotate draft / sent / declined; hires keep their accepted offer, priced from the job. */
function offerFor(a: Application, job: Job | undefined, k: number, now: number): Offer | undefined {
  if (!a.offer) return a.offer;
  const priced = { ...a.offer, ...offerAmount(job, k) };
  if (a.stage !== 'offer') return priced;
  const { sentAt: _sent, respondedAt: _resp, ...draft } = priced;
  switch (k % 3) {
    case 0: return { ...draft, status: 'draft', note: 'Waiting for the hiring manager to confirm the start date.' };
    case 1: return { ...priced, status: 'sent' };
    default: return { ...priced, status: 'declined', respondedAt: iso(now - DAY), declineReason: 'Accepted a counter-offer from current employer' };
  }
}

// ---------------------------------------------------------------- flow detail

const ANSWERS: Record<string, string[]> = {
  'q-notice': ['30 days', '2 weeks', 'Available now'],
  'q-lead': ['I lead 4 engineers today', 'Mentored 2 juniors, no formal lead role yet', 'Led a squad of 6 for two years'],
};

const CHAT_QUERIES: Array<[days: number, text: string]> = [
  [9, 'Senior React developer, SaaS, Advanced English'],
  [3, 'Tìm dev Flutter senior có kinh nghiệm Fintech'],
  [1, 'Java backend 5 years Healthcare'],
];

/** Emails, activities, interviews, offers, answers, notes and chats layered on the base seed. */
export function withFlowDetail(s: DemoState, now: number): DemoState {
  const jobOf = (id: string) => s.jobs.find((j) => j.id === id);
  const candOf = (id: string) => s.candidates.find((c) => c.id === id);
  const userName = (id: string) => s.users.find((u) => u.id === id)?.name ?? id;
  const before = (ms: number) => Math.min(ms, now - 5 * 60_000);
  const emails: SentEmail[] = [];
  const acts: Activity[] = [];

  // Pass 1: shape each application.
  const portal = new Set(s.users.flatMap((u) => (u.candidateId ? [u.candidateId] : [])));
  let ivK = 0;
  let finalK = 0;
  let rejK = 0;
  let offerK = 0;
  const applications = s.applications.map((a): Application => {
    const job = jobOf(a.jobId);
    let next: Application = a;
    if (a.via === 'careers' && job?.questions?.length) {
      next = { ...next, answers: job.questions.map((q, n) => ({
        questionId: q.id, label: q.label,
        answer: q.type === 'yesno' ? ((a.id.charCodeAt(a.id.length - 1) + n) % 3 ? 'Yes' : 'No') : (ANSWERS[q.id] ?? ['See my CV'])[Number(a.id.slice(-1)) % 3] ?? 'See my CV',
      })) };
    }
    if (a.stage === 'rejected' && a.rejectedReason) {
      next = { ...next, history: next.history.map((h, n) => (n === next.history.length - 1 ? { ...h, note: a.rejectedReason } : h)) };
    }
    if (a.stage === 'interview') next = { ...next, interviews: interviewRounds(a, ivK++, now) };
    if (a.stage === 'final_interview') next = { ...next, interviews: finalRounds(a, finalK++, now) };
    if (a.stage === 'rejected' && !a.interviews?.length && rejK++ % 3 !== 2) next = { ...next, interviews: rejectedRounds(a, rejK) };
    // A candidate with a portal login always has a sent offer, so the demo can accept or decline it from /me.
    if (a.offer) next = { ...next, offer: offerFor(a, job, a.stage !== 'offer' ? offerK : portal.has(a.candidateId) ? 1 : offerK++, now) };
    return next;
  });

  // Pass 2: the email log and activity trail each application implies.
  for (const a of applications) {
    const job = jobOf(a.jobId);
    const c = candOf(a.candidateId);
    if (!job || !c) continue;
    const ref = { candidateId: c.id, applicationId: a.id, jobId: job.id };
    const log = (type: Activity['type'], by: string, at: number, detail: string) => acts.push({ type, ...ref, by, at: iso(before(at)), detail });
    const mail = (templateId: string, by: string, at: number, vars: Record<string, string>) => {
      const tpl = s.prompts.find((p) => p.id === templateId);
      if (!tpl || !c.email) return;
      const subject = `${tpl.name} – ${job.title}`;
      const when = iso(before(at));
      emails.push({ id: `mail-seed-${emails.length + 1}`, ...ref, templateId, to: c.email, subject, body: fillTemplate(tpl.text, { name: c.name, job: job.title, ...vars }), by, at: when });
      acts.push({ type: 'email_sent', ...ref, by, at: when, detail: `Email sent: ${subject}` });
    };

    for (const [n, ev] of (a.aiEvaluations ?? []).entries()) log('ai_evaluated', AI_ACTOR, Date.parse(ev.at) + 60_000, `AI evaluation v${n + 1}: ${ev.score}`);
    if (a.via === 'careers') mail(TEMPLATE.received, CAREERS_ACTOR, Date.parse(a.addedAt) + 60_000, {});
    const screening = a.history.find((h) => h.stage === 'screening');
    if (screening && Number(a.id.slice(-1)) % 2 === 0) mail(TEMPLATE.update, screening.by, Date.parse(screening.at) + 30 * 60_000, { stage: stageLabel('screening', 'en') });

    let booked = Date.parse(a.history.find((h) => h.stage === 'interview')?.at ?? a.stageEnteredAt);
    for (const iv of a.interviews ?? []) {
      const start = Date.parse(iv.at);
      // Booked a few days ahead, never after the round itself, never before the previous booking.
      const bookedAt = before(Math.max(booked, Math.min(start - 3 * DAY, start - 2 * HOUR)));
      log('interview_scheduled', iv.createdBy, bookedAt, `${iv.round} scheduled for ${interviewTime(iv.at)}`);
      mail(TEMPLATE.interview, iv.createdBy, bookedAt + 60_000, { time: interviewTime(iv.at), place: iv.place || 'Phone call' });
      if (iv.status === 'cancelled') log('interview_cancelled', iv.createdBy, Math.min(start - HOUR, bookedAt + 6 * HOUR), `${iv.round} cancelled`);
      for (const sc of iv.scorecards) log('scorecard_submitted', sc.by, Date.parse(sc.at), `Scorecard for ${iv.round}: ${sc.recommendation}`);
      booked = bookedAt + HOUR;
    }

    const o = a.offer;
    if (o) {
      const created = Date.parse(o.sentAt ?? o.updatedAt) - 4 * HOUR;
      log('offer_updated', o.createdBy, created, 'Offer created');
      if (o.sentAt) {
        log('offer_updated', o.createdBy, Date.parse(o.sentAt), 'Offer sent');
        mail(TEMPLATE.offer, o.createdBy, Date.parse(o.sentAt) + 60_000, {
          salary: formatMoney(o.salary, o.currency), startDate: shortDate(o.startDate), validUntil: shortDate(o.validUntil), portalLink: '/careers/login',
        });
      }
      if (o.respondedAt) log('offer_updated', o.createdBy, Date.parse(o.respondedAt), o.status === 'accepted' ? 'Offer accepted' : `Offer declined: ${o.declineReason}`);
    }
    if (a.handoff) log('handed_off', a.handoff.by, Date.parse(a.handoff.at), `Handed off to ${a.handoff.target}`);
    if (a.stage === 'rejected' && Number(a.id.slice(-1)) % 3 !== 0) mail(TEMPLATE.rejection, a.history[a.history.length - 1].by, Date.parse(a.stageEnteredAt) + 20 * 60_000, {});
  }

  // Talent Pool housekeeping: owner hand-overs, CV re-uploads merged into existing profiles, notes linked to profiles.
  const staff = s.users.filter((u) => u.role !== 'Candidate' && u.role !== 'Super Admin').map((u) => u.id);
  for (const c of s.candidates.filter((_, i) => i % 37 === 4)) {
    const from = staff.find((u) => u !== c.cvOwner)!;
    acts.push({ type: 'owner_transferred', candidateId: c.id, by: 'u-thu', at: iso(before(Date.parse(c.createdAt) + 3 * DAY)),
      detail: `CV owner changed from ${userName(from)} to ${userName(c.cvOwner)}`, from, to: c.cvOwner });
  }
  for (const c of s.candidates.filter((x) => x.source === SOURCE_CV_UPLOAD).slice(0, 3)) {
    acts.push({ type: 'candidate_merged', candidateId: c.id, by: c.cvOwner, at: iso(before(Date.parse(c.createdAt) + 5 * DAY)),
      detail: `Existing profile updated via ${SOURCE_CV_UPLOAD}` });
  }
  const linked: Record<string, string> = { 'note-03': s.candidates[11]?.id, 'note-07': s.candidates[46]?.id };
  const notes = s.notes.map((n) => {
    const cid = linked[n.id];
    if (!cid) return n;
    acts.push({ type: 'note_converted', candidateId: cid, by: n.createdBy, at: iso(before(Date.parse(n.createdAt) + DAY)), detail: 'Note linked to existing profile' });
    return { ...n, convertedToCandidateId: cid };
  });

  // Candidate portal: the logged-in candidates uploaded a new CV; the first also changed contact details.
  for (const u of s.users.filter((x) => x.candidateId)) {
    const c = candOf(u.candidateId!);
    const latest = c?.cvVersions?.[c.cvVersions.length - 1];
    if (!c || !latest) continue;
    acts.push({ type: 'candidate_self_update', candidateId: c.id, by: u.id, at: latest.at, detail: `New CV uploaded: ${latest.fileName}` });
    if (c.suggestions?.length) acts.push({ type: 'candidate_self_update', candidateId: c.id, by: u.id, at: iso(Date.parse(latest.at) + HOUR), detail: 'Candidate updated phone, location' });
  }

  // AI Search history: real answers from the seeded pool.
  const chats: ChatMessage[] = CHAT_QUERIES.flatMap(([days, text], n) => {
    const at = iso(now - days * DAY);
    const req = parseQuery(text, s.taxonomy);
    const hits = hasCriteria(req) ? searchCandidates(s.candidates, req) : [];
    const sessionId = `chat-seed-${n + 1}`;
    return [
      { sessionId, role: 'user' as const, text, at },
      { sessionId, role: 'assistant' as const, at,
        text: hits.length ? translate('en', 'assistant.reply.found', { count: hits.length }) : translate('en', 'assistant.reply.none'),
        results: hits.map((h) => ({ candidateId: h.candidate.id, score: h.score, reason: h.reason })) },
    ];
  });

  return {
    ...s,
    applications,
    notes,
    // The base seed already covers every campaign status (camp-7 is paused).
    activities: [...s.activities, ...acts].sort((x, y) => x.at.localeCompare(y.at)),
    emails: emails.sort((x, y) => x.at.localeCompare(y.at)),
    chats: [...s.chats, ...chats],
  };
}
