import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useToast, type ToastItem } from '../hooks/useToast';

const ICONS: Record<string, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const ACCENT_COLORS: Record<string, string> = {
  success: '#34d399',
  error: '#fb7185',
  info: '#60a5fa',
};

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setEntered(true));
  }, []);

  const show = entered && !item.leaving;
  const color = ACCENT_COLORS[item.type] || ACCENT_COLORS.info;
  const Icon = ICONS[item.type] || Info;

  return (
    <div
      onClick={onDismiss}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#252320',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8, padding: '10px 12px',
        minWidth: 240, maxWidth: 360,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        opacity: show ? 1 : 0,
        transform: show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-6px)',
        transition: 'opacity 200ms ease, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 4, bottom: 4, width: 3,
        borderRadius: '0 2px 2px 0',
        background: color,
      }} />
      <Icon size={16} style={{ color, flexShrink: 0, marginLeft: 4 }} />
      <span style={{ flex: 1, fontSize: 13, color: '#faf9f5', lineHeight: 1.4 }}>{item.message}</span>
      <X size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.8)'}
        onMouseLeave={e => (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.4)'} />
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
