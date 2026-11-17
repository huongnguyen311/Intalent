import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMockupFixture } from '../../data/fixtureMockup';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { SystemConfigPage } from '../system-config/SystemConfigPage';
import { TaContributionPage } from '../ta-contribution/TaContributionPage';
import { TaxonomyPage } from '../taxonomy/TaxonomyPage';
import { UsersPage } from '../users/UsersPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const page = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const menu = (name: string | RegExp) => fireEvent.click(screen.getByRole('menuitem', { name }));

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

describe('TaxonomyPage', () => {
  it('adds a level, counts usage from candidates, and refuses duplicates', () => {
    page(<TaxonomyPage />);
    const advanced = useStore.getState().candidates.filter((c) => c.english === 'Advanced').length;
    expect(advanced).toBeGreaterThan(0);
    expect(within(screen.getByText('Advanced').closest('tr')!).getByText(String(advanced))).toBeInTheDocument();

    click(/Add New English Level/);
    fireEvent.change(screen.getByLabelText('TAG NAME'), { target: { value: 'Native' } });
    click('Save');
    expect(screen.getByText('Native')).toBeInTheDocument();

    click(/Add New English Level/);
    fireEvent.change(screen.getByLabelText('TAG NAME'), { target: { value: ' advanced ' } });
    click('Save');
    expect(screen.getByRole('alert')).toHaveTextContent('already exists');
  });

  it('renames (rewriting candidates) and deactivates a tag; the status filter hides it', () => {
    page(<TaxonomyPage />);
    fireEvent.click(within(screen.getByText('Basic').closest('tr')!).getByRole('button', { name: 'Actions' }));
    menu('Rename');
    fireEvent.change(screen.getByLabelText('TAG NAME'), { target: { value: 'Elementary' } });
    click('Save');
    expect(screen.getByText('Elementary')).toBeInTheDocument();
    expect(useStore.getState().candidates.some((c) => c.english === 'Basic')).toBe(false);

    fireEvent.click(within(screen.getByText('Elementary').closest('tr')!).getByRole('button', { name: 'Actions' }));
    menu('Deactivate');
    expect(within(screen.getByText('Elementary').closest('tr')!).getByText('Inactive')).toBeInTheDocument();
    click(/Filter:/);
    menu('Active');
    expect(screen.queryByText('Elementary')).toBeNull();
  });

  it('switches to the Domain tab', () => {
    page(<TaxonomyPage />);
    click('Domain');
    expect(screen.getByRole('button', { name: /Add New Domain/ })).toBeInTheDocument();
    expect(screen.queryByText('Advanced')).toBeNull();
  });
});

describe('UsersPage', () => {
  it('computes the stat cards from users', () => {
    page(<UsersPage />);
    const users = useStore.getState().users;
    const card = screen.getByText('Total Users').parentElement!;
    expect(within(card).getByText(String(users.length))).toBeInTheDocument();
  });

  it('adds a user, blocks a duplicate email, deactivates and changes role', () => {
    page(<UsersPage />);
    click(/New User/);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Tester Nguyen' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'tester@company.demo' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Admin' } });
    click('Save');
    expect(screen.getByText('tester@company.demo')).toBeInTheDocument();
    expect(useStore.getState().users.find((u) => u.name === 'Tester Nguyen')?.role).toBe('Admin');

    click(/New User/);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Other' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'TESTER@company.demo' } });
    click('Save');
    expect(screen.getByRole('alert')).toHaveTextContent('already exists');
    click('Cancel');

    const row = () => screen.getByText('Tester Nguyen').closest('tr')!;
    fireEvent.click(within(row()).getByRole('button', { name: 'Actions' }));
    menu('Deactivate');
    expect(within(row()).getByText('Inactive')).toBeInTheDocument();

    fireEvent.click(within(row()).getByRole('button', { name: 'Actions' }));
    menu('Edit');
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'User' } });
    click('Save');
    expect(useStore.getState().users.find((u) => u.name === 'Tester Nguyen')?.role).toBe('User');
  });

  it('never lets the demo user be deactivated', () => {
    expect(useStore.getState().setUserActive('u-admin', false)).toEqual({ ok: false, reason: 'protected' });
    expect(useStore.getState().setUserRole('u-admin', 'User')).toEqual({ ok: false, reason: 'protected' });
  });

  it('filters by search text', () => {
    page(<UsersPage />);
    fireEvent.change(screen.getByPlaceholderText('Search by name or email...'), { target: { value: 'thu.mai' } });
    expect(screen.getByText('Mai Anh Thu')).toBeInTheDocument();
    expect(screen.queryByText('Pham Gia Huy')).toBeNull();
  });
});

