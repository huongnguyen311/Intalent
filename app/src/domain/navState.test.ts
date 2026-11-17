import { describe, expect, it } from 'vitest';
import { isGroupOpen, loadNavState, saveNavState } from './navState';

const DEFAULTS = { rail: false, folded: { 'nav.group.configuration': true } };

function fake(value: string | null, throws = false): Storage {
  return {
    getItem: () => {
      if (throws) throw new Error('blocked');
      return value;
    },
    setItem: () => {
      if (throws) throw new Error('blocked');
    },
  } as unknown as Storage;
}

describe('navState', () => {
  it('invalid stored nav state falls back to defaults', () => {
    expect(loadNavState(fake('{bad'))).toEqual(DEFAULTS);
    expect(loadNavState(fake(null, true))).toEqual(DEFAULTS);
    expect(loadNavState(fake('{"rail":1}'))).toEqual(DEFAULTS);
  });

  it('round-trips and swallows save errors', () => {
    const s = { rail: true, folded: { 'nav.group.jd': true } };
    let saved = '';
    const st = { getItem: () => saved, setItem: (_: string, v: string) => (saved = v) } as unknown as Storage;
    saveNavState(s, st);
    expect(loadNavState(st)).toEqual(s);
    expect(() => saveNavState(s, fake(null, true))).not.toThrow();
  });

  it('group with active route is forced open', () => {
    expect(isGroupOpen('nav.group.jd', { rail: false, folded: { 'nav.group.jd': true } }, true)).toBe(true);
    expect(isGroupOpen('nav.group.jd', { rail: false, folded: { 'nav.group.jd': true } }, false)).toBe(false);
    expect(isGroupOpen('nav.group.jd', { rail: false, folded: {} }, false)).toBe(true);
  });
});
