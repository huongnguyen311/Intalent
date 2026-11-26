export type Stage =
  | 'new' | 'ai_screening' | 'screening' | 'interview' | 'assessment' | 'final_interview' | CustomStage | 'offer'
  | 'hired' | 'rejected' | 'withdrawn';
/** Slots for columns a job adds itself; each job names them (Job.stageNames). */
export type CustomStage = 'custom_1' | 'custom_2' | 'custom_3' | 'custom_4' | 'custom_5' | 'custom_6';
export type Via = 'careers' | 'talent_pool' | 'campaign' | 'manual';
export type Lang = 'en' | 'vi';

export interface Candidate {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  seniority: string;
  english: string;
  skills: string[];
  domains: string[];
  tags: string[];
  groups: string[];
  cvOwner: string;
  source: string;
  inTalentPool: true;
  createdAt: string;
  cv: string;
  linkedin?: string;
  /** Optional profile detail; absent for candidates created from a bare intake form. */
  summary?: string;
  /** CV tagline and city, used only to render the original-document pane. */
  headline?: string;
  location?: string;
  /** Expected pay in USD per month; absent means "Contact for rate". Used by JD Matching's Max Rate filter. */
  expectedRate?: number;
  /** Shown as "Primary Skills" on the profile; falls back to `skills`. */
  primarySkills?: string[];
  secondarySkills?: string[];
  techStack?: string[];
  openToWork?: boolean;
  experience?: WorkExperience[];
  education?: EducationEntry[];
  /** Original-document-only CV content (not structured profile fields). */
  address?: string;
  competencies?: CvCompetency[];
  projects?: CvProject[];
  certifications?: string[];
  /** e.g. "English — IELTS 7.0". */
  languages?: string[];
  /** Uploaded CV files, newest last (simulated: file name only). */
  cvVersions?: CvVersion[];
  /** Changes the candidate proposed to HR-standardised fields, waiting for review. */
  suggestions?: ProfileSuggestion[];
  /** Privacy consents captured from the candidate (PRD 6 `consents`). */
  consents?: Consent[];
  /** Set when PII was erased on request (PRD AC-12); the record stays for reporting. */
  anonymizedAt?: string;
  /** Latest AI CV parse (PRD 3.4 / AC-07): per-field confidence and fields the CV did not contain. */
  parse?: ParseResult;
  /** Last staff or candidate edit of the profile (user id + ISO time). */
  updatedBy?: string;
  updatedAt?: string;
}

export interface Consent {
  purpose: 'recruitment';
  policyVersion: string;
  at: string;
  withdrawnAt?: string;
}

export type ParseField = 'name' | 'email' | 'phone' | 'title' | 'seniority' | 'english' | 'skills';
export const PARSE_FIELDS: ParseField[] = ['name', 'email', 'phone', 'title', 'seniority', 'english', 'skills'];

