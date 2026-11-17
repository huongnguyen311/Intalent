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
  JobInput,
  JobPatch,
  Note,
  NoteInput,
  Prompt,
  Stage,
  TaxonomyItem,
  User,
  Via,
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
  addToPipeline(
    candidateId: string,
    jobId: string,
    ctx: { via: Via; source: string; campaignId?: string; by: string },
  ): { ok: true; application: Application } | { ok: false; reason: 'duplicate'; stage: Stage };
  moveStage(appId: string, to: Stage, by: string, reason?: string): boolean;
  /** Refuses blank text and unknown applications. */
  addComment(appId: string, text: string, by: string): boolean;
  /** Integer 1-5; a reviewer rating again replaces their earlier score. */
  rateApplication(appId: string, by: string, stars: number): boolean;
  /** Public apply: dedupes the candidate, then adds to the job's pipeline. `src` is a campaign tracking code (`<campaignId>-<channel>`); unknown codes count as the careers page. */
  applyFromCareers(
    input: CandidateInput,
    jobId: string,
    src?: string,
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
  addUser(input: { name: string; email: string; role: Role }): UserResult;
  updateUser(id: string, patch: { name: string; email: string }): UserResult;
  /** The demo user cannot leave Super Admin or be deactivated ('protected'). */
  setUserRole(id: string, role: Role): UserResult;
  setUserActive(id: string, active: boolean): UserResult;
  /** Saved only; prompts and email templates are never executed. */
  updatePrompt(id: string, patch: Partial<Pick<Prompt, 'description' | 'text'>>): boolean;
  /** Moves a CV to another TA and logs an owner_transferred activity; refuses unknown candidates, no-ops and targets that are inactive or Candidate-role. */
  transferOwner(candidateId: string, toUserId: string, by: string): TransferResult;
  resetDemo(): void;
}

export type DemoStore = DemoState & DemoActions;

export interface Env {
  now: () => string;
  id: (prefix: string) => string;
}

export type Set = StoreApi<DemoStore>['setState'];
export type Get = StoreApi<DemoStore>['getState'];
