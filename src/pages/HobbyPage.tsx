import { TimerCard } from '../components/TimerCard';
import { useT } from '../hooks/useI18n';

export function HobbyPage() {
  const t = useT();
  return (
    <>
      <h1 className="page-title">
        <span className="title-icon">🎨</span> {t('navHobby')}
      </h1>
      <TimerCard
        type="Hobby"
        icon="🎨"
        intervalSeconds={4}
        accentColor="var(--color-hobby)"
      />
    </>
  );
}
