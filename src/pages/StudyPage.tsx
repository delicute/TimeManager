import { TimerCard } from '../components/TimerCard';
import { useT } from '../hooks/useI18n';

export function StudyPage() {
  const t = useT();
  return (
    <>
      <h1 className="page-title">
        <span className="title-icon">📚</span> {t('navStudy')}
      </h1>
      <TimerCard
        type="Study"
        icon="📚"
        intervalSeconds={2}
        accentColor="var(--color-study)"
      />
    </>
  );
}
