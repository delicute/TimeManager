import { useState, useEffect } from 'react';
import { Play, BookOpen, Palette, Gamepad2 } from 'lucide-react';
import { useT, timerKeyMap } from '../hooks/useI18n';
import { useAppStore } from '../hooks/useAppStore';
import { TimerCard } from '../components/TimerCard';
import type { SessionType } from '../types';

const TABS: { id: SessionType; icon: typeof BookOpen; color: string }[] = [
  { id: 'Study', icon: BookOpen, color: 'var(--color-study)' },
  { id: 'Hobby', icon: Palette, color: 'var(--color-hobby)' },
  { id: 'Entertainment', icon: Gamepad2, color: 'var(--color-entertainment)' },
];

interface StartPageProps {
  initialTab?: SessionType;
}

export function StartPage({ initialTab }: StartPageProps) {
  const { state } = useAppStore();
  const t = useT();
  const [tab, setTab] = useState<SessionType>(initialTab || 'Study');
  // Sync tab when initialTab changes (e.g. from keyboard shortcut)
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  const activeTab = TABS.find(x => x.id === tab) || TABS[0];
  const tabInterval = tab === 'Study' ? state.settings.studyWeight
    : tab === 'Hobby' ? state.settings.hobbyWeight : 1;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '6px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer', height: 32,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    border: active ? '1.5px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(93,184,166,0.15)' : 'transparent',
    color: active ? 'var(--color-accent-teal)' : '#faf9f5',
    fontFamily: 'inherit', fontWeight: active ? 600 : 400,
  });

  return (
    <>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        <span className="title-icon"><Play size={24} /></span> {t('navStart')}
      </h1>

      {/* Sub-navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {TABS.map(tabItem => {
          const Icon = tabItem.icon;
          const isActive = tab === tabItem.id;
          return (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)} style={tabStyle(isActive)}>
              <Icon size={15} /> {t(timerKeyMap[tabItem.id])}
            </button>
          );
        })}
      </div>

      <TimerCard
        key={tab}
        type={activeTab.id}
        icon={<activeTab.icon size={18} />}
        intervalSeconds={tabInterval}
        accentColor={activeTab.color}
        showConsumption={activeTab.id === 'Entertainment'}
        giftedRemaining={activeTab.id === 'Entertainment' ? state.balance.dailyGiftedRemaining : undefined}
        earnedRemaining={activeTab.id === 'Entertainment' ? state.balance.earnedBalance : undefined}
      />
    </>
  );
}
