import { useState, useEffect } from 'react';
import { useAppStore } from './hooks/useAppStore';
import { Sidebar } from './components/Sidebar';
import { StudyPage } from './pages/StudyPage';
import { HobbyPage } from './pages/HobbyPage';
import { EntertainmentPage } from './pages/EntertainmentPage';
import { RecordPage } from './pages/RecordPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReminderPage } from './pages/ReminderPage';

export function App() {
  const [currentPage, setCurrentPage] = useState('Study');
  const { loadInitialData, startSession, stopSession } = useAppStore();

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ─── Hotkeys ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey) {
        switch (e.key) {
          case '1': setCurrentPage('Study'); e.preventDefault(); return;
          case '2': setCurrentPage('Hobby'); e.preventDefault(); return;
          case '3': setCurrentPage('Entertainment'); e.preventDefault(); return;
          case '4': setCurrentPage('Record'); e.preventDefault(); return;
          case '5': setCurrentPage('Reminder'); e.preventDefault(); return;
          case '6': setCurrentPage('Settings'); e.preventDefault(); return;
        }
      }
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key.toUpperCase()) {
          case 'S': startSession('Study'); e.preventDefault(); return;
          case 'H': startSession('Hobby'); e.preventDefault(); return;
          case 'E': startSession('Entertainment'); e.preventDefault(); return;
          case 'X': stopSession(); e.preventDefault(); return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [startSession, stopSession]);

  const renderPage = () => {
    switch (currentPage) {
      case 'Study': return <StudyPage />;
      case 'Hobby': return <HobbyPage />;
      case 'Entertainment': return <EntertainmentPage />;
      case 'Record': return <RecordPage />;
      case 'Reminder': return <ReminderPage />;
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
