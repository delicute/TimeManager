import { useState, useEffect } from 'react';
import { useAppStore } from './hooks/useAppStore';
import { Sidebar } from './components/Sidebar';
import { StudyPage } from './pages/StudyPage';
import { HobbyPage } from './pages/HobbyPage';
import { EntertainmentPage } from './pages/EntertainmentPage';
import { RecordPage } from './pages/RecordPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReminderPage } from './pages/ReminderPage';
import { HotkeySettingsPage } from './pages/HotkeySettingsPage';
import { DEFAULT_HOTKEYS, type SessionType } from './types';

export function App() {
  const [currentPage, setCurrentPage] = useState('Study');
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
        case 'navStudy': setCurrentPage('Study'); return;
        case 'navHobby': setCurrentPage('Hobby'); return;
        case 'navEntertainment': setCurrentPage('Entertainment'); return;
        case 'navRecord': setCurrentPage('Record'); return;
        case 'navReminder': setCurrentPage('Reminder'); return;
        case 'navSettings': setCurrentPage('Settings'); return;
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
      case 'Study': return <StudyPage />;
      case 'Hobby': return <HobbyPage />;
      case 'Entertainment': return <EntertainmentPage />;
      case 'Record': return <RecordPage />;
      case 'Reminder': return <ReminderPage />;
      case 'Hotkey': return <HotkeySettingsPage />;
      case 'Settings': return <SettingsPage />;
      default: return <StudyPage />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="content-area">
        <div className="content-inner">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
