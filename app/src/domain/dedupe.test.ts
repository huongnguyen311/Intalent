import { findDuplicate } from './dedupe';
import type { Candidate } from './types';

const khoa = {
  id: 'c1',
  name: 'Khoa Pham',
  email: 'khoa.pham@example.com',
  phone: '0901234567',
} as Candidate;
const other = { id: 'c2', name: 'Lan Tran', email: 'lan@example.com', phone: '0988000111' } as Candidate;

describe('findDuplicate', () => {
  it('dedupe treats formatting variants as one person', () => {
    const cands = [other, khoa];
    expect(findDuplicate(cands, { phone: '+84 0901 234 567' })).toBe(khoa);
    expect(findDuplicate(cands, { phone: '0901234567' })).toBe(khoa);
    expect(findDuplicate(cands, { phone: '(+84) 901-234-567' })).toBe(khoa);
    expect(findDuplicate(cands, { email: 'KHOA.Pham@Example.com ' })).toBe(khoa);
  });

  it('no match returns undefined', () => {
    expect(findDuplicate([khoa], { email: 'nobody@example.com', phone: '0900000000' })).toBeUndefined();
    expect(findDuplicate([khoa], {})).toBeUndefined();
  });
});
