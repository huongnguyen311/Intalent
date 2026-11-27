import { normalizePhone } from './normalize';

export type ContactErrors = { email?: true; phone?: true };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Blank is allowed (a profile may lack one); a value that is there must look like a real email / phone. */
export function contactErrors(email: string, phone: string): ContactErrors {
  const errors: ContactErrors = {};
  if (email.trim() && !EMAIL_RE.test(email.trim())) errors.email = true;
  const digits = normalizePhone(phone);
  if (phone.trim() && (digits.length < 9 || digits.length > 15 || /[^\d\s+().-]/.test(phone))) errors.phone = true;
  return errors;
}
