import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { AppState, SessionType, BalanceState, AppSettings, TimeLogEntry, ReminderRule, ReminderCondition, ConditionNode, ReminderMetric, ReminderTriggerState } from '../types';
import { todayStr } from '../utils/formatting';
import { t } from '../i18n';
import type { Locale } from '../i18n';

// ─── Constants ──────────────────────────────────────────────
const DAILY_GIFT = 1800; // 30 minutes
const REMINDER_INTERVAL = 200; // 200ms polling
const CONTINUITY_GAP = 300; // 5 minutes max gap to maintain continuity

const STUDY_MILESTONES = [
  { threshold: 3600, reward: 900, labelZH: '连续学习≥1h', labelEN: 'Continuous study ≥1h' },
  { threshold: 10800, reward: 2700, labelZH: '连续学习≥3h', labelEN: 'Continuous study ≥3h' },
  { threshold: 18000, reward: 3600, labelZH: '连续学习≥5h', labelEN: 'Continuous study ≥5h' },
];

const HOBBY_MILESTONES = [
  { threshold: 3600, reward: 600, labelZH: '连续爱好≥1h', labelEN: 'Continuous hobby ≥1h' },
  { threshold: 10800, reward: 1800, labelZH: '连续爱好≥3h', labelEN: 'Continuous hobby ≥3h' },
  { threshold: 18000, reward: 2700, labelZH: '连续爱好≥5h', labelEN: 'Continuous hobby ≥5h' },
];

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
  notificationEnabled: true,
  notificationDuration: 5,
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
  | { type: 'REMINDER_DELETE_RULE'; payload: string };

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
      const rate = earnedBalance < 0 ? 2 : 1;
      if (dailyGiftedRemaining + earnedBalance <= 0) return state;
      if (dailyGiftedRemaining >= rate) {
        return {
          ...state,
          balance: { ...state.balance, dailyGiftedRemaining: dailyGiftedRemaining - rate },
        };
      }
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
}

const AppContext = createContext<AppStore | null>(null);

function evalNode(node: ConditionNode, metrics: Record<string, number>, session?: { isActive: boolean; currentType: string }): boolean {
  if (node.type === 'leaf') {
    const val = metrics[node.metric] ?? 0;
    switch (node.operator) {
      case 'lt': return val < node.value;
      case 'gt': return val > node.value;
      case 'gte': return val >= node.value;
      case 'lte': return val <= node.value;
      case 'eq': return val === node.value;
      default: return false;
    }
  } else if (node.type === 'bool') {
    if (!session) return false;
    if (node.boolType === 'currentState') {
      return node.expected === (session.isActive && session.currentType === node.boolValue);
    }
    return false;
  } else {
    const results = node.nodes.map(n => evalNode(n, metrics, session));
    return node.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
  }
}

// Collect current values for all leaf conditions, keyed by path
function renderLeafSummary(node: ConditionNode, metrics: Record<string, number>, locale: string): string {
  const parts: string[] = [];
  const labels: Record<string, string> = locale === 'zh' ? {
    entertainmentBalance: '娱乐余额', dailyGiftedBalance: '赠送余额', earnedBalance: '赚取余额',
    studyDuration: '今日学习', hobbyDuration: '今日爱好', entertainmentDuration: '今日娱乐',
    continuousEntertainment: '连续娱乐', totalAvailableBalance: '可用总额', debtAmount: '债务金额',
    Study: '学习', Hobby: '爱好', Entertainment: '娱乐',
  } : {
    entertainmentBalance: 'Entertainment', dailyGiftedBalance: 'Gifted', earnedBalance: 'Earned',
    studyDuration: 'Study', hobbyDuration: 'Hobby', entertainmentDuration: 'Entertainment',
    continuousEntertainment: 'Continuous', totalAvailableBalance: 'Available', debtAmount: 'Debt',
    Study: 'Study', Hobby: 'Hobby', Entertainment: 'Entertainment',
  };
  function walk(n: ConditionNode) {
    if (n.type === 'leaf') {
      const val = Math.round(metrics[n.metric] ?? 0);
      const opMap: Record<string, string> = { lt: '<', gt: '>', gte: '>=', lte: '<=', eq: '=' };
      parts.push(`${labels[n.metric] || n.metric} ${opMap[n.operator] || n.operator} ${n.value} (${val})`);
    } else if (n.type === 'bool') {
      const stateLabel = labels[n.boolValue] || n.boolValue;
      const expLabel = n.expected ? (locale === 'zh' ? 'True' : 'True') : (locale === 'zh' ? 'False' : 'False');
      parts.push(`${locale === 'zh' ? '当前状态' : 'State'} = ${stateLabel} (${expLabel})`);
    } else {
      n.nodes.forEach(walk);
    }
  }
  walk(node);
  return parts.join('; ');
}

