import type { StoreApi } from 'zustand';
import type {
  Application,
  Candidate,
  CandidateInput,
  CandidatePatch,
  DemoState,
  Jd,
  JdInput,
  JdPatch,
  Note,
  NoteInput,
  Stage,
  Via,
} from '../../domain/types';

export type UpdateCandidateResult =
  | { ok: true; candidate: Candidate }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'duplicate'; conflictId: string };

export type DeleteJdResult = { ok: true } | { ok: false; reason: 'not_found' } | { ok: false; reason: 'in_use'; jobs: number };

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
  addNote(input: NoteInput, by: string): Note;
  convertNote(noteId: string, by: string): { candidate: Candidate; created: boolean };
  createJd(input: JdInput): Jd;
  updateJd(id: string, patch: JdPatch): boolean;
  setJdStatus(id: string, status: 'Published' | 'Draft'): boolean;
  /** Refuses while a job still points at the JD. */
  deleteJd(id: string): DeleteJdResult;
  /** Answers `text` with a ranked candidate search; starts a new conversation when `sessionId` is null. Returns the session id. */
  sendChat(sessionId: string | null, text: string): string;
  deleteChat(sessionId: string): void;
  resetDemo(): void;
}

export type DemoStore = DemoState & DemoActions;

export interface Env {
  now: () => string;
  id: (prefix: string) => string;
}

export type Set = StoreApi<DemoStore>['setState'];
export type Get = StoreApi<DemoStore>['getState'];
