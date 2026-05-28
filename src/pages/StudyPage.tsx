import { BookOpen } from 'lucide-react';
import { TimerCard } from '../components/TimerCard';
import { useT } from '../hooks/useI18n';

export function StudyPage() {
  const t = useT();
  return (
    <>
      <h1 className="page-title">
        <span className="title-icon"><BookOpen size={24} /></span> {t('navStudy')}
      </h1>
      <TimerCard
        type="Study"
        icon={<BookOpen size={18} />}
        intervalSeconds={2}
        accentColor="var(--color-study)"
      />
    </>
  );
}
