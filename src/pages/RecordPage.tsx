import { useAppStore } from '../hooks/useAppStore';
import { useT, navKeyMap } from '../hooks/useI18n';
import {
  formatDuration,
  formatBalance,
  activityIcon,
} from '../utils/formatting';

export function RecordPage() {
  const { state } = useAppStore();
  const { todayLogs, session } = state;
  const t = useT();

  // Compute totals
  const totals: Record<string, number> = { Study: 0, Hobby: 0, Entertainment: 0 };
  for (const log of todayLogs) {
    const sec = Math.floor(
      (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000
    );
    totals[log.activityType] = (totals[log.activityType] || 0) + sec;
  }

  // Add active session
  if (session.isActive && session.currentType !== 'None' && session.startTime) {
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    totals[session.currentType] = (totals[session.currentType] || 0) + elapsed;
  }

  // Build timeline
  const timeline = todayLogs
    .slice()
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .map(log => ({
      icon: activityIcon(log.activityType),
      name: t(navKeyMap[log.activityType]),
      timeRange: `${fmtTime(log.startTime)} - ${fmtTime(log.endTime)}`,
      duration: formatDuration(
        Math.floor(
          (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000
        )
      ),
      balanceText: formatBalance(log.balanceChange),
      isNegative: log.balanceChange < 0,
    }));

  // Active session at top
  if (session.isActive && session.currentType !== 'None' && session.startTime) {
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    timeline.unshift({
      icon: activityIcon(session.currentType),
      name: `${t(navKeyMap[session.currentType])} (${t('recordInProgress')})`,
      timeRange: `${fmtTime(session.startTime)} - ${t('recordNow')}`,
      duration: formatDuration(elapsed),
      balanceText: '',
      isNegative: false,
    });
  }

  return (
    <>
      <h1 className="page-title">
        <span className="title-icon">📊</span> {t('recordTitle')}
      </h1>

      {/* Summary Cards */}
      <div className="record-cards">
        {[
          { type: 'Study', icon: '📚', label: t(navKeyMap['Study']), value: totals.Study || 0, color: 'var(--color-study)' },
          { type: 'Hobby', icon: '🎨', label: t(navKeyMap['Hobby']), value: totals.Hobby || 0, color: 'var(--color-hobby)' },
          { type: 'Entertainment', icon: '🎮', label: t(navKeyMap['Entertainment']), value: totals.Entertainment || 0, color: 'var(--color-entertainment)' },
        ].map(item => (
          <div key={item.type} className="record-card">
            <div className="card-icon">{item.icon}</div>
            <div className="card-label">{item.label}</div>
            <div className="card-value" style={{ color: item.color }}>
              {formatDuration(item.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="timeline-card">
        <div className="timeline-header">
          <h3>{t('recordTimeline')}</h3>
        </div>
        {timeline.length === 0 ? (
          <div className="empty-hint">{t('recordEmpty')}</div>
        ) : (
          timeline.map((item, i) => (
            <div key={i} className="timeline-item">
              <div className="item-icon">{item.icon}</div>
              <div>
                <div className="item-name">{item.name}</div>
                <div className="item-time">{item.timeRange}</div>
              </div>
              <div className="item-duration">{item.duration}</div>
              <div
                className={`item-balance ${
                  item.balanceText ? (item.isNegative ? 'negative' : 'positive') : ''
                }`}
              >
                {item.balanceText}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function fmtTime(iso: string | number): string {
  const d = typeof iso === 'number' ? new Date(iso) : new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
