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
    lastStudyEnd?: number;
    lastHobbyEnd?: number;
  };
  debugTodayOverride?: Record<string, number>;
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
  globalHotkeys?: boolean;
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
  sessionPause: 'Ctrl+Shift+P',
  sessionPrint: 'Ctrl+Shift+L',
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

// ─── Reminder Types ───────────────────────────────────────────

export type ReminderMetric =
  | 'entertainmentBalance'
  | 'dailyGiftedBalance'
  | 'earnedBalance'
  | 'studyDuration'
  | 'hobbyDuration'
  | 'entertainmentDuration'
  | 'totalAvailableBalance'
  | 'debtAmount'
  | 'currentSessionDuration';

export type ReminderOperator = 'lt' | 'gt' | 'gte' | 'lte' | 'eq' | 'neq';

export type ReminderUrgency = 'low' | 'medium' | 'high' | 'critical' | 'urgent' | 'reminder' | 'notification' | 'info';
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

export type BoolType = 'currentState' | 'isDebt' | 'hasActivityToday' | 'isPaused' | 'isMilestoneAvailable';

export interface BoolCondition {
  type: 'bool';
  boolType: BoolType;
  boolValue?: SessionType; // only used when boolType === 'currentState'
  expected: boolean;
}

export interface ConditionGroup {
  type: 'group';
  logic: 'and' | 'or';
  nodes: ConditionNode[];
}

export interface TimeCondition {
  type: 'time';
  /** 'before' = trigger before this time, 'after' = trigger after, 'at' = trigger at this exact minute */
  timeOp: 'before' | 'after' | 'at';
  /** HH:mm in 24h format, e.g. "22:00" */
  timeValue: string;
}

export interface NotCondition {
  type: 'not';
  node: ConditionNode;
}

export type ConditionNode = LeafCondition | BoolCondition | ConditionGroup | TimeCondition | NotCondition;

export interface ReminderRule {
  id: string;
  title: string;
  content: string;
  conditionTree: ConditionNode;
  urgency: ReminderUrgency;
  enabled: boolean;
  sound?: string; // '' = none, 'builtin:beep', 'builtin:completion', 'file:base64,<dataUrl>'
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
    isPaused: boolean;
    pausedAt?: number;
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
      saveBalanceSync: (data: BalanceState) => void;
      loadSettings: () => Promise<AppSettings | null>;
      saveSettings: (data: AppSettings) => Promise<void>;
      getTodayLogs: () => Promise<TimeLogEntry[]>;
      getLogsForDate: (dateStr: string) => Promise<TimeLogEntry[]>;
      writeLogEntry: (entry: TimeLogEntry) => Promise<void>;
      writeLogEntrySync: (entry: TimeLogEntry) => void;
      clearAllLogs: () => Promise<void>;
      showNotification: (title: string, body: string) => Promise<void>;
      minimizeToTray: () => Promise<void>;
      restoreWindow: () => Promise<void>;
      quitApp: () => Promise<void>;
      getBasePath: () => Promise<string>;
      setAutoStart: (enabled: boolean) => Promise<void>;
      selectFolder: () => Promise<string | null>;
      shellOpenPath: (dirPath: string) => Promise<void>;
      remindersLoad: () => Promise<ReminderRule[]>;
      remindersSave: (rules: ReminderRule[]) => Promise<void>;
      windowSetAlwaysOnTop: (onTop: boolean) => Promise<void>;
      getBuiltinSoundUrls: () => Promise<Record<string, string>>;
      readAudioFile: (filePath: string) => Promise<string | null>;
      selectAudioFile: () => Promise<string | null>;
      reminderShowToast: (rule: ReminderRule) => Promise<void>;
      reminderToastDismiss: () => Promise<void>;
      reminderToastSnooze: (minutes: number) => Promise<void>;
      reminderResize: (height: number) => Promise<void>;
      onReminderToastAction: (callback: (action: { action: string; minutes?: number }) => void) => () => void;
      setMinimizeToTray: (value: boolean) => Promise<void>;
      notificationShow: (data: { type: string; notifType: string; title: string; body: string; color: string; duration: number }) => Promise<void>;
      notificationDismiss: (id: string) => Promise<void>;
      sessionUpdateState: (state: { isActive: boolean; type: string }) => Promise<void>;
      onTrayAction: (callback: (action: { action: string; type?: string; page?: string }) => void) => () => void;
      registerGlobalHotkeys: (hotkeys: Record<string, string>) => Promise<Record<string, boolean>>;
      unregisterGlobalHotkeys: () => Promise<void>;
      onGlobalShortcutTrigger: (callback: (id: string) => void) => () => void;
    };
    __saveActiveSession__?: () => void;
  }
}
