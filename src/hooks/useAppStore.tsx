import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { AppState, SessionType, BalanceState, AppSettings, TimeLogEntry, ReminderRule, ReminderMetric, ReminderTriggerState } from '../types';
import { todayStr } from '../utils/formatting';
import { t } from '../i18n';
import type { Locale } from '../i18n';

// ─── Constants ──────────────────────────────────────────────
const DAILY_GIFT = 1800; // 30 minutes
const REMINDER_INTERVAL = 10000; // 10 seconds

// ─── Defaults ────────────────────────────────────────────────
const defaultSettings: AppSettings = {
  autoStart: false,
  silentStart: false,
  minimizeToTray: true,
  studyWeight: 2,
  studyWeightMin: 0.5,
  studyWeightMax: 60,
  studyWeightStep: 0.5,
  hobbyWeight: 4,
  hobbyWeightMin: 0.5,
  hobbyWeightMax: 120,
  hobbyWeightStep: 0.5,
};

const defaultState: AppState = {
  session: {
    isActive: false,
    currentType: 'None',
    startTime: null,
    tickCount: 0,
  },
  balance: {
    earnedBalance: 0,
    dailyGiftedRemaining: DAILY_GIFT,
    lastDate: '',
  },
  settings: { ...defaultSettings },
  todayLogs: [],
  reminderRules: [],
  showReminderModal: null,
};

