import { Play, BarChart3, Bell, Keyboard, Settings, BookOpen, Palette, Gamepad2 } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT, statusKeyMap, navKeyMap } from '../hooks/useI18n';
import { Bug } from "lucide-react";
import { formatDuration, activityColor } from '../utils/formatting';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'Start', icon: Play },
  { id: 'Record', icon: BarChart3 },
  { id: 'Reminder', icon: Bell },
  { id: 'Hotkey', icon: Keyboard },
  { id: 'Settings', icon: Settings },
];

const ACTIVITY_ICONS: Record<string, typeof BookOpen> = {
  Study: BookOpen,
  Hobby: Palette,
  Entertainment: Gamepad2,
};

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { state } = useAppStore();
  const { balance, session, todayLogs } = state;
  const t = useT();

  // Compute today's total per type
  const todaySeconds: Record<string, number> = { Study: 0, Hobby: 0, Entertainment: 0 };
  for (const log of todayLogs) {
    const sec = (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000;
    todaySeconds[log.activityType] = (todaySeconds[log.activityType] || 0) + sec;
  }

  if (session.isActive && session.currentType !== 'None' && session.startTime) {
    const elapsed = (Date.now() - session.startTime) / 1000;
    todaySeconds[session.currentType] = (todaySeconds[session.currentType] || 0) + elapsed;
  }

  const totalAvailable = balance.earnedBalance + balance.dailyGiftedRemaining;
  const statusKey = session.isActive
    ? statusKeyMap[session.currentType]
    : null;
  const statusLabel = statusKey ? t(statusKey) : t('statusIdle');
  const statusColor = session.isActive
    ? activityColor(session.currentType as string)
    : 'var(--color-on-dark-soft)';
  const ActivityIcon = session.isActive ? ACTIVITY_ICONS[session.currentType as string] : null;

  return (
    <aside className="sidebar">
      {/* Balance Panel — at top */}
      <div className="sidebar-balance">
        <div className="balance-label">
          {t('balanceLabel')}
          {balance.earnedBalance < 0 && (
            <span className="balance-debt-badge">{t('balanceDebt')}</span>
          )}
        </div>
        <div className={`balance-value ${balance.earnedBalance < 0 ? 'debt' : ''}`}>
          {balance.earnedBalance < 0
            ? `-${formatDuration(Math.abs(balance.earnedBalance))}`
            : formatDuration(totalAvailable)}
        </div>
        <div className="balance-detail">
          {t('balanceGifted')}: {formatDuration(balance.dailyGiftedRemaining)}
          {' | '} {t('balanceEarned')}: {formatDuration(balance.earnedBalance)}
        </div>
      </div>

      {/* Status Indicator */}
      <div className="sidebar-summary sidebar-summary-first">
        <div className="summary-title">{t('currentStatus')}</div>
        <div style={{ fontSize: 16, fontWeight: 500, color: statusColor, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          {ActivityIcon && <ActivityIcon size={18} />}
          {statusLabel}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-btn ${currentPage === item.id || (item.id === 'Start' && ['Study','Hobby','Entertainment'].includes(currentPage)) ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon"><Icon size={18} /></span>
              {t(navKeyMap[item.id])}
            </button>
          );
        })}
        {state.settings.debug && <button key="Debug" className={`nav-btn ${currentPage === "Debug" ? "active" : ""}`} onClick={() => onNavigate("Debug")}><span className="nav-icon"><Bug size={18} /></span>{t("navDebug")}</button>}
      </nav>

      {/* Daily Summary */}
      <div className="sidebar-summary sidebar-summary-first">
        <div className="summary-title">{t('todayOverview')}</div>
        <div className="today-row">
          {(['Study', 'Hobby', 'Entertainment'] as const).map(type => {
            const TypeIcon = ACTIVITY_ICONS[type];
            return (
              <div
                key={type}
                className="today-item"
                style={{ color: activityColor(type) }}
              >
                <TypeIcon size={14} />
                <span>{formatDuration(Math.floor(todaySeconds[type] || 0))}</span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
