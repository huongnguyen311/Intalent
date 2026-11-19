import { companyOf, type CompanySettings } from '../../domain/company';
import { normalizeEmail } from '../../domain/normalize';
import type { User } from '../../domain/types';
import {
  activeWorkspaceId, DEFAULT_WS, demoHash, issueToken, listWorkspaces, sendMail, workspaceUsers, type WorkspaceEntry,
} from '../../store/platform';
import { useStore } from '../../store/store';
import { buildSeed } from '../../data/seed';

let seedCache: User[] | undefined;
const seedUsers = (): User[] => (seedCache ??= buildSeed().users);

export type Account = { workspace: WorkspaceEntry; user: Pick<User, 'id' | 'email' | 'status' | 'role' | 'passwordHash'> };

/** Every staff account with this email, active workspace first (a person may belong to several workspaces). */
export function findAccounts(email: string): Account[] {
  const e = normalizeEmail(email);
  if (!e) return [];
  const active = activeWorkspaceId();
  const out: Account[] = [];
  for (const ws of listWorkspaces()) {
    const saved = ws.id === active ? useStore.getState().users : workspaceUsers(ws.id);
    // The original demo may never have been saved in this browser: its accounts are the seed's.
    const users = saved.length === 0 && ws.id === DEFAULT_WS ? seedUsers() : saved;
    const u = users.find((x) => normalizeEmail(x.email) === e && x.status !== 'Inactive' && x.role !== 'Candidate');
    if (u) out.push({ workspace: ws, user: u });
  }
  return out.sort((a, b) => Number(b.workspace.id === active) - Number(a.workspace.id === active));
}

/** Seed users have no password (any is accepted); everyone else must match. */
export const passwordMatches = (user: Pick<User, 'passwordHash'>, password: string): boolean =>
  !user.passwordHash || user.passwordHash === demoHash(password);

const origin = () => (typeof window === 'undefined' ? '' : window.location.origin);

/** Sends (to the demo mailbox) the invitation email for a user of the active workspace. */
export function sendInvitation(
  user: Pick<User, 'id' | 'email' | 'name' | 'role'>,
  invitedBy: string,
  company: CompanySettings = companyOf(useStore.getState()),
): void {
  const tok = issueToken('invite', user.email, { workspaceId: company.workspaceId, userId: user.id });
  sendMail({
    to: normalizeEmail(user.email),
    workspace: company.name,
    subject: `${invitedBy} invited you to ${company.name} on InTalent`,
    body: `Hi ${user.name},\n\n${invitedBy} invited you to join ${company.name} on InTalent as ${user.role}.\nThe link is valid for 7 days.`,
    action: { label: 'Accept invitation', href: `${origin()}/invite?token=${tok.token}` },
  });
}

export function sendVerification(email: string, name: string): string {
  const tok = issueToken('verify', email);
  sendMail({
    to: normalizeEmail(email),
    subject: 'Verify your email for InTalent',
    body: `Hi ${name},\n\nConfirm this address to finish creating your InTalent workspace. The link is valid for 24 hours.`,
    action: { label: 'Verify email', href: `${origin()}/verify?token=${tok.token}` },
  });
  return tok.token;
}

/** Only accounts that exist get a mail; the page answers the same either way. */
export function sendPasswordReset(email: string): void {
  for (const a of findAccounts(email)) {
    const tok = issueToken('reset', a.user.email, { workspaceId: a.workspace.id, userId: a.user.id });
    sendMail({
      to: normalizeEmail(a.user.email),
      workspace: a.workspace.name,
      subject: `Reset your InTalent password (${a.workspace.name})`,
      body: 'Someone asked to reset the password of this account. The link is valid for 1 hour. Ignore this email if it was not you.',
      action: { label: 'Choose a new password', href: `${origin()}/reset-password?token=${tok.token}` },
    });
  }
}
