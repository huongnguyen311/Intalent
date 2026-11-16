import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed, mulberry32 } from '../data/seed';
import { useStore } from '../store/store';
import { ULTRA_LIMITS, UPLOAD_LIMITS, parseCvFile, validateFiles } from './parseCv';

const MB = 1024 * 1024;
const f = (name: string, size = 1000) => ({ name, size });

beforeEach(() => useStore.setState(buildSeed()));

describe('validateFiles', () => {
  it('rejects files over 5MB and wrong types', () => {
    const { accepted, rejected } = validateFiles(
      [f('a.pdf'), f('big.pdf', 5 * MB + 1), f('exactly.docx', 5 * MB), f('pic.png'), f('notes.txt'), f('NOEXT')],
      UPLOAD_LIMITS,
    );
    expect(accepted.map((x) => x.name)).toEqual(['a.pdf', 'exactly.docx', 'notes.txt']);
    expect(rejected.map((r) => [r.file.name, r.reason])).toEqual([
      ['big.pdf', 'size'],
      ['pic.png', 'type'],
      ['NOEXT', 'type'],
    ]);
  });

  it('Ultra does not accept TXT', () => {
    expect(validateFiles([f('a.txt')], ULTRA_LIMITS).rejected[0].reason).toBe('type');
  });

  it('batch over 10 files rejects extras', () => {
    const files = Array.from({ length: 12 }, (_, i) => f(`cv${i}.pdf`));
    const { accepted, rejected } = validateFiles(files, UPLOAD_LIMITS);
    expect(accepted).toHaveLength(10);
    expect(rejected.map((r) => [r.file.name, r.reason])).toEqual([
      ['cv10.pdf', 'batch'],
      ['cv11.pdf', 'batch'],
    ]);
    expect(validateFiles(files, ULTRA_LIMITS).rejected).toHaveLength(0);
  });
});

describe('parseCvFile', () => {
  it('derives the name from the file name and fills fictional fields', () => {
    const r = parseCvFile(f('Nguyen_Van_A_CV.pdf'), mulberry32(1));
    expect(r.name).toBe('Nguyen Van A');
    expect(r.email).toBe('a.nguyen@example.com');
    expect(r.skills!.length).toBeGreaterThanOrEqual(3);
    expect(r.seniority).toBeTruthy();
    expect(r.english).toBeTruthy();
  });

  it('falls back to a generated name and is deterministic per rng', () => {
    const a = parseCvFile(f('12345.pdf'), mulberry32(7));
    expect(a.name.split(' ')).toHaveLength(3);
    expect(a.email).toMatch(/@example\.com$/);
    expect(parseCvFile(f('12345.pdf'), mulberry32(7))).toEqual(a);
  });

  it('parsed duplicate merges instead of creating', () => {
    const fileFor = (name: string) => f(`${name.replace(/ /g, '_')}_CV.pdf`);
    const existing = useStore
      .getState()
      .candidates.find((c) => parseCvFile(fileFor(c.name), mulberry32(1)).email === c.email)!;
    expect(existing).toBeDefined();
    const before = useStore.getState().candidates.length;
    const input = parseCvFile(fileFor(existing.name), mulberry32(2));
    const res = useStore.getState().upsertCandidate(input, { source: 'CV Upload', by: 'u-admin' });
    expect(res.created).toBe(false);
    expect(res.candidate.id).toBe(existing.id);
    expect(useStore.getState().candidates).toHaveLength(before);
    expect(res.candidate.source).toBe(existing.source);
  });
});
