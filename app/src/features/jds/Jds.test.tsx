import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMockupFixture } from '../../data/fixtureMockup';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { JdDetailPage } from './JdDetailPage';
import { isJobTitle, JdEditorPage } from './JdEditorPage';
import { JdListPage } from './JdListPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

/** Strips a seeded JD back to the pre-editor shape (title, skills and pasted text only). */
const makeLegacyJd = (id: string, body?: string) =>
  useStore.setState((s) => ({
    jds: s.jds.map((j) => (j.id === id
      ? { id: j.id, code: j.code, title: j.title, client: j.client, domains: j.domains, skills: j.skills, status: j.status, createdAt: j.createdAt, updatedAt: j.updatedAt,
        body: body ?? `${j.title.toUpperCase()}

MUST-HAVE SKILLS
- 5+ years of relevant professional experience` }
      : j)),
  }));

const Where = () => <div data-testid="where">{useLocation().pathname + useLocation().search}</div>;
const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/jds" element={<JdListPage />} />
        <Route path="/jds/new" element={<JdEditorPage mode="create" />} />
        <Route path="/jds/:id" element={<JdDetailPage />} />
        <Route path="/jds/:id/edit" element={<JdEditorPage mode="edit" />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

describe('JdListPage', () => {
  it('lists the JDs with "+N" overflow chips and filters by search text', () => {
    renderAt('/jds');
    expect(screen.getByText('ID: JD-2026-004')).toBeInTheDocument();
    expect(screen.getAllByText('+10')).toHaveLength(3);
    fireEvent.change(screen.getByPlaceholderText('Search by title, domain, or skill...'), { target: { value: 'flutter' } });
    expect(screen.getByText('Senior Flutter & Java Engineer')).toBeInTheDocument();
    expect(screen.queryByText('Senior Growth Marketing Lead')).toBeNull();
  });

  it('opens the full-page editor from Create New JD', () => {
    renderAt('/jds');
    fireEvent.click(screen.getByRole('button', { name: /Create New JD/ }));
    expect(screen.getByRole('heading', { name: 'Create New Job Description' })).toBeInTheDocument();
  });

  it('shows clients, "Internal" for JDs without one, and filters by client', () => {
    renderAt('/jds');
    expect(screen.getByText('Acme SaaS')).toBeInTheDocument();
    expect(screen.getByText('Internal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Client: All Clients/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Internal' }));
    expect(screen.getByText('Senior Flutter & Java Engineer')).toBeInTheDocument();
    expect(screen.queryByText('Tech Lead / Senior Engineer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Client: Internal/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Acme SaaS' }));
    expect(screen.getByText('Tech Lead / Senior Engineer')).toBeInTheDocument();
    expect(screen.queryByText('Senior Flutter & Java Engineer')).toBeNull();
  });

  it('shows level and how many jobs use each JD, and blocks deleting a JD in use', () => {
    const seed = buildSeed();
    const usedId = seed.jobs[0].jdId;
    const usedJd = seed.jds.find((j) => j.id === usedId)!;
    const n = seed.jobs.filter((j) => j.jdId === usedId).length;
    useStore.setState({ jds: seed.jds.map((j) => (j.id === usedId ? { ...j, seniority: 'Senior', minYears: 5 } : j)) });
    renderAt('/jds');
    const row = screen.getByText(usedJd.title).closest('tr')!;
    expect(within(row).getByText('Senior · 5+ yrs')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: new RegExp(`${n} job\\(s\\)`) })).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: `Actions ${usedJd.title}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete job description' });
    expect(within(dialog).getByText(new RegExp(`used by ${n} job`))).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('unpublishes from the row menu and deletes only after confirming', () => {
    const jd = useStore.getState().createJd({ title: 'Temp role', domains: [], skills: [], body: '', status: 'Published' });
    renderAt('/jds');
    fireEvent.click(screen.getByRole('button', { name: 'Actions Temp role' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unpublish' }));
    expect(useStore.getState().jds.find((j) => j.id === jd.id)!.status).toBe('Draft');

    fireEvent.click(screen.getByRole('button', { name: 'Actions Temp role' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(useStore.getState().jds.some((j) => j.id === jd.id)).toBe(true);
    const dialog = screen.getByRole('dialog', { name: 'Delete job description' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(useStore.getState().jds.some((j) => j.id === jd.id)).toBe(false);
  });
});

describe('JdDetailPage', () => {
  it('shows requirements and "Create Job from this JD" navigates to /jobs/new?fromJd=', () => {
    renderAt('/jds/jd-2026-002');
    expect(screen.getByRole('heading', { name: 'Senior Frontend Developer' })).toBeInTheDocument();
    expect(screen.getByText('5 yrs')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Create Job from this JD/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/jobs/new?fromJd=jd-2026-002');
  });

  it('hides new actions in fixture mode and shows the mockup JD', () => {
    window.history.pushState({}, '', '/?fixture=mockup');
    useStore.setState({ ...buildMockupFixture() });
    try {
      renderAt('/jds/jd-2026-002');
      expect(screen.queryByRole('button', { name: /Create Job/ })).toBeNull();
      expect(screen.getByText('None')).toBeInTheDocument();
      expect(screen.getByText('Healthcare or SaaS industry experience')).toBeInTheDocument();
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('shows a message for an unknown JD', () => {
    renderAt('/jds/nope');
    expect(screen.getByText('JD not found')).toBeInTheDocument();
  });
});

describe('JdDetailPage structured fields', () => {
  it('shows client, critical skills, qualifications, pay and the overview', () => {
    const jd = useStore.getState().createJd({
      title: 'Data Analyst', client: 'Contoso Bank', domains: ['Fintech'], skills: ['SQL', 'Python'], body: '',
      criticalSkills: ['SQL'], niceToHave: ['dbt'], education: 'bachelor', major: 'Statistics', languages: ['Japanese - N2'],
      certifications: ['Google Data Analytics'], otherRequirements: 'Own laptop', location: 'HCMC', workingModel: 'Remote',
      summary: 'Turn bank data into decisions.', responsibilities: ['Build dashboards'], dailyTasks: ['Stand-up'],
      aboutTeam: 'Five analysts',
    });
    renderAt(`/jds/${jd.id}`);
    expect(screen.getByText(/Contoso Bank/)).toBeInTheDocument();
    expect(screen.getByLabelText('Critical skill')).toBeInTheDocument();
    for (const text of ['dbt', "Bachelor's degree", 'Statistics', 'Japanese - N2', 'Google Data Analytics', 'Own laptop', 'HCMC', 'Remote', 'Turn bank data into decisions.', 'Build dashboards', 'Stand-up',
      'Five analysts']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    // No pasted text: the empty "Original JD" card is hidden.
    expect(screen.queryByRole('heading', { name: /Original/ })).toBeNull();
  });

  it('hides the pasted text when the structured overview already covers it', () => {
    const jd = useStore.getState().createJd({
      title: 'QA Lead', domains: [], skills: ['Playwright'], body: 'PASTED SOURCE TEXT',
      summary: 'Lead QA.', responsibilities: ['Own the test plan'],
    });
    renderAt(`/jds/${jd.id}`);
    expect(screen.getByRole('heading', { name: /Job Overview/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Original/ })).toBeNull();
    expect(screen.queryByText('PASTED SOURCE TEXT')).toBeNull();
  });

  it('shows the pasted text for an older JD without an overview', () => {
    makeLegacyJd('jd-2026-001');
    renderAt('/jds/jd-2026-001');
    expect(screen.getByRole('heading', { name: /Original Job Description/ })).toBeInTheDocument();
  });

  it('keeps an older JD without structured fields as before', () => {
    makeLegacyJd('jd-2026-001');
    renderAt('/jds/jd-2026-001');
    expect(screen.queryByRole('heading', { name: 'Job Overview' })).toBeNull();
    expect(screen.queryByText('QUALIFICATIONS')).toBeNull();
    expect(screen.queryByText('COMPENSATION & BENEFITS')).toBeNull();
  });
});

describe('JdDetailPage jobs', () => {
  it('lists the jobs that use the JD, linking to each', () => {
    renderAt('/jds/jd-2026-001');
    const card = screen.getByRole('heading', { name: /Jobs using this JD/ }).parentElement!;
    expect(within(card).getByRole('link', { name: /Senior Flutter & Java Engineer/ })).toHaveAttribute('href', '/jobs/job-3');
    expect(within(card).getByRole('link', { name: /^Mobile Engineer \(Flutter\)/ })).toHaveAttribute('href', '/jobs/job-5');
  });

  it('says when no job uses the JD', () => {
    useStore.setState({ jobs: [] });
    renderAt('/jds/jd-2026-001');
    expect(screen.getByText('No job uses this JD yet.')).toBeInTheDocument();
  });
});

const JD_TEXT = [
  'SENIOR DATA ENGINEER',
  'Remote role for a fintech product. Advanced English required.',
  '',
  'Responsibilities',
  '- Build data pipelines',
  '- Own the warehouse',
  '',
  'Must have',
  '- 5+ years with Python and PostgreSQL',
  '- Docker in production',
  '',
  'Nice to have',
  '- Airflow',
  '',
  'Benefits',
  '- 13th month salary',
].join('\n');

const addTag = (label: RegExp, value: string) => {
  const box = screen.getByLabelText(label, { selector: 'input' });
  fireEvent.change(box, { target: { value } });
  fireEvent.keyDown(box, { key: 'Enter' });
};

describe('isJobTitle', () => {
  it('treats one short line as a title and anything longer as a JD', () => {
    expect(isJobTitle('Senior Backend Engineer')).toBe(true);
    expect(isJobTitle('  QA Lead  ')).toBe(true);
    expect(isJobTitle('')).toBe(false);
    expect(isJobTitle('BACKEND ENGINEER\n- Java')).toBe(false);
    expect(isJobTitle('We are looking for a senior engineer who loves building APIs at scale')).toBe(false);
  });
});

describe('JdEditorPage', () => {
  it('one click fills the form, lists what was filled per section, and Undo restores the form', () => {
    renderAt('/jds/new');
    fireEvent.change(screen.getByLabelText(/JD Title/), { target: { value: 'My own title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senior Backend Engineer' }));
    expect(screen.getByLabelText('Job title or JD text')).toHaveValue('Senior Backend Engineer');
    fireEvent.click(screen.getByRole('button', { name: /Fill form with AI/ }));
    expect(screen.getByLabelText(/JD Title/)).toHaveValue('Senior Backend Engineer');
    expect(screen.getByText(/4 skills · 3 must-have · 1 nice-to-have · 5 yrs/)).toBeInTheDocument();
    // Three sections only: the old "Full Text & Careers Content" row is gone.
    expect(screen.queryByText(/^4\. /)).toBeNull();
    // A title alone gives no domain: the bar says what is still required, and it clears once filled.
    expect(screen.getByText('Still empty: Domain')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Domain/, { selector: 'input' }), { target: { value: 'Fintech' } });
    fireEvent.keyDown(screen.getByLabelText(/^Domain/, { selector: 'input' }), { key: 'Enter' });
    expect(screen.queryByText('Still empty: Domain')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    expect(screen.getByLabelText(/JD Title/)).toHaveValue('My own title');
    expect(screen.getByLabelText('Job title or JD text')).toHaveValue('Senior Backend Engineer');
  });

  it('an uploaded .md file shows its text on the page; rewriting or filling is up to the user', async () => {
    renderAt('/jds/new');
    const file = new File([JD_TEXT], 'jd.md', { type: 'text/markdown' });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    const box = screen.getByLabelText('Job title or JD text') as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toContain('SENIOR DATA ENGINEER'));
    // Tall enough to read the whole file; nothing is rewritten or filled yet.
    expect(box.rows).toBeGreaterThan(3);
    expect(screen.queryByLabelText('Standard JD draft')).toBeNull();
    expect(screen.getByLabelText(/JD Title/)).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: /Rewrite to standard/ }));
    fireEvent.click(screen.getByRole('button', { name: /Looks right, fill the form/ }));
    expect(screen.getByLabelText(/JD Title/)).toHaveValue('Senior Data Engineer');
  });

  it('Rewrite to standard shows an editable standard draft and only fills the form once confirmed', () => {
    renderAt('/jds/new');
    fireEvent.change(screen.getByLabelText('Job title or JD text'), { target: { value: JD_TEXT } });
    fireEvent.click(screen.getByRole('button', { name: /Rewrite to standard/ }));
    const draft = screen.getByLabelText('Standard JD draft') as HTMLTextAreaElement;
    expect(draft.value).toMatch(/^Senior Data Engineer\n/);
    expect(draft.value).toContain('Requirements (must-have):\n- 5+ years with Python and PostgreSQL');
    // Nothing reaches the form while reviewing.
    expect(screen.getByLabelText(/JD Title/)).toHaveValue('');
    fireEvent.change(draft, { target: { value: draft.value.replace('Senior Data Engineer', 'Lead Data Engineer') } });
    fireEvent.click(screen.getByRole('button', { name: /Looks right, fill the form/ }));
    expect(screen.getByLabelText(/JD Title/)).toHaveValue('Lead Data Engineer');
    expect(screen.getByLabelText(/Responsibilities/)).toHaveValue('Build data pipelines\nOwn the warehouse');
    expect(screen.getByRole('heading', { name: 'Form filled by AI from “the standard rewrite”' })).toBeInTheDocument();
  });

  it('standardizes pasted text, applies it to the form and saves a draft with the client', () => {
    renderAt('/jds/new');
    expect(screen.getByRole('button', { name: /Fill form with AI/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Job title or JD text'), { target: { value: JD_TEXT } });
    expect(screen.getByRole('status')).toHaveTextContent('Full JD: AI will read it');
    fireEvent.click(screen.getByRole('button', { name: /Fill form with AI/ }));
    expect(screen.getByLabelText(/JD Title/)).toHaveValue('Senior Data Engineer');
    // Applied: the AI card folds into a bar that offers to start over.
    expect(screen.getByRole('heading', { name: 'Form filled by AI from “your JD text”' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start over with AI/ }));
    expect(screen.getByLabelText('Job title or JD text')).toHaveValue('');
    expect(screen.getByLabelText(/Working Model/)).toHaveValue('Remote');
    expect(screen.getByLabelText(/Responsibilities/)).toHaveValue('Build data pipelines\nOwn the warehouse');
    fireEvent.change(screen.getByLabelText('Client / Company'), { target: { value: 'Contoso Bank' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    const created = useStore.getState().jds.find((j) => j.title === 'Senior Data Engineer')!;
    expect(created).toMatchObject({
      client: 'Contoso Bank', status: 'Draft', skills: ['Python', 'PostgreSQL', 'Docker'], domains: ['Fintech'],
      mustHave: ['5+ years with Python and PostgreSQL', 'Docker in production'], niceToHave: ['Airflow'],
      seniority: 'Senior', minYears: 5, english: 'Advanced', workingModel: 'Remote',
    });
    expect(screen.getByRole('heading', { name: 'Senior Data Engineer' })).toBeInTheDocument();
  });

  it('adds tags with Enter, skips duplicates and removes with x', () => {
    renderAt('/jds/new');
    addTag(/Tech Stack Tags/, 'Go');
    addTag(/Tech Stack Tags/, 'go');
    expect(screen.getAllByText('Go')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Go' }));
    expect(screen.queryByText('Go')).toBeNull();
  });

  it('needs only a title for a draft and has no Publish button', () => {
    renderAt('/jds/new');
    expect(screen.queryByRole('button', { name: /^Publish$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    expect(useStore.getState().jds).toHaveLength(5);
    fireEvent.change(screen.getByLabelText(/JD Title/), { target: { value: 'QA Lead' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    expect(useStore.getState().jds.find((j) => j.title === 'QA Lead')!.status).toBe('Draft');
  });

  it('Run Match on an edited JD saves it and opens JD Matching', () => {
    makeLegacyJd('jd-2026-002');
    renderAt('/jds/jd-2026-002/edit');
    expect(screen.getByLabelText(/JD Title/)).toHaveValue('Senior Frontend Developer');
    expect(screen.getByLabelText(/Seniority Level/)).toHaveValue('Senior');
    expect(screen.getByLabelText(/Min\. Experience/)).toHaveValue(5);
    addTag(/Must-Have Skills/, 'React 18');
    // The seed JD never states an English level, which Run Match requires.
    fireEvent.click(screen.getByRole('button', { name: /Save & Match/ }));
    expect(screen.queryByTestId('where')).toBeNull();
    fireEvent.change(screen.getByLabelText(/English Level/), { target: { value: 'Intermediate' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Match/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/jd-matching?jd=jd-2026-002');
    expect(useStore.getState().jds.find((j) => j.id === 'jd-2026-002')).toMatchObject({ status: 'Published', mustHave: ['React 18'], english: 'Intermediate' });
  });

  it('asks before leaving with unsaved changes', () => {
    renderAt('/jds/new');
    fireEvent.change(screen.getByLabelText(/JD Title/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByText('ID: JD-2026-004')).toBeInTheDocument();
  });

  it('names where the header back arrow goes: the list, the JD, or the job form', () => {
    const a = renderAt('/jds/new');
    expect(screen.getByRole('button', { name: 'Back to JD Management' })).toBeInTheDocument();
    a.unmount();
    const b = renderAt('/jds/jd-2026-002/edit');
    const title = useStore.getState().jds.find((j) => j.id === 'jd-2026-002')!.title;
    expect(screen.getByRole('button', { name: `Back to ${title}` })).toBeInTheDocument();
    b.unmount();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/jds/new', state: { returnTo: '/jobs/new' } }]}>
        <Routes>
          <Route path="/jds/new" element={<JdEditorPage mode="create" />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back to the job form' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/jobs/new');
  });

  it("has no Full Text section; an older JD's daily tasks join its responsibilities on save", () => {
    const jd = useStore.getState().createJd({
      title: 'Ops Analyst', client: '', domains: [], skills: ['SQL'], body: 'Original pasted JD',
      responsibilities: ['Build reports'], dailyTasks: ['Stand-up', 'Build reports'], skillsExperience: '- SQL',
    });
    renderAt(`/jds/${jd.id}/edit`);
    expect(screen.queryByRole('heading', { name: /Full Text/ })).toBeNull();
    expect(screen.queryByLabelText('Your skills and experience')).toBeNull();
    expect(screen.queryByLabelText('Daily Tasks')).toBeNull();
    expect(screen.getByLabelText(/Responsibilities/)).toHaveValue('Build reports\nStand-up');
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    expect(useStore.getState().jds.find((j) => j.id === jd.id)).toMatchObject({
      responsibilities: ['Build reports', 'Stand-up'], dailyTasks: [], skillsExperience: '', body: 'Original pasted JD',
    });
  });

  it('generates a draft from the job title alone and applies it', () => {
    renderAt('/jds/new');
    fireEvent.change(screen.getByLabelText('Job title or JD text'), { target: { value: 'Junior Frontend Developer' } });
    expect(screen.getByRole('status')).toHaveTextContent('Job title: AI will write a draft');
    fireEvent.click(screen.getByRole('button', { name: /Fill form with AI/ }));
    expect(screen.getByLabelText(/JD Title/)).toHaveValue('Junior Frontend Developer');
    expect(screen.getByLabelText(/Seniority Level/)).toHaveValue('Junior');
    expect(screen.getByLabelText(/Min\. Experience/)).toHaveValue(1);
    expect((screen.getByLabelText(/Job Summary/) as HTMLTextAreaElement).value).toContain('Junior Frontend Developer');
    expect((screen.getByLabelText(/Responsibilities/) as HTMLTextAreaElement).value).toContain('Build responsive, accessible user interfaces');
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('saves the new requirement fields and critical skills', () => {
    renderAt('/jds/new');
    fireEvent.change(screen.getByLabelText(/JD Title/), { target: { value: 'Data Analyst' } });
    addTag(/Tech Stack Tags/, 'SQL');
    addTag(/Tech Stack Tags/, 'Python');
    fireEvent.click(screen.getByRole('button', { name: 'Mark SQL as critical' }));
    expect(screen.getByRole('button', { name: 'Mark SQL as critical' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Education Level'), { target: { value: 'bachelor' } });
    fireEvent.change(screen.getByLabelText('Major / Field of Study'), { target: { value: 'Statistics' } });
    addTag(/Other Languages/, 'Japanese - N2');
    addTag(/Certifications/, 'Google Data Analytics');
    fireEvent.change(screen.getByLabelText(/Responsibilities/), { target: { value: 'Stand-up\nBuild reports' } });
    fireEvent.change(screen.getByLabelText('About the Team'), { target: { value: 'Five analysts' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    expect(useStore.getState().jds.find((j) => j.title === 'Data Analyst')).toMatchObject({
      criticalSkills: ['SQL'], education: 'bachelor', major: 'Statistics', languages: ['Japanese - N2'],
      certifications: ['Google Data Analytics'],
      responsibilities: ['Stand-up', 'Build reports'], dailyTasks: [], aboutTeam: 'Five analysts',
    });
  });

  it('Run Match does not need a summary or responsibilities', () => {
    renderAt('/jds/new');
    fireEvent.change(screen.getByLabelText(/JD Title/), { target: { value: 'Go Engineer' } });
    addTag(/Tech Stack Tags/, 'Go');
    addTag(/Must-Have Skills/, '3+ years of Go');
    addTag(/^Domain/, 'Fintech');
    fireEvent.click(screen.getByRole('button', { name: /Save & Match/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/jd-matching?jd=');
  });

  it('offers one-click suggestions that follow the form, and a filtered dropdown while typing', () => {
    renderAt('/jds/new');
    fireEvent.change(screen.getByLabelText(/JD Title/), { target: { value: 'Senior Backend Engineer' } });
    // Role stack for the title, one click each.
    fireEvent.click(screen.getByRole('button', { name: 'Add Node.js' }));
    expect(screen.getByRole('button', { name: 'Mark Node.js as critical' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Node.js' })).toBeNull();
    // Must-have ideas are built from the stack and years.
    fireEvent.click(screen.getByRole('button', { name: 'Add Hands-on production experience with Node.js' }));
    expect(screen.getByText('Hands-on production experience with Node.js')).toBeInTheDocument();
    // Dropdown: type, arrow down, Enter picks the highlighted option.
    const stack = screen.getByLabelText(/Tech Stack Tags/, { selector: 'input' });
    fireEvent.change(stack, { target: { value: 'postg' } });
    expect(screen.getByRole('listbox', { name: /Tech Stack Tags/ })).toBeInTheDocument();
    fireEvent.keyDown(stack, { key: 'ArrowDown' });
    fireEvent.keyDown(stack, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Mark PostgreSQL as critical' })).toBeInTheDocument();
    // Typing a known option in another case keeps its proper spelling.
    fireEvent.change(stack, { target: { value: 'docker' } });
    fireEvent.keyDown(stack, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Mark Docker as critical' })).toBeInTheDocument();
  });

  it('shows not found for an unknown JD', () => {
    renderAt('/jds/nope/edit');
    expect(screen.getByText('Job description not found')).toBeInTheDocument();
  });
});
