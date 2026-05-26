import type { Translations } from './types';

export const en: Translations = {
  // App
  appTitle: 'TimeManager',
  appSubtitle: 'Time Manager',

  // Navigation
  navStudy: 'Study',
  navHobby: 'Hobby',
  navEntertainment: 'Entertainment',
  navRecord: 'Records',
  navSettings: 'Settings',

  // Status
  statusIdle: 'Idle',
  statusStudying: 'Studying',
  statusHobbying: 'Hobby Time',
  statusEntertaining: 'Entertaining',
  statusInsufficient: 'Insufficient balance',

  // Balance
  balanceLabel: 'Entertainment Balance',
  balanceGifted: 'Gifted',
  balanceEarned: 'Earned',
  sessionEarned: 'Session Earned',
  sessionConsumed: 'Session Used',
  giftedRemain: 'Gifted Left',
  earnedRemain: 'Earned Left',
  earnPerSecond: 'Earn 1 balance per {time}',

  // Timer
  start: '▶ Start {name}',
  stop: '■ Stop {name}',
  timerStudy: 'Study',
  timerHobby: 'Hobby',
  timerEntertainment: 'Entertainment',
  todayStudy: "Today's Study",
  todayHobby: "Today's Hobby",
  todayEntertainment: "Today's Entertainment",

  // Record
  recordTitle: "Today's Records",
  recordTimeline: 'Timeline',
  recordEmpty: 'No records yet today',
  recordInProgress: 'In Progress',
  recordNow: 'now',

  // Settings
  settingsTitle: 'Settings',
  startupOptions: 'Startup Options',
  autoStart: 'Launch at startup',
  silentStart: 'Silent start (to system tray)',
  minimizeToTray: 'Minimize to tray on close',
  weightSettings: 'Weight Settings',
  dataSection: 'Data',
  dataPath: 'Storage Path',
  hintMinimize: 'Tip: Closing the window minimizes to tray',
  selectFolder: 'Select Folder',
  language: 'Language',
  min: 'Min',
  max: 'Max',
  step: 'Step',

  // Sidebar
  currentStatus: 'Current Status',
  todayOverview: "Today's Overview",

  // Reminder
  lowBalanceTitle: 'Balance Warning',
  lowBalanceBody: 'Less than 10 minutes of balance remaining ({time})',
  longSessionTitle: 'Entertainment Reminder',
  longSessionBody: 'You have been entertaining for 2 hours, take a break!',

  // Debt
  balanceDebtLabel: 'Debt',
  balanceDebt: 'In Debt',

  // Reminder system
  navReminder: 'Reminders',
  reminderPageTitle: 'Reminder Rules',
  reminderAdd: 'Add Rule',
  reminderNoRules: 'No reminder rules yet',
  reminderTitleLabel: 'Title',
  reminderContentLabel: 'Content',
  reminderConditionLabel: 'Condition',
  reminderUrgencyLabel: 'Urgency',
  reminderSnoozeLabel: 'Snooze',
  reminderSnoozeMinutes: 'Delay (min)',
  reminderEnabled: 'Enabled',
  reminderDismiss: 'OK',
  reminderSnooze: 'Wait',
  reminderMetricEntertainmentBalance: 'Entertainment Balance',
  reminderMetricStudyDuration: "Today's Study",
  reminderMetricHobbyDuration: "Today's Hobby",
  reminderMetricEntertainmentDuration: "Today's Entertainment",
  reminderMetricContinuousEntertainment: 'Continuous Entertainment',
  reminderMetricTotalAvailableBalance: 'Total Available',
  reminderMetricDebtAmount: 'Debt Amount',
  reminderUrgencyLow: 'Low',
  reminderUrgencyMedium: 'Medium',
  reminderUrgencyHigh: 'High',
  reminderUrgencyCritical: 'Critical',
  reminderOperLt: '<',
  reminderOperGt: '>',
  reminderOperGte: '≥',
  reminderOperLte: '≤',
  reminderOperEq: '=',
  reminderEdit: 'Edit',
  reminderDelete: 'Delete',
  reminderDeleteConfirm: 'Delete this rule?',
  reminderSeconds: 's',
  reminder5min: '5 min',
  reminder10min: '10 min',
  reminderCustom: 'Custom',
  reminderMetricDailyGiftedBalance: 'Gifted Balance',
  reminderMetricEarnedBalance: 'Earned Balance',
  reminderAnd: 'AND',
  reminderOr: 'OR',
  reminderAddCondition: 'Add Condition',
  reminderRemoveCondition: 'Remove Condition',
};
