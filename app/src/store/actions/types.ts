import type { StoreApi } from 'zustand';
import type {
  Application,
  Campaign,
  CampaignInput,
  CampaignPatch,
  CampaignStatus,
  Candidate,
  CandidateInput,
  CandidatePatch,
  DemoState,
  Jd,
  JdInput,
  JdPatch,
  Job,
  JobTemplate,
  JobTemplateFields,
  JobInput,
  JobPatch,
  Note,
  NoteInput,
  ApplicationAnswer,
  Interview,
  InterviewInput,
  OfferInput,
  Prompt,
  Scorecard,
  SelfServicePatch,
  SuggestField,
  CvVersion,
  SentEmail,
  Stage,
  TaxonomyItem,
  User,
  Via,
  AiEvaluation,
  RejectCode,
} from '../../domain/types';
import type { Role } from '../../domain/users';

export type UpdateCandidateResult =
  | { ok: true; candidate: Candidate }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'duplicate'; conflictId: string };

export type DeleteJdResult = { ok: true } | { ok: false; reason: 'not_found' } | { ok: false; reason: 'in_use'; jobs: number };

export type TaxonomyResult =
  | { ok: true; item: TaxonomyItem }
  | { ok: false; reason: 'empty' | 'duplicate' | 'not_found' };
export type UserResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid' | 'duplicate' | 'not_found' | 'protected' };

export type TransferResult = { ok: true } | { ok: false; reason: 'not_found' | 'same_owner' | 'not_assignable' };

