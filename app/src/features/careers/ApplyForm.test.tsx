import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { AppRoutes } from '../../routes';
import { useStore } from '../../store/store';

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  );

let jobId: string;
let closedId: string;
let campaignId: string;

beforeEach(() => {
  const seed = buildSeed();
  useStore.setState({ ...seed, applications: [], activities: [], ui: { ...seed.ui, careersLang: 'en' } });
  jobId = seed.jobs.find((j) => j.status === 'open')!.id;
  closedId = seed.jobs.find((j) => j.status !== 'open')!.id;
  campaignId = seed.campaigns[0].id;
});

const fill = (name: string, email: string) => {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
};
const consent = () => fireEvent.click(screen.getByRole('checkbox'));
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

describe('Careers site', () => {
  it('lists only open jobs and shows the job description with an apply link keeping ?src', () => {
    renderAt('/careers');
    const open = useStore.getState().jobs.filter((j) => j.status === 'open');
    expect(screen.getByTestId('careers-grid').children).toHaveLength(open.length);
    expect(screen.queryByText(useStore.getState().jobs.find((j) => j.id === closedId)!.title)).toBeNull();
  });

  it('job page keeps ?src on the apply link', () => {
    renderAt(`/careers/${jobId}?src=${campaignId}-linkedin`);
    expect(screen.getByRole('link', { name: 'Apply now' })).toHaveAttribute('href', `/careers/${jobId}/apply?src=${campaignId}-linkedin`);
  });

  it('closed job shows the unavailable page on job and apply routes', () => {
    for (const p of [`/careers/${closedId}`, `/careers/${closedId}/apply`, '/careers/nope']) {
      const { unmount } = renderAt(p);
      expect(screen.getByText('This job is no longer available')).toBeInTheDocument();
      unmount();
    }
  });

  it('validates name, contact and consent without creating anything', () => {
    renderAt(`/careers/${jobId}/apply`);
    submit();
    expect(screen.getByText('Please enter your name')).toBeInTheDocument();
    expect(screen.getByText('Enter an email or a phone number')).toBeInTheDocument();
    expect(screen.getByText('You need to agree before applying')).toBeInTheDocument();
    expect(useStore.getState().applications).toHaveLength(0);
  });

  it('rejects a CV that is not PDF or DOCX', () => {
    renderAt(`/careers/${jobId}/apply`);
    fireEvent.change(screen.getByLabelText(/^CV/), { target: { files: [new File(['x'], 'cv.exe')] } });
    expect(screen.getByText('Only PDF or DOCX files are accepted')).toBeInTheDocument();
  });

  it('submits an application with the campaign channel and shows the confirmation', () => {
    renderAt(`/careers/${jobId}/apply?src=${campaignId}-topcv`);
    fill('Pham Thi Test', 'pham.test@example.com');
    consent();
    submit();
    expect(screen.getByTestId('careers-applied')).toBeInTheDocument();
    expect(useStore.getState().applications[0]).toMatchObject({ stage: 'new', source: 'TopCV', via: 'campaign', campaignId });
  });

  it('applying again shows the already applied page and adds nothing', () => {
    useStore.getState().applyFromCareers({ name: 'Pham Thi Test', email: 'pham.test@example.com' }, jobId);
    renderAt(`/careers/${jobId}/apply`);
    fill('Pham Thi Test', 'PHAM.test@example.com');
    consent();
    submit();
    expect(screen.getByTestId('careers-already-applied')).toBeInTheDocument();
    expect(screen.getByText(/Current status: Received/)).toBeInTheDocument();
    expect(useStore.getState().applications).toHaveLength(1);
  });

  it('status check lists applications with friendly stage words', () => {
    useStore.getState().applyFromCareers({ name: 'Pham Thi Test', email: 'pham.test@example.com' }, jobId);
    renderAt('/careers/status');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'pham.test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check status' }));
    expect(screen.getByText('Received')).toBeInTheDocument();
  });

  it('language toggle switches the careers scope to Vietnamese', () => {
    renderAt('/careers');
    fireEvent.click(screen.getByRole('button', { name: /^vi$/i }));
    expect(useStore.getState().ui.careersLang).toBe('vi');
    expect(screen.getAllByText('Tra cứu hồ sơ').length).toBeGreaterThan(0);
  });
});
