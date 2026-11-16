import type { Lang } from '../domain/types';
import { en, type TKey } from './en';
import { vi } from './vi';

export type Vars = Record<string, string | number>;
export type Translate<K extends string = TKey> = (lang: Lang, key: K, vars?: Vars) => string;

/** Builds a translator over the given dictionaries; a key missing from vi falls back to en (warns once per key in dev). */
export function createTranslator<K extends string>(dicts: {
  en: Record<K, string>;
  vi: Partial<Record<K, string>>;
}): Translate<K> {
  const warned = new Set<string>();
  return (lang, key, vars) => {
    let text: string | undefined = dicts[lang][key];
    if (text === undefined) {
      if (import.meta.env.DEV && !warned.has(key)) {
        warned.add(key);
        console.warn(`[i18n] missing "${lang}" translation for "${key}", falling back to en`);
      }
      text = dicts.en[key];
    }
    return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
  };
}

/** Non-hook translator for domain code and tests (store-free, so domain modules can import it). */
export const translate: Translate = createTranslator<TKey>({ en, vi });
