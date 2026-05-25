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
  const { loadInitialData } = useAppStore();

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

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
