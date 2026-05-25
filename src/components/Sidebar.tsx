import type { SessionType } from '../types';
import { useAppStore } from '../hooks/useAppStore';
import { useT, statusKeyMap, navKeyMap } from '../hooks/useI18n';
import { formatDuration, activityIcon, activityColor } from '../utils/formatting';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { state } = useAppStore();
  const { balance, session, todayLogs } = state;
  const t = useT();

  const navItems = [
    { id: 'Study', icon: '📚' },
    { id: 'Hobby', icon: '🎨' },
    { id: 'Entertainment', icon: '🎮' },
    { id: 'Record', icon: '📊' },
    { id: 'Reminder', icon: '⏰' },
    { id: 'Settings', icon: '⚙' },
  ];

  // Compute today's total per type
  const todaySeconds: Record<string, number> = { Study: 0, Hobby: 0, Entertainment: 0 };
  for (const log of todayLogs) {
    const sec = (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000;
    todaySeconds[log.activityType] = (todaySeconds[log.activityType] || 0) + sec;
  }

  // Add active session
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

  return (
    <aside className="sidebar">
      {/* App Title */}
      <div className="sidebar-header">
        <h1>TimeManager</h1>
      </div>

      {/* Status Indicator */}
      <div className="sidebar-summary">
        <div className="summary-title">{t('currentStatus')}</div>
        <div style={{
          fontSize: 16,
          fontWeight: 500,
          color: statusColor,
          marginTop: 4,
        }}>
          {session.isActive && <span style={{ marginRight: 6 }}>{activityIcon(session.currentType as string)}</span>}
          {statusLabel}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-btn ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {t(navKeyMap[item.id])}
          </button>
        ))}
      </nav>

      {/* Daily Summary */}
      <div className="sidebar-summary">
        <div className="summary-title">{t('todayOverview')}</div>
        {['Study', 'Hobby', 'Entertainment'].map(type => (
          <div
            key={type}
            className="summary-item"
            style={{ color: activityColor(type) }}
          >
            {activityIcon(type)} {formatDuration(Math.floor(todaySeconds[type] || 0))}
          </div>
        ))}
      </div>

      {/* Balance Panel */}
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
        {balance.earnedBalance < 0 && (
          <div className="balance-debt-hint">
            {t('balanceDebtLabel')}: {formatDuration(Math.abs(balance.earnedBalance))}
          </div>
        )}
      </div>
    </aside>
  );
}
