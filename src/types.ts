export type SessionType = 'None' | 'Study' | 'Hobby' | 'Entertainment';

export interface BalanceState {
  earnedBalance: number;
  dailyGiftedRemaining: number;
  lastDate: string;
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
}

export interface TimeLogEntry {
  startTime: string;
  endTime: string;
  activityType: string;
  balanceChange: number;
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

export interface ReminderRule {
  id: string;
  title: string;
  content: string;
  condition: ReminderCondition;
  condition2?: ReminderCondition;
  logic?: 'and' | 'or';
  urgency: ReminderUrgency;
  enabled: boolean;
  // Internal: current metric values set by engine when enqueuing
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
      onReminderToastAction: (callback: (action: { action: string; minutes?: number }) => void) => void;
    };
  }
}