export interface DemoActions {
  upsertCandidate(
    input: CandidateInput,
    ctx: { source: string; by: string },
  ): { candidate: Candidate; created: boolean };
  updateCandidate(id: string, patch: CandidatePatch): UpdateCandidateResult;
  /** PRD AC-12: erases PII (contact, CV, files, emails), withdraws consents, logs an audit event. False if unknown or already done. */
  anonymizeCandidate(id: string, by: string): boolean;
  addToPipeline(
    candidateId: string,
    jobId: string,
    ctx: { via: Via; source: string; campaignId?: string; by: string },
  ): { ok: true; application: Application } | { ok: false; reason: 'duplicate'; stage: Stage }
    | { ok: false; reason: 'job_not_open' };
  /** Moving out of `rejected` clears the rejection reason. */
  /** Rejected needs a reason or `opts.code`. `opts.ruleId` marks a move made by a pipeline automation. */
  moveStage(appId: string, to: Stage, by: string, reason?: string, note?: string, opts?: { code?: RejectCode; ruleId?: string }): boolean;
  /** Appends a new AI evaluation version and clears `aiPending`, then runs the job's automation rules (none = the card stays). Undefined for unknown or handed-off applications. */
  runAiEvaluation(appId: string, by: string): AiEvaluation | undefined;
  /** Applies the job's matching automation rules (chained, at most a few hops); returns how many moves were made. */
  runAutomations(appId: string): number;
  /** Refuses blank text and unknown applications. */
  addComment(appId: string, text: string, by: string): boolean;
  /** Integer 1-5; a reviewer rating again replaces their earlier score. */
  rateApplication(appId: string, by: string, stars: number): boolean;
  /** Public apply: dedupes the candidate, then adds to the job's pipeline. `src` is a campaign tracking code (`<campaignId>-<channel>`); unknown codes count as the careers page. */
  applyFromCareers(
    input: CandidateInput,
    jobId: string,
    src?: string,
    answers?: ApplicationAnswer[],
  ): { ok: true; application: Application; created: boolean } | { ok: false; reason: 'unavailable' } | { ok: false; reason: 'duplicate'; stage: Stage };
  addNote(input: NoteInput, by: string): Note;
  convertNote(noteId: string, by: string): { candidate: Candidate; created: boolean };
  createJd(input: JdInput): Jd;
  updateJd(id: string, patch: JdPatch): boolean;
  setJdStatus(id: string, status: 'Published' | 'Draft'): boolean;
  /** Refuses while a job still points at the JD. */
  deleteJd(id: string): DeleteJdResult;
  /** Created jobs get `openedAt` = now; `status: 'open'` makes them public on the careers site. */
  createJob(input: JobInput): Job;
  updateJob(id: string, patch: JobPatch): boolean;
  /** Re-opening a draft or closed job restarts its days-open clock. */
  setJobStatus(id: string, status: Job['status']): boolean;
  /** Draft -> pending_approval; the request is stamped with the signed-in user. */
  requestJobApproval(id: string): boolean;
  /** pending_approval -> open (published). */
  approveJob(id: string): boolean;
  /** pending_approval -> draft with the reason kept on the job; a blank reason is refused. */
  rejectJob(id: string, reason: string): boolean;
  saveJobTemplate(name: string, fields: JobTemplateFields): JobTemplate;
  deleteJobTemplate(id: string): boolean;
  /** New campaigns start active (`id` lets the wizard preview final links beforehand); tracking links are generated from the current origin. */
  createCampaign(input: CampaignInput, id?: string): Campaign;
  /** Regenerates the tracking links. */
  updateCampaign(id: string, patch: CampaignPatch): boolean;
  setCampaignStatus(id: string, status: CampaignStatus): boolean;
  /** Answers `text` with a ranked candidate search; starts a new conversation when `sessionId` is null. Returns the session id. */
  sendChat(sessionId: string | null, text: string): string;
  deleteChat(sessionId: string): void;
  addTaxonomy(kind: TaxonomyItem['kind'], label: string): TaxonomyResult;
  /** Also rewrites the label on every candidate using it. */
  renameTaxonomy(id: string, label: string): TaxonomyResult;
  setTaxonomyActive(id: string, active: boolean): boolean;
  /** New users start Invited (PRD 3.1): they become Active when they accept, i.e. first sign in. */
  addUser(input: { name: string; email: string; role: Role }): UserResult;
  /** Invited -> Active, logged as user_joined. */
  acceptInvitation(id: string, patch?: { name?: string; passwordHash?: string }): UserResult;
  /** Stores a new (demo-hashed) password and logs it. */
  setUserPassword(id: string, passwordHash: string): UserResult;
  /** Saves the workspace profile and logs settings_updated. */
  updateCompany(patch: Partial<import('../../domain/company').CompanySettings>): void;
  updateUser(id: string, patch: { name: string; email: string }): UserResult;
  /** The demo user cannot leave Super Admin or be deactivated ('protected'). */
  setUserRole(id: string, role: Role): UserResult;
  setUserActive(id: string, active: boolean): UserResult;
  /** Saved only; prompts and email templates are never executed. */
  updatePrompt(id: string, patch: Partial<Pick<Prompt, 'description' | 'text'>>): boolean;
  /** Moves a CV to another TA and logs an owner_transferred activity; refuses unknown candidates, no-ops and targets that are inactive or Candidate-role. */
  transferOwner(candidateId: string, toUserId: string, by: string): TransferResult;
  /** Simulated send: logs the email; null when the candidate has no email or subject/body is blank. */
  sendEmail(
    input: { candidateId: string; applicationId?: string; templateId?: string; subject: string; body: string },
    by: string,
  ): SentEmail | null;
  /** Needs a round name, a time and at least one interviewer; moves New/Screening cards to Interview. */
  scheduleInterview(appId: string, input: InterviewInput, by: string): Interview | null;
  cancelInterview(appId: string, interviewId: string, by: string): boolean;
  /** One scorecard per interviewer per round (a resubmit replaces it); marks the round done. */
  submitScorecard(appId: string, interviewId: string, input: Pick<Scorecard, 'scores' | 'recommendation' | 'note'>, by: string): boolean;
  /** Creates or edits the offer as a draft; moves earlier cards to Offer. Refused once accepted. */
  saveOffer(appId: string, input: OfferInput, by: string): boolean;
  markOfferSent(appId: string, by: string): boolean;
  /** Only a sent offer can be answered; declining needs a reason; accepting moves the card to Hired. */
  respondOffer(appId: string, accepted: boolean, by: string, reason?: string): boolean;
  /** Hired only; afterwards the application is read-only. */
  handOff(appId: string, by: string): boolean;
  /** Candidate login by email: returns the linked Candidate account, creating it on first sign-in; null when no profile has that email. */
  candidateSignIn(email: string): User | null;
  /** Contact fields and "Open to work" take effect at once (same duplicate rules as HR edits). */
  selfUpdate(candidateId: string, patch: SelfServicePatch, by: string): UpdateCandidateResult | { ok: false; reason: 'no_contact' };
  uploadCvVersion(candidateId: string, fileName: string, by: string): CvVersion | null;
  /** Proposes a value for an HR-standardised field (one pending proposal per field; proposing the current value withdraws it). */
  suggestChange(candidateId: string, field: SuggestField, value: string | string[]): boolean;
  /** Approving applies the proposed value; either way the proposal is removed and logged. */
  reviewSuggestion(candidateId: string, suggestionId: string, approve: boolean, by: string): boolean;
  resetDemo(): void;
}

export type DemoStore = DemoState & DemoActions;

export interface Env {
  now: () => string;
  id: (prefix: string) => string;
}

export type Set = StoreApi<DemoStore>['setState'];
export type Get = StoreApi<DemoStore>['getState'];
