import type { Candidate } from './types';
import { normalizeEmail, normalizePhone } from './normalize';

/** Dedupe key: normalized email first, else normalized phone. */
export function findDuplicate(
  cands: Candidate[],
  input: { email?: string; phone?: string },
): Candidate | undefined {
  const email = input.email ? normalizeEmail(input.email) : '';
  if (email) {
    return cands.find((c) => normalizeEmail(c.email) === email);
  }
  const phone = input.phone ? normalizePhone(input.phone) : '';
  if (phone) {
    return cands.find((c) => c.phone && normalizePhone(c.phone) === phone);
  }
  return undefined;
}
