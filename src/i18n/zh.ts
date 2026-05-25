import type { Translations } from './types';

export const zh: Translations = {
  // App
  appTitle: 'TimeManager',
  appSubtitle: '时间管理器',

  // Navigation
  navStudy: '学习',
  navHobby: '爱好',
  navEntertainment: '娱乐',
  navRecord: '记录',
  navSettings: '设置',

  // Status
  statusIdle: '空闲中',
  statusStudying: '学习中',
  statusHobbying: '爱好中',
  statusEntertaining: '娱乐中',
  statusInsufficient: '余额不足',

  // Balance
  balanceLabel: '娱乐余额',
  balanceGifted: '赠送',
  balanceEarned: '赚取',
  sessionEarned: '本场赚取',
  sessionConsumed: '本场消耗',
  giftedRemain: '赠送剩余',
  earnedRemain: '赚取剩余',
  earnPerSecond: '每 {time} 获得 1 娱乐余额',

  // Timer
  start: '▶ 开始{name}',
  stop: '■ 停止{name}',
  timerStudy: '学习',
  timerHobby: '爱好',
  timerEntertainment: '娱乐',
  todayStudy: '今日学习',
  todayHobby: '今日爱好',
  todayEntertainment: '今日娱乐',

  // Record
  recordTitle: '今日记录',
  recordTimeline: '时间线',
  recordEmpty: '今天还没有记录',
  recordInProgress: '进行中',
  recordNow: '现在',

  // Settings
  settingsTitle: '设置',
  startupOptions: '启动选项',
  autoStart: '开机自启',
  silentStart: '静默启动（启动到系统托盘）',
  minimizeToTray: '关闭窗口时退出到系统托盘',
  weightSettings: '权重调节',
  dataSection: '数据',
  dataPath: '存储路径',
  hintMinimize: '提示：关闭窗口会最小化到系统托盘',
  selectFolder: '选择文件夹',
  language: '语言',
  min: '下限',
  max: '上限',
  step: '步长',

  // Sidebar
  currentStatus: '当前状态',
  todayOverview: '今日概览',

  // Reminder
  lowBalanceTitle: '余额提醒',
  lowBalanceBody: '娱乐余额不足10分钟，剩余 {time}',
  longSessionTitle: '娱乐提醒',
  longSessionBody: '你已经连续娱乐2小时了，建议休息一下',

  // Debt
  balanceDebtLabel: '债务',
  balanceDebt: '负债中',

  // Reminder system
  navReminder: '提醒',
  reminderPageTitle: '提醒规则',
  reminderAdd: '添加规则',
  reminderNoRules: '还没有提醒规则',
  reminderTitleLabel: '标题',
  reminderContentLabel: '内容',
  reminderConditionLabel: '触发条件',
  reminderUrgencyLabel: '紧急度',
  reminderSnoozeLabel: '暂停设置',
  reminderSnoozeMinutes: '延迟（分钟）',
  reminderSnoozeRepeat: '重复次数',
  reminderEnabled: '启用',
  reminderDismiss: '确定',
  reminderSnooze: '等等',
  reminderMetricEntertainmentBalance: '娱乐余额',
  reminderMetricStudyDuration: '今日学习',
  reminderMetricHobbyDuration: '今日爱好',
  reminderMetricEntertainmentDuration: '今日娱乐',
  reminderMetricContinuousEntertainment: '连续娱乐',
  reminderMetricTotalAvailableBalance: '可用总额',
  reminderMetricDebtAmount: '债务金额',
  reminderUrgencyLow: '低',
  reminderUrgencyMedium: '中',
  reminderUrgencyHigh: '高',
  reminderUrgencyCritical: '严重',
  reminderOperLt: '<',
  reminderOperGt: '>',
  reminderOperGte: '≥',
  reminderOperLte: '≤',
  reminderOperEq: '=',
  reminderEdit: '编辑',
  reminderDelete: '删除',
  reminderDeleteConfirm: '确定删除此规则？',
  reminderSeconds: '秒',
};
