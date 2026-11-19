import type { CompanySettings } from '../domain/company';
import type { DemoState, User } from '../domain/types';
import { buildSeed } from './seed';

export interface NewWorkspaceInput {
  company: CompanySettings;
  owner: User;
  /** Copy the demo's jobs, candidates and staff in, so a trial has something to explore. */
  sampleData: boolean;
}

/**
 * Starting data for a newly created workspace (PRD 4.1). Empty by default: only the owner, the product's
 * default prompts / email templates and an empty taxonomy. Nothing from any other workspace is copied.
 */
export function newWorkspaceState({ company, owner, sampleData }: NewWorkspaceInput): DemoState {
  const seed = buildSeed(undefined, Date.now());
  const ui = { lang: company.language, careersLang: company.language, piiUnlocked: false, actingAs: owner.id };
  const joined = {
    type: 'user_joined' as const, userId: owner.id, by: owner.id, at: owner.createdAt.length > 10 ? owner.createdAt : new Date().toISOString(),
    detail: `Workspace ${company.name} created`,
  };
  if (sampleData) {
    return { ...seed, users: [owner, ...seed.users.filter((u) => u.email !== owner.email)], activities: [...seed.activities, joined], company, ui };
  }
  return {
    candidates: [], applications: [], jobs: [], campaigns: [], notes: [], activities: [joined],
    users: [owner], jds: [], taxonomy: [], prompts: seed.prompts, chats: [], emails: [],
    company, ui,
  };
}

/** Empty workspace used when a non-default workspace has no valid saved data. */
export function blankWorkspace(company: CompanySettings): DemoState {
  const seed = buildSeed(undefined, Date.now());
  return {
    candidates: [], applications: [], jobs: [], campaigns: [], notes: [], activities: [],
    users: [], jds: [], taxonomy: [], prompts: seed.prompts, chats: [], emails: [],
    company, ui: { lang: company.language, careersLang: company.language, piiUnlocked: false },
  };
}
