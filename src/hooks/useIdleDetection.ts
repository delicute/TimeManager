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

  useEffect(() => {
    if (!idleEnabled) return;

    const id = setInterval(async () => {
      try {
        const s = sessionRef.current;
        if (!s.isActive || s.currentType === 'None') return;

        const idleSec = await window.electronAPI.getUserIdleTime();

        if (s.autoPaused && s.isPaused) {
          // Auto-paused — resume as soon as user interacts again
          if (idleSec < 3) {
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
          // Active and not paused — check idle threshold
          if (idleSec >= idleMinutes * 60) {
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
      } catch {
        // ignore (e.g. during dev or if IPC is unavailable)
      }
    }, 3000);

    return () => clearInterval(id);
  }, [idleEnabled, idleMinutes, dispatch]);
}