// Migrate old flat-format rule to tree format
function migrateRule(rule: any): ReminderRule {
  if (rule.conditionTree) return rule as ReminderRule;

  // Handle oldest format (condition/condition2)
  if (!rule.conditions && rule.condition) {
    const conds: ReminderCondition[] = [rule.condition];
    if (rule.condition2) conds.push(rule.condition2);
    rule.conditions = conds;
  }

  if (rule.conditions && rule.conditions.length > 0) {
    rule.conditionTree = {
      type: 'group',
      logic: rule.logic || 'and',
      nodes: rule.conditions.map((c: any) => ({
        type: 'leaf',
        metric: c.metric,
        operator: c.operator,
        value: c.value,
      })),
    };
  } else {
    // Default
    rule.conditionTree = {
      type: 'group',
      logic: 'and',
      nodes: [{ type: 'leaf', metric: 'totalAvailableBalance', operator: 'lt', value: 600 }],
    };
  }

  return rule as ReminderRule;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const balanceRef = useRef(state.balance);
  const sessionRef = useRef(state.session);
  const settingsRef = useRef(state.settings);
  const lastTickTimeRef = useRef<Record<string, number>>({ study: 0, hobby: 0 });
  const todayLogsRef = useRef<TimeLogEntry[]>([]);
  const reminderRulesRef = useRef<ReminderRule[]>([]);
  const triggerStatesRef = useRef<Map<string, ReminderTriggerState>>(new Map());
  const initialMountRef = useRef(true);

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
        window.electronAPI.setMinimizeToTray(settings.minimizeToTray !== false);
      } else {
        window.electronAPI.setMinimizeToTray(defaultSettings.minimizeToTray);
      }

      if (balance) {
        dispatch({ type: 'SET_BALANCE', payload: balance });
        dispatch({ type: 'BALANCE_RESET_DAILY' });
      }

      // Migrate old rule formats to conditionTree
      const migratedRules = rules.map(r => migrateRule(r));
      dispatch({ type: 'REMINDER_LOAD_RULES', payload: migratedRules });
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

  // Persist settings on every change (skip initial mount)
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    persistSettings(state.settings);
    window.electronAPI.setMinimizeToTray(state.settings.minimizeToTray);
  }, [state.settings, persistSettings]);

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
          dailyGiftedBalance: bal.dailyGiftedRemaining,
          earnedBalance: bal.earnedBalance,
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
            ts = { dismissed: false, snoozedUntil: 0, lastTriggered: 0 };
            triggerStatesRef.current.set(rule.id, ts);
          }

          // Evaluate condition tree
          const tree = rule.conditionTree;
          if (!tree) continue;
          const met = evalNode(tree, metrics, { isActive: s.isActive, currentType: s.currentType });

          if (!met) {
            // Condition cleared — allow re-trigger
            ts.lastTriggered = 0;
            continue;
          }

          // Condition IS met — show notification (once per trigger)
          if (ts.lastTriggered > 0) continue;

          ts.lastTriggered = now;
          const cfg = settingsRef.current;
          const locale = cfg.locale || 'zh';
          const notifColors: Record<string, string> = { urgent: '#c64545', warning: '#e8a55a', reminder: '#5db8a6', notification: '#5db872', info: '#a09d96', low: '#a09d96', medium: '#5db872', high: '#e8a55a', critical: '#c64545' };
          const body = rule.content || renderLeafSummary(tree, metrics, locale);
          window.electronAPI.notificationShow({
            type: 'reminder',
            notifType: rule.urgency || 'reminder',
            title: rule.title || (locale === 'zh' ? '提醒' : 'Reminder'),
            body,
            color: notifColors[rule.urgency] || '#e8a55a',
            duration: cfg.notificationDuration ?? 5,
          });
        }
      } catch { /* ignore */ }
    }, REMINDER_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // ─── Session Notification Helper ───────────────────────
  function notifySessionAction(type: SessionType, action: 'start' | 'stop', elapsed?: number) {
    try {
      const cfg = settingsRef.current;
      if (!cfg.notificationEnabled) return;
      const locale = cfg.locale || 'zh';
      if (action === 'start') {
        const title = locale === 'zh' ? `已进入${type === 'Study' ? '学习' : type === 'Hobby' ? '爱好' : '娱乐'}状态` : `Entered ${type}`;
        window.electronAPI.notificationShow({ type, notifType: 'notification', title, body: '', color: '#5db872', duration: cfg.notificationDuration ?? 5 });
      } else if (action === 'stop' && elapsed != null) {
        const hrs = Math.floor(elapsed / 3600);
        const mins = Math.floor((elapsed % 3600) / 60);
        const secs = Math.floor(elapsed % 60);
        let durationStr: string;
        if (locale === 'zh') {
          durationStr = `${hrs > 0 ? `${hrs}h` : ''}${mins > 0 ? `${mins}min` : ''}${secs}s`;
        } else {
          durationStr = `${hrs > 0 ? `${hrs}h` : ''}${mins > 0 ? `${mins}m` : ''}${secs}s`;
        }
        const typeLabel = locale === 'zh'
          ? (type === 'Study' ? '学习' : type === 'Hobby' ? '爱好' : '娱乐')
          : type;
        const title = locale === 'zh' ? `已退出${typeLabel}` : `Exited ${type}`;
        const body = locale === 'zh' ? `你这次${typeLabel}了${durationStr}` : `You spent ${durationStr}`;
        window.electronAPI.notificationShow({ type, notifType: 'info', title, body, color: '#a09d96', duration: cfg.notificationDuration ?? 5 });
      }
    } catch { /* ignore */ }
  }

  // ─── Session Management ──────────────────────────────────
  const stopSession = useCallback(() => {
    const s = sessionRef.current;
    const bal = balanceRef.current;
    const activeType = s.currentType;
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

        // ─── Reward check for Study / Hobby ─────────────
        if (activeType === 'Study' || activeType === 'Hobby') {
          const milestones = bal.milestones || { studyContinuous: 0, hobbyContinuous: 0, studyClaimed: 0, hobbyClaimed: 0, lastStudyEnd: 0, lastHobbyEnd: 0 };
          const isStudy = activeType === 'Study';
          const key = isStudy ? 'study' : 'hobby';
          const contKey = isStudy ? 'studyContinuous' : 'hobbyContinuous';
          const claimKey = isStudy ? 'studyClaimed' : 'hobbyClaimed';
          const lastEndKey = isStudy ? 'lastStudyEnd' : 'lastHobbyEnd';
          const milestoneList = isStudy ? STUDY_MILESTONES : HOBBY_MILESTONES;

          // Add this session's duration to continuous
          let continuous = (milestones as any)[contKey] + elapsed;
          const lastEnd = (milestones as any)[lastEndKey] || 0;
          // Reset if gap too large
          if (lastEnd > 0 && s.startTime - lastEnd > CONTINUITY_GAP * 1000) {
            continuous = elapsed;
          }

          let claimed = (milestones as any)[claimKey] || 0;
          let rewardTotal = 0;

          milestoneList.forEach((m, i) => {
            if (!(claimed & (1 << i)) && continuous >= m.threshold) {
              claimed |= (1 << i);
              rewardTotal += m.reward;
              const cfg = settingsRef.current;
              const locale = cfg.locale || 'zh';
              const label = locale === 'zh' ? m.labelZH : m.labelEN;
              const rewardMin = Math.round(m.reward / 60);
              const threshDisplay = m.threshold >= 3600 ? `${Math.round(m.threshold / 3600)}h` : `${Math.round(m.threshold / 60)}min`;
              const desc = locale === 'zh' ? `连续大于${threshDisplay}，获得${rewardMin}min的余额` : `Continuous >${threshDisplay}, earned ${rewardMin}min balance`;
              window.electronAPI.notificationShow({
                type: activeType,
                notifType: 'milestone',
                title: label,
                body: desc,
                color: '#e8a55a',
                duration: cfg.notificationDuration ?? 5,
              });
            }
          });

          if (rewardTotal > 0) {
            const updatedBalance = {
              ...bal,
              dailyGiftedRemaining: bal.dailyGiftedRemaining + rewardTotal,
              milestones: {
                ...milestones,
                [contKey]: continuous,
                [claimKey]: claimed,
                [lastEndKey]: endTime,
              },
            } as BalanceState;
            dispatch({ type: 'SET_BALANCE', payload: updatedBalance });
            window.electronAPI.saveBalance(updatedBalance);
          } else {
            // Still need to save continuous duration for progress bar
            const updatedBalance = {
              ...bal,
              milestones: {
                ...milestones,
                [contKey]: continuous,
                [lastEndKey]: endTime,
              },
            } as BalanceState;
            dispatch({ type: 'SET_BALANCE', payload: updatedBalance });
            window.electronAPI.saveBalance(updatedBalance);
          }
        }
      }
      dispatch({ type: 'SESSION_STOP' });
      notifySessionAction(activeType, 'stop', elapsed);
      try {
        const bc = settingsRef.current;
        const bl = bc.locale || 'zh';
        const ticks = Math.floor(elapsed);
        if (activeType === 'Study' || activeType === 'Hobby') {
          const w = activeType === 'Study' ? bc.studyWeight : bc.hobbyWeight;
          const earned = Math.floor(elapsed / w);
          window.electronAPI.notificationShow({ type: activeType, notifType: 'info', title: bl === 'zh' ? `赚取 ${earned} 余额` : `Earned ${earned}`, body: '', color: '#a09d96', duration: bc.notificationDuration ?? 5 });
        } else window.electronAPI.notificationShow({ type: activeType, notifType: 'info', title: bl === 'zh' ? `消耗 ${ticks} 余额` : `Consumed ${ticks}`, body: '', color: '#a09d96', duration: bc.notificationDuration ?? 5 });
      } catch { /* ignore */ }
    } else {
      dispatch({ type: 'SESSION_STOP' });
    }
  }, []);

  const startSession = useCallback((type: SessionType) => {
    if (sessionRef.current.isActive) {
      if (sessionRef.current.currentType === type) {
        stopSession();
        return;
      }
      stopSession();
    }
    dispatch({ type: 'SESSION_START', payload: type });
    notifySessionAction(type, 'start');
  }, [stopSession]);

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      loadInitialData,
      startSession,
      stopSession,
      persistBalance,
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
