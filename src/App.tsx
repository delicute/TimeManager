import { useState, useEffect } from 'react';
import { useAppStore } from './hooks/useAppStore';
import { Sidebar } from './components/Sidebar';
import { StartPage } from './pages/StartPage';
import { RecordPage } from './pages/RecordPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReminderPage } from './pages/ReminderPage';
import { DebugPage } from './pages/DebugPage';
import { DEFAULT_HOTKEYS, type SessionType } from './types';
import { ToastProvider } from './hooks/useToast';
import { ToastContainer } from './components/Toast';

export function App() {
  const [currentPage, setCurrentPage] = useState('Start');
  const [startTab, setStartTab] = useState<SessionType>('Study');
  const { state, loadInitialData, startSession, stopSession } = useAppStore();
  const hotkeys = state.settings.hotkeys;
  const session = state.session;

  // Sync session state to main process for tray menu
  useEffect(() => {
    window.electronAPI.sessionUpdateState({ isActive: session.isActive, type: session.currentType });
  }, [session.isActive, session.currentType]);

  // Listen for tray actions
  useEffect(() => {
    window.electronAPI.onTrayAction((action) => {
      if (action.action === 'startSession' && action.type) {
        startSession(action.type as SessionType);
      } else if (action.action === 'stopSession') {
        stopSession();
      } else if (action.action === 'navigate' && action.page) {
        setCurrentPage(action.page);
      }
    });
  }, [startSession, stopSession]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ─── Global Hotkeys ─────────────────────────────────
  useEffect(() => {
    window.electronAPI.onGlobalShortcutTrigger((id) => {
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
      }
    });
  }, [startSession, stopSession]);

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
