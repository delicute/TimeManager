import { useEffect, useRef } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useT } from '../hooks/useI18n';

const urgencyColors: Record<string, string> = {
  low: 'var(--color-on-dark-soft)',
  medium: 'var(--color-accent-amber)',
  high: 'var(--color-accent-orange)',
  critical: 'var(--color-error)',
};

export function ReminderModal() {
  const { state, dismissReminder, snoozeReminder } = useAppStore();
  const rule = state.showReminderModal;
  const t = useT();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!rule) return;

    // Play beep sound on first show
    const playBeep = async () => {
      try {
        const dataUrl = await window.electronAPI.getBeepDataUrl();
        if (dataUrl) {
          const audio = new Audio(dataUrl);
          audioRef.current = audio;
          audio.play().catch(() => { /* ignore autoplay restriction */ });
        }
      } catch { /* ignore */ }
    };
    playBeep();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [rule]);

  if (!rule) return null;

  return (
    <div className="reminder-overlay" onClick={dismissReminder}>
      <div
        className="reminder-dialog"
        onClick={e => e.stopPropagation()}
      >
        {/* Urgency color bar */}
        <div
          className="reminder-bar"
          style={{ background: urgencyColors[rule.urgency] || 'var(--color-accent-amber)' }}
        />

        <div className="reminder-body">
          <div className="reminder-urgency-label">
            {t(`reminderUrgency${rule.urgency.charAt(0).toUpperCase()}${rule.urgency.slice(1)}` as any)}
          </div>
          <h2 className="reminder-title">{rule.title}</h2>
          {rule.content && (
            <p className="reminder-content">{rule.content}</p>
          )}

          <div className="reminder-actions">
            <button
              className="btn btn-primary"
              onClick={dismissReminder}
              autoFocus
            >
              {t('reminderDismiss')}
            </button>
            <button
              className="btn btn-secondary"
              onClick={snoozeReminder}
            >
              {t('reminderSnooze')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
