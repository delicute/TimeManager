import { useState, useEffect } from 'react';
import { Keyboard } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT } from '../hooks/useI18n';
import { DEFAULT_HOTKEYS } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface HotkeyAction {
  id: string;
  labelKey: string;
}

const NAV_ACTIONS: HotkeyAction[] = [
  { id: 'navStudy', labelKey: 'navStudy' },
  { id: 'navHobby', labelKey: 'navHobby' },
  { id: 'navEntertainment', labelKey: 'navEntertainment' },
  { id: 'navRecord', labelKey: 'navRecord' },
  { id: 'navReminder', labelKey: 'navReminder' },
  { id: 'navSettings', labelKey: 'navSettings' },
];

const SESSION_ACTIONS: HotkeyAction[] = [
  { id: 'sessionStudy', labelKey: 'start' },
  { id: 'sessionHobby', labelKey: 'start' },
  { id: 'sessionEntertainment', labelKey: 'start' },
  { id: 'sessionStop', labelKey: 'stop' },
  { id: 'sessionPause', labelKey: 'timerPause' },
  { id: 'sessionPrint', labelKey: 'debugTitle' },
];

const RECORDING_ACTIONS: HotkeyAction[] = [
  { id: 'recordingConfirm', labelKey: 'recordingConfirm' },
  { id: 'recordingCancel', labelKey: 'recordingCancel' },
];

const LABEL_EN: Record<string, string> = {
  sessionStudy: 'Start Study',
  sessionHobby: 'Start Hobby',
  sessionEntertainment: 'Start Entertainment',
  sessionStop: 'Stop Timer',
  sessionPause: 'Pause / Resume',
  sessionPrint: 'Print Status',
  recordingConfirm: 'Confirm Key',
  recordingCancel: 'Cancel Key',
};

const LABEL_ZH: Record<string, string> = {
  sessionStudy: '开始学习',
  sessionHobby: '开始爱好',
  sessionEntertainment: '开始娱乐',
  sessionStop: '停止计时',
  sessionPause: '暂停 / 继续',
  sessionPrint: '打印状态',
  recordingConfirm: '确认键',
  recordingCancel: '取消键',
};

function parseCombo(combo: string): { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; key: string } | null {
  const parts = combo.split('+');
  let ctrl = false, shift = false, alt = false, meta = false;
  const keys: string[] = [];
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (lower === 'ctrl') ctrl = true;
    else if (lower === 'shift') shift = true;
    else if (lower === 'alt') alt = true;
    else if (lower === 'meta' || lower === 'win' || lower === 'cmd') meta = true;
    else keys.push(p);
  }
  if (keys.length !== 1) return null;
  return { ctrl, shift, alt, meta, key: keys[0] };
}

function combosEqual(a: string, b: string): boolean {
  const pa = parseCombo(a);
  const pb = parseCombo(b);
  if (!pa || !pb) return false;
  return pa.ctrl === pb.ctrl && pa.shift === pb.shift && pa.alt === pb.alt && pa.meta === pb.meta && pa.key.toLowerCase() === pb.key.toLowerCase();
}

function eventToCombo(e: KeyboardEvent): string | null {
  const key = e.key;
  if (key === 'Control' || key === 'Shift' || key === 'Meta' || key === 'Alt') return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  if (e.metaKey) parts.push('Win');
  let keyName = key;
  if (key === ' ') keyName = 'Space';
  else if (key.length === 1) keyName = key.toUpperCase();
  else if (key === 'Escape') return 'Escape';
  parts.push(keyName);
  return parts.join('+');
}

