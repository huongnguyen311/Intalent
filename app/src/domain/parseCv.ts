import { DOMAINS, ENGLISH, FIRST_NAMES, LAST_NAMES, MIDDLE_NAMES, SENIORITY, SKILLS, TITLES } from '../data/names';
import type { Rng } from '../data/seed';
import { PARSE_FIELDS, type CandidateInput, type ParseField, type ParseResult } from './types';

export const PARSE_MODEL = 'intalent-parse-v1';
/** Fields below this confidence are flagged for HR to check. */
export const LOW_CONFIDENCE = 0.7;

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

/**
 * Splits one selection into accepted files and rejected ones (with the reason). Only valid files count toward
 * `maxFiles`, so a wrong type or an oversized file never pushes a good one out of the batch.
 */
export function validateFiles<T extends FileLike>(
  files: T[],
  limits: UploadLimits,
): { accepted: T[]; rejected: { file: T; reason: RejectReason }[] } {
  const accepted: T[] = [];
  const rejected: { file: T; reason: RejectReason }[] = [];
  files.forEach((file) => {
    if (!limits.extensions.includes(extensionOf(file.name))) rejected.push({ file, reason: 'type' });
    else if (file.size > limits.maxBytes) rejected.push({ file, reason: 'size' });
    else if (accepted.length >= limits.maxFiles) rejected.push({ file, reason: 'batch' });
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

/**
 * Simulated CV parse for forms an applicant or TA is filling in. The fake email is withheld (a made-up address
 * could match an existing profile and merge two people) and the name is kept only when the file name yields one.
 */
export function cvPrefill(file: FileLike, rng: Rng): CandidateInput {
  return { ...parseCvFile(file, rng), name: nameFromFileName(file.name), email: '' };
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

/**
 * Simulated parse quality for a file: confidence per field from a hash of the file name (no rng draws, so the
 * extracted values above stay the same), and fields that came back empty listed as missing.
 */
export function parseReport(fileName: string, input: CandidateInput, at: string): ParseResult {
  const h = hashString(`${fileName}#parse`);
  const confidence: Partial<Record<ParseField, number>> = {};
  const missing: ParseField[] = [];
  PARSE_FIELDS.forEach((f, i) => {
    const v = input[f];
    if (Array.isArray(v) ? v.length === 0 : !v) {
      missing.push(f);
      return;
    }
    // Contact details are usually clean; seniority/English are inferred and less certain.
    const floor = f === 'name' || f === 'email' || f === 'phone' ? 0.8 : 0.5;
    confidence[f] = Math.round((floor + (((h >>> (i * 3)) & 0xff) / 255) * (0.99 - floor)) * 100) / 100;
  });
  return { model: PARSE_MODEL, at, confidence, missing };
}

/** Fields HR should check: low confidence first, then missing. */
export function fieldsToCheck(parse: ParseResult): { low: ParseField[]; missing: ParseField[] } {
  const low = PARSE_FIELDS.filter((f) => (parse.confidence[f] ?? 1) < LOW_CONFIDENCE);
  return { low, missing: parse.missing };
}
