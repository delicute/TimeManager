import type { ReactNode } from 'react';
import { Play, Square, Gift } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT, statusKeyMap, timerKeyMap, todayKeyMap } from '../hooks/useI18n';
import { formatDurationFull, formatDuration } from '../utils/formatting';
import type { SessionType } from '../types';

const STUDY_MILESTONES = [
  { threshold: 3600, label: '1h', reward: 900 },
  { threshold: 10800, label: '3h', reward: 2700 },
  { threshold: 18000, label: '5h', reward: 3600 },
];

const HOBBY_MILESTONES = [
  { threshold: 3600, label: '1h', reward: 600 },
  { threshold: 10800, label: '3h', reward: 1800 },
  { threshold: 18000, label: '5h', reward: 2700 },
];

interface TimerCardProps {
  type: SessionType;
  icon: ReactNode;
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
            <div className="stat-value warning">{sessionConsumed > 0 ? `${sessionConsumed}s` : '0s'}</div>
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
            <div className="stat-value positive">{sessionEarned > 0 ? `${sessionEarned}s` : '0s'}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">{t(todayKeyMap[type])}</div>
            <div className="stat-value">{formatDuration(computeTodayTotal())}</div>
          </div>
        </div>
      )}

      {/* Milestone Progress Bar (Study & Hobby only) */}
      {(type === 'Study' || type === 'Hobby') && (() => {
        const milestones = type === 'Study' ? STUDY_MILESTONES : HOBBY_MILESTONES;
        const claimKey = type === 'Study' ? 'studyClaimed' : 'hobbyClaimed';
        const mData = state.balance.milestones;
        const claimed = mData?.[claimKey as keyof typeof mData] as number || 0;
        const continuous = computeTodayTotal();
        const nextThreshold = (() => {
        for (const m of milestones) {
          if (!(claimed & (1 << milestones.indexOf(m)))) {
            nextThreshold = m.threshold;
            break;
          }
        }
        const progress = continuous >= nextThreshold ? 100 : (continuous / nextThreshold) * 100;
        const maxTh = milestones[milestones.length - 1].threshold;

        return (
          <div className="milestone-bar-wrap">
            {/* Rewards above each milestone node */}
            <div className="milestone-rewards-row">
              {milestones.map((m, i) => (
                <div key={i} className="milestone-reward" style={{ left: `${(m.threshold / maxTh) * 100}%` }}>
                  <Gift size={10} />
                  <span>+{formatDuration(m.reward)}</span>
                </div>
              ))}
            </div>
            {/* Bar */}
            <div className="milestone-bar">
              <div className="milestone-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
              {milestones.map((m, i) => (
                <div key={i} className={`milestone-dot${(claimed & (1 << i)) ? ' claimed' : ''}`}
                  style={{ left: `${(m.threshold / maxTh) * 100}%` }} />
              ))}
            </div>
            {/* Bottom row: current time + milestones on same line */}
            <div className="milestone-top-row">
              <span className="milestone-current-time">{continuous < 60 ? `${Math.round(continuous)}s` : formatDuration(Math.round(continuous / 60) * 60)}</span>
              <div className="milestone-marks">
                {milestones.map((m, i) => (
                  <span key={i} style={{ left: `${(m.threshold / maxTh) * 100}%` }}>{m.label}</span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Action Button */}
      <div style={{ marginTop: 32 }}>
        <button
          className={`btn btn-full ${isActive ? 'btn-stop' : 'btn-start'}`}
          onClick={handleClick}
          disabled={!canStart && !isActive}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
        >
          {isActive ? <Square size={16} /> : <Play size={16} />}
          {isActive ? t('stop', { name: localizedName }) : t('start', { name: localizedName })}
        </button>
      </div>

      {/* Status Text */}
      <div className="status-text" style={{ color: isActive ? accentColor : undefined }}>
        {isActive && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{icon} {t(statusKeyMap[type])}</span>}
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