export function HotkeySettingsPage({ embedded }: { embedded?: boolean }) {
  const { state, dispatch } = useAppStore();
  const t = useT();
  const locale = state.settings.locale || 'zh';
  const currentHotkeys = { ...DEFAULT_HOTKEYS, ...state.settings.hotkeys };

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [pendingCombo, setPendingCombo] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Global hotkeys: only register Session Control shortcuts
  const SESSION_HOTKEY_IDS = ['sessionStudy', 'sessionHobby', 'sessionEntertainment', 'sessionStop', 'sessionPause', 'sessionPrint'];

  useEffect(() => {
    if (state.settings.globalHotkeys) {
      const sessionOnly: Record<string, string> = {};
      for (const id of SESSION_HOTKEY_IDS) {
        if (currentHotkeys[id]) sessionOnly[id] = currentHotkeys[id];
      }
      window.electronAPI.registerGlobalHotkeys(sessionOnly);
    } else {
      window.electronAPI.unregisterGlobalHotkeys();
    }
  }, [state.settings.globalHotkeys, state.settings.hotkeys]);

  const updateSetting = (partial: Partial<typeof state.settings>) => {
    const updated = { ...state.settings, ...partial };
    dispatch({ type: 'SET_SETTINGS', payload: updated });
    window.electronAPI.saveSettings(updated);
  };

  // Global keydown listener when recording (capture phase, before confirm)
  useEffect(() => {
    if (!recordingId) return;

    const confirmCombo = currentHotkeys.recordingConfirm || 'Enter';
    const cancelCombo = currentHotkeys.recordingCancel || 'Escape';

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const combo = eventToCombo(e);
      if (!combo) return;

      // Cancel: don't trigger if we're recording the cancel key itself
      if (recordingId !== 'recordingCancel' && (combo === cancelCombo || combosEqual(combo, cancelCombo))) {
        setRecordingId(null);
        setPendingCombo(null);
        setConflictId(null);
        return;
      }

      // Confirm: don't trigger if we're recording the confirm key itself
      if (recordingId !== 'recordingConfirm' && pendingCombo && (combo === confirmCombo || combosEqual(combo, confirmCombo))) {
        confirmPending();
        return;
      }

      // Check conflict
      const newHotkeys = { ...currentHotkeys, [recordingId]: combo };
      let conflictingAction: string | null = null;
      for (const [id, val] of Object.entries(newHotkeys)) {
        if (id !== recordingId && combosEqual(val, combo)) {
          conflictingAction = id;
          break;
        }
      }

      setConflictId(conflictingAction);
      setPendingCombo(combo);
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recordingId, currentHotkeys, pendingCombo]);

  const confirmPending = () => {
    if (!recordingId || !pendingCombo) return;
    const newHotkeys = { ...currentHotkeys, [recordingId]: pendingCombo };
    updateSetting({ hotkeys: newHotkeys });
    setPendingCombo(null);
    setRecordingId(null);
    setConflictId(null);
  };

  const cancelPending = () => {
    setPendingCombo(null);
    setConflictId(null);
  };

  function actionLabel(action: HotkeyAction): string {
    if (locale === 'zh' && LABEL_ZH[action.id]) return LABEL_ZH[action.id];
    if (LABEL_EN[action.id]) return LABEL_EN[action.id];
    return t(action.labelKey as any);
  }

  function renderHotkeyControl(action: HotkeyAction) {
    const isRecording = recordingId === action.id;
    const hasPending = isRecording && pendingCombo;

    if (hasPending) {
      return (
        <div className="hotkey-setting-controls">
          <kbd className="hotkey-pending">{pendingCombo}</kbd>
          <button
            className="btn btn-secondary"
            style={{ height: 28, fontSize: 11, padding: '2px 10px' }}
            onClick={confirmPending}
          >
            {t('hotkeyConfirm')}
          </button>
          <button
            className="btn btn-secondary"
            style={{ height: 28, fontSize: 11, padding: '2px 10px' }}
            onClick={cancelPending}
          >
            {t('hotkeyCancel')}
          </button>
        </div>
      );
    }

    if (isRecording) {
      return (
        <div className="hotkey-setting-controls">
          {conflictId === action.id && (
            <span className="hotkey-conflict-hint">
              {t('hotkeyConflict')}
            </span>
          )}
          <span className="hotkey-recording">
            {t('hotkeyPressHint')}
          </span>
        </div>
      );
    }

    return (
      <div className="hotkey-setting-controls">
        {conflictId === action.id && (
          <span className="hotkey-conflict-hint">
            {t('hotkeyConflict')}
          </span>
        )}
        <kbd className="hotkey-kbd" onClick={() => { setRecordingId(action.id); setConflictId(null); }}>
          {currentHotkeys[action.id]}
        </kbd>
      </div>
    );
  }

  return (
    <div>
      {!embedded && <h1 className="page-title">
        <span className="title-icon"><Keyboard size={24} /></span> {t('navHotkey')}
      </h1>}

      <div className="card">
        <div className="settings-section-title">{t('navNavigation')}</div>
        {NAV_ACTIONS.map(action => (
          <div key={action.id} className="hotkey-setting-row">
            <span className="hotkey-setting-label">{actionLabel(action)}</span>
            {renderHotkeyControl(action)}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="settings-section-title">{t('sessionControl')}</div>
        {SESSION_ACTIONS.map(action => (
          <div key={action.id} className="hotkey-setting-row">
            <span className="hotkey-setting-label">{actionLabel(action)}</span>
            {renderHotkeyControl(action)}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="settings-section-title">{t('recordingControls')}</div>
        {RECORDING_ACTIONS.map(action => (
          <div key={action.id} className="hotkey-setting-row">
            <span className="hotkey-setting-label">{actionLabel(action)}</span>
            {renderHotkeyControl(action)}
          </div>
        ))}
      </div>

      <div className="card" style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '12px 16px' }}>
        <button className="btn btn-secondary" onClick={() => setShowResetConfirm(true)} style={{ height: 32, fontSize: 12 }}>
          {t('hotkeyResetAll')}
        </button>
        {recordingId && (
          <button className="btn btn-secondary" onClick={() => { setRecordingId(null); setConflictId(null); }} style={{ height: 32, fontSize: 12 }}>
            {t('hotkeyCancel')}
          </button>
        )}
      </div>
      <ConfirmDialog
        open={showResetConfirm}
        title={t('hotkeyResetConfirmTitle')}
        message={t('hotkeyResetConfirmMsg')}
        confirmLabel={t('resetAll')} cancelLabel={t('cancelLabel')}
        onConfirm={() => {
          updateSetting({ hotkeys: undefined });
          setRecordingId(null);
          setConflictId(null);
          setShowResetConfirm(false);
        }}
        onCancel={() => setShowResetConfirm(false)}
        danger
      />

    </div>
  );
}