// ─── Actions ─────────────────────────────────────────────────
type Action =
  | { type: 'SET_BALANCE'; payload: BalanceState }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'SET_TODAY_LOGS'; payload: TimeLogEntry[] }
  | { type: 'SESSION_START'; payload: SessionType }
  | { type: 'SESSION_STOP' }
  | { type: 'SESSION_TICK' }
  | { type: 'BALANCE_ADD_EARNED'; payload: number }
  | { type: 'BALANCE_TRY_CONSUME' }
  | { type: 'BALANCE_RESET_DAILY' }
  | { type: 'REMINDER_LOAD_RULES'; payload: ReminderRule[] }
  | { type: 'REMINDER_ADD_RULE'; payload: ReminderRule }
  | { type: 'REMINDER_UPDATE_RULE'; payload: ReminderRule }
  | { type: 'REMINDER_DELETE_RULE'; payload: string }
  | { type: 'REMINDER_SHOW_MODAL'; payload: ReminderRule | null };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_BALANCE':
      return { ...state, balance: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'SET_TODAY_LOGS':
      return { ...state, todayLogs: action.payload };
    case 'SESSION_START':
      return {
        ...state,
        session: {
          isActive: true,
          currentType: action.payload,
          startTime: Date.now(),
          tickCount: 0,
        },
      };
    case 'SESSION_STOP':
      return {
        ...state,
        session: { isActive: false, currentType: 'None', startTime: null, tickCount: 0 },
      };
    case 'SESSION_TICK':
      return {
        ...state,
        session: { ...state.session, tickCount: state.session.tickCount + 1 },
      };
    case 'BALANCE_ADD_EARNED':
      // During debt (earnedBalance < 0), don't add — effectively repaying debt
      if (state.balance.earnedBalance < 0) return state;
      return {
        ...state,
        balance: {
          ...state.balance,
          earnedBalance: state.balance.earnedBalance + action.payload,
        },
      };
    case 'BALANCE_TRY_CONSUME': {
      const { earnedBalance, dailyGiftedRemaining } = state.balance;
      // Debt: double consumption rate
      const rate = earnedBalance < 0 ? 2 : 1;
      if (dailyGiftedRemaining + earnedBalance <= 0) return state;
      if (dailyGiftedRemaining >= rate) {
        return {
          ...state,
          balance: { ...state.balance, dailyGiftedRemaining: dailyGiftedRemaining - rate },
        };
      }
      // Deplete gifted first, then earned
      const remaining = rate - dailyGiftedRemaining;
      return {
        ...state,
        balance: {
          ...state.balance,
          dailyGiftedRemaining: 0,
          earnedBalance: earnedBalance - remaining,
        },
      };
    }
    case 'BALANCE_RESET_DAILY': {
      const today = todayStr();
      if (state.balance.lastDate !== today) {
        return {
          ...state,
          balance: { ...state.balance, dailyGiftedRemaining: DAILY_GIFT, lastDate: today },
        };
      }
      return state;
    }
    case 'REMINDER_LOAD_RULES':
      return { ...state, reminderRules: action.payload };
    case 'REMINDER_ADD_RULE':
      return { ...state, reminderRules: [...state.reminderRules, action.payload] };
    case 'REMINDER_UPDATE_RULE':
      return {
        ...state,
        reminderRules: state.reminderRules.map(r =>
          r.id === action.payload.id ? action.payload : r
        ),
      };
    case 'REMINDER_DELETE_RULE':
      return {
        ...state,
        reminderRules: state.reminderRules.filter(r => r.id !== action.payload),
      };
    case 'REMINDER_SHOW_MODAL':
      return { ...state, showReminderModal: action.payload };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────
interface AppStore {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  loadInitialData: () => Promise<void>;
  startSession: (type: SessionType) => void;
  stopSession: () => void;
  persistBalance: () => Promise<void>;
  dismissReminder: () => void;
  snoozeReminder: () => void;
}

const AppContext = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const balanceRef = useRef(state.balance);
  const sessionRef = useRef(state.session);
  const settingsRef = useRef(state.settings);
  const lastTickTimeRef = useRef<Record<string, number>>({ study: 0, hobby: 0 });
  const todayLogsRef = useRef<TimeLogEntry[]>([]);
  const reminderRulesRef = useRef<ReminderRule[]>([]);
  const triggerStatesRef = useRef<Map<string, ReminderTriggerState>>(new Map());

  // Keep refs in sync
  useEffect(() => { balanceRef.current = state.balance; }, [state.balance]);
  useEffect(() => { sessionRef.current = state.session; }, [state.session]);
  useEffect(() => { settingsRef.current = state.settings; }, [state.settings]);
  useEffect(() => { todayLogsRef.current = state.todayLogs; }, [state.todayLogs]);
  useEffect(() => { reminderRulesRef.current = state.reminderRules; }, [state.reminderRules]);

  // ─── IPC helpers ─────────────────────────────────────────
  const loadInitialData = useCallback(async () => {
    try {
      const [balance, settings, logs, rules] = await Promise.all([
        window.electronAPI.loadBalance(),
        window.electronAPI.loadSettings(),
        window.electronAPI.getTodayLogs(),
        window.electronAPI.remindersLoad(),
      ]);

      dispatch({ type: 'SET_TODAY_LOGS', payload: logs });

      if (settings) {
        dispatch({ type: 'SET_SETTINGS', payload: { ...defaultSettings, ...settings } });
      }

      if (balance) {
        dispatch({ type: 'SET_BALANCE', payload: balance });
        dispatch({ type: 'BALANCE_RESET_DAILY' });
      }

      dispatch({ type: 'REMINDER_LOAD_RULES', payload: rules });
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, []);

  const persistBalance = useCallback(async () => {
    try {
      await window.electronAPI.saveBalance(balanceRef.current);
    } catch { /* ignore */ }
  }, []);

  const persistSettings = useCallback(async (settings: AppSettings) => {
    try {
      await window.electronAPI.saveSettings(settings);
    } catch { /* ignore */ }
  }, []);

  // Persist balance on change
  useEffect(() => {
    if (state.balance.lastDate) {
      const t = setTimeout(() => persistBalance(), 100);
      return () => clearTimeout(t);
    }
  }, [state.balance, persistBalance]);

  // ─── Timer (1-second heartbeat) ─────────────────────────
  useEffect(() => {
    if (!state.session.isActive) return;

    const interval = setInterval(() => {
      dispatch({ type: 'SESSION_TICK' });

      const s = sessionRef.current;
      const bal = balanceRef.current;
      const cfg = settingsRef.current;

      if (s.currentType === 'Study' || s.currentType === 'Hobby') {
        const intervalSec = s.currentType === 'Study' ? cfg.studyWeight : cfg.hobbyWeight;
        const now = Date.now();
        const key = s.currentType.toLowerCase();
        const last = lastTickTimeRef.current[key] || s.startTime!;
        const elapsed = (now - last) / 1000;

        if (elapsed >= intervalSec) {
          lastTickTimeRef.current[key] = now;
          dispatch({ type: 'BALANCE_ADD_EARNED', payload: 1 });
        }
      } else if (s.currentType === 'Entertainment') {
        dispatch({ type: 'BALANCE_TRY_CONSUME' });
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      lastTickTimeRef.current = { study: 0, hobby: 0 };
    };
  }, [state.session.isActive]);

  // ─── Reminder evaluation engine (10s interval) ────────
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const rules = reminderRulesRef.current;
        const bal = balanceRef.current;
        const s = sessionRef.current;
        const logs = todayLogsRef.current;

        if (!rules.length) return;

        // Compute today's durations per type
        const todaySec: Record<string, number> = { Study: 0, Hobby: 0, Entertainment: 0 };
        for (const log of logs) {
          const sec = (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000;
          todaySec[log.activityType] = (todaySec[log.activityType] || 0) + sec;
        }
        if (s.isActive && s.currentType !== 'None' && s.startTime) {
          const elapsed = (Date.now() - s.startTime) / 1000;
          todaySec[s.currentType] = (todaySec[s.currentType] || 0) + elapsed;
        }

        const continuousEntertainment = s.isActive && s.currentType === 'Entertainment' && s.startTime
          ? (Date.now() - s.startTime) / 1000
          : 0;

        const available = Math.max(0, bal.earnedBalance) + bal.dailyGiftedRemaining;
        const debtAmount = bal.earnedBalance < 0 ? Math.abs(bal.earnedBalance) : 0;

        // Metric values map
        const metrics: Record<ReminderMetric, number> = {
          entertainmentBalance: bal.earnedBalance,
          studyDuration: todaySec.Study,
          hobbyDuration: todaySec.Hobby,
          entertainmentDuration: todaySec.Entertainment,
          continuousEntertainment,
          totalAvailableBalance: available,
          debtAmount,
        };

        const now = Date.now();

        for (const rule of rules) {
          if (!rule.enabled) continue;

          // Get or init trigger state
          let ts = triggerStatesRef.current.get(rule.id);
          if (!ts) {
            ts = { dismissed: false, snoozedUntil: 0, snoozeCount: 0, lastTriggered: 0 };
            triggerStatesRef.current.set(rule.id, ts);
          }

          // Check snooze
          if (ts.snoozedUntil > now) continue;
          if (ts.dismissed && rule.urgency !== 'critical') continue;

          // Evaluate condition
          const metricVal = metrics[rule.condition.metric] ?? 0;
          let met = false;
          switch (rule.condition.operator) {
            case 'lt': met = metricVal < rule.condition.value; break;
            case 'gt': met = metricVal > rule.condition.value; break;
            case 'gte': met = metricVal >= rule.condition.value; break;
            case 'lte': met = metricVal <= rule.condition.value; break;
            case 'eq': met = metricVal === rule.condition.value; break;
          }

          if (met) {
            // Avoid re-triggering within same interval
            if (now - ts.lastTriggered < REMINDER_INTERVAL - 100) continue;
            ts.lastTriggered = now;
            dispatch({ type: 'REMINDER_SHOW_MODAL', payload: rule });
            await window.electronAPI.windowSetAlwaysOnTop(true);
          } else {
            // Reset trigger state when condition no longer met
            ts.dismissed = false;
            ts.snoozedUntil = 0;
          }
        }
      } catch { /* ignore */ }
    }, REMINDER_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // ─── Session Management ──────────────────────────────────
  const stopSession = useCallback(() => {
    const s = sessionRef.current;
    if (s.isActive && s.startTime) {
      const endTime = Date.now();
      const elapsed = (endTime - s.startTime) / 1000;

      if (elapsed >= 1) {
        const balanceChange = s.currentType === 'Entertainment'
          ? -s.tickCount
          : s.tickCount;

        const entry: TimeLogEntry = {
          startTime: new Date(s.startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          activityType: s.currentType,
          balanceChange,
        };

        window.electronAPI.writeLogEntry(entry);
        window.electronAPI.getTodayLogs().then(logs => {
          dispatch({ type: 'SET_TODAY_LOGS', payload: logs });
        });
      }
    }
    dispatch({ type: 'SESSION_STOP' });
  }, []);

  const startSession = useCallback((type: SessionType) => {
    // No balance guard for entertainment — debt is allowed
    if (sessionRef.current.isActive) stopSession();
    dispatch({ type: 'SESSION_START', payload: type });
  }, [stopSession]);

  // ─── Reminder callbacks ──────────────────────────────────
  const dismissReminder = useCallback(() => {
    const rule = state.showReminderModal;
    if (rule) {
      const ts = triggerStatesRef.current.get(rule.id);
      if (ts) ts.dismissed = true;
    }
    dispatch({ type: 'REMINDER_SHOW_MODAL', payload: null });
    window.electronAPI.windowSetAlwaysOnTop(false);
  }, [state.showReminderModal]);

  const snoozeReminder = useCallback(() => {
    const rule = state.showReminderModal;
    if (rule) {
      const ts = triggerStatesRef.current.get(rule.id);
      if (ts) {
        ts.snoozedUntil = Date.now() + rule.snoozeMinutes * 60 * 1000;
        ts.snoozeCount++;
        // If repeat limit reached, dismiss instead
        if (rule.snoozeRepeat > 0 && ts.snoozeCount >= rule.snoozeRepeat) {
          ts.dismissed = true;
        }
      }
    }
    dispatch({ type: 'REMINDER_SHOW_MODAL', payload: null });
    window.electronAPI.windowSetAlwaysOnTop(false);
  }, [state.showReminderModal]);

  // ─── Persist settings when they change ───────────────────
  useEffect(() => {
    if (state.settings.studyWeight !== 2 || state.settings.hobbyWeight !== 4) {
      persistSettings(state.settings);
    }
  }, [state.settings]);

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      loadInitialData,
      startSession,
      stopSession,
      persistBalance,
      dismissReminder,
      snoozeReminder,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
