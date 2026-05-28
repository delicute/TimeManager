import { Gamepad2 } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { TimerCard } from '../components/TimerCard';
import { useT } from '../hooks/useI18n';

export function EntertainmentPage() {
  const { state } = useAppStore();
  const t = useT();

  return (
    <>
      <h1 className="page-title">
        <span className="title-icon"><Gamepad2 size={24} /></span> {t('navEntertainment')}
      </h1>
      <TimerCard
        type="Entertainment"
        icon={<Gamepad2 size={18} />}
        intervalSeconds={1}
        accentColor="var(--color-entertainment)"
        showConsumption
        giftedRemaining={state.balance.dailyGiftedRemaining}
        earnedRemaining={state.balance.earnedBalance}
      />
    </>
  );
}
