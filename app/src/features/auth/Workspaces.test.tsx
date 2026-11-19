import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { AppRoutes } from '../../routes';
import { PERSIST_VERSION } from '../../store/persist';
import {
  activeWorkspaceId, checkToken, DEFAULT_WS, demoHash, listWorkspaces, readMailbox, registerWorkspace,
  setActiveWorkspace, workspaceKey, writeWorkspaceData,
} from '../../store/platform';
import { createDemoStore } from '../../store/store';
import { useStore } from '../../store/store';
import { newWorkspaceState } from '../../data/workspace';
import { DEFAULT_COMPANY } from '../../domain/company';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
const tokenFrom = (href: string) => new URL(href).searchParams.get('token')!;
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  const seed = buildSeed();
  useStore.setState({ ...seed, company: undefined, ui: { ...seed.ui, actingAs: undefined } });
  assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign, origin: 'http://localhost', pathname: '/', search: '' });
});
afterEach(() => vi.unstubAllGlobals());

/** A second tenant with one owner (password "secret123") and one candidate. */
function makeTenant() {
  const company = { ...DEFAULT_COMPANY, workspaceId: 'ws-acme-1', name: 'Acme', careersSlug: 'acme', logoText: 'AC' };
  const owner = { id: 'u-acme', name: 'Ann Acme', email: 'ann@acme.demo', role: 'Super Admin', status: 'Active', createdAt: '2026-11-19T00:00:00.000Z', passwordHash: demoHash('secret123') };
  const state = newWorkspaceState({ company, owner, sampleData: false });
  state.candidates = [{ ...buildSeed().candidates[0], id: 'cand-acme', name: 'Only In Acme', email: 'x@acme.demo' }];
  writeWorkspaceData(company.workspaceId, state, PERSIST_VERSION);
  registerWorkspace({ id: company.workspaceId, name: 'Acme', slug: 'acme', createdAt: owner.createdAt });
  return { company, owner };
}

describe('sign up creates a separate, verified workspace (PRD 4.1, AC-01)', () => {
  it('needs the emailed link, then writes an empty tenant with invites and switches into it', () => {
    at('/signup');
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Mai Owner' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'owner@newco.demo' } });
    fireEvent.change(screen.getByLabelText('Password (8+ characters)'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();

    const mail = readMailbox()[0];
    expect(mail).toMatchObject({ to: 'owner@newco.demo', subject: 'Verify your email for InTalent' });
    // Opening the link (as the mailbox would) verifies the address; the waiting page moves on.
    expect(checkToken(tokenFrom(mail.action!.href), 'verify').ok).toBe(true);
    const verify = at(`/verify?token=${tokenFrom(mail.action!.href)}`);
    expect(screen.getByRole('heading', { name: 'Email verified' })).toBeInTheDocument();
    verify.unmount();
    act(() => { window.dispatchEvent(new Event('focus')); });

    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'New Co' } });
    expect(screen.getByLabelText('Careers page slug')).toHaveValue('new-co');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Invite email 1'), { target: { value: 'rec@newco.demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Finish and create the first job' }));

    const ws = listWorkspaces().find((w) => w.slug === 'new-co')!;
    expect(ws.name).toBe('New Co');
    expect(activeWorkspaceId()).toBe(ws.id);
    expect(assign).toHaveBeenCalledWith('/jobs?new=1');
    const saved = JSON.parse(localStorage.getItem(workspaceKey(ws.id))!).state;
    // Nothing from the demo workspace is copied.
    expect(saved.candidates).toEqual([]);
    expect(saved.jobs).toEqual([]);
    expect(saved.users.map((u: { email: string; status: string }) => [u.email, u.status])).toEqual([
      ['owner@newco.demo', 'Active'], ['rec@newco.demo', 'Invited'],
    ]);
    expect(saved.ui.actingAs).toBe(saved.users[0].id);
    expect(readMailbox()[0]).toMatchObject({ to: 'rec@newco.demo', workspace: 'New Co' });
  });
});

describe('tenant isolation (AC-01)', () => {
  it('a store opened on another workspace sees only that workspace', () => {
    makeTenant();
    setActiveWorkspace('ws-acme-1');
    const acme = createDemoStore(localStorage);
    expect(acme.getState().candidates.map((c) => c.name)).toEqual(['Only In Acme']);
    expect(acme.getState().users.map((u) => u.email)).toEqual(['ann@acme.demo']);
    setActiveWorkspace(DEFAULT_WS);
    const demo = createDemoStore(localStorage);
    expect(demo.getState().candidates.some((c) => c.id === 'cand-acme')).toBe(false);
  });

  it('a signed-out visitor of a tenant workspace is sent to login, not given the demo admin', () => {
    const { company } = makeTenant();
    useStore.setState({ users: [], company, ui: { lang: 'en', careersLang: 'en', piiUnlocked: false } });
    at('/jobs');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});

describe('sign in across workspaces', () => {
  it('checks the password, then reloads into the workspace that holds the account', () => {
    makeTenant();
    at('/login');
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'ann@acme.demo' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'wrong-pass' } });
    fireEvent.submit(screen.getByLabelText(/email address/i).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong password');
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secret123' } });
    fireEvent.submit(screen.getByLabelText(/email address/i).closest('form')!);
    expect(activeWorkspaceId()).toBe('ws-acme-1');
    expect(assign).toHaveBeenCalledWith('/login?resume=1');
  });
});

describe('emails with working links', () => {
  it('invitation: the link sets a password and signs the user in', () => {
    const r = useStore.getState().addUser({ name: 'New Rec', email: 'newrec@company.demo', role: 'Recruiter' });
    if (!r.ok) throw new Error('setup');
    at('/users');
    // The Users dialog sends the mail; here we send it the same way.
    return import('./accounts').then(({ sendInvitation }) => {
      sendInvitation(r.user, 'Super Admin');
      const link = readMailbox()[0].action!.href;
      at(`/invite?token=${tokenFrom(link)}`);
      fireEvent.change(screen.getAllByLabelText('Password (8+ characters)').slice(-1)[0], { target: { value: 'newpass123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Join the workspace' }));
      const u = useStore.getState().users.find((x) => x.id === r.user.id)!;
      expect(u.status).toBe('Active');
      expect(u.passwordHash).toBe(demoHash('newpass123'));
      expect(useStore.getState().ui.actingAs).toBe(u.id);
      expect(checkToken(tokenFrom(link), 'invite')).toEqual({ ok: false, reason: 'used' });
    });
  });

  it('password reset: mail only for real accounts, link changes the password once', () => {
    at('/forgot-password');
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'nobody@nowhere.demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(readMailbox()).toHaveLength(0);

    const admin = useStore.getState().users.find((u) => u.role === 'Recruiter' && u.status === 'Active')!;
    at('/forgot-password');
    fireEvent.change(screen.getAllByLabelText('Work email').slice(-1)[0], { target: { value: admin.email } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Send reset link' }).slice(-1)[0]);
    const link = readMailbox()[0].action!.href;
    at(`/reset-password?token=${tokenFrom(link)}`);
    fireEvent.change(screen.getByLabelText('New password (8+ characters)'), { target: { value: 'brandnew99' } });
    fireEvent.change(screen.getByLabelText('Repeat the password'), { target: { value: 'brandnew99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(useStore.getState().users.find((u) => u.id === admin.id)?.passwordHash).toBe(demoHash('brandnew99'));
    expect(checkToken(tokenFrom(link), 'reset').ok).toBe(false);
  });
});
