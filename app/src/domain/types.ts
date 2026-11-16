export type Stage = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
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
}

export interface StageHistoryEntry {
  stage: Stage;
  at: string;
  by: string;
}

export interface ApplicationComment {
  by: string;
  at: string;
  text: string;
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
  rating?: number;
  comments: ApplicationComment[];
  rejectedReason?: string;
}

export interface Job {
  id: string;
  jdId: string;
  title: string;
  department: string;
  location: string;
  level: string;
  employment: string;
  status: 'draft' | 'open' | 'closed';
  stageSla: Partial<Record<Stage, number>>;
  openedAt: string;
  hiringManager: string;
}

export interface CampaignLink {
  channel: string;
  url: string;
}

export interface Campaign {
  id: string;
  name: string;
  jobIds: string[];
  channels: string[];
  goal: number;
  start: string;
  end: string;
  status: string;
  links: CampaignLink[];
  stats: { views: number };
}

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
  | 'note_converted';

export interface Activity {
  type: ActivityType;
  candidateId?: string;
  applicationId?: string;
  jobId?: string;
  by: string;
  at: string;
  detail: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface Jd {
  id: string;
  title: string;
  body: string;
  skills: string[];
  createdAt: string;
}

export interface TaxonomyItem {
  id: string;
  kind: string;
  label: string;
  active: boolean;
}

export interface Prompt {
  id: string;
  name: string;
  text: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

export interface UiState {
  lang: Lang;
  piiUnlocked: boolean;
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
  ui: UiState;
}

export type CandidateInput = Partial<Omit<Candidate, 'id' | 'createdAt' | 'inTalentPool' | 'source'>> & {
  name: string;
};

export interface NoteInput {
  name: string;
  contact: string;
  text: string;
}
