import { useEffect, useRef } from 'react';
import { useAppStore } from './useAppStore';

export function useIdleDetection() {
  const { state, dispatch } = useAppStore();
  const idleEnabled = state.settings.idlePauseEnabled;
  const idleMinutes = state.settings.idlePauseMinutes;

  const lastActivityRef = useRef(Date.now());
  const sessionRef = useRef(state.session);
  const settingsRef = useRef(state.settings);
  sessionRef.current = state.session;
  settingsRef.current = state.settings;

  useEffect(() => {
    if (!idleEnabled) return;

    lastActivityRef.current = Date.now();

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      const s = sessionRef.current;
      // Auto-resume if currently auto-paused
      if (s.autoPaused && s.isActive && s.isPaused && s.currentType !== 'None') {
        dispatch({ type: 'SESSION_RESUME' });
        const cfg = settingsRef.current;
        const locale = cfg.locale || 'zh';
        window.electronAPI.notificationShow({
          type: s.currentType,
          notifType: 'info',
          title: locale === 'zh' ? '检测到操作，计时已恢复' : 'Activity detected, timer resumed',
          body: '',
          color: '#5db872',
          duration: cfg.notificationDuration ?? 5,
        });
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'wheel'];
    for (const ev of events) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    const intervalId = setInterval(() => {
      const s = sessionRef.current;
      // Only auto-pause when a session is active and not already paused
      if (!s.isActive || s.currentType === 'None' || s.isPaused) return;

      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= idleMinutes * 60 * 1000) {
        dispatch({ type: 'SESSION_AUTO_PAUSE' });
        const cfg = settingsRef.current;
        const locale = cfg.locale || 'zh';
        window.electronAPI.notificationShow({
          type: s.currentType,
          notifType: 'warning',
          title: locale === 'zh'
            ? `已闲置 ${idleMinutes} 分钟，计时已暂停`
            : `Idle for ${idleMinutes} min, timer paused`,
          body: '',
          color: '#e8a55a',
          duration: cfg.notificationDuration ?? 5,
        });
      }
    }, 5000);

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, onActivity);
      }
      clearInterval(intervalId);
    };
  }, [idleEnabled, idleMinutes, dispatch]);
}
