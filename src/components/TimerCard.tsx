import type { ReactNode } from 'react';
import { Play, Square, Gift, Pause } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT, timerKeyMap, todayKeyMap } from '../hooks/useI18n';
import { formatDurationFull, formatDuration } from '../utils/formatting';
import type { SessionType } from '../types';
import { STUDY_MILESTONES, HOBBY_MILESTONES } from '../constants';

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
  const { state, dispatch, startSession, stopSession } = useAppStore();
  const { session } = state;
  const t = useT();

  const isActive = session.isActive && session.currentType === type;
  const paused = session.isPaused;
  const rawElapsed = isActive && session.startTime
    ? Math.floor((Date.now() - session.startTime) / 1000) : 0;
  // When paused, compute elapsed from pausedAt (works for both button and shortcut pause)
  const elapsedSeconds = paused && session.pausedAt && session.startTime
    ? Math.floor((session.pausedAt - session.startTime) / 1000)
    : rawElapsed;

  const sessionEarned = isActive && type !== 'Entertainment'
    ? Math.floor(elapsedSeconds / intervalSeconds) : 0;

  const debtRate = state.balance.earnedBalance < 0 ? 2 : 1;
  const sessionConsumed = isActive && type === 'Entertainment'
    ? elapsedSeconds * debtRate : 0;

  const handlePause = () => {
    if (!paused) {
      dispatch({ type: 'SESSION_PAUSE' });
    } else {
      dispatch({ type: 'SESSION_RESUME' });
    }
  };

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
        const contKey = type === 'Study' ? 'studyContinuous' : 'hobbyContinuous';
        const mData = state.balance.milestones;
        const claimed = mData?.[claimKey as keyof typeof mData] as number || 0;
        // Use stored continuous time + current session elapsed (pause-aware)
        const storedCont = (mData?.[contKey as keyof typeof mData] as number) || 0;
        const continuous = storedCont + (isActive ? elapsedSeconds : 0);
        // Only show unclaimed milestones that haven't been passed yet
        const activeMilestones = milestones.filter((_, i) => {
          if (claimed & (1 << i)) return false;
          return continuous < milestones[i].threshold;
        });
        const maxTh = milestones[milestones.length - 1].threshold;
        if (activeMilestones.length === 0) {
          // All milestones done — show bar with completion message
          return (
            <div className="milestone-bar-wrap" style={{ opacity: 0.45 }}>
              <div className="milestone-bar">
                <div className="milestone-fill" style={{ width: '100%', opacity: 0.4 }} />
                {milestones.map((m, i) => (
                  <div key={i} className="milestone-dot claimed"
                    style={{ left: `${(m.threshold / maxTh) * 100}%` }} />
                ))}
              </div>
              <div className="milestone-top-row">
                <span className="milestone-current-time">{continuous < 60 ? `${Math.round(continuous)}s` : formatDuration(Math.round(continuous / 60) * 60)}</span>
                <div className="milestone-marks">
                  {milestones.map((m, i) => (
                    <span key={i} style={{ left: `${(m.threshold / maxTh) * 100}%` }}>{m.label}</span>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-accent-teal)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                  {t('milestoneAllClaimed')}
                </span>
              </div>
            </div>
          );
        }
        const progress = (continuous / maxTh) * 100;

        return (
          <div className="milestone-bar-wrap">
            {/* Rewards above each milestone node */}
            <div className="milestone-rewards-row">
              {activeMilestones.map((m, i) => (
                <div key={i} className="milestone-reward" style={{ left: `${(m.threshold / maxTh) * 100}%` }}>
                  <Gift size={10} />
                  <span>+{formatDuration(m.reward)}</span>
                </div>
              ))}
            </div>
            {/* Bar */}
            <div className="milestone-bar">
              <div className="milestone-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
              {activeMilestones.map((m, i) => (
                <div key={i} className="milestone-dot"
                  style={{ left: `${(m.threshold / maxTh) * 100}%` }} />
              ))}
            </div>
            {/* Bottom row: current time + milestones on same line */}
            <div className="milestone-top-row">
              <span className="milestone-current-time">{continuous < 60 ? `${Math.round(continuous)}s` : formatDuration(Math.round(continuous / 60) * 60)}</span>
              <div className="milestone-marks">
                {activeMilestones.map((m, i) => (
                  <span key={i} style={{ left: `${(m.threshold / maxTh) * 100}%` }}>{m.label}</span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Action Buttons */}
      <div style={{ marginTop: 22 }}>
        {isActive ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-stop" onClick={handleClick}
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <Square size={16} /> {t('stop', { name: localizedName })}
            </button>
            <button className={`btn ${paused ? 'btn-start' : 'btn-secondary'}`} onClick={handlePause}
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              {paused ? <Play size={16} /> : <Pause size={16} />}
              {paused ? t('timerResume') : t('timerPause')}
            </button>
          </div>
        ) : (
          <button className="btn btn-full btn-start" onClick={handleClick}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Play size={16} /> {t('start', { name: localizedName })}
          </button>
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
