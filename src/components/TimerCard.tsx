import { useAppStore } from '../hooks/useAppStore';
import { useT, statusKeyMap, timerKeyMap, todayKeyMap } from '../hooks/useI18n';
import { formatDurationFull, formatDuration } from '../utils/formatting';
import type { SessionType } from '../types';

interface TimerCardProps {
  type: SessionType;
  icon: string;
  intervalSeconds: number;
  accentColor: string;
  showConsumption?: boolean;
  giftedRemaining?: number;
  earnedRemaining?: number;
}

export function TimerCard({
  type,
  icon,
  intervalSeconds,
  accentColor,
  showConsumption,
  giftedRemaining,
  earnedRemaining,
}: TimerCardProps) {
  const { state, startSession, stopSession } = useAppStore();
  const { session } = state;
  const t = useT();

  const isActive = session.isActive && session.currentType === type;

  const elapsedSeconds = isActive && session.startTime
    ? Math.floor((Date.now() - session.startTime) / 1000)
    : 0;

  const sessionEarned = isActive && type !== 'Entertainment'
    ? Math.floor(elapsedSeconds / intervalSeconds)
    : 0;

  const sessionConsumed = isActive && type === 'Entertainment'
    ? elapsedSeconds
    : 0;

  const canStart = type !== 'Entertainment' ||
    (state.balance.earnedBalance + state.balance.dailyGiftedRemaining > 0);

  const handleClick = () => {
    if (isActive) {
      stopSession();
    } else {
      startSession(type);
    }
  };

  const localizedName = t(timerKeyMap[type]);

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      {/* Timer Display */}
      <div className="timer-display">
        {formatDurationFull(elapsedSeconds)}
      </div>

      {/* Stats */}
      {showConsumption ? (
        <div className="stats-grid cols-3">
          <div className="stat-item">
            <div className="stat-label">{t('sessionConsumed')}</div>
            <div className="stat-value warning">{sessionConsumed > 0 ? `-${sessionConsumed}s` : '-0s'}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">{t('giftedRemain')}</div>
            <div className="stat-value positive">{formatDuration(giftedRemaining ?? 0)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">{t('earnedRemain')}</div>
            <div className="stat-value neutral">{formatDuration(earnedRemaining ?? 0)}</div>
          </div>
        </div>
      ) : (
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">{t('sessionEarned')}</div>
            <div className="stat-value positive">{sessionEarned > 0 ? `+${sessionEarned}s` : '+0s'}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">{t(todayKeyMap[type])}</div>
            <div className="stat-value">{formatDuration(computeTodayTotal())}</div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div style={{ marginTop: 24 }}>
        <button
          className={`btn btn-full ${isActive ? 'btn-stop' : 'btn-start'}`}
          onClick={handleClick}
          disabled={!canStart && !isActive}
        >
          {isActive ? t('stop', { name: localizedName }) : t('start', { name: localizedName })}
        </button>
      </div>

      {/* Status Text */}
      <div className="status-text" style={{ color: isActive ? accentColor : undefined }}>
        {isActive && `${icon} ${t(statusKeyMap[type])}`}
        {!canStart && type === 'Entertainment' && !isActive && (
          <span style={{ color: 'var(--color-error)' }}>{t('statusInsufficient')}</span>
        )}
      </div>
    </div>
  );

  function computeTodayTotal(): number {
    let total = 0;
    for (const log of state.todayLogs) {
      if (log.activityType === type) {
        total += (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000;
      }
    }
    if (isActive) total += elapsedSeconds;
    return Math.floor(total);
  }
}
