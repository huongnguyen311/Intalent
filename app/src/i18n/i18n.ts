import { useCallback } from 'react';
import type { Lang } from '../domain/types';
import { useStore } from '../store/store';
import { translate, type Vars } from './translate';

export { createTranslator, translate } from './translate';
export type { Translate, Vars } from './translate';
export type { TKey } from './en';
import type { TKey } from './en';

/** 'app' = internal UI (ui.lang, default en); 'careers' = public site (ui.careersLang, default vi). */
export type LangScope = 'app' | 'careers';

export function useLang(scope: LangScope = 'app'): [Lang, (l: Lang) => void] {
  const field = scope === 'careers' ? 'careersLang' : 'lang';
  const lang = useStore((s) => s.ui[field]);
  const setLang = useCallback(
    (l: Lang) => useStore.setState((s) => ({ ui: { ...s.ui, [field]: l } })),
    [field],
  );
  return [lang, setLang];
}

export function useT(scope: LangScope = 'app'): (key: TKey, vars?: Vars) => string {
  const [lang] = useLang(scope);
  return useCallback((key: TKey, vars?: Vars) => translate(lang, key, vars), [lang]);
}
