import { useState, useEffect, useRef } from 'react';
import { List, BookOpen, Palette, Gamepad2, Calendar, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT, navKeyMap } from '../hooks/useI18n';
import { formatDuration } from '../utils/formatting';

const ACTIVITY_ICONS: Record<string, typeof BookOpen> = { Study: BookOpen, Hobby: Palette, Entertainment: Gamepad2 };
const ACTIVITY_TYPES = ['Study', 'Hobby', 'Entertainment'] as const;
const TYPE_COLORS: Record<string, string> = { Study: '#5db872', Hobby: '#5db8a6', Entertainment: '#e8a55a' };

type RangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function now() { return new Date(); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate()-n); return d; }
function weekStart() { const d = new Date(); d.setDate(d.getDate()-d.getDay()); return d; }
function monthStart() { return new Date(now().getFullYear(), now().getMonth(), 1); }

interface SegData { label: string; value: number; color: string; }

function PieSVG({ data, size = 140, hovered, onHover }: {
  data: SegData[]; size?: number; hovered: string | null; onHover: (label: string | null) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{width:size,height:size,borderRadius:'50%',background:'rgba(255,255,255,0.04)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--color-on-dark-soft)'}}>—</div>;
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${size/2},${size/2}) rotate(-90)`}>
        {data.map((d, i) => {
          const pct = d.value / total;
          const dash = pct * circ;
          const seg = (
            <circle key={i} r={r} fill="none" stroke={hovered === d.label ? d.color : `${d.color}cc`}
              strokeWidth={hovered === d.label ? 8 : 6}
              strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset}
              style={{transition:'stroke-width .12s,stroke .12s',cursor:'pointer'}}
              onMouseEnter={() => onHover(d.label)} onMouseLeave={() => onHover(null)} />
          );
          offset += dash;
          return seg;
        })}
        {/* Invisible larger circles for hover hit area */}
        {(() => { let hOff = 0; return data.map((d, i) => {
          const pct = d.value / total;
          const dash = pct * circ;
          const seg = (
            <circle key={`h-${i}`} r={r} fill="none" stroke="transparent" strokeWidth={14}
              strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-hOff}
              style={{cursor:'pointer'}}
              onMouseEnter={() => onHover(d.label)} onMouseLeave={() => onHover(null)} />
          );
          hOff += dash;
          return seg;
        })})()}
      </g>
      {/* Center text */}
      <text x={size/2} y={size/2+4} textAnchor="middle" fill="#faf9f5" fontSize={13} fontWeight={600}>
        {formatDuration(total)}
      </text>
    </svg>
  );
}

function CalendarPopup({ calYear, calMonth, setCalYear, setCalMonth, onSelectDate, onClose }: {
  calYear: number; calMonth: number;
  setCalYear: (y: number) => void; setCalMonth: (m: number) => void;
  onSelectDate: (year: number, month: number, day: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
  const todayDateStr = fmt(now());
  const weekDayLabels = ['日','一','二','三','四','五','六'];
  const cells: (number | null)[] = Array(firstDayIndex).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div ref={ref} className="calendar-popup">
      <div className="cal-header">
        <button className="cal-nav cal-nav-year" onClick={() => setCalYear(calYear - 1)}>&laquo;</button>
        <button className="cal-nav" onClick={() => { if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); } else setCalMonth(calMonth - 1); }}>&lsaquo;</button>
        <span className="cal-title">{calYear}年{calMonth + 1}月</span>
        <button className="cal-nav" onClick={() => { if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); } else setCalMonth(calMonth + 1); }}>&rsaquo;</button>
        <button className="cal-nav cal-nav-year" onClick={() => setCalYear(calYear + 1)}>&raquo;</button>
      </div>
      <div className="cal-weekdays">{weekDayLabels.map(d => <span key={d} className="cal-wd">{d}</span>)}</div>
      <div className="cal-grid">{cells.map((day, i) => {
        if (day === null) return <div key={i} className="cal-day empty" />;
        const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return <button key={i} className={`cal-day${ds === todayDateStr ? ' today' : ''}`} onClick={() => onSelectDate(calYear, calMonth, day)}>{day}</button>;
      })}</div>
    </div>
  );
}

export function RecordPage() {
  const { state } = useAppStore();
  const { session } = state;
  const t = useT();
  const [preset, setPreset] = useState<RangePreset>('today');
  const [customFrom, setCustomFrom] = useState(() => fmt(now()));
  const [customTo, setCustomTo] = useState(() => fmt(now()));
  const [logs, setLogs] = useState<any[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calYear, setCalYear] = useState(now().getFullYear());
  const [calMonth, setCalMonth] = useState(now().getMonth());
  const [hoverSeg, setHoverSeg] = useState<string | null>(null);

  // Custom date calendar target ('from' | 'to')
  const [calTarget, setCalTarget] = useState<'from' | 'to'>('from');
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const todayDateStr = fmt(now());

  // Load logs
  useEffect(() => {
    async function load() {
      if (preset === 'today') { setLogs(state.todayLogs); return; }
      let from: Date, to: Date;
      switch (preset) {
        case 'yesterday': from = daysAgo(1); to = daysAgo(1); break;
        case 'week': from = weekStart(); to = now(); break;
        case 'month': from = monthStart(); to = now(); break;
        case 'all': from = daysAgo(365); to = now(); break;
        case 'custom': from = new Date(customFrom); to = new Date(customTo + 'T23:59:59'); break;
        default: setLogs([]); return;
      }
      const all: any[] = [];
      const dateStrs: string[] = [];
      let d = new Date(from);
      while (d <= to) {
        dateStrs.push(fmt(d));
        d.setDate(d.getDate() + 1);
      }
      // Load all dates in parallel
      const results = await Promise.all(dateStrs.map(async ds => {
        if (ds === todayDateStr) return state.todayLogs;
        try { return await window.electronAPI.getLogsForDate(ds) || []; } catch { return []; }
      }));
      for (const r of results) all.push(...r);
      setLogs(all);
    }
    load();
  }, [preset, customFrom, customTo, state.todayLogs]);

  const filteredLogs = preset === 'custom'
    ? logs.filter(l => {
        const t = new Date(l.startTime).getTime();
        return t >= new Date(customFrom).getTime() && t <= new Date(customTo + 'T23:59:59').getTime();
      })
    : logs;

  // Totals
  const totals: Record<string, number> = { Study: 0, Hobby: 0, Entertainment: 0 };
  let totalBalEarned = 0, totalBalConsumed = 0;
  for (const log of filteredLogs) {
    if (!log.debug) {
      const sec = Math.floor((new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000);
      totals[log.activityType] = (totals[log.activityType] || 0) + sec;
      if (log.balanceChange > 0) totalBalEarned += log.balanceChange;
      else if (log.balanceChange < 0) totalBalConsumed += Math.abs(log.balanceChange);
    }
  }
  if (preset === 'today' && session.isActive && session.currentType !== 'None' && session.startTime) {
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    totals[session.currentType] = (totals[session.currentType] || 0) + elapsed;
  }
  const totalTime = Object.values(totals).reduce((a, b) => a + b, 0);

  // Pie data (no sub-pie)
  const pieData = ACTIVITY_TYPES.map(t => ({ label: t, value: totals[t], color: TYPE_COLORS[t] })).filter(d => d.value > 0);
  pieData.sort((a, b) => b.value - a.value);

  // Hover detail
  const hoverItem = hoverSeg ? pieData.find(d => d.label === hoverSeg) : null;
  const hoverPct = hoverItem ? Math.round(hoverItem.value / totalTime * 100) : 0;

  // Timeline
  const isSingleDay = preset === 'today' || preset === 'yesterday' || (preset === 'custom' && customFrom === customTo);
  const minSec = state.settings.minSessionLogEnabled ? (state.settings.minSessionLogSec ?? 10) : 0;
  const timeline = filteredLogs.filter(l => { if (!minSec || l.debug) return true; const d = Math.floor((new Date(l.endTime).getTime() - new Date(l.startTime).getTime()) / 1000); return d >= minSec; }).slice().sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map(log => {
    const TypeIcon = ACTIVITY_ICONS[log.activityType] || BookOpen;
    return {
      icon: <TypeIcon size={16} />,
      name: t(navKeyMap[log.activityType] || log.activityType) + (log.debug ? ' (Debug)' : ''),
      timeRange: isSingleDay
        ? `${fmtTime(log.startTime)} - ${fmtTime(log.endTime)}`
        : `${fmtShortDate(log.startTime)} ${fmtTime(log.startTime)} - ${fmtTime(log.endTime)}`,
      duration: formatDuration(Math.floor((new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000)),
      balanceText: log.balanceChange !== 0 ? `${log.balanceChange > 0 ? '+' : ''}${log.balanceChange}` : '',
      isNegative: log.balanceChange < 0,
    };
  });
  if (preset === 'today' && session.isActive && session.currentType !== 'None' && session.startTime) {
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    const ActiveIcon = ACTIVITY_ICONS[session.currentType] || BookOpen;
    timeline.unshift({ icon: <ActiveIcon size={16} />, name: `${t(navKeyMap[session.currentType])} (${t('recordInProgress')})`, timeRange: `${fmtTime(session.startTime)} - ${t('recordNow')}`, duration: formatDuration(elapsed), balanceText: '', isNegative: false });
  }

  const presetBtns: { id: RangePreset; label: string }[] = [
    { id: 'today', label: '今天' }, { id: 'yesterday', label: '昨天' },
    { id: 'week', label: '本周' }, { id: 'month', label: '本月' },
    { id: 'all', label: '总时长' },
  ];

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', height: 26,
    border: active ? '1.5px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(93,184,166,0.15)' : 'transparent',
    color: active ? 'var(--color-accent-teal)' : '#faf9f5', fontFamily: 'inherit',
  });

  const TYPE_LABELS: Record<string, string> = { Study: '学习', Hobby: '爱好', Entertainment: '娱乐' };

  return (
    <>
      <div className="page-title-row">
        <h1 className="page-title"><span className="title-icon"><List size={24} /></span> {t('recordTitle')}</h1>
        <div style={{ position: 'relative' }}>
          <button className="btn-date-picker" onClick={() => { setShowCalendar(v => !v); setShowPicker(false); }} title={todayDateStr}><Calendar size={18} /></button>
          {showCalendar && (
            <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, marginTop: 4 }}>
              <CalendarPopup calYear={calYear} calMonth={calMonth}
                setCalYear={setCalYear} setCalMonth={setCalMonth}
                onSelectDate={(y, m, d) => { const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; setCustomFrom(ds); setCustomTo(ds); setPreset('custom'); setShowCalendar(false); }}
                onClose={() => setShowCalendar(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Date presets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {presetBtns.map(p => (
          <button key={p.id} onClick={() => setPreset(p.id)} style={btnStyle(preset === p.id)}>{p.label}</button>
        ))}
        {/* 自定义 preset button */}
        <button onClick={() => setPreset(preset === 'custom' ? 'today' : 'custom')} style={btnStyle(preset === 'custom')}>
          自定义
        </button>
        {/* Custom date range (expanded when 'custom' is selected) */}
        {preset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, marginLeft: 2 }}>
            <span style={{ color: 'var(--color-on-dark-soft)' }}>从</span>
            <span style={{ position: 'relative' }} ref={pickerRef}>
              <button onClick={() => { setCalTarget('from'); setShowPicker(v => !v); }}
                style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#faf9f5', fontSize: 11, height: 26, cursor: 'pointer', fontFamily: 'inherit' }}>
                {customFrom}
              </button>
              {showPicker && calTarget === 'from' && (
                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4 }}>
                  <CalendarPopup calYear={calYear} calMonth={calMonth}
                    setCalYear={setCalYear} setCalMonth={setCalMonth}
                    onSelectDate={(y, m, d) => {
                      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      setCustomFrom(ds); setShowPicker(false);
                    }}
                    onClose={() => setShowPicker(false)} />
                </div>
              )}
            </span>
            <span style={{ color: 'var(--color-on-dark-soft)' }}>~</span>
            <span style={{ position: 'relative' }}>
              <button onClick={() => { setCalTarget('to'); setShowPicker(v => !v); }}
                style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#faf9f5', fontSize: 11, height: 26, cursor: 'pointer', fontFamily: 'inherit' }}>
                {customTo}
              </button>
              {showPicker && calTarget === 'to' && (
                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4 }}>
                  <CalendarPopup calYear={calYear} calMonth={calMonth}
                    setCalYear={setCalYear} setCalMonth={setCalMonth}
                    onSelectDate={(y, m, d) => {
                      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      setCustomTo(ds); setShowPicker(false);
                    }}
                    onClose={() => setShowPicker(false)} />
                </div>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['Study', 'Hobby', 'Entertainment'] as const).map(type => {
          const Icon = ACTIVITY_ICONS[type];
          return (
            <div key={type} className="card" style={{ flex: 1, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon size={16} style={{ color: TYPE_COLORS[type], flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--color-on-dark-soft)', lineHeight: 1.2 }}>{t(navKeyMap[type])}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: TYPE_COLORS[type], lineHeight: 1.3 }}>{formatDuration(totals[type] || 0)}</div>
              </div>
            </div>
          );
        })}
        <div className="card" style={{ flex: 1, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={16} style={{ color: '#faf9f5', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-on-dark-soft)', lineHeight: 1.2 }}>总时间</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#faf9f5', lineHeight: 1.3 }}>{formatDuration(totalTime)}</div>
          </div>
        </div>
      </div>

      {/* Balance summary */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <div className="card" style={{ flex: 1, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <TrendingUp size={14} style={{ color: 'var(--color-accent-teal)' }} />
          <span style={{ fontSize: 11, color: 'var(--color-on-dark-soft)' }}>赚取</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent-teal)' }}>{totalBalEarned}</span>
        </div>
        <div className="card" style={{ flex: 1, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <TrendingDown size={14} style={{ color: 'var(--color-error)' }} />
          <span style={{ fontSize: 11, color: 'var(--color-on-dark-soft)' }}>消耗</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-error)' }}>{totalBalConsumed}</span>
        </div>
      </div>

      {/* Pie chart with hover detail + legend */}
      {pieData.length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {/* Legend - vertical on left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexWrap: 'wrap', maxHeight: 160 }}>
              {pieData.map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', padding: '2px 6px', borderRadius: 4, background: hoverSeg === d.label ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                  onMouseEnter={() => setHoverSeg(d.label)} onMouseLeave={() => setHoverSeg(null)}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                  <span style={{ color: hoverSeg === d.label ? '#faf9f5' : 'var(--color-on-dark-soft)' }}>{TYPE_LABELS[d.label] || d.label}</span>
                  {hoverSeg === d.label && hoverItem && (
                    <span style={{ color: 'var(--color-on-dark-soft)', fontSize: 10, marginLeft: 2 }}>
                      {formatDuration(hoverItem.value)} {hoverPct}%
                    </span>
                  )}
                </div>
              ))}
            </div>
            {/* Pie */}
            <div style={{ textAlign: 'center', marginLeft: 'auto' }}>
              <PieSVG data={pieData} size={160} hovered={hoverSeg} onHover={setHoverSeg} />
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="timeline-card">
        <div className="timeline-header"><h3>{t('recordTimeline')}</h3></div>
        {timeline.length === 0 ? <div className="empty-hint">{t('recordEmpty')}</div> : timeline.map((item, i) => (
          <div key={i} className="timeline-item">
            <div className="item-icon">{item.icon}</div>
            <div><div className="item-name">{item.name}</div><div className="item-time">{item.timeRange}</div></div>
            <div className="item-duration">{item.duration}</div>
            <div className={`item-balance${item.balanceText ? (item.isNegative ? ' negative' : ' positive') : ''}`}>{item.balanceText}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function fmtTime(iso: string | number): string {
  const d = typeof iso === 'number' ? new Date(iso) : new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
