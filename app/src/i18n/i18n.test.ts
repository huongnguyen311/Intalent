import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi as vitest } from 'vitest';
import { stageLabel, STAGES } from '../domain/stages';
import { useStore } from '../store/store';
import { en } from './en';
import { createTranslator, translate, useLang, useT } from './i18n';
import { vi } from './vi';

afterEach(() => {
  act(() => useStore.getState().resetDemo());
  vitest.restoreAllMocks();
});

describe('dictionaries', () => {
  it('vi and en have identical key sets', () => {
    expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort());
  });
  it('has no empty values', () => {
    for (const d of [en, vi]) for (const v of Object.values(d)) expect(v.trim()).not.toBe('');
  });
});

describe('translate', () => {
  it('interpolates vars', () => {
    const t = createTranslator({ en: { greet: 'Hi {name}, {n} new' }, vi: { greet: 'Chào {name}, {n} mới' } });
    expect(t('vi', 'greet', { name: 'An', n: 3 })).toBe('Chào An, 3 mới');
  });
  it('leaves unknown placeholders intact', () => {
    const t = createTranslator({ en: { a: 'x {y}' }, vi: { a: 'x {y}' } });
    expect(t('en', 'a')).toBe('x {y}');
  });
  it('falls back to en for missing vi key and warns in dev', () => {
    const warn = vitest.spyOn(console, 'warn').mockImplementation(() => {});
    const t = createTranslator({ en: { a: 'English', b: 'Only en' }, vi: { a: 'Tiếng Việt' } });
    expect(t('vi', 'b')).toBe('Only en');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('b');
    expect(t('vi', 'a')).toBe('Tiếng Việt');
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('default translator resolves starter keys', () => {
    expect(translate('en', 'nav.dashboard')).toBe('Dashboard');
    expect(translate('vi', 'stage.new')).toBe('Mới');
  });
  it('stageLabel reads from the dictionaries', () => {
    for (const s of STAGES) {
      expect(stageLabel(s, 'en')).toBe(en[`stage.${s}`]);
      expect(stageLabel(s, 'vi')).toBe(vi[`stage.${s}`]);
    }
  });
});

describe('hooks', () => {
  it('useLang reads and sets ui.lang; useT follows it', () => {
    const { result } = renderHook(() => ({ lang: useLang(), t: useT() }));
    expect(result.current.lang[0]).toBe('en');
    expect(result.current.t('nav.jobs')).toBe('Jobs');
    act(() => result.current.lang[1]('vi'));
    expect(useStore.getState().ui.lang).toBe('vi');
    expect(result.current.t('nav.jobs')).toBe(vi['nav.jobs']);
  });
  it('careers scope uses ui.careersLang (default vi) independently', () => {
    const { result } = renderHook(() => ({ careers: useLang('careers'), t: useT('careers') }));
    expect(result.current.careers[0]).toBe('vi');
    expect(result.current.t('stage.new')).toBe('Mới');
    act(() => result.current.careers[1]('en'));
    expect(useStore.getState().ui.careersLang).toBe('en');
    expect(useStore.getState().ui.lang).toBe('en');
    expect(result.current.t('stage.new')).toBe('New');
  });
});
