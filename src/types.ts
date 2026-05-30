export type SessionType = 'None' | 'Study' | 'Hobby' | 'Entertainment';

export interface BalanceState {
  earnedBalance: number;
  dailyGiftedRemaining: number;
  lastDate: string;
  milestones?: {
    studyContinuous: number;
    hobbyContinuous: number;
    studyClaimed: number;
    hobbyClaimed: number;
  };
}

export interface AppSettings {
  autoStart: boolean;
  silentStart: boolean;
  minimizeToTray: boolean;
  studyWeight: number;
  studyWeightMin: number;
  studyWeightMax: number;
  studyWeightStep: number;
  hobbyWeight: number;
  hobbyWeightMin: number;
  hobbyWeightMax: number;
  hobbyWeightStep: number;
  dataPath?: string;
  locale?: 'zh' | 'en';
  hotkeys?: Record<string, string>;
  notificationEnabled: boolean;
  notificationDuration: number;
  debug?: boolean;
  minSessionLogSec?: number;
  minSessionLogEnabled?: boolean;
}

export const DEFAULT_HOTKEYS: Record<string, string> = {
  navStudy: 'Ctrl+1',
  navHobby: 'Ctrl+2',
  navEntertainment: 'Ctrl+3',
  navRecord: 'Ctrl+4',
  navReminder: 'Ctrl+5',
  navSettings: 'Ctrl+6',
  navDebug: 'Ctrl+7',
  sessionStudy: 'Ctrl+Shift+S',
  sessionHobby: 'Ctrl+Shift+H',
  sessionEntertainment: 'Ctrl+Shift+E',
  sessionStop: 'Ctrl+Shift+X',
  recordingConfirm: 'Enter',
  recordingCancel: 'Escape',
};

export interface TimeLogEntry {
  startTime: string;
  endTime: string;
  activityType: string;
  balanceChange: number;
  debug?: boolean;
  minSessionLogSec?: number;
  minSessionLogEnabled?: boolean;
}

export interface LogItem {
  icon: string;
  activityName: string;
  timeRange: string;
  duration: string;
  balanceText: string;
  isNegative: boolean;
}

// ─── Reminder Types ───────────────────────────────────────────

export type ReminderMetric =
  | 'entertainmentBalance'
  | 'dailyGiftedBalance'
  | 'earnedBalance'
  | 'studyDuration'
  | 'hobbyDuration'
  | 'entertainmentDuration'
  | 'continuousEntertainment'
  | 'totalAvailableBalance'
  | 'debtAmount';

export type ReminderOperator = 'lt' | 'gt' | 'gte' | 'lte' | 'eq';

export type ReminderUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface ReminderCondition {
  metric: ReminderMetric;
  operator: ReminderOperator;
  value: number;
}

// ─── Condition Tree Types (for complex AND/OR nesting) ──────

export interface LeafCondition {
  type: 'leaf';
  metric: ReminderMetric;
  operator: ReminderOperator;
  value: number;
}

export interface BoolCondition {
  type: 'bool';
  boolType: 'currentState';
  boolValue: SessionType;
  expected: boolean;
}

export interface ConditionGroup {
  type: 'group';
  logic: 'and' | 'or';
  nodes: ConditionNode[];
}

export type ConditionNode = LeafCondition | BoolCondition | ConditionGroup;

export interface ReminderRule {
  id: string;
  title: string;
  content: string;
  conditionTree: ConditionNode;
  urgency: ReminderUrgency;
  enabled: boolean;
  // Internal: current metric values set by engine when enqueuing (path → value)
  _currentValues?: Record<string, number>;
  _locale?: string;

  // Deprecated — kept for migration from flat format
  conditions?: ReminderCondition[];
  logic?: 'and' | 'or';
  condition?: ReminderCondition;
  condition2?: ReminderCondition;
  _currentValue?: number;
  _currentValue2?: number;
}

export interface ReminderTriggerState {
  dismissed: boolean;
  snoozedUntil: number;
  lastTriggered: number;
}

interface ReducerReminderActions {
  type: 'REMINDER_LOAD_RULES';
  payload: ReminderRule[];
}
interface ReducerReminderAddRule {
  type: 'REMINDER_ADD_RULE';
  payload: ReminderRule;
}
interface ReducerReminderUpdateRule {
  type: 'REMINDER_UPDATE_RULE';
  payload: ReminderRule;
}
interface ReducerReminderDeleteRule {
  type: 'REMINDER_DELETE_RULE';
  payload: string;
}
interface ReducerReminderShowModal {
  type: 'REMINDER_SHOW_MODAL';
  payload: ReminderRule | null;
}

export type ReminderAction =
  | ReducerReminderActions
  | ReducerReminderAddRule
  | ReducerReminderUpdateRule
  | ReducerReminderDeleteRule
  | ReducerReminderShowModal;

// ─── AppState ──────────────────────────────────────────────────

export interface AppState {
  session: {
    isActive: boolean;
    currentType: SessionType;
    startTime: number | null;
    tickCount: number;
  };
  balance: BalanceState;
  settings: AppSettings;
  todayLogs: TimeLogEntry[];
  reminderRules: ReminderRule[];
  showReminderModal: ReminderRule | null;
}

declare global {
  interface Window {
    electronAPI: {
      loadBalance: () => Promise<BalanceState>;
      saveBalance: (data: BalanceState) => Promise<void>;
      loadSettings: () => Promise<AppSettings | null>;
      saveSettings: (data: AppSettings) => Promise<void>;
      getTodayLogs: () => Promise<TimeLogEntry[]>;
      getLogsForDate: (dateStr: string) => Promise<TimeLogEntry[]>;
      writeLogEntry: (entry: TimeLogEntry) => Promise<void>;
      showNotification: (title: string, body: string) => Promise<void>;
      minimizeToTray: () => Promise<void>;
      restoreWindow: () => Promise<void>;
      quitApp: () => Promise<void>;
      getBasePath: () => Promise<string>;
      setAutoStart: (enabled: boolean) => Promise<void>;
      selectFolder: () => Promise<string | null>;
      remindersLoad: () => Promise<ReminderRule[]>;
      remindersSave: (rules: ReminderRule[]) => Promise<void>;
      windowSetAlwaysOnTop: (onTop: boolean) => Promise<void>;
      getBeepDataUrl: () => Promise<string>;
      reminderShowToast: (rule: ReminderRule) => Promise<void>;
      reminderToastDismiss: () => Promise<void>;
      reminderToastSnooze: (minutes: number) => Promise<void>;
      reminderResize: (height: number) => Promise<void>;
      onReminderToastAction: (callback: (action: { action: string; minutes?: number }) => void) => void;
      setMinimizeToTray: (value: boolean) => Promise<void>;
      notificationShow: (data: { type: string; notifType: string; title: string; body: string; color: string; duration: number }) => Promise<void>;
      notificationDismiss: (id: string) => Promise<void>;
      sessionUpdateState: (state: { isActive: boolean; type: string }) => Promise<void>;
      onTrayAction: (callback: (action: { action: string; type?: string; page?: string }) => void) => void;
    };
  }
}
