/**
 * Browser-side stand-ins for what a backend would own: the workspace (tenant) registry, a demo mailbox that
 * receives every email the product "sends", and one-time tokens behind the links in those emails.
 * All of it lives in localStorage next to (not inside) each workspace's own data, so workspaces stay isolated.
 */
import { DEFAULT_COMPANY } from '../domain/company';
import { PERSIST_KEY } from './persist';

export const DEFAULT_WS = DEFAULT_COMPANY.workspaceId;
const REGISTRY_KEY = 'intalent-workspaces';
const ACTIVE_KEY = 'intalent-active-ws';
const MAILBOX_KEY = 'intalent-mailbox';
const TOKENS_KEY = 'intalent-tokens';
const PENDING_LOGIN_KEY = 'intalent-pending-login';

export interface WorkspaceEntry {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface MailMessage {
  id: string;
  to: string;
  subject: string;
  body: string;
  /** Button in the message (verification, reset, invitation links). */
  action?: { label: string; href: string };
  /** Workspace that sent it; absent for platform mail (sign-up). */
  workspace?: string;
  at: string;
}

export type TokenKind = 'verify' | 'reset' | 'invite';
export interface Token {
  token: string;
  kind: TokenKind;
  email: string;
  workspaceId?: string;
  userId?: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

const store = (): Storage | undefined => (typeof localStorage === 'undefined' ? undefined : localStorage);

function read<T>(key: string, fallback: T, s: Storage | undefined = store()): T {
  try {
    const raw = s?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown, s: Storage | undefined = store()): void {
  try {
    s?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the demo keeps working in memory */
  }
}

const randomToken = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : String(Math.random()).slice(2);

// ---------- workspaces

/** localStorage key holding one workspace's data; the original demo keeps the historic key. */
export const workspaceKey = (id: string): string => (id === DEFAULT_WS ? PERSIST_KEY : `${PERSIST_KEY}:${id}`);

export function listWorkspaces(s?: Storage): WorkspaceEntry[] {
  const extra = read<WorkspaceEntry[]>(REGISTRY_KEY, [], s ?? store());
  const base: WorkspaceEntry = { id: DEFAULT_WS, name: DEFAULT_COMPANY.name, slug: DEFAULT_COMPANY.careersSlug, createdAt: '2026-11-16T00:00:00.000Z' };
  return [base, ...extra.filter((w) => w.id !== DEFAULT_WS)];
}

export function activeWorkspaceId(s?: Storage): string {
  const id = (s ?? store())?.getItem(ACTIVE_KEY);
  return id && listWorkspaces(s).some((w) => w.id === id) ? id : DEFAULT_WS;
}

export function setActiveWorkspace(id: string, s?: Storage): void {
  try {
    (s ?? store())?.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function registerWorkspace(entry: WorkspaceEntry, s?: Storage): void {
  const list = read<WorkspaceEntry[]>(REGISTRY_KEY, [], s ?? store()).filter((w) => w.id !== entry.id);
  write(REGISTRY_KEY, [...list, entry], s ?? store());
}

/** Keeps the registry's name/slug in step with the workspace's own settings. */
export function updateWorkspaceEntry(id: string, patch: Partial<Pick<WorkspaceEntry, 'name' | 'slug'>>, s?: Storage): void {
  if (id === DEFAULT_WS) return;
  const list = read<WorkspaceEntry[]>(REGISTRY_KEY, [], s ?? store());
  write(REGISTRY_KEY, list.map((w) => (w.id === id ? { ...w, ...patch } : w)), s ?? store());
}

export const slugTaken = (slug: string, exceptId?: string, s?: Storage): boolean =>
  listWorkspaces(s).some((w) => w.slug === slug && w.id !== exceptId);

export const workspaceBySlug = (slug: string, s?: Storage): WorkspaceEntry | undefined => listWorkspaces(s).find((w) => w.slug === slug);

/** Read-only peek at another workspace's users (sign-in lookup); never their candidates or jobs. */
export function workspaceUsers(id: string, s?: Storage): { id: string; email: string; status: string; passwordHash?: string; role: string }[] {
  const saved = read<{ state?: { users?: unknown[] } }>(workspaceKey(id), {}, s ?? store());
  const users = saved.state?.users;
  return Array.isArray(users) ? (users as never) : [];
}

/** Writes a complete persisted payload for a new workspace (same envelope zustand persist uses). */
export function writeWorkspaceData(id: string, state: unknown, version: number, s?: Storage): void {
  write(workspaceKey(id), { state, version }, s ?? store());
}

/** Switches the browser to `id` by reloading at `to`; returns false when it is already active. */
export function enterWorkspace(id: string, to: string): boolean {
  if (activeWorkspaceId() === id) return false;
  setActiveWorkspace(id);
  window.location.assign(to);
  return true;
}

// ---------- pending sign-in (survives the reload into another workspace)

export function setPendingLogin(email: string): void {
  write(PENDING_LOGIN_KEY, { email, at: new Date().toISOString() });
}

export function takePendingLogin(): string | undefined {
  const p = read<{ email?: string } | null>(PENDING_LOGIN_KEY, null);
  try {
    store()?.removeItem(PENDING_LOGIN_KEY);
  } catch {
    /* ignore */
  }
  return p?.email;
}

// ---------- mailbox

export function sendMail(msg: Omit<MailMessage, 'id' | 'at'>): MailMessage {
  const full: MailMessage = { ...msg, id: randomToken().slice(0, 12), at: new Date().toISOString() };
  const box = read<MailMessage[]>(MAILBOX_KEY, []);
  // Keep the demo mailbox bounded.
  write(MAILBOX_KEY, [full, ...box].slice(0, 300));
  return full;
}

export const readMailbox = (): MailMessage[] => read<MailMessage[]>(MAILBOX_KEY, []);
export const clearMailbox = (): void => write(MAILBOX_KEY, []);

// ---------- tokens

const HOUR = 3_600_000;
const TTL: Record<TokenKind, number> = { verify: 24 * HOUR, reset: 1 * HOUR, invite: 7 * 24 * HOUR };

export function issueToken(kind: TokenKind, email: string, extra: Pick<Token, 'workspaceId' | 'userId'> = {}): Token {
  const now = Date.now();
  const t: Token = { token: randomToken(), kind, email, ...extra, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + TTL[kind]).toISOString() };
  write(TOKENS_KEY, [...read<Token[]>(TOKENS_KEY, []), t].slice(-200));
  return t;
}

export type TokenCheck = { ok: true; token: Token } | { ok: false; reason: 'unknown' | 'used' | 'expired' };

export function checkToken(token: string | null, kind: TokenKind): TokenCheck {
  const t = read<Token[]>(TOKENS_KEY, []).find((x) => x.token === token && x.kind === kind);
  if (!t) return { ok: false, reason: 'unknown' };
  if (t.usedAt) return { ok: false, reason: 'used' };
  if (Date.parse(t.expiresAt) < Date.now()) return { ok: false, reason: 'expired' };
  return { ok: true, token: t };
}

export function consumeToken(token: string): void {
  write(TOKENS_KEY, read<Token[]>(TOKENS_KEY, []).map((x) => (x.token === token ? { ...x, usedAt: new Date().toISOString() } : x)));
}

/** True once a verification token was used (the sign-up tab polls this). */
export const tokenUsed = (token: string): boolean => !!read<Token[]>(TOKENS_KEY, []).find((x) => x.token === token)?.usedAt;

// ---------- passwords (demo only: a real backend hashes server-side with a slow, salted hash)

export function demoHash(password: string): string {
  let h = 5381;
  for (let i = 0; i < password.length; i++) h = (Math.imul(h, 33) ^ password.charCodeAt(i)) >>> 0;
  return `demo$${h.toString(16)}$${password.length}`;
}
