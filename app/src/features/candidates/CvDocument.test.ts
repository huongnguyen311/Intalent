import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { paginate } from './CvDocument';

describe('CV original document', () => {
  it('breaks pages when content overflows, never mid-block', () => {
    expect(paginate([{}, {}, {}], [400, 400, 400], 1000)).toEqual([[0, 1], [2]]);
  });

  it('keeps a heading on the same page as the block after it', () => {
    expect(paginate([{}, { keep: true }, {}], [800, 50, 300], 1000)).toEqual([[0], [1, 2]]);
  });

  it('one page when nothing is measured (no layout engine)', () => {
    expect(paginate([{}, {}], [0, 0])).toEqual([[0, 1]]);
  });

  it('seeded CVs carry bullets, competencies, certifications and languages', () => {
    const full = buildSeed().candidates.filter((c) => c.experience?.length);
    expect(full.every((c) => c.experience!.every((x) => x.highlights?.length))).toBe(true);
    expect(full.every((c) => c.competencies?.length && c.languages?.length && c.certifications?.length && c.address)).toBe(true);
    expect(full.some((c) => c.projects?.length)).toBe(true);
  });
});
