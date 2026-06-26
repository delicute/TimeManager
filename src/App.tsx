import { useState, useEffect, useRef } from 'react';
import { useAppStore } from './hooks/useAppStore';
import { Sidebar } from './components/Sidebar';
import { StartPage } from './pages/StartPage';
import { RecordPage } from './pages/RecordPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReminderPage } from './pages/ReminderPage';
import { DebugPage } from './pages/DebugPage';
import { DEFAULT_HOTKEYS, type SessionType } from './types';
import { formatDurationFull, formatDuration } from './utils/formatting';
import { ToastProvider } from './hooks/useToast';
import { ToastContainer } from './components/Toast';

export function App() {
  const [currentPage, setCurrentPage] = useState('Start');
  const [startTab, setStartTab] = useState<SessionType>('Study');
  const { state, loadInitialData, startSession, stopSession, dispatch } = useAppStore();
  const hotkeys = state.settings.hotkeys;
  const session = state.session;
  const balance = state.balance;
  const sessionRef = useRef(session);
  const balanceRef = useRef(balance);
  sessionRef.current = session;
  balanceRef.current = balance;
  const settingsRef = useRef(state.settings);
  settingsRef.current = state.settings;

  // Session action IDs that are also registered as global shortcuts
  const SESSION_ACTIONS = new Set(['sessionStudy', 'sessionHobby', 'sessionEntertainment', 'sessionStop', 'sessionPause', 'sessionPrint']);

  // Sync session/balance/settings to main process for tray + background balance tracking
  useEffect(() => {
    window.electronAPI.sessionUpdateState({
      isActive: session.isActive,
      type: session.currentType,
      startTime: session.startTime,
      isPaused: session.isPaused,
      pausedAt: session.pausedAt,
      _balance: balance,
      _settings: state.settings,
    });
    // 注意：balance 不在依赖数组中——主进程只需要会话开始时的余额快照，
    // 平衡自身的推算由主进程独立完成，无需 renderer 每秒上报余额。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isActive, session.currentType, session.startTime, session.isPaused, session.pausedAt, state.settings]);

  // Listen for tray actions
  useEffect(() => {
    const cleanup = window.electronAPI.onTrayAction((action) => {
      if (action.action === 'startSession' && action.type) {
        startSession(action.type as SessionType);
      } else if (action.action === 'stopSession') {
        stopSession();
      } else if (action.action === 'navigate' && action.page) {
        setCurrentPage(action.page);
      }
    });
    return () => cleanup();
  }, [startSession, stopSession]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ─── Global Hotkey Registration ──────────────────────
  // Must be at App level (always mounted), NOT in HotkeySettingsPage
  useEffect(() => {
    if (state.settings.globalHotkeys) {
      const currentHotkeys = { ...DEFAULT_HOTKEYS, ...state.settings.hotkeys };
      const sessionOnly: Record<string, string> = {};
      for (const id of ['sessionStudy', 'sessionHobby', 'sessionEntertainment', 'sessionStop', 'sessionPause', 'sessionPrint']) {
        if (currentHotkeys[id]) sessionOnly[id] = currentHotkeys[id];
      }
      window.electronAPI.registerGlobalHotkeys(sessionOnly);
    } else {
      window.electronAPI.unregisterGlobalHotkeys();
    }
  }, [state.settings.globalHotkeys, state.settings.hotkeys]);

  // ─── Global Hotkeys Listener (IPC from main process) ─
  useEffect(() => {
    const cleanup = window.electronAPI.onGlobalShortcutTrigger((id) => {
      switch (id) {
        case 'navStudy': setCurrentPage('Start'); setStartTab('Study'); return;
        case 'navHobby': setCurrentPage('Start'); setStartTab('Hobby'); return;
        case 'navEntertainment': setCurrentPage('Start'); setStartTab('Entertainment'); return;
        case 'navRecord': setCurrentPage('Record'); return;
        case 'navReminder': setCurrentPage('Reminder'); return;
        case 'navSettings': setCurrentPage('Settings'); return;
        case 'navDebug': setCurrentPage('Debug'); return;
        case 'sessionStudy': startSession('Study'); return;
        case 'sessionHobby': startSession('Hobby'); return;
        case 'sessionEntertainment': startSession('Entertainment'); return;
        case 'sessionStop': stopSession(); return;
        case 'sessionPause': {
          const s = sessionRef.current;
          if (!s.isActive) return;
          const typeLabel = s.currentType === 'Study' ? '学习' : s.currentType === 'Hobby' ? '爱好' : '娱乐';
          if (s.isPaused) {
            dispatch({ type: 'SESSION_RESUME' });
            window.electronAPI.notificationShow({
              type: s.currentType, notifType: 'info', title: `[${typeLabel}] 状态已恢复`, body: '',
              color: '#5db872', duration: 3,
            });
          } else {
            dispatch({ type: 'SESSION_PAUSE' });
            window.electronAPI.notificationShow({
              type: s.currentType, notifType: 'info', title: `[${typeLabel}] 状态已暂停`, body: '',
              color: '#e8a55a', duration: 3,
            });
          }
          return;
        }
        case 'sessionPrint': {
          const s = sessionRef.current;
          const b = balanceRef.current;
          const elapsed = s.isActive && s.startTime ? Math.floor((Date.now() - s.startTime) / 1000) : 0;
          const debtInfo = b.earnedBalance < 0 ? ` 负债中(×2)` : '';
          const elapsedStr = s.isActive ? formatDurationFull(elapsed) : '--';
          const pausedLabel = s.isPaused ? ' [已暂停]' : '';
          const status = s.isActive
            ? `[${s.currentType}] ${elapsedStr}${pausedLabel}${debtInfo}`
            : '无活动会话';
          const giftInfo = formatDuration(b.dailyGiftedRemaining);
          const earnedInfo = b.earnedBalance < 0 ? `-${formatDuration(Math.abs(b.earnedBalance))}` : formatDuration(b.earnedBalance);
          const debtLabel = b.earnedBalance < 0 ? ` 负债` : '';
          const body = `${status}\n赠送: ${giftInfo} | 赚取: ${earnedInfo}${debtLabel}`;
          window.electronAPI.notificationShow({
            type: 'debug', notifType: 'info', title: '当前状态', body,
            color: '#a09d96', duration: 8,
          });
          return;
        }
      }
    });
    return () => cleanup();
  }, [startSession, stopSession, dispatch]);

  // ─── Hotkeys ──────────────────────────────────────────
  useEffect(() => {
    const currentHotkeys = { ...DEFAULT_HOTKEYS, ...hotkeys };

    // Build reverse map: normalized key -> action id
    const keyMap = new Map<string, string>();
    for (const [actionId, combo] of Object.entries(currentHotkeys)) {
      const parts = combo.split('+').map(p => p.toLowerCase());
      const normParts: string[] = [];
      if (parts.includes('ctrl')) normParts.push('ctrl');
      if (parts.includes('shift')) normParts.push('shift');
      if (parts.includes('alt')) normParts.push('alt');
      if (parts.includes('win') || parts.includes('meta')) normParts.push('meta');
      const keyPart = parts.find(p => p !== 'ctrl' && p !== 'shift' && p !== 'alt' && p !== 'win' && p !== 'meta');
      if (keyPart) normParts.push(keyPart);
      keyMap.set(normParts.join('+'), actionId);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const normParts: string[] = [];
      if (e.ctrlKey) normParts.push('ctrl');
      if (e.shiftKey) normParts.push('shift');
      if (e.altKey) normParts.push('alt');
      if (e.metaKey) normParts.push('meta');
      normParts.push(e.key.toLowerCase());
      const lookupKey = normParts.join('+');
      const action = keyMap.get(lookupKey);
      if (!action) return;

      // When global hotkeys are enabled, session control is handled by
      // OS-level shortcuts (globalShortcut.register). Skip keydown to
      // avoid double-firing.
      if (SESSION_ACTIONS.has(action) && settingsRef.current.globalHotkeys) return;

      e.preventDefault();
      switch (action) {
        case 'navStudy': setCurrentPage('Start'); setStartTab('Study'); return;
        case 'navHobby': setCurrentPage('Start'); setStartTab('Hobby'); return;
        case 'navEntertainment': setCurrentPage('Start'); setStartTab('Entertainment'); return;
        case 'navRecord': setCurrentPage('Record'); return;
        case 'navReminder': setCurrentPage('Reminder'); return;
        case 'navSettings': setCurrentPage('Settings'); return;
        case 'navDebug': setCurrentPage('Debug'); return;
        case 'sessionStudy': startSession('Study'); return;
        case 'sessionHobby': startSession('Hobby'); return;
        case 'sessionEntertainment': startSession('Entertainment'); return;
        case 'sessionStop': stopSession(); return;
        case 'sessionPause': {
          const s = sessionRef.current;
          if (!s.isActive) return;
          const typeLabel = s.currentType === 'Study' ? '学习' : s.currentType === 'Hobby' ? '爱好' : '娱乐';
          if (s.isPaused) {
            dispatch({ type: 'SESSION_RESUME' });
            window.electronAPI.notificationShow({
              type: s.currentType, notifType: 'info', title: `[${typeLabel}] 状态已恢复`, body: '',
              color: '#5db872', duration: 3,
            });
          } else {
            dispatch({ type: 'SESSION_PAUSE' });
            window.electronAPI.notificationShow({
              type: s.currentType, notifType: 'info', title: `[${typeLabel}] 状态已暂停`, body: '',
              color: '#e8a55a', duration: 3,
            });
          }
          return;
        }
        case 'sessionPrint': {
          const s = sessionRef.current;
          const b = balanceRef.current;
          const elapsed = s.isActive && s.startTime ? Math.floor((Date.now() - s.startTime) / 1000) : 0;
          const elapsedStr = s.isActive ? formatDurationFull(elapsed) : '--';
          const debtInfo = b.earnedBalance < 0 ? ` 负债中(×2)` : '';
          const pausedLabel = s.isPaused ? ' [已暂停]' : '';
          const status = s.isActive
            ? `[${s.currentType}] ${elapsedStr}${pausedLabel}${debtInfo}`
            : '无活动会话';
          const giftInfo = formatDuration(b.dailyGiftedRemaining);
          const earnedInfo = b.earnedBalance < 0 ? `-${formatDuration(Math.abs(b.earnedBalance))}` : formatDuration(b.earnedBalance);
          const debtLabel = b.earnedBalance < 0 ? ` 负债` : '';
          const body = `${status}\n赠送: ${giftInfo} | 赚取: ${earnedInfo}${debtLabel}`;
          window.electronAPI.notificationShow({
            type: 'debug', notifType: 'info', title: '当前状态', body,
            color: '#a09d96', duration: 8,
          });
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys, startSession, stopSession]);

  const renderPage = () => {
    switch (currentPage) {
      case 'Start':
      case 'Study':
      case 'Hobby':
      case 'Entertainment':
        return <StartPage initialTab={currentPage === 'Start' ? startTab : currentPage as SessionType} />;
      case 'Record': return <RecordPage />;
      case 'Reminder': return <ReminderPage />;
      case 'Hotkey': return <SettingsPage initialTab="hotkey" />;
      case 'Settings': return <SettingsPage />;
      case 'Debug': return <DebugPage />;
      default: return <StartPage initialTab="Study" />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="content-area">
        <ToastProvider>
          <div className="content-inner" key={currentPage}>
            {renderPage()}
          </div>
          <ToastContainer />
        </ToastProvider>
      </main>
    </div>
  );
}
