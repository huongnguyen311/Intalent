import { DOMAINS, ENGLISH, FIRST_NAMES, LAST_NAMES, MIDDLE_NAMES, SENIORITY, SKILLS, TITLES } from '../data/names';
import type { Rng } from '../data/seed';
import type { CandidateInput } from './types';

export interface UploadLimits {
  /** Accepted file extensions, lower-case, without the dot. */
  extensions: readonly string[];
  maxBytes: number;
  maxFiles: number;
}

const MB = 1024 * 1024;

/** Limits quoted by the mockup copy. */
export const UPLOAD_LIMITS: UploadLimits = { extensions: ['pdf', 'docx', 'txt'], maxBytes: 5 * MB, maxFiles: 10 };
export const ULTRA_LIMITS: UploadLimits = { extensions: ['pdf', 'docx'], maxBytes: 5 * MB, maxFiles: 1000 };

export type RejectReason = 'type' | 'size' | 'batch';

export interface FileLike {
  name: string;
  size: number;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Splits one selection into accepted files and rejected ones (with the reason). Files past `maxFiles` are rejected. */
export function validateFiles<T extends FileLike>(
  files: T[],
  limits: UploadLimits,
): { accepted: T[]; rejected: { file: T; reason: RejectReason }[] } {
  const accepted: T[] = [];
  const rejected: { file: T; reason: RejectReason }[] = [];
  files.forEach((file, i) => {
    if (i >= limits.maxFiles) rejected.push({ file, reason: 'batch' });
    else if (!limits.extensions.includes(extensionOf(file.name))) rejected.push({ file, reason: 'type' });
    else if (file.size > limits.maxBytes) rejected.push({ file, reason: 'size' });
    else accepted.push(file);
  });
  return { accepted, rejected };
}

const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

const NOISE = new Set(['cv', 'resume', 'curriculum', 'vitae', 'final', 'new', 'updated', 'copy']);
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

/** "Nguyen_Van_A_CV.pdf" becomes "Nguyen Van A"; empty when nothing name-like is left. */
export function nameFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return base
    .split(/[^\p{L}]+/u)
    .filter((w) => w && !NOISE.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Same scheme as the seed: family name is the first word, given name the last (`given.family@example.com`). */
export function emailForName(name: string): string {
  const words = name.split(' ');
  const family = fold(words[0]);
  return words.length > 1 ? `${fold(words[words.length - 1])}.${family}@example.com` : `${family}@example.com`;
}

/** Stable 32-bit hash, used to seed an rng per file so re-parsing a file gives the same result. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Fake CV extraction (fictional data). The name comes from the file name, so uploading a file named after an
 * existing candidate (e.g. "Nguyen_Van_A_CV.pdf") yields the same email and merges into that profile.
 */
export function parseCvFile(file: FileLike, rng: Rng): CandidateInput {
  const name =
    nameFromFileName(file.name) || `${pick(rng, LAST_NAMES)} ${pick(rng, MIDDLE_NAMES)} ${pick(rng, FIRST_NAMES)}`;
  const skills: string[] = [];
  for (const n = 3 + Math.floor(rng() * 4); skills.length < n; ) {
    const s = pick(rng, SKILLS);
    if (!skills.includes(s)) skills.push(s);
  }
  const phone = `09${10_000_000 + Math.floor(rng() * 90_000_000)}`;
  return {
    name,
    title: pick(rng, TITLES),
    email: emailForName(name),
    phone: `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`,
    seniority: pick(rng, SENIORITY),
    english: pick(rng, ENGLISH),
    skills,
    domains: [pick(rng, DOMAINS)],
    cv: file.name,
  };
}