describe('SystemConfigPage', () => {
  it('edits a prompt and stores it with a new timestamp', () => {
    page(<SystemConfigPage />);
    fireEvent.click(screen.getByRole('button', { name: /Edit Prompt: Jd Matching/ }));
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Rank strictly by must-have skills.' } });
    click('Save');
    const p = useStore.getState().prompts.find((x) => x.id === 'prompt-jd-matching')!;
    expect(p.text).toBe('Rank strictly by must-have skills.');
    expect(p.updatedAt).not.toBe('2026-03-24T15:25:53');
  });

  it('lists email templates on their own tab and shows simulated usage', () => {
    page(<SystemConfigPage />);
    expect(screen.queryByText('Rejection')).toBeNull();
    click('Email Templates');
    expect(screen.getByText('Rejection')).toBeInTheDocument();
    click('AI Usage & Cost');
    expect(screen.getByText(/Simulated figures/)).toBeInTheDocument();
  });
});

describe('TaContributionPage', () => {
  it('shows the mockup figures in fixture mode', () => {
    useStore.setState({ ...buildMockupFixture() });
    page(<TaContributionPage />);
    const table = screen.getByTestId('ta-contribution-table');
    expect(within(table).getByText('Unattributed (before CV Owner tracking)')).toBeInTheDocument();
    expect(within(table).getByText('312')).toBeInTheDocument();
    expect(within(table).getByText('+6')).toBeInTheDocument();
    expect(within(table).getByText('−3')).toBeInTheDocument();
  });

  it('transfers a CV from the history tab and the new row appears', () => {
    page(<TaContributionPage />);
    const s = useStore.getState();
    const cand = s.candidates[0];
    const to = s.users.find((u) => u.id !== cand.cvOwner && u.role !== 'Candidate')!;
    fireEvent.click(screen.getByTestId('ta-contribution-tab-transfers'));
    fireEvent.change(screen.getByTestId('ta-contribution-transfer-candidate'), { target: { value: cand.id } });
    fireEvent.change(screen.getByTestId('ta-contribution-transfer-to'), { target: { value: to.id } });
    fireEvent.click(screen.getByTestId('ta-contribution-transfer-button'));
    const table = screen.getByTestId('ta-contribution-transfers-table');
    expect(within(table).getByText(cand.name)).toBeInTheDocument();
    expect(useStore.getState().candidates[0].cvOwner).toBe(to.id);
  });

  it('exports cv-theo-ta.csv with a real download', async () => {
    const create = vi.fn(() => 'blob:x');
    let blob: Blob | undefined;
    URL.createObjectURL = ((b: Blob) => { blob = b; return create(); }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    page(<TaContributionPage />);
    fireEvent.click(screen.getByTestId('ta-contribution-export-button'));
    expect(names).toEqual(['cv-theo-ta.csv']);
    const text = await blob!.text();
    expect(text.split('\r\n')[0]).toBe('TA,CV mới,Upload trùng,Parse lỗi,Đang xử lý,Nhận chuyển giao,Chuyển đi,Tổng');
    const lines = text.split('\r\n');
    expect(lines[lines.length - 1].startsWith('Tổng,')).toBe(true);
    click.mockRestore();
  });
});
