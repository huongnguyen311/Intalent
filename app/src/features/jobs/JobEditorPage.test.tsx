import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { jobPostFromJd } from '../../domain/jobPost';
import type { Job } from '../../domain/types';
import { AppRoutes } from '../../routes';
import { useStore } from '../../store/store';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

const renderAt = (url: string, state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: url.split('?')[0], search: url.includes('?') ? `?${url.split('?')[1]}` : '', state }]}>
      <AppRoutes />
      <Where />
    </MemoryRouter>,
  );

const where = () => screen.getByTestId('where').textContent;
const asUser = (id: string) => useStore.setState({ ui: { ...useStore.getState().ui, actingAs: id } });
const patchJob1 = (patch: Partial<Job>) =>
  useStore.setState({ jobs: useStore.getState().jobs.map((j) => (j.id === 'job-1' ? { ...j, ...patch } : j)) });

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

describe('JobEditorPage', () => {
  it('has a header back arrow to the list (create) or the job (edit), asking first when edited', () => {
    const a = renderAt('/jobs/new');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Jobs' }));
    expect(where()).toBe('/jobs');
    a.unmount();
    renderAt('/jobs/job-1/edit');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Senior Frontend Developer' }));
    expect(screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(where()).toBe('/jobs/job-1');
  });

  it('opens create, edit and duplicate at their URLs', () => {
    const a = renderAt('/jobs/new');
    expect(screen.getByRole('heading', { name: 'Create Job' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('');
    a.unmount();
    const b = renderAt('/jobs/job-1/edit');
    expect(screen.getByRole('heading', { name: 'Edit Job' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Senior Frontend Developer');
    b.unmount();
    renderAt('/jobs/job-1/duplicate');
    expect(screen.getByRole('heading', { name: 'Duplicate job' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Senior Frontend Developer (Copy)');
  });

  it('fromJd prefills the JD', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const jd = useStore.getState().jds.find((j) => j.id === 'jd-2026-002')!;
    expect(screen.getByLabelText('Job description')).toHaveValue('jd-2026-002');
    expect(screen.getByLabelText('Title')).toHaveValue(jd.title);
  });

  it('old links redirect', () => {
    const a = renderAt('/jobs?new=1');
    expect(where()).toBe('/jobs/new');
    a.unmount();
    renderAt('/jobs?fromJd=jd-2026-002');
    expect(where()).toBe('/jobs/new?fromJd=jd-2026-002');
  });

  it('out-of-scope job shows no access', () => {
    asUser('u-linh');
    patchJob1({ hiringManager: 'u-nam', collaborators: [] });
    renderAt('/jobs/job-1/edit');
    expect(screen.getByText(/You do not have access to this job/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('unknown job shows not found', () => {
    renderAt('/jobs/nope/edit');
    expect(screen.getByText('Job not found')).toBeInTheDocument();
  });

  it('no job.edit permission shows NoAccess', () => {
    asUser('u-quang');
    renderAt('/jobs/new');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('saving goes to the job page', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(where()).toBe(`/jobs/${useStore.getState().jobs[0].id}`);
  });

  it('cancel goes back where you came from', () => {
    const a = renderAt('/jobs/job-1/edit');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(where()).toBe('/jobs/job-1');
    a.unmount();
    renderAt('/jobs/new', { from: '/jds/jd-2026-002' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(where()).toBe('/jds/jd-2026-002');
  });

  it('jobs list buttons open the editor page', () => {
    const a = renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: /New job/ }));
    expect(where()).toBe('/jobs/new');
    a.unmount();
    const b = renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Senior Frontend Developer' }));
    expect(where()).toBe('/jobs/job-1/edit');
    b.unmount();
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Senior Frontend Developer' }));
    expect(where()).toBe('/jobs/job-1/duplicate');
  });

  it('job detail Edit and Duplicate open the editor page', () => {
    const a = renderAt('/jobs/job-1');
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect(where()).toBe('/jobs/job-1/edit');
    a.unmount();
    renderAt('/jobs/job-1');
    fireEvent.click(screen.getByRole('button', { name: /Duplicate/ }));
    expect(where()).toBe('/jobs/job-1/duplicate');
  });
});

describe('JobEditorPage unsaved changes', () => {
  const typeTitle = (v: string) => fireEvent.change(screen.getByLabelText('Title'), { target: { value: v } });

  it('cancel with changes asks before leaving', () => {
    renderAt('/jobs/new');
    typeTitle('Data Lead');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(where()).toBe('/jobs/new');
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(where()).toBe('/jobs');
  });

  it('has no back link: Cancel in the bottom bar leaves', () => {
    renderAt('/jobs/new');
    expect(within(screen.getByTestId('job-editor')).queryByRole('link', { name: 'Jobs' })).toBeNull();
  });

  it('cancel without changes leaves at once', () => {
    renderAt('/jobs/new');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(where()).toBe('/jobs');
  });

  it('never offers unsaved work back from an earlier visit', () => {
    const a = renderAt('/jobs/new');
    typeTitle('Kept');
    a.unmount();
    renderAt('/jobs/new');
    expect(screen.queryByText('You have unsaved changes from earlier.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  it('warns before the tab closes with unsaved changes', () => {
    renderAt('/jobs/new');
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    typeTitle('Data Lead');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});

describe('JobEditorPage preview', () => {
  const openPreview = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    return screen.getByRole('dialog', { name: 'Preview' });
  };

  it('shows no preview column, only a Preview button', () => {
    renderAt('/jobs/new');
    expect(screen.queryByRole('complementary', { name: 'Preview' })).toBeNull();
    expect(screen.queryByRole('button', { name: /show preview|hide preview/i })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Preview' })).toBeNull();
  });

  it('Preview opens a panel that follows the form', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Data Lead' } });
    fireEvent.change(screen.getByLabelText("Why you'll love working here"), { target: { value: 'Free lunch' } });
    const panel = openPreview();
    expect(within(panel).getByRole('heading', { name: 'Data Lead' })).toBeInTheDocument();
    expect(panel).toHaveTextContent('Free lunch');
  });
});

describe('JobEditorPage review fixes', () => {
  function Nav() {
    const go = useNavigate();
    return (
      <>
        <button onClick={() => go(-1)}>test-back</button>
        <button onClick={() => go('/jobs/new?fromJd=jd-2026-002')}>test-go-fromJd</button>
      </>
    );
  }
  const renderEntries = (entries: string[]) =>
    render(
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <AppRoutes />
        <Where />
        <Nav />
      </MemoryRouter>,
    );

  it('after saving, Back does not reopen the editor', () => {
    renderEntries(['/jobs', '/jobs/new?fromJd=jd-2026-002']);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'test-back' }));
    expect(where()).toBe('/jobs');
  });
});

describe('JobEditorPage small fixes', () => {

  it('an unknown fromJd opens a blank create', () => {
    renderAt('/jobs/new?fromJd=nope');
    expect(screen.getByLabelText('Job description')).toHaveValue('');
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  it('picking another JD replaces the title the first JD filled in', () => {
    renderAt('/jobs/new');
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'jd-2026-002' } });
    expect(screen.getByLabelText('Title')).toHaveValue('Senior Frontend Developer');
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'jd-2026-003' } });
    expect(screen.getByLabelText('Title')).toHaveValue('Tech Lead / Senior Engineer');
  });

});

describe('JobEditorPage + Create a new JD', () => {
  const pickNewJd = () => fireEvent.change(screen.getByLabelText('Job description'), { target: { value: '__new__' } });
  const saveJd = (title: string) => {
    fireEvent.change(screen.getByLabelText(/JD Title/), { target: { value: title } });
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    return useStore.getState().jds.find((j) => j.title === title)!;
  };

  it('opens the Create JD page and comes back with the new JD picked', () => {
    renderAt('/jobs/new');
    pickNewJd();
    expect(where()).toBe('/jds/new');
    const created = saveJd('QA Lead');
    expect(where()).toBe(`/jobs/new?fromJd=${created.id}`);
    expect(screen.getByLabelText('Job description')).toHaveValue(created.id);
    expect(screen.getByLabelText('Title')).toHaveValue('QA Lead');
  });

  it('asks before leaving unsaved job changes', () => {
    renderAt('/jobs/new');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Typed' } });
    pickNewJd();
    expect(where()).toBe('/jobs/new');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(where()).toBe('/jds/new');
  });

  it('Cancel on the JD page returns to the job form', () => {
    renderAt('/jobs/new');
    pickNewJd();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(where()).toBe('/jobs/new');
  });

  it('works from Edit too, keeping the job title', () => {
    renderAt('/jobs/job-1/edit');
    pickNewJd();
    const created = saveJd('QA Lead');
    expect(where()).toBe(`/jobs/job-1/edit?fromJd=${created.id}`);
    expect(screen.getByLabelText('Job description')).toHaveValue(created.id);
    expect(screen.getByLabelText('Title')).toHaveValue('Senior Frontend Developer');
  });

  describe('hiring urgency', () => {
    const plus60 = () => {
      const d = new Date(Date.now() + 60 * 86_400_000);
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };

    it('create starts at Normal with a target date 60 days out', () => {
      renderAt('/jobs/new');
      expect(screen.getByRole('heading', { name: 'Hiring urgency' })).toBeInTheDocument();
      expect(screen.getByLabelText('Hiring priority')).toHaveValue('normal');
      expect(screen.getByLabelText('Target hiring date')).toHaveValue(plus60());
    });

    it('a cleared target date blocks saving', () => {
      renderAt('/jobs/new?fromJd=jd-2026-002');
      const before = useStore.getState().jobs.length;
      fireEvent.change(screen.getByLabelText('Target hiring date'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
      expect(screen.getByText('Pick a target hiring date')).toBeInTheDocument();
      expect(useStore.getState().jobs).toHaveLength(before);
    });

    it('saves priority, reason, notes and date', () => {
      renderAt('/jobs/new?fromJd=jd-2026-002');
      fireEvent.change(screen.getByLabelText('Hiring priority'), { target: { value: 'critical' } });
      fireEvent.change(screen.getByLabelText('Urgency reason'), { target: { value: 'Project needs devs now' } });
      fireEvent.change(screen.getByLabelText('Priority notes'), { target: { value: 'Ask CTO' } });
      fireEvent.change(screen.getByLabelText('Target hiring date'), { target: { value: '2027-01-15' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
      expect(useStore.getState().jobs[0]).toMatchObject({
        hiringPriority: 'critical', urgencyReason: 'Project needs devs now', priorityNotes: 'Ask CTO', targetHiringDate: '2027-01-15',
      });
    });

    it('editing a job without a date prefills 60 days out and keeps its priority', () => {
      patchJob1({ targetHiringDate: undefined, hiringPriority: 'high' });
      renderAt('/jobs/job-1/edit');
      expect(screen.getByLabelText('Target hiring date')).toHaveValue(plus60());
      expect(screen.getByLabelText('Hiring priority')).toHaveValue('high');
    });
  });

  describe('campaign', () => {
    const options = () => within(screen.getByLabelText('Campaign')).getAllByRole('option').map((o) => o.textContent);

    it('offers No campaign plus every campaign that has not finished', () => {
      renderAt('/jobs/new');
      const open = useStore.getState().campaigns.filter((c) => !['completed', 'cancelled'].includes(c.status)).map((c) => c.name);
      expect(options()).toEqual(['No campaign', ...open]);
      expect(screen.getByLabelText('Campaign')).toHaveValue('');
    });

    it('saves the picked campaign on a new job', () => {
      renderAt('/jobs/new?fromJd=jd-2026-002');
      fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: 'camp-4' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
      expect(useStore.getState().jobs[0].campaignId).toBe('camp-4');
    });

    it('edit shows the current campaign, even a finished one, and can take the job out', () => {
      patchJob1({ campaignId: 'camp-3' });
      renderAt('/jobs/job-1/edit');
      expect(screen.getByLabelText('Campaign')).toHaveValue('camp-3');
      expect(options()).toContain('Growth Marketing Referral');
      fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(useStore.getState().jobs.find((j) => j.id === 'job-1')!.campaignId).toBeUndefined();
    });
  });
});

describe('JobEditorPage post content', () => {
  const jdOf = (id: string) => useStore.getState().jds.find((j) => j.id === id)!;
  const summary = () => screen.getByLabelText('About the role');
  const niceToHave = () => screen.getByLabelText('Nice to have');
  const pick = (id: string) => fireEvent.change(screen.getByLabelText('Job description'), { target: { value: id } });

  it('picking a JD fills the post content', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const jd = jdOf('jd-2026-002');
    expect(summary()).toHaveValue(jd.summary);
    expect(screen.getByLabelText('Requirements (must-have)')).toHaveValue(jobPostFromJd(jd).mustHave.join('\n'));
    expect(screen.getByLabelText("What you'll do")).toHaveValue(jobPostFromJd(jd).responsibilities.join('\n'));
  });

  it('picking another JD keeps what was typed and fills only empty fields', () => {
    renderAt('/jobs/new');
    pick('jd-2026-002');
    fireEvent.change(summary(), { target: { value: 'Typed by HR' } });
    fireEvent.change(niceToHave(), { target: { value: '' } });
    pick('jd-2026-003');
    expect(summary()).toHaveValue('Typed by HR');
    expect(niceToHave()).toHaveValue(jdOf('jd-2026-003').niceToHave!.join('\n'));
    // Untouched sections filled from the first JD follow the new pick.
    expect(screen.getByLabelText("What you'll do")).toHaveValue(jobPostFromJd(jdOf('jd-2026-003')).responsibilities.join('\n'));
  });

  it('a section cleared on the job stays empty', () => {
    renderAt('/jobs/job-1/edit');
    fireEvent.change(niceToHave(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(useStore.getState().jobs.find((j) => j.id === 'job-1')!.niceToHave).toEqual([]);
  });

  it('Preview shows the job post content', () => {
    renderAt('/jobs/job-1/edit');
    fireEvent.change(summary(), { target: { value: 'Preview summary' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const panel = screen.getByRole('dialog', { name: 'Preview' });
    expect(panel).toHaveTextContent('Preview summary');
    expect(within(panel).getByRole('heading', { name: 'Nice to have' })).toBeInTheDocument();
  });

  it('saves the post content on the job', () => {
    renderAt('/jobs/job-1/edit');
    fireEvent.change(summary(), { target: { value: 'Edited summary' } });
    fireEvent.change(niceToHave(), { target: { value: 'One\n\n  Two  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const job = useStore.getState().jobs.find((j) => j.id === 'job-1')!;
    expect(job.summary).toBe('Edited summary');
    expect(job.niceToHave).toEqual(['One', 'Two']);
  });

  it('an older job without a copy shows (and so keeps on save) its JD content', () => {
    patchJob1({ summary: undefined, responsibilities: undefined, skills: undefined, mustHave: undefined, niceToHave: undefined, aboutTeam: undefined });
    renderAt('/jobs/job-1/edit');
    expect(summary()).toHaveValue(jdOf('jd-2026-002').summary);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(useStore.getState().jobs.find((j) => j.id === 'job-1')!.summary).toBe(jdOf('jd-2026-002').summary);
  });

  it('duplicate keeps the post content', () => {
    patchJob1({ summary: 'Source summary' });
    renderAt('/jobs/job-1/duplicate');
    expect(summary()).toHaveValue('Source summary');
  });

  it('Load from JD replaces the post content after confirming', () => {
    patchJob1({ summary: 'Old copy' });
    renderAt('/jobs/job-1/edit');
    fireEvent.click(screen.getByRole('button', { name: 'Load from JD' }));
    const dialog = screen.getByRole('dialog', { name: 'Replace post content?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace' }));
    expect(summary()).toHaveValue(jdOf('jd-2026-002').summary);
  });

  it('drops a bullet typed at the start of a line', () => {
    renderAt('/jobs/job-1/edit');
    fireEvent.change(niceToHave(), { target: { value: '- One\n• Two\n* Three\n1. Four' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(useStore.getState().jobs.find((j) => j.id === 'job-1')!.niceToHave).toEqual(['One', 'Two', 'Three', 'Four']);
  });

  it('Load from JD is disabled when the job\'s JD no longer exists', () => {
    patchJob1({ jdId: 'jd-deleted' });
    renderAt('/jobs/job-1/edit');
    expect(screen.getByRole('button', { name: 'Load from JD' })).toBeDisabled();
  });

  it('Load from JD is disabled without a JD', () => {
    renderAt('/jobs/new');
    expect(screen.getByRole('button', { name: 'Load from JD' })).toBeDisabled();
  });
});