export interface ParseResult {
  model: string;
  at: string;
  /** 0..1 per extracted field. */
  confidence: Partial<Record<ParseField, number>>;
  /** Fields left empty because the CV did not contain them (never invented). */
  missing: ParseField[];
  /** Set once HR has checked the uncertain fields. */
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface CvVersion {
  id: string;
  fileName: string;
  at: string;
  /** User id; a candidate account id when the candidate uploaded it themselves. */
  by: string;
}

/** Fields a candidate may only propose; HR approves or rejects. */
export type SuggestField = 'seniority' | 'english' | 'skills';
export const SUGGEST_FIELDS: SuggestField[] = ['seniority', 'english', 'skills'];

export interface ProfileSuggestion {
  id: string;
  field: SuggestField;
  /** `skills` holds the full proposed list; the others a single label. */
  value: string | string[];
  at: string;
}

/** Contact fields a candidate may change directly. */
export type SelfServicePatch = Partial<Pick<Candidate, 'email' | 'phone' | 'linkedin' | 'location' | 'openToWork'>>

export interface WorkExperience {
  title: string;
  company: string;
  /** YYYY-MM */
  start: string;
  end: string;
  description: string;
  /** CV bullet points for this job, as written in the original document; `sub` are nested bullets. */
  highlights?: CvBullet[];
}

export interface CvBullet {
  text: string;
  sub?: string[];
}

/** "Label: text" line of the CV's Core Competencies block. */
export interface CvCompetency {
  label: string;
  text: string;
}

export interface CvProject {
  name: string;
  role: string;
  /** YYYY-MM – YYYY-MM or free text. */
  period: string;
  description: string;
  tech: string[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
}

export interface StageHistoryEntry {
  stage: Stage;
  at: string;
  by: string;
  /** Optional note typed when the card was moved here. */
  note?: string;
  /** Set when a pipeline automation rule made the move (`by` is then the automation actor). */
  ruleId?: string;
}

export interface ApplicationComment {
  by: string;
  at: string;
  text: string;
}

/** One reviewer's score; each user keeps at most one rating per application. */
export interface ApplicationRating {
  by: string;
  stars: number;
  at: string;
}

export type InterviewMode = 'onsite' | 'online' | 'phone';
export type Recommendation = 'strong_yes' | 'yes' | 'no' | 'strong_no';
export const SCORE_CRITERIA = ['technical', 'communication', 'problem', 'culture'] as const;
export type ScoreCriterion = (typeof SCORE_CRITERIA)[number];

/** One line of a scorecard. Skills carry the JD's own wording; core competencies are named by `key` (i18n). */
export interface ScoreCriterionDef {
  key: string;
  group: 'skill' | 'core';
  label?: string;
}

/** One interviewer's evaluation of one interview round. */
export interface Scorecard {
  by: string;
  at: string;
  /** 1–5 per criterion key; a skill the interviewer did not probe is left out. */
  scores: Record<string, number>;
  /** The criteria this card was scored on (built for the job and round); absent on older cards (SCORE_CRITERIA). */
  criteria?: ScoreCriterionDef[];
  recommendation: Recommendation;
  note?: string;
}

export interface Interview {
  id: string;
  round: string;
  /** Local start time, ISO without zone (YYYY-MM-DDTHH:mm), in `timeZone`. */
  at: string;
  /** IANA zone of whoever scheduled it (e.g. Asia/Ho_Chi_Minh); absent on older records. */
  timeZone?: string;
  durationMin: number;
  mode: InterviewMode;
  /** Room, address or meeting link. */
  place: string;
  interviewers: string[];
  status: 'scheduled' | 'done' | 'cancelled';
  scorecards: Scorecard[];
  createdBy: string;
}

export type InterviewInput = Pick<Interview, 'round' | 'at' | 'durationMin' | 'mode' | 'place' | 'interviewers'> & Pick<Partial<Interview>, 'timeZone'>;

export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'declined';

export interface Offer {
  salary: number;
  currency: Currency;
  startDate: string;
  contract: string;
  validUntil: string;
  note?: string;
  status: OfferStatus;
  createdBy: string;
  updatedAt: string;
  sentAt?: string;
  respondedAt?: string;
  declineReason?: string;
}

export type OfferInput = Pick<Offer, 'salary' | 'currency' | 'startDate' | 'contract' | 'validUntil' | 'note'>;

export interface Handoff {
  at: string;
  by: string;
  target: string;
}

export type AiCriterion = 'stack' | 'experience' | 'domain' | 'english';

/**
 * One strength or gap, stored as an i18n key + params so it renders in the viewer's language.
 * `evidence` is a verbatim sentence from the CV, absent when none was found.
 */
export interface AiFinding {
  criterion: AiCriterion;
  key: string;
  params?: Record<string, string | number>;
  evidence?: string;
}

export interface AiQuestion {
  key: string;
  params?: Record<string, string | number>;
}

/** One AI run on an application (PRD `ai_evaluations`); an application keeps every version, newest last. */
export interface AiEvaluation {
  id: string;
  score: number;
  breakdown: { key: AiCriterion; points: number; max: number }[];
  strengths: AiFinding[];
  gaps: AiFinding[];
  questions: AiQuestion[];
  /** The JD had nothing to match against; `score` is 0 and the UI shows a dash instead. */
  noCriteria?: boolean;
  model: 'intalent-match-v1';
  at: string;
}

export interface ApplicationAnswer {
  questionId: string;
  label: string;
  answer: string;
}

/** A (simulated) email sent to a candidate. */
export interface SentEmail {
  id: string;
  candidateId: string;
  applicationId?: string;
  templateId?: string;
  to: string;
  subject: string;
  body: string;
  by: string;
  at: string;
}

export interface Application {
  id: string;
  candidateId: string;
  jobId: string;
  stage: Stage;
  source: string;
  via: Via;
  campaignId?: string;
  addedBy: string;
  addedAt: string;
  stageEnteredAt: string;
  history: StageHistoryEntry[];
  ratings?: ApplicationRating[];
  comments: ApplicationComment[];
  rejectedReason?: string;
  /** Rejection category for reporting; the free-text reason adds detail. */
  rejectedCode?: RejectCode;
  interviews?: Interview[];
  offer?: Offer;
  /** Set once the hire is passed to the internal onboarding tool; the application is then read-only. */
  handoff?: Handoff;
  /** Answers to the job's application questions (careers applications only). */
  answers?: ApplicationAnswer[];
  /** AI runs on this application, newest last; the UI shows the latest. */
  aiEvaluations?: AiEvaluation[];
  /** Waiting in the (simulated) AI queue. */
  aiPending?: boolean;
}

/** ISO 4217 codes offered in the salary pickers (PRD 6.1: never assume USD). */
export const CURRENCIES = ['VND', 'USD', 'EUR', 'SGD', 'JPY', 'AUD', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Workplace = 'onsite' | 'hybrid' | 'remote';
export const WORKPLACES: Workplace[] = ['onsite', 'hybrid', 'remote'];

export interface JobQuestion {
  id: string;
  label: string;
  type: 'text' | 'yesno';
  required: boolean;
}

/** How pressing a job's hiring is; `urgent` and `critical` count as urgent hiring. */
export const HIRING_PRIORITIES = ['normal', 'high', 'urgent', 'critical'] as const;
export type HiringPriority = (typeof HIRING_PRIORITIES)[number];

export interface Job {
  id: string;
  /** Undefined reads as `normal`. */
  hiringPriority?: HiringPriority;
  /** Date the job should be filled by (YYYY-MM-DD); past it with open seats, the job is overdue. */
  targetHiringDate?: string;
  /** Why the job has this priority (who approved it, deadline driver, on-hold reason); shown on the priority badge. */
  urgencyReason?: string;
  jdId: string;
  title: string;
  department: string;
  location: string;
  level: string;
  employment: string;
  /** PRD 3.2: onsite / hybrid / remote. */
  workplace?: Workplace;
  /** PRD 3.2: how many people this job hires. */
  headcount?: number;
  /** The campaign this job runs in; careers-page applicants are credited to it while it is active. */
  campaignId?: string;
  /** PRD 3.2: On Hold pauses intake (off the careers page) while the pipeline keeps working.
   *  `pending_approval` waits for a Recruitment Lead / Super Admin before it goes public. */
  status: 'draft' | 'pending_approval' | 'open' | 'on_hold' | 'closed';
  /** Last approval round: who asked, who decided, and the reason when it was sent back. */
  approval?: JobApproval;
  /** Minimum years of experience; overrides the years read from the JD when scoring. */
  minYears?: number;
  /** Lowest education level accepted. */
  education?: Education;
  /** Set on every create/edit/status change; seeded jobs fall back to their latest activity. */
  updatedAt?: string;
  stageSla: Partial<Record<Stage, number>>;
  openedAt: string;
  hiringManager: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: Currency;
  /** Show the salary range on the public careers page. */
  showSalary?: boolean;
  /** Staff who work on this job alongside the hiring manager. */
  collaborators?: string[];
  /** Default interview panel for this job (besides the hiring manager). */
  interviewers?: string[];
  questions?: JobQuestion[];
  /** Careers-page "Why you'll love working here"; starts from the company template. */
  whyLove?: string;
  /** Careers-page "Additional information" (location, hours, process...). */
  additionalInfo?: string;
  /** Careers-page copy, filled from the JD when it is picked (see domain/jobPost); the JD stays the source for AI matching. */
  summary?: string;
  responsibilities?: string[];
  aboutTeam?: string;
  skills?: string[];
  mustHave?: string[];
  niceToHave?: string[];
  /** The job's middle columns in board order (see OPTIONAL_STAGES; may include 'withdrawn'); undefined = DEFAULT_PIPELINE. */
  pipeline?: Stage[];
  /** Column names this job uses instead of the standard labels (required for custom columns). */
  stageNames?: Partial<Record<Stage, string>>;
  /** Stage automation rules, checked in order; the first match moves the card. */
  automations?: AutomationRule[];
}

export type RejectCode = 'skills' | 'experience' | 'salary' | 'culture' | 'english' | 'no_response' | 'filled' | 'other';

/** "When a card is in `from` and <condition>, move it to `to`." Score conditions use the latest AI score. */
export interface AutomationRule {
  id: string;
  enabled: boolean;
  from: Stage;
  when: 'on_enter' | 'score_gte' | 'score_lt';
  score?: number;
  to: Stage;
  /** Required when `to` is Rejected. */
  rejectCode?: RejectCode;
}

export const EDUCATIONS = ['any', 'college', 'bachelor', 'master', 'phd'] as const;
export type Education = (typeof EDUCATIONS)[number];

export interface JobApproval {
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  /** Set when the approver sent the job back to draft. */
  rejectedReason?: string;
}

export const CAMPAIGN_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type CampaignPriority = (typeof CAMPAIGN_PRIORITIES)[number];
export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface Campaign {
  id: string;
  /** CMP-<year>-<NNN>, set on create and never edited. */
  code: string;
  name: string;
  description?: string;
  /** User id of the HR person running the campaign. */
  owner: string;
  priority?: CampaignPriority;
  start: string;
  end: string;
  applicationDeadline?: string;
  /** Stored status; read it through effectiveStatus (a scheduled campaign turns active on its start date). */
  status: CampaignStatus;
  /** Jobs join a campaign from the job form (Job.campaignId); each job's openings are its hiring target. */
  goals: {
    targetApplicants?: number;
    budget?: number;
    currency?: Currency;
  };
  /** `views` is 0 for campaigns without recorded traffic; campaignStats then simulates it. */
  stats: { views: number };
  createdAt: string;
}

export type CampaignInput = Omit<Campaign, 'id' | 'code' | 'status' | 'stats' | 'createdAt'>;
export type CampaignPatch = Partial<CampaignInput>;

export interface Note {
  id: string;
  name: string;
  contact: string;
  text: string;
  createdBy: string;
  createdAt: string;
  convertedToCandidateId?: string;
}

export type ActivityType =
  | 'candidate_created'
  | 'candidate_merged'
  | 'added_to_pipeline'
  | 'stage_changed'
  | 'note_added'
  | 'note_converted'
  | 'owner_transferred'
  | 'email_sent'
  | 'interview_scheduled'
  | 'interview_cancelled'
  | 'scorecard_submitted'
  | 'offer_updated'
  | 'handed_off'
  | 'candidate_self_update'
  | 'suggestion_reviewed'
  | 'ai_evaluated'
  // Audit-only events (PRD 3.1 "Audit events").
  | 'consent_captured'
  | 'candidate_anonymized'
  | 'job_created'
  | 'job_status_changed'
  | 'job_approval_requested'
  | 'job_approved'
  | 'job_rejected'
  | 'user_invited'
  | 'user_joined'
  | 'user_role_changed'
  | 'user_status_changed'
  | 'settings_updated';

export interface Activity {
  type: ActivityType;
  candidateId?: string;
  applicationId?: string;
  jobId?: string;
  by: string;
  at: string;
  detail: string;
  /** User the event is about (user_* events). */
  userId?: string;
  /** owner_transferred only: previous and new CV owner (user ids; the fixture may hold display names). */
  from?: string;
  to?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  /** Candidate accounts only: the Talent Pool profile this login edits. */
  candidateId?: string;
  /** Set once the user chose a password (sign-up, invitation, reset); demo seed users have none and accept any. */
  passwordHash?: string;
}

export interface Jd {
  id: string;
  /** Human-facing code, e.g. JD-2026-004. */
  code: string;
  title: string;
  client: string;
  domains: string[];
  body: string;
  skills: string[];
  /** 'Published' or 'Draft'. */
  status: string;
  /** Bullet requirements shown on JD Detail; derived from the body when absent. */
  mustHave?: string[];
  /** Careers-page "Your skills and experience" section. */
  skillsExperience?: string;
  /** Structured requirements from the full-page editor (prod "Refine Requirements"); absent on older JDs. */
  niceToHave?: string[];
  seniority?: string;
  minYears?: number;
  english?: string;
  /** ISO date the hire should start. */
  availableFrom?: string;
  location?: string;
  workingModel?: 'Onsite' | 'Hybrid' | 'Remote';
  /** One item per line in the editor. */
  responsibilities?: string[];
  /** Short pitch of the role shown first to candidates. */
  summary?: string;
  aboutTeam?: string;
  dailyTasks?: string[];
  /** Lowest education accepted, same scale as Job.education. */
  education?: Education;
  major?: string;
  /** Languages besides English, e.g. "Japanese - N2". */
  languages?: string[];
  certifications?: string[];
  otherRequirements?: string;
  /** Tech-stack skills HR marked critical; they weigh double in matching. */
  criticalSkills?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaxonomyItem {
  id: string;
  kind: 'english' | 'domain' | 'seniority';
  label: string;
  active: boolean;
  usage: number;
  updatedAt: string;
}

export interface Prompt {
  id: string;
  name: string;
  description: string;
  text: string;
  updatedAt: string;
}

/** One ranked candidate in an AI Search answer. */
export interface ChatResult {
  candidateId: string;
  score: number;
  reason: string;
}

export interface ChatMessage {
  /** Messages sharing a sessionId form one conversation in the history sidebar. */
  sessionId: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  results?: ChatResult[];
}

export interface UiState {
  lang: Lang;
  /** Public careers site language; independent of the internal UI language. */
  careersLang: Lang;
  piiUnlocked: boolean;
  /** Signed-in user id (demo role switcher / candidate login); absent = the demo Super Admin. */
  actingAs?: string;
  /** Per user: when they last opened the notification bell (ISO). */
  notifSeen?: Record<string, string>;
}

export interface TaRow {
  name: string;
  newCv: number;
  duplicateUploads: number;
  parseFailed: number;
  processing: number;
  received: number;
  transferredOut: number;
  total: number;
}

export interface Labeled {
  label: string;
}

/** Mockup-only figures that 10 candidate rows cannot produce; absent from the regular seed. */
export interface MockupTotals {
  dashboard: {
    totalCandidates: number;
    activeCandidates: number;
    parsing: { ok: number; of: number };
    missingEmail: number;
    topStacks: Array<Labeled & { pct: number; color: string }>;
    seniority: Array<Labeled & { count: number }>;
    contributors: Array<{ name: string; total: number; newCv: number }>;
    availableStacks: Array<Labeled & { count: number; pct: number }>;
    english: Array<Labeled & { count: number; color: string }>;
    domains: Array<Labeled & { pct: number }>;
  };
  users: { total: number; superAdmins: number; admins: number; users: number };
  taContribution: { rows: TaRow[]; totals: TaRow };
}

/** The fixed JD Matching run the mockup shows (its 8 rows are fictional people, not store candidates). */
export interface MockupMatching {
  jdId: string;
  /** English requirement as the mockup words it. */
  english: string;
  scanned: number;
  strong: number;
  partial: number;
  lastRun: { time: string; date: string };
  rows: MatchRow[];
}

export interface MatchRow {
  candidateId: string;
  name: string;
  title: string;
  score: number;
  seniority: string;
  years: number;
  english: string;
  have: string[];
  miss: string[];
  reason: string;
  location?: string;
  /** USD per month (see Candidate.expectedRate). */
  rate?: number;
  /** Points per criterion; shown in the score's "why" popover. */
  breakdown?: { stack: number; experience: number; domain: number; english: number };
}

export interface DemoMeta {
  totals?: MockupTotals;
  matching?: MockupMatching;
}

export interface DemoState {
  candidates: Candidate[];
  applications: Application[];
  jobs: Job[];
  campaigns: Campaign[];
  notes: Note[];
  activities: Activity[];
  users: User[];
  jds: Jd[];
  taxonomy: TaxonomyItem[];
  prompts: Prompt[];
  chats: ChatMessage[];
  emails: SentEmail[];
  ui: UiState;
  /** Workspace profile; absent in older saves (see companyOf). */
  company?: import('./company').CompanySettings;
  /** Fixture-only overrides; undefined for the regular seed. */
  meta?: DemoMeta;
}

/** Fields an edit may change; identity, creation time and pool membership are fixed. */
export type CandidatePatch = Partial<Omit<Candidate, 'id' | 'createdAt' | 'inTalentPool'>>;

export type CandidateInput = Partial<Omit<Candidate, 'id' | 'createdAt' | 'inTalentPool' | 'source'>> & {
  name: string;
};

export interface JdInput extends JdDetails {
  title: string;
  client?: string;
  domains: string[];
  skills: string[];
  body: string;
  status?: string;
  mustHave?: string[];
  skillsExperience?: string;
}

/** Optional structured fields shared by Jd and JdInput. */
export type JdDetails = Pick<Jd, 'niceToHave' | 'seniority' | 'minYears' | 'english' | 'availableFrom' | 'location' | 'workingModel' | 'responsibilities' | 'summary' | 'aboutTeam' | 'dailyTasks' | 'education' | 'major' | 'languages' | 'certifications' | 'otherRequirements' | 'criticalSkills'>;

export type JdPatch = Partial<Omit<JdInput, 'status'>>;

export type JobInput = Omit<Job, 'id' | 'openedAt' | 'updatedAt'>;
export type JobPatch = Partial<Omit<Job, 'id' | 'openedAt' | 'updatedAt'>>;

export interface NoteInput {
  name: string;
  contact: string;
  text: string;
}
