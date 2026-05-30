import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useToast, type ToastItem } from '../hooks/useToast';

const ICONS: Record<string, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const COLORS: Record<string, string> = {
  success: 'var(--color-success, #5db872)',
  error: 'var(--color-error, #c64545)',
  info: 'var(--color-on-dark-soft, #a09d96)',
};

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const Icon = ICONS[item.type] || Info;

  return (
    <div
      onClick={onDismiss}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--color-surface-dark-elevated, #252320)',
        border: `1.5px solid ${COLORS[item.type] || COLORS.info}`,
        borderRadius: 8, padding: '10px 14px',
        minWidth: 240, maxWidth: 360,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-12px)',
        transition: 'opacity 220ms ease-out, transform 220ms ease-out',
        pointerEvents: 'auto',
      }}
    >
      <Icon size={16} style={{ color: COLORS[item.type], flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: '#faf9f5', lineHeight: 1.4 }}>{item.message}</span>
      <X size={14} style={{ color: 'var(--color-on-dark-soft)', flexShrink: 0, opacity: 0.6 }} />
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 9999, pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <ToastItemView key={t.id} item={t} onDismiss={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}
