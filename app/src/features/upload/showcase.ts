import { mulberry32 } from '../../data/seed';
import { hashString, parseCvFile, parseReport, type UploadLimits } from '../../domain/parseCv';
import type { Candidate } from '../../domain/types';
import type { QueueRow } from './useUploadQueue';

const KB = 1024;
const MB = 1024 * KB;

const cvName = (name: string, ext = 'pdf') => `${name.replace(/\s+/g, '_')}_CV.${ext}`;

/**
 * Rows already in the queue when the page opens, so every state is visible without uploading: CVs added to the
 * pool, one merged, one possible duplicate waiting for HR (Merge / Skip work), one skipped and each failure
 * reason. They point at existing candidates and write nothing to the store until HR acts on the duplicate.
 */
export function showcaseRows(limits: UploadLimits, candidates: Candidate[]): QueueRow[] {
  if (candidates.length < 6) return [];
  const [dup, merged, ...rest] = candidates;
  const added = rest.slice(0, 3);
  const exts = ['pdf', 'docx', 'pdf'].filter((e) => limits.extensions.includes(e));
  const size = (i: number) => 180 * KB + ((i * 7919) % 900) * KB;

  const dupFile = { name: cvName(dup.name), size: 420 * KB };
  const parsed = parseCvFile(dupFile, mulberry32(hashString(dupFile.name)));
  const input = { ...parsed, parse: parseReport(dupFile.name, parsed, new Date().toISOString()) };

  const rows: Omit<QueueRow, 'id'>[] = [
    ...added.map((c, i) => ({
      name: cvName(c.name, exts[i % exts.length]), size: size(i), status: 'done' as const, progress: 100,
      outcome: 'created' as const, candidateId: c.id,
    })),
    { name: cvName(merged.name, 'docx'), size: size(5), status: 'done', progress: 100, outcome: 'merged', candidateId: merged.id },
    { ...dupFile, status: 'review', progress: 100, input, duplicateId: dup.id, duplicateName: dup.name },
    { name: 'Tran_Van_Binh_CV_cu.pdf', size: size(7), status: 'skipped', progress: 100 },
    { name: 'Portfolio_thiet_ke.png', size: 2 * MB, status: 'failed', progress: 0, reason: 'type' },
    { name: 'Nguyen_Hoai_Nam_CV_scan.pdf', size: Math.round(8.4 * MB), status: 'failed', progress: 0, reason: 'size' },
    { name: 'Scan_CV_hong.pdf', size: 96 * KB, status: 'failed', progress: 0, reason: 'parse' },
    // Only a small batch limit can be hit in practice (10 in Standard, not 1000 in Ultra).
    ...(limits.maxFiles <= 50
      ? [{ name: 'Quach_Tieu_Phung_CV.pdf', size: size(9), status: 'failed' as const, progress: 0, reason: 'batch' as const }]
      : []),
  ];
  return rows.map((r, i) => ({ ...r, id: i + 1 }));
}
