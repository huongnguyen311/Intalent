import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed, mulberry32 } from '../../data/seed';
import { parseCvFile } from '../../domain/parseCv';
import { useStore } from '../../store/store';
import { UltraUploadPage } from './UltraUploadPage';
import { UploadPage } from './UploadPage';
import { AppRoutes } from '../../routes';

vi.mock('../../components/Toast', () => ({
  toast: vi.fn(),
  Toaster: () => null,
}));

const MB = 1024 * 1024;
const mk = (name: string, size = 1000) => {
  const file = new File(['x'], name);
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const renderPage = (ui: JSX.Element) => render(<MemoryRouter>{ui}</MemoryRouter>);
const pick = (container: HTMLElement, files: File[]) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
};
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  useStore.setState(buildSeed());
});
afterEach(() => {
  vi.useRealTimers();
  window.history.pushState({}, '', '/');
});

describe('UploadPage', () => {
  it('renders the empty queue like the mockup', () => {
    renderPage(<UploadPage />);
    // Outside fixture mode the title and subtitle live in the page header only (no repeated in-page heading).
    expect(screen.queryByText('Upload Resumes')).toBeNull();
    expect(screen.getByText('Batch ingestion for candidate pool')).toBeInTheDocument();
    expect(screen.getByText('Max 5MB per file • Max 10 files/batch')).toBeInTheDocument();
    expect(screen.getByText('No files in queue')).toBeInTheDocument();
  });

  it('rejects files over 5MB and wrong types with a reason', () => {
    const { container } = renderPage(<UploadPage />);
    const before = useStore.getState().candidates.length;
    pick(container, [mk('big.pdf', 5 * MB + 1), mk('pic.png')]);
    expect(screen.getByText('File exceeds 5 MB')).toBeInTheDocument();
    expect(screen.getByText('Unsupported file type')).toBeInTheDocument();
    advance(10_000);
    expect(useStore.getState().candidates).toHaveLength(before);
  });

  it('batch over 10 files rejects extras', () => {
    const { container } = renderPage(<UploadPage />);
    pick(
      container,
      Array.from({ length: 12 }, (_, i) => mk(`Tran_Van_Cv${String.fromCharCode(97 + i)}.pdf`)),
    );
    expect(screen.getAllByText('Batch limit exceeded (max 10 files)')).toHaveLength(2);
    advance(60_000);
    expect(screen.getAllByText('Added to Talent Pool')).toHaveLength(10);
  });

  it('creates a candidate for a new file, attributed to CV Upload', () => {
    const { container } = renderPage(<UploadPage />);
    const before = useStore.getState().candidates.length;
    pick(container, [mk('Zzz_Qqq_Xx_CV.pdf')]);
    advance(120);
    expect(screen.getByText('Parsing…')).toBeInTheDocument();
    advance(5_000);
    const s = useStore.getState();
    expect(s.candidates).toHaveLength(before + 1);
    const created = s.candidates.find((c) => c.name === 'Zzz Qqq Xx')!;
    expect(created.source).toBe('CV Upload');
    expect(created.email).toMatch(/@example\.com$/);
    expect(screen.getByText('Added to Talent Pool')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', `/candidates/${created.id}`);
  });

  it('a parsed duplicate waits for HR to merge it', () => {
    const fileFor = (name: string) => `${name.replace(/ /g, '_')}_CV.pdf`;
    const existing = useStore.getState().candidates.find((c) => parseCvFile({ name: fileFor(c.name), size: 1 }, mulberry32(1)).email === c.email)!;
    const { container } = renderPage(<UploadPage />);
    const before = useStore.getState().candidates.length;
    const merges = () => useStore.getState().activities.filter((a) => a.type === 'candidate_merged').length;
    const mergedBefore = merges();
    pick(container, [mk(fileFor(existing.name))]);
    advance(5_000);
    expect(screen.getByText(`Possible duplicate of ${existing.name}`)).toBeInTheDocument();
    expect(merges()).toBe(mergedBefore);
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(useStore.getState().candidates).toHaveLength(before);
    expect(screen.getByText('Merged into existing profile')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', `/candidates/${existing.id}`);
    expect(useStore.getState().activities.slice(-1)[0]?.type).toBe('candidate_merged');
  });

  it('a skipped duplicate leaves the existing profile untouched', () => {
    const fileFor = (name: string) => `${name.replace(/ /g, '_')}_CV.pdf`;
    const existing = useStore.getState().candidates.find((c) => parseCvFile({ name: fileFor(c.name), size: 1 }, mulberry32(1)).email === c.email)!;
    const snapshot = JSON.stringify(existing);
    const { container } = renderPage(<UploadPage />);
    pick(container, [mk(fileFor(existing.name))]);
    advance(5_000);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(JSON.stringify(useStore.getState().candidates.find((c) => c.id === existing.id))).toBe(snapshot);
  });

  it('files over the batch limit can be retried', () => {
    const { container } = renderPage(<UploadPage />);
    pick(container, Array.from({ length: 11 }, (_, i) => mk(`Tran_Van_Cv${String.fromCharCode(97 + i)}.pdf`)));
    advance(60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    advance(5_000);
    expect(screen.getAllByText('Added to Talent Pool')).toHaveLength(11);
  });

  it('shows a summary of the batch', () => {
    const { container } = renderPage(<UploadPage />);
    pick(container, [mk('Zzz_Qqq_Xx_CV.pdf'), mk('bad.exe')]);
    advance(5_000);
    expect(screen.getByText('1 added · 0 to review · 1 failed')).toBeInTheDocument();
  });

  it('clears its timer on unmount', () => {
    const { container, unmount } = renderPage(<UploadPage />);
    const baseline = vi.getTimerCount();
    pick(container, [mk('Le_Van_B_CV.pdf')]);
    expect(vi.getTimerCount()).toBe(baseline + 1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('UltraUploadPage', () => {
  it('starts empty with Upload & Process disabled', () => {
    renderPage(<UltraUploadPage />);
    expect(screen.getByText('AI CV Processor Ultra')).toBeInTheDocument();
    expect(screen.getByText('PDF, DOCX only | Max 5MB each | Up to 1000 files')).toBeInTheDocument();
    expect(screen.getByText('No files selected yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload & Process/ })).toBeDisabled();
  });

  it('rejects TXT, queues PDF/DOCX and only parses after Upload & Process', () => {
    const { container } = renderPage(<UltraUploadPage />);
    const before = useStore.getState().candidates.length;
    pick(container, [mk('notes.txt'), mk('Pham_Thi_C_CV.pdf'), mk('Do_Van_D_CV.docx')]);
    expect(screen.getByText('Unsupported file type')).toBeInTheDocument();
    advance(5_000);
    expect(useStore.getState().candidates).toHaveLength(before);
    expect(screen.getAllByText('Queued')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Upload & Process/ }));
    advance(10_000);
    const s = useStore.getState();
    expect(s.candidates).toHaveLength(before + 2);
    expect(s.candidates.find((c) => c.name === 'Pham Thi C')?.source).toBe('Ultra Upload');
    expect(screen.getAllByText('Added to Talent Pool')).toHaveLength(2);
  });

  it('Clear empties the list and stops the timer', () => {
    const { container } = renderPage(<UltraUploadPage />);
    const baseline = vi.getTimerCount();
    pick(container, [mk('Pham_Thi_C_CV.pdf')]);
    fireEvent.click(screen.getByRole('button', { name: /Upload & Process/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(vi.getTimerCount()).toBe(baseline);
    expect(screen.getByText('No files selected yet')).toBeInTheDocument();
    expect(within(document.body).queryByText('Queued')).toBeNull();
  });
});

describe('Upload mode switch', () => {
  const renderAt = (url: string) =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <AppRoutes />
      </MemoryRouter>,
    );

  it('upload mode switch navigates to ultra and back', () => {
    renderAt('/upload');
    const standard = 'Max 5MB per file • Max 10 files/batch';
    expect(screen.getByText(standard)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Bulk (Ultra)' }));
    expect(screen.queryByText(standard)).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Standard' }));
    expect(screen.getByText(standard)).toBeInTheDocument();
  });

  it('fixture mode shows no tabs or switch', () => {
    window.history.pushState({}, '', '/?fixture=mockup');
    renderAt('/upload');
    expect(screen.queryByRole('link', { name: 'Bulk (Ultra)' })).toBeNull();
  });

  it('ultra fixture mode renders no switch or wrapper', () => {
    window.history.pushState({}, '', '/?fixture=mockup');
    const { container } = renderAt('/upload-ultra');
    expect(screen.queryByRole('navigation', { name: 'Upload mode' })).toBeNull();
    expect(container.querySelector('.text-center.mb-16')?.firstElementChild?.className).not.toContain('justify-center');
  });
});
