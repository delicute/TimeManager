import { useAppStore } from './useAppStore';
import { t, type Locale } from '../i18n';

export function useT() {
  const { state } = useAppStore();
  const locale: Locale = state.settings.locale || 'zh';
  return (key: Parameters<typeof t>[0], params?: Record<string, string>) =>
    t(key, locale, params);
}

export function useLocale() {
  const { state, dispatch } = useAppStore();
  const locale: Locale = state.settings.locale || 'zh';

  const setLocale = (newLocale: Locale) => {
    const updated = { ...state.settings, locale: newLocale };
    dispatch({ type: 'SET_SETTINGS', payload: updated });
    window.electronAPI.saveSettings(updated);
  };

  return [locale, setLocale] as const;
}

// Maps SessionType to the translation key for the status text
export const statusKeyMap: Record<string, keyof import('../i18n/types').Translations> = {
  Study: 'statusStudying',
  Hobby: 'statusHobbying',
  Entertainment: 'statusEntertaining',
};

// Maps SessionType to the translation key for the activity name (timer label)
export const timerKeyMap: Record<string, keyof import('../i18n/types').Translations> = {
  Study: 'timerStudy',
  Hobby: 'timerHobby',
  Entertainment: 'timerEntertainment',
};

// Maps SessionType to the translation key for "today's" label
export const todayKeyMap: Record<string, keyof import('../i18n/types').Translations> = {
  Study: 'todayStudy',
  Hobby: 'todayHobby',
  Entertainment: 'todayEntertainment',
};

// Maps page id to nav translation key
export const navKeyMap: Record<string, keyof import('../i18n/types').Translations> = {
  Start: 'navStart',
  Study: 'navStudy',
  Hobby: 'navHobby',
  Entertainment: 'navEntertainment',
  Record: 'navRecord',
  Reminder: 'navReminder',
  Hotkey: 'navHotkey',
  Settings: 'navSettings',
  Debug: 'navDebug',
};
