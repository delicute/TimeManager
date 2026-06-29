import { useEffect, useRef } from 'react';
import { useAppStore } from './useAppStore';

export function useIdleDetection() {
  const { state, dispatch } = useAppStore();
  const idleEnabled = state.settings.idlePauseEnabled;
  const idleMinutes = state.settings.idlePauseMinutes;

  const sessionRef = useRef(state.session);
  const settingsRef = useRef(state.settings);
  sessionRef.current = state.session;
  settingsRef.current = state.settings;

  // Track auto-pause locally — synchronous, no React state round-trip
  const idleAutoPausedRef = useRef(false);

  useEffect(() => {
    if (!idleEnabled) {
      idleAutoPausedRef.current = false;
      return;
    }

    let stopped = false;

    const check = async () => {
      if (stopped) return;
      const s = sessionRef.current;
      const threshold = idleMinutes * 60;

      if (s.isActive && s.currentType !== 'None') {
        try {
          const idleSec = await window.electronAPI.getUserIdleTime();

          if (idleAutoPausedRef.current) {
            // Auto-paused — resume when user interacts
            if (idleSec < 3) {
              idleAutoPausedRef.current = false;
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
          } else if (!s.isPaused) {
            // Active — check idle threshold
            if (idleSec >= threshold) {
              idleAutoPausedRef.current = true;
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
          }
          // s.isPaused && !idleAutoPausedRef.current = manual pause → do nothing
        } catch {
          // ignore
        }
      } else {
        // Session not active — reset flag
        idleAutoPausedRef.current = false;
      }

      if (!stopped) setTimeout(check, 1000); // pontail: always reschedule, even on inactive
    };

    const timeoutId = setTimeout(check, 1000);
    return () => {
      stopped = true;
      clearTimeout(timeoutId);
    };
  }, [idleEnabled, idleMinutes, dispatch]);
}
