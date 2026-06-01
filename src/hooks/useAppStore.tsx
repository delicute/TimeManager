import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { AppState, SessionType, BalanceState, AppSettings, TimeLogEntry, ReminderRule, ReminderCondition, ConditionNode, ReminderMetric, ReminderTriggerState } from '../types';
import { todayStr } from '../utils/formatting';
import { t } from '../i18n';
import type { Locale } from '../i18n';
import { STUDY_MILESTONES, HOBBY_MILESTONES } from '../constants';

// ─── Constants ──────────────────────────────────────────────
const DAILY_GIFT = 1800; // 30 minutes
const REMINDER_INTERVAL = 200; // 200ms polling
const CONTINUITY_GAP = 300; // 5 minutes max gap to maintain continuity

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
  globalHotkeys: false,
};

const defaultState: AppState = {
  session: {
    isActive: false,
    currentType: 'None',
    startTime: null,
    tickCount: 0,
    isPaused: false,
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
  | { type: 'SESSION_PAUSE' }
  | { type: 'SESSION_RESUME' }
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
          isPaused: false,
        },
      };
    case 'SESSION_PAUSE':
      // Guard: ignore if already paused — prevents invalid state transitions
      if (state.session.isPaused) return state;
      return { ...state, session: { ...state.session, isPaused: true, pausedAt: Date.now() } };
    case 'SESSION_RESUME': {
      // Guard: only resume if actually paused with a valid pausedAt
      if (!state.session.isPaused || !state.session.pausedAt) return state;
      const pausedMs = Date.now() - state.session.pausedAt;
      const { pausedAt: _, ...rest } = state.session;
      return {
        ...state,
        session: { ...rest, isPaused: false, startTime: (state.session.startTime ?? Date.now()) + pausedMs },
      };
    }
    case 'SESSION_STOP':
      return {
        ...state,
        session: { isActive: false, currentType: 'None', startTime: null, tickCount: 0, isPaused: false },
      };
    case 'SESSION_TICK':
      return {
        ...state,
        session: { ...state.session, tickCount: state.session.tickCount + 1 },
      };
    case 'BALANCE_ADD_EARNED':
      return {
        ...state,
        balance: {
          ...state.balance,
          earnedBalance: state.balance.earnedBalance + action.payload,
        },
      };
    case 'BALANCE_TRY_CONSUME': {
      let { earnedBalance, dailyGiftedRemaining } = state.balance;
      const rate = earnedBalance < 0 ? 2 : 1;
      let remaining = rate;

      // 1. 先消耗赠送余额
      if (dailyGiftedRemaining > 0) {
        const take = Math.min(dailyGiftedRemaining, remaining);
        dailyGiftedRemaining -= take;
        remaining -= take;
      }

      // 2. 不够再消耗赚取余额
      if (remaining > 0 && earnedBalance > 0) {
        const take = Math.min(earnedBalance, remaining);
        earnedBalance -= take;
        remaining -= take;
      }

      // 3. 还不够则进入负债
      if (remaining > 0) {
        earnedBalance -= remaining;
      }

      return {
        ...state,
        balance: { ...state.balance, earnedBalance, dailyGiftedRemaining },
      };
    }
    case 'BALANCE_RESET_DAILY': {
      const today = todayStr();
      if (state.balance.lastDate !== today) {
        return {
          ...state,
          balance: { ...state.balance, dailyGiftedRemaining: DAILY_GIFT, lastDate: today, milestones: undefined, debugTodayOverride: undefined },
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

function evalNode(node: ConditionNode, metrics: Record<string, number>, session?: { isActive: boolean; currentType: string; isPaused?: boolean }): boolean {
  if (node.type === 'leaf') {
    const val = metrics[node.metric] ?? 0;
    switch (node.operator) {
      case 'lt': return val < node.value;
      case 'gt': return val > node.value;
      case 'gte': return val >= node.value;
      case 'lte': return val <= node.value;
      case 'eq': return val === node.value;
      case 'neq': return val !== node.value;
      default: return false;
    }
  } else if (node.type === 'bool') {
    if (node.boolType === 'currentState') {
      if (!session) return false;
      return node.expected === (session.isActive && session.currentType === node.boolValue);
    }
    if (node.boolType === 'isDebt') {
      const bal = (metrics as any)._earnedBalance ?? 0;
      return node.expected === (bal < 0);
    }
    if (node.boolType === 'hasActivityToday') {
      const todaySec = (metrics as any)._todayDurations ?? {};
      const total = (todaySec.Study || 0) + (todaySec.Hobby || 0) + (todaySec.Entertainment || 0);
      return node.expected === (total > 0);
    }
    if (node.boolType === 'isPaused') {
      if (!session) return false;
      return node.expected === session.isPaused;
    }
    if (node.boolType === 'isMilestoneAvailable') {
      // Simplification: check via session paused + balance milestones
      // We pass _milestones in metrics for this
      return node.expected === ((metrics as any)._hasUnclaimedMilestone === true);
    }
    return false;
  } else if (node.type === 'time') {
    const now = new Date();
    const [h, m] = node.timeValue.split(':').map(Number);
    const targetMin = h * 60 + m;
    const currentMin = now.getHours() * 60 + now.getMinutes();
    if (node.timeOp === 'at') {
      return currentMin === targetMin;
    }
    return node.timeOp === 'before' ? currentMin < targetMin : currentMin >= targetMin;
  } else if (node.type === 'not') {
    return !evalNode(node.node, metrics, session);
  } else if (node.type === 'group') {
    const results = node.nodes.map(n => evalNode(n, metrics, session));
    return node.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
  } else {
    const _exhaustive: never = node;
    return false;
  }
}

// Collect current values for all leaf conditions, keyed by path
function renderLeafSummary(node: ConditionNode, metrics: Record<string, number>, locale: string): string {
  const parts: string[] = [];
  const labels: Record<string, string> = locale === 'zh' ? {
    entertainmentBalance: '余额', dailyGiftedBalance: '赠送余额', earnedBalance: '赚取余额',
    studyDuration: '今日学习', hobbyDuration: '今日爱好', entertainmentDuration: '今日娱乐',
    totalAvailableBalance: '可用总额', debtAmount: '债务',
    currentSessionDuration: '当前时长',
    isDebt: '是否负债', hasActivityToday: '今日有活动', isPaused: '是否暂停',
    isMilestoneAvailable: '有里程碑',
    Study: '学习', Hobby: '爱好', Entertainment: '娱乐',
  } : {
    entertainmentBalance: 'Balance', dailyGiftedBalance: 'Gifted', earnedBalance: 'Earned',
    studyDuration: 'Study', hobbyDuration: 'Hobby', entertainmentDuration: 'Entertainment',
    totalAvailableBalance: 'Available', debtAmount: 'Debt',
    currentSessionDuration: 'Session Duration',
    isDebt: 'In Debt', hasActivityToday: 'Has Activity', isPaused: 'Is Paused',
    isMilestoneAvailable: 'Milestone Ready',
    Study: 'Study', Hobby: 'Hobby', Entertainment: 'Entertainment',
  };
  function walk(n: ConditionNode) {
    if (n.type === 'leaf') {
      const val = Math.round(metrics[n.metric] ?? 0);
      const opMap: Record<string, string> = { lt: '<', gt: '>', gte: '>=', lte: '<=', eq: '=', neq: '!=' };
      parts.push(`${labels[n.metric] || n.metric} ${opMap[n.operator] || n.operator} ${n.value} (${val})`);
    } else if (n.type === 'bool') {
      if (n.boolType === 'currentState') {
        const stateLabel = labels[n.boolValue!] || n.boolValue!;
        const expLabel = n.expected ? (locale === 'zh' ? '是' : 'True') : (locale === 'zh' ? '否' : 'False');
        parts.push(`${locale === 'zh' ? '当前状态' : 'State'} = ${stateLabel} (${expLabel})`);
      } else {
        const boolLabel = labels[n.boolType] || n.boolType;
        const expLabel = n.expected ? (locale === 'zh' ? '是' : 'True') : (locale === 'zh' ? '否' : 'False');
        parts.push(`${boolLabel} = ${expLabel}`);
      }
    } else if (n.type === 'time') {
      const opLabel = n.timeOp === 'before' ? (locale === 'zh' ? '之前' : 'before') : (locale === 'zh' ? '之后' : 'after');
      parts.push(`${locale === 'zh' ? '时间' : 'Time'} ${opLabel} ${n.timeValue}`);
    } else if (n.type === 'not') {
      parts.push(`${locale === 'zh' ? '非' : 'NOT'} (`);
      walk(n.node);
      parts.push(')');
    } else if (n.type === 'group') {
      const inner: string[] = [];
      n.nodes.forEach(c => { const before = parts.length; walk(c); inner.push(parts.slice(before).join('')); parts.length = before; });
      parts.push(inner.join(` ${n.logic === 'and' ? (locale === 'zh' ? ' 且 ' : ' AND ') : (locale === 'zh' ? ' 或 ' : ' OR ')} `));
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

// ─── Entertainment consumption simulation (用于 stopSession 统一结算) ────
function simulateEntertainmentConsumption(
  startEarned: number,
  startGifted: number,
  durationSec: number
): { earnedBalance: number; dailyGiftedRemaining: number } {
  let earned = startEarned;
  let gifted = startGifted;
  for (let i = 0; i < durationSec; i++) {
    const rate = earned < 0 ? 2 : 1;
    let remaining = rate;
    // 1. 先消耗赠送余额
    if (gifted > 0) {
      const take = Math.min(gifted, remaining);
      gifted -= take;
      remaining -= take;
    }
    // 2. 不够再消耗赚取余额
    if (remaining > 0 && earned > 0) {
      const take = Math.min(earned, remaining);
      earned -= take;
      remaining -= take;
    }
    // 3. 还不够则负债
    if (remaining > 0) {
      earned -= remaining;
    }
  }
  return { earnedBalance: earned, dailyGiftedRemaining: gifted };
}

  const [state, dispatch] = useReducer(reducer, defaultState);
  const balanceRef = useRef(state.balance);
  const sessionRef = useRef(state.session);
  const settingsRef = useRef(state.settings);
  const startBalanceRef = useRef<BalanceState | null>(null); // snapshot at session start, for stopSession reconciliation
  const lastTickTimeRef = useRef<Record<string, number>>({ study: 0, hobby: 0 }); // ref-based timer tracking (no closure issue)
  const todayLogsRef = useRef<TimeLogEntry[]>([]);
  const reminderRulesRef = useRef<ReminderRule[]>([]);
  const triggerStatesRef = useRef<Map<string, ReminderTriggerState>>(new Map());
  const initialMountRef = useRef(true);
  const startingRef = useRef(false); // Prevent re-entrance in startSession

  // Keep refs in sync
  useEffect(() => { balanceRef.current = state.balance; }, [state.balance]);
  useEffect(() => { sessionRef.current = state.session; }, [state.session]);
  useEffect(() => { settingsRef.current = state.settings; }, [state.settings]);
  useEffect(() => { todayLogsRef.current = state.todayLogs; }, [state.todayLogs]);
  useEffect(() => { reminderRulesRef.current = state.reminderRules; }, [state.reminderRules]);

  // ─── Save balance synchronously before app quit ─────────
  const saveActiveSession = useCallback(() => {
    try {
      const s = sessionRef.current;
      let bal = { ...balanceRef.current };
      const cfg = settingsRef.current;
      // If there's an active session, write a log entry before quitting
      // AND update milestones so progress bar doesn't reset on restart
      if (s.isActive && s.currentType !== 'None' && s.startTime) {
        const endTime = Date.now();
        const elapsed = (endTime - s.startTime) / 1000;
        const elapsedSec = Math.floor(elapsed);
        let balanceDelta = 0;
        if (elapsed >= 1) {
          if (s.currentType === 'Study' || s.currentType === 'Hobby') {
            const w = s.currentType === 'Study' ? cfg.studyWeight : cfg.hobbyWeight;
            balanceDelta = Math.floor(elapsed / w);
            // Update milestone continuous time (same logic as stopSession)
            const isStudy = s.currentType === 'Study';
            const contKey = isStudy ? 'studyContinuous' : 'hobbyContinuous';
            const claimKey = isStudy ? 'studyClaimed' : 'hobbyClaimed';
            const lastEndKey = isStudy ? 'lastStudyEnd' : 'lastHobbyEnd';
            const msList = isStudy ? STUDY_MILESTONES : HOBBY_MILESTONES;
            const ms = bal.milestones || { studyContinuous: 0, hobbyContinuous: 0, studyClaimed: 0, hobbyClaimed: 0, lastStudyEnd: 0, lastHobbyEnd: 0 };
            let continuous = (ms[contKey] || 0) + elapsed;
            const lastEnd = (ms[lastEndKey] || 0);
            if (lastEnd > 0 && s.startTime - lastEnd > CONTINUITY_GAP * 1000) {
              continuous = elapsed;
            }
            let claimed = (ms[claimKey] || 0) as number;
            let rewardTotal = 0;
            msList.forEach((mst, i) => {
              if (!(claimed & (1 << i)) && continuous >= mst.threshold) {
                claimed |= (1 << i);
                rewardTotal += mst.reward;
              }
            });
            bal = {
              ...bal,
              dailyGiftedRemaining: bal.dailyGiftedRemaining + rewardTotal,
              milestones: {
                ...ms,
                [contKey]: continuous,
                [claimKey]: claimed,
                [lastEndKey]: endTime,
              },
            } as BalanceState;
          } else if (s.currentType === 'Entertainment') {
            balanceDelta = -elapsedSec;
          }
          const entry: TimeLogEntry = {
            startTime: new Date(s.startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            activityType: s.currentType,
            balanceChange: balanceDelta,
          };
          window.electronAPI.writeLogEntrySync(entry);
        }
      }
      window.electronAPI.saveBalanceSync(bal);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    window.__saveActiveSession__ = saveActiveSession;
    const handler = () => saveActiveSession();
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      delete window.__saveActiveSession__;
    };
  }, [saveActiveSession]);

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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Persist balance on change
  useEffect(() => {
    if (state.balance.lastDate) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => persistBalance(), 1000);
    }
    return () => clearTimeout(saveTimerRef.current);
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

  // ─── Main-process tick listener (不受窗口隐藏节流影响) ─────
  useEffect(() => {
    const cleanup = window.electronAPI.onSessionTick(() => {
      const s = sessionRef.current;
      if (!s.isActive || s.isPaused) return;

      dispatch({ type: 'SESSION_TICK' });

      const cfg = settingsRef.current;

      if (s.currentType === 'Study' || s.currentType === 'Hobby') {
        const intervalSec = s.currentType === 'Study' ? cfg.studyWeight : cfg.hobbyWeight;
        const now = Date.now();
        const key = s.currentType.toLowerCase();
        // 基于经过总时间计算期望赚取数，避免非整数 weight 造成的精度丢失
        // 也兼容后台节流：interval 暂停后恢复时一次补回所有丢掉的赚取
        const elapsed = (now - s.startTime!) / 1000;
        const expectedEarned = Math.floor(elapsed / intervalSec);
        const lastEarned = lastTickTimeRef.current[key] ?? 0;
        if (expectedEarned > lastEarned) {
          const delta = expectedEarned - lastEarned;
          lastTickTimeRef.current[key] = expectedEarned;
          dispatch({ type: 'BALANCE_ADD_EARNED', payload: delta });
        }
      } else if (s.currentType === 'Entertainment') {
        const key = 'entertainment';
        // Count-based approach matching Study/Hobby pattern:
        // compute total expected consumption from session start, dispatch delta
        const elapsed = (Date.now() - s.startTime!) / 1000;
        const expectedConsumed = Math.floor(elapsed);
        const lastConsumed = lastTickTimeRef.current[key] ?? 0;
        if (expectedConsumed > lastConsumed) {
          const delta = expectedConsumed - lastConsumed;
          lastTickTimeRef.current[key] = expectedConsumed;
          for (let i = 0; i < delta; i++) {
            dispatch({ type: 'BALANCE_TRY_CONSUME' });
          }
        }
      }
    });
    return () => cleanup();
  }, [dispatch]);

  // Reset lastTickTimeRef when session stops (准备下一轮会话从头计时)
  useEffect(() => {
    if (!state.session.isActive) {
      lastTickTimeRef.current = {};
    }
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
          const now = s.isPaused && s.pausedAt ? s.pausedAt : Date.now();
          const elapsed = (now - s.startTime) / 1000;
          todaySec[s.currentType] = (todaySec[s.currentType] || 0) + elapsed;
        }

        // Apply debug today override (for Set operation in DebugPage)
        const dbgOverride = bal.debugTodayOverride;
        if (dbgOverride) {
          for (const t of ['Study', 'Hobby', 'Entertainment'] as const) {
            if (dbgOverride[t] !== undefined) todaySec[t] = dbgOverride[t];
          }
        }

        const continuousEntertainment = s.isActive && s.currentType === 'Entertainment' && s.startTime
          ? (Date.now() - s.startTime) / 1000
          : 0;

        const continuousStudy = s.isActive && s.currentType === 'Study' && s.startTime
          ? (Date.now() - s.startTime) / 1000
          : (bal.milestones?.studyContinuous || 0);

        const continuousHobby = s.isActive && s.currentType === 'Hobby' && s.startTime
          ? (Date.now() - s.startTime) / 1000
          : (bal.milestones?.hobbyContinuous || 0);

        const available = Math.max(0, bal.earnedBalance) + bal.dailyGiftedRemaining;
        const debtAmount = bal.earnedBalance < 0 ? Math.abs(bal.earnedBalance) : 0;

        // Current session duration (0 if not active)
        const currentSessionDuration = s.isActive && s.startTime
          ? ((s.isPaused && s.pausedAt ? s.pausedAt : Date.now()) - s.startTime) / 1000
          : 0;

        // Check if there are unclaimed milestones
        const hasUnclaimedMilestone = (() => {
          const ms = bal.milestones;
          if (!ms) return false;
          const studyClaimed = (ms.studyClaimed || 0) as number;
          const hobbyClaimed = (ms.hobbyClaimed || 0) as number;
          const studyCont = s.isActive && s.currentType === 'Study'
            ? (Date.now() - (s.startTime || 0)) / 1000
            : (ms.studyContinuous || 0);
          const hobbyCont = s.isActive && s.currentType === 'Hobby'
            ? (Date.now() - (s.startTime || 0)) / 1000
            : (ms.hobbyContinuous || 0);
          const studyUnclaimed = STUDY_MILESTONES.some((m, i) =>
            !(studyClaimed & (1 << i)) && studyCont >= m.threshold
          );
          const hobbyUnclaimed = HOBBY_MILESTONES.some((m, i) =>
            !(hobbyClaimed & (1 << i)) && hobbyCont >= m.threshold
          );
          return studyUnclaimed || hobbyUnclaimed;
        })();

        // Metric values map
        const metrics: Record<string, number> & { _todayDurations?: Record<string, number>; _earnedBalance?: number; _hasUnclaimedMilestone?: boolean } = {
          entertainmentBalance: bal.earnedBalance,
          dailyGiftedBalance: bal.dailyGiftedRemaining,
          earnedBalance: bal.earnedBalance,
          studyDuration: todaySec.Study,
          hobbyDuration: todaySec.Hobby,
          entertainmentDuration: todaySec.Entertainment,
          continuousEntertainment,
          continuousStudy,
          continuousHobby,
          totalAvailableBalance: available,
          debtAmount,
          currentSessionDuration,
          _todayDurations: todaySec,
          _earnedBalance: bal.earnedBalance,
          _hasUnclaimedMilestone: hasUnclaimedMilestone,
        } as any;

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
          const met = evalNode(tree, metrics, { isActive: s.isActive, currentType: s.currentType, isPaused: s.isPaused });

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
          const body = rule.content || '';
          window.electronAPI.notificationShow({
            type: 'reminder',
            notifType: rule.urgency || 'reminder',
            title: rule.title || (locale === 'zh' ? '提醒' : 'Reminder'),
            body,
            color: notifColors[rule.urgency] || '#e8a55a',
            duration: cfg.notificationDuration ?? 5,
            sound: rule.sound || '',
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
        window.electronAPI.notificationShow({ type, notifType: 'notification', title, body, color: '#5db872', duration: cfg.notificationDuration ?? 5 });
      }
    } catch { /* ignore */ }
  }

  // ─── Session Management ──────────────────────────────────
  const stopSession = useCallback(async () => {
    const s = sessionRef.current;
    const bal = balanceRef.current;
    const cfg = settingsRef.current;
    const activeType = s.currentType;
    if (s.isActive && s.startTime) {
      const endTime = Date.now();
      const elapsed = (endTime - s.startTime) / 1000;
      if (elapsed >= 1) {
        const elapsedSec = Math.floor(elapsed);
        let balanceDelta = 0;

        // ─── Log entry ──────────────────────────────────────
        if (activeType === 'Study' || activeType === 'Hobby') {
          const w = activeType === 'Study' ? cfg.studyWeight : cfg.hobbyWeight;
          balanceDelta = Math.floor(elapsed / w);
        } else if (activeType === 'Entertainment') {
          balanceDelta = -elapsedSec;
        }

        const entry: TimeLogEntry = {
          startTime: new Date(s.startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          activityType: s.currentType,
          balanceChange: balanceDelta,
        };

        await window.electronAPI.writeLogEntry(entry);
        const logs = await window.electronAPI.getTodayLogs();
        dispatch({ type: 'SET_TODAY_LOGS', payload: logs });

        // ─── Build finalBalance with reconciliation + milestones ─
        // 使用最新的 balancerRef（而非 await 前捕获的 bal），避免 timer 在 await
        // writeLogEntry/getTodayLogs 期间 dispatch 的余额变更被覆盖
        let finalBalance: BalanceState = { ...balanceRef.current };

        // ─── Reconciliation: correct any missed timer ticks ─
        if (startBalanceRef.current) {
          const startBal = startBalanceRef.current;
          if (activeType === 'Study' || activeType === 'Hobby') {
            const w = activeType === 'Study' ? cfg.studyWeight : cfg.hobbyWeight;
            const expectedEarned = Math.floor(elapsed / w);
            const actualEarned = finalBalance.earnedBalance - startBal.earnedBalance;
            if (actualEarned < expectedEarned) {
              finalBalance.earnedBalance += expectedEarned - actualEarned;
            }
          } else if (activeType === 'Entertainment') {
            const expected = simulateEntertainmentConsumption(
              startBal.earnedBalance, startBal.dailyGiftedRemaining, elapsedSec
            );
            const earnedDiff = expected.earnedBalance - finalBalance.earnedBalance;
            const giftedDiff = expected.dailyGiftedRemaining - finalBalance.dailyGiftedRemaining;
            if (earnedDiff !== 0 || giftedDiff !== 0) {
              finalBalance.earnedBalance += earnedDiff;
              finalBalance.dailyGiftedRemaining += giftedDiff;
            }
          }
          // 保存快照用于结束通知计算
          startBalanceRef.current = null;
        }

        // ─── Reward check for Study / Hobby ───────────────
        if (activeType === 'Study' || activeType === 'Hobby') {
          const milestones = bal.milestones || { studyContinuous: 0, hobbyContinuous: 0, studyClaimed: 0, hobbyClaimed: 0, lastStudyEnd: 0, lastHobbyEnd: 0 };
          const isStudy = activeType === 'Study';
          const contKey = isStudy ? 'studyContinuous' : 'hobbyContinuous';
          const claimKey = isStudy ? 'studyClaimed' : 'hobbyClaimed';
          const lastEndKey = isStudy ? 'lastStudyEnd' : 'lastHobbyEnd';
          const milestoneList = isStudy ? STUDY_MILESTONES : HOBBY_MILESTONES;

          // Add this session's duration to continuous
          const m = milestones as NonNullable<BalanceState['milestones']>;
          let continuous = m[contKey] + elapsed;
          const lastEnd = m[lastEndKey] || 0;
          // Reset if gap too large
          if (lastEnd > 0 && s.startTime - lastEnd > CONTINUITY_GAP * 1000) {
            continuous = elapsed;
          }

          let claimed = m[claimKey] || 0;
          let rewardTotal = 0;

          milestoneList.forEach((ms, i) => {
            if (!(claimed & (1 << i)) && continuous >= ms.threshold) {
              claimed |= (1 << i);
              rewardTotal += ms.reward;
              const locale = cfg.locale || 'zh';
              const label = locale === 'zh' ? ms.labelZH : ms.labelEN;
              const rewardMin = Math.round(ms.reward / 60);
              const threshDisplay = ms.threshold >= 3600
                ? `${Math.round(ms.threshold / 3600)}h`
                : `${Math.round(ms.threshold / 60)}min`;
              const desc = locale === 'zh'
                ? `连续大于${threshDisplay}，获得${rewardMin}min的余额`
                : `Continuous >${threshDisplay}, earned ${rewardMin}min balance`;
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

          // Merge milestone progress + rewards into finalBalance
          finalBalance = {
            ...finalBalance,
            dailyGiftedRemaining: finalBalance.dailyGiftedRemaining + rewardTotal,
            milestones: {
              ...milestones,
              [contKey]: continuous,
              [claimKey]: claimed,
              [lastEndKey]: endTime,
            },
          } as BalanceState;
        }

        // ─── Apply balance (single update) ────────────────
        dispatch({ type: 'SET_BALANCE', payload: finalBalance });
        window.electronAPI.saveBalance(finalBalance);
      }
      dispatch({ type: 'SESSION_STOP' });
      notifySessionAction(activeType, 'stop', elapsed);
      try {
        const bl = cfg.locale || 'zh';
        const ticks = Math.floor(elapsed);
        if (activeType === 'Study' || activeType === 'Hobby') {
          const w = activeType === 'Study' ? cfg.studyWeight : cfg.hobbyWeight;
          const earned = Math.floor(elapsed / w);
          window.electronAPI.notificationShow({ type: activeType, notifType: 'info', title: bl === 'zh' ? `赚取 ${earned} 余额` : `Earned ${earned}`, body: '', color: '#a09d96', duration: cfg.notificationDuration ?? 5 });
        } else {
          window.electronAPI.notificationShow({ type: activeType, notifType: 'info', title: bl === 'zh' ? `消耗 ${ticks} 余额` : `Consumed ${ticks}`, body: '', color: '#a09d96', duration: cfg.notificationDuration ?? 5 });
        }
      } catch { /* ignore */ }
    } else {
      dispatch({ type: 'SESSION_STOP' });
    }
  }, []);

  const startSession = useCallback(async (type: SessionType) => {
    // Guard against re-entrance (e.g. global shortcut + keydown double-fire)
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      if (sessionRef.current.isActive) {
        if (sessionRef.current.currentType === type) {
          await stopSession();
          return;
        }
        await stopSession();
      }
      // Snapshot the balance BEFORE the new session starts (for reconciliation)
      startBalanceRef.current = balanceRef.current;
      dispatch({ type: 'SESSION_START', payload: type });
      notifySessionAction(type, 'start');
    } finally {
      startingRef.current = false;
    }
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
