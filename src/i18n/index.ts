import { zh } from './zh';
import { en } from './en';
import type { Translations } from './types';

export type Locale = 'zh' | 'en';

const locales: Record<Locale, Translations> = { zh, en };

export function t(key: keyof Translations, locale: Locale, params?: Record<string, string>): string {
  const text = locales[locale]?.[key] ?? locales['zh'][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
}

export function getLocaleLabel(locale: Locale): string {
  return locale === 'zh' ? '中文' : 'English';
}
