import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { AppRoutes } from '../../routes';
import { signInAs } from '../../store/session';
import { useStore } from '../../store/store';

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  );

beforeEach(() => {
  window.localStorage.clear();
  const seed = buildSeed(undefined, Date.now());
  useStore.setState({ ...seed, ui: { ...seed.ui, careersLang: 'en' } });
});

describe('UX fixes per role', () => {
  it('a drawer opened from My interviews leaves stage moves to the Pipeline and links the CV', () => {
    signInAs('u-nam');
    const app = useStore.getState().applications.find((a) => a.stage === 'interview' && a.interviews?.some((i) => i.interviewers.includes('u-nam') && i.status === 'scheduled'))!;
    renderAt('/my-interviews');
    const name = useStore.getState().candidates.find((c) => c.id === app.candidateId)!.name;
    fireEvent.click(screen.getAllByText(name)[0]);
    expect(screen.queryByRole('button', { name: /Move to/ })).toBeNull();
    expect(screen.getByRole('link', { name: /View CV & profile/ })).toHaveAttribute('href', `/candidates/${app.candidateId}`);
  });

  it('an Interviewer sees neither the team ratings nor other scorecards before sending their own', () => {
    signInAs('u-quang');
    const s = useStore.getState();
    const app = s.applications.find((a) => a.interviews?.some((i) => i.interviewers.includes('u-quang') && !i.scorecards.some((c) => c.by === 'u-quang') && i.status !== 'cancelled'))!;
    // Someone else already scored the same round.
    const iv = app.interviews!.find((i) => i.interviewers.includes('u-quang') && !i.scorecards.some((c) => c.by === 'u-quang'))!;
    useStore.setState({
      applications: s.applications.map((a) => (a.id === app.id ? {
        ...a,
        interviews: a.interviews!.map((i) => (i.id === iv.id ? { ...i, scorecards: [{ by: 'u-huy', at: i.at, scores: { technical: 5, communication: 5, problem: 5, culture: 5 }, recommendation: 'strong_yes' as const, note: 'Hire!' }] } : i)),
      } : a)),
    });
    renderAt('/my-interviews');
    const name = useStore.getState().candidates.find((c) => c.id === app.candidateId)!.name;
    fireEvent.click(screen.getAllByText(name)[0]);
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).queryByText(/Hire!/)).toBeNull();
    expect(within(drawer).getByText(/hidden until you send yours/)).toBeInTheDocument();
    expect(within(drawer).queryByText('Your rating')).toBeNull();
  });

  it('roles without contact permission get a masked CV preview and no download', () => {
    signInAs('u-quang');
    const app = useStore.getState().applications.find((a) => a.interviews?.some((i) => i.interviewers.includes('u-quang')))!;
    const c = useStore.getState().candidates.find((x) => x.id === app.candidateId)!;
    renderAt(`/candidates/${c.id}`);
    expect(screen.queryByText((t) => !!c.email && t.includes(c.email))).toBeNull();
    expect(screen.queryByTitle(/Download/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Back/ })).toBeInTheDocument();
  });

  it('roles without Talent Pool access get no AI Search shortcut', () => {
    signInAs('u-nam');
    renderAt('/jobs');
    expect(screen.queryByRole('link', { name: 'AI Search' })).toBeNull();
  });
});

describe('candidate offer', () => {
  it('lets the candidate accept a sent offer, which moves the application to Hired', () => {
    const s = useStore.getState();
    const app = s.applications.find((a) => a.offer?.status === 'sent' && s.users.some((u) => u.candidateId === a.candidateId))!;
    const acct = s.users.find((u) => u.candidateId === app.candidateId)!;
    signInAs(acct.id);
    renderAt('/me');
    fireEvent.click(screen.getByRole('button', { name: 'Accept offer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, accept' }));
    const after = useStore.getState().applications.find((a) => a.id === app.id)!;
    expect(after.offer?.status).toBe('accepted');
    expect(after.stage).toBe('hired');
    expect(screen.getByText(/You accepted this offer/)).toBeInTheDocument();
  });

  it('needs a reason to decline', () => {
    const s = useStore.getState();
    const app = s.applications.find((a) => a.offer?.status === 'sent' && s.users.some((u) => u.candidateId === a.candidateId))!;
    signInAs(s.users.find((u) => u.candidateId === app.candidateId)!.id);
    renderAt('/me');
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    const send = screen.getByRole('button', { name: 'Send and decline' });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/why/), { target: { value: 'Accepted another offer' } });
    fireEvent.click(send);
    expect(useStore.getState().applications.find((a) => a.id === app.id)!.offer?.status).toBe('declined');
  });
});
