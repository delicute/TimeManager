import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: React.CSSProperties;
  width?: number | string;
  className?: string;
  placeholder?: string;
}

export function Select<T extends string>({
  options,
  value,
  onChange,
  style,
  width,
  className,
  placeholder,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [upward, setUpward] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-flip: measure space when opening
  useEffect(() => {
    if (!open || !ref.current) return;
    const btn = ref.current.firstChild as HTMLElement | null;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Need ~220px ideally, but use estimate based on option count
    const needed = Math.min(options.length * 32 + 8, 220);
    setUpward(spaceBelow < needed && spaceAbove >= needed);
  }, [open, options.length]);

  const handleSelect = useCallback((val: T) => {
    onChange(val);
    setOpen(false);
  }, [onChange]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width, ...style } as React.CSSProperties}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={className}
        style={{
          width: '100%',
          padding: '3px 22px 3px 8px',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.06)',
          color: '#faf9f5',
          fontSize: 12,
          height: 28,
          boxSizing: 'border-box',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          ...(style as React.CSSProperties),
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? selected.label : (placeholder || '')}
        </span>
        <ChevronDown
          size={12}
          style={{
            flexShrink: 0,
            transition: 'transform 0.15s',
            transform: open ? (upward ? 'rotate(0deg)' : 'rotate(180deg)') : 'rotate(0deg)',
            color: 'var(--color-on-dark-soft, #a09d96)',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            zIndex: 1000,
            maxHeight: 220,
            overflowY: 'auto',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            background: '#252320',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            ...(upward ? { bottom: '100%', marginBottom: 2 } : { top: '100%', marginTop: 2 }),
          }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 10px',
                border: 'none',
                background: opt.value === value ? 'rgba(93,184,166,0.15)' : 'transparent',
                color: opt.value === value ? 'var(--color-accent-teal, #5db8a6)' : '#faf9f5',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              onMouseEnter={e => {
                if (opt.value !== value) {
                  (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                }
              }}
              onMouseLeave={e => {
                if (opt.value !== value) {
                  (e.target as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
