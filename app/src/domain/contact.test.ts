import { describe, expect, it } from 'vitest';
import { contactErrors } from './contact';

describe('contactErrors', () => {
  it('accepts blanks and well-formed values', () => {
    expect(contactErrors('', '')).toEqual({});
    expect(contactErrors('an.nguyen@example.com', '+84 901 234 567')).toEqual({});
    expect(contactErrors('x@y.vn', '0901-234-567')).toEqual({});
  });

  it('flags a malformed email', () => {
    expect(contactErrors('an.nguyen@', '')).toEqual({ email: true });
    expect(contactErrors('an nguyen@example.com', '')).toEqual({ email: true });
  });

  it('flags a phone that is too short, too long or has letters', () => {
    expect(contactErrors('', '12345')).toEqual({ phone: true });
    expect(contactErrors('', '0901 234 567 890 123 45')).toEqual({ phone: true });
    expect(contactErrors('', '0901abc567')).toEqual({ phone: true });
  });
});
