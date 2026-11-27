import { can, type Perm } from '../domain/permissions';
import type { User } from '../domain/types';
import { CURRENT_USER_ID } from '../domain/users';
import { DEFAULT_COMPANY } from '../domain/company';
import { useStore } from './store';

/** Id of the signed-in user (outside React, e.g. in event handlers). Falls back to the demo Super Admin. */
export function me(): string {
  return currentUser().id;
}

/** Used when the user list has no demo admin (e.g. the mockup fixture): full access, as before roles existed. */
const DEMO_ADMIN: User = { id: CURRENT_USER_ID, name: 'Super Admin', email: '', role: 'Super Admin', status: 'Active', createdAt: '' };

/** Nobody signed in (only possible outside the original demo workspace): no permissions at all. */
export const GUEST: User = { id: 'guest', name: 'Guest', email: '', role: 'Guest', status: 'Active', createdAt: '' };
export const isGuest = (u: Pick<User, 'id'>): boolean => u.id === GUEST.id;

/** The original demo workspace (as opposed to a tenant created through sign-up). */
const isDemoWorkspaceId = (workspaceId: string | undefined): boolean => !workspaceId || workspaceId === DEFAULT_COMPANY.workspaceId;

/** Whether the demo "View as" role switcher may show: only in the demo workspace, never in a real tenant. */
export function useIsDemoWorkspace(): boolean {
  return useStore((s) => isDemoWorkspaceId(s.company?.workspaceId));
}

/**
 * The original demo workspace keeps its "always signed in as the demo admin" behaviour; any other workspace
 * (a real tenant) requires a signed-in, active member.
 */
function resolve(users: User[], actingAs: string | undefined, workspaceId: string | undefined, signedIn: boolean | undefined): User {
  // Hosted demo (VITE_REQUIRE_LOGIN=1): nobody is signed in until they pass the login page.
  if (REQUIRE_LOGIN && !signedIn) return GUEST;
  const acting = actingAs ? users.find((u) => u.id === actingAs && u.status !== 'Inactive') : undefined;
  if (acting) return acting;
  if (!isDemoWorkspaceId(workspaceId)) return GUEST;
  return users.find((u) => u.id === CURRENT_USER_ID) || DEMO_ADMIN;
}

/** Set on the hosted build so visitors start at the login page instead of the auto-signed-in demo admin. */
const REQUIRE_LOGIN = import.meta.env.VITE_REQUIRE_LOGIN === '1';

/** The signed-in user, re-rendering when it changes. */
export function useMe(): User {
  return useStore((s) => resolve(s.users, s.ui.actingAs, s.company?.workspaceId, s.ui.signedIn));
}

export function currentUser(): User {
  const { ui, users, company } = useStore.getState();
  return resolve(users, ui.actingAs, company?.workspaceId, ui.signedIn);
}

/** Permission check for the signed-in user. */
export function useCan(): (perm: Perm) => boolean {
  const user = useMe();
  return (perm) => can(user, perm);
}

export function signInAs(userId: string | undefined): void {
  useStore.setState((s) => ({ ui: { ...s.ui, actingAs: userId, signedIn: true } }));
}

/** Log out: back to the demo admin locally, or to a guest (login page) on the hosted build. */
export function signOut(): void {
  useStore.setState((s) => ({ ui: { ...s.ui, actingAs: undefined, signedIn: false } }));
}
