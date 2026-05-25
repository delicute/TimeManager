import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useT } from '../hooks/useI18n';

const urgencyColors: Record<string, string> = {
  low: 'var(--color-on-dark-soft)',
  medium: 'var(--color-accent-teal)',
  high: 'var(--color-accent-amber)',
  critical: 'var(--color-error)',
};

export function ReminderModal() {
  const { state, dismissReminder, snoozeReminder } = useAppStore();
  const rule = state.showReminderModal;
  const t = useT();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [customMins, setCustomMins] = useState(15);

  // Reset snooze panel when rule changes
  useEffect(() => {
    setSnoozeOpen(false);
    setCustomMins(15);
  }, [rule]);

  // Play beep sound on show
  useEffect(() => {
    if (!rule) return;

    const playBeep = async () => {
      try {
        const dataUrl = await window.electronAPI.getBeepDataUrl();
        if (dataUrl) {
          const audio = new Audio(dataUrl);
          audioRef.current = audio;
          audio.play().catch(() => {});
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
    <div className={`reminder-toast urgency-${rule.urgency}`}>
      <div className="toast-bar" style={{ background: urgencyColors[rule.urgency] }} />
      <div className="toast-body">
        <div className="toast-urgency">
          {t(`reminderUrgency${rule.urgency.charAt(0).toUpperCase()}${rule.urgency.slice(1)}` as any)}
        </div>
        <div className="toast-title">{rule.title}</div>
        {rule.content && <div className="toast-content">{rule.content}</div>}
        <div className="toast-actions">
          <button
            className="btn btn-primary btn-toast"
            onClick={dismissReminder}
            autoFocus
          >
            {t('reminderDismiss')}
          </button>
          <button
            className="btn btn-secondary btn-toast"
            onClick={() => setSnoozeOpen(!snoozeOpen)}
          >
            {t('reminderSnooze')}
          </button>
        </div>
        {snoozeOpen && (
          <div className="toast-snooze-panel">
            <button className="btn btn-secondary btn-toast" onClick={() => snoozeReminder(5)}>
              {t('reminder5min')}
            </button>
            <button className="btn btn-secondary btn-toast" onClick={() => snoozeReminder(10)}>
              {t('reminder10min')}
            </button>
            <div className="toast-snooze-custom">
              <span className="toast-custom-label">{t('reminderCustom')}</span>
              <input
                type="number"
                className="toast-snooze-input"
                min={1}
                value={customMins}
                onChange={e => setCustomMins(Math.max(1, Number(e.target.value)))}
                onKeyDown={e => { if (e.key === 'Enter') snoozeReminder(customMins); }}
              />
              <span className="toast-snooze-unit">{t('reminderSnoozeMinutes')}</span>
              <button className="btn btn-primary btn-toast" onClick={() => snoozeReminder(customMins)}>
                {t('reminderDismiss')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
