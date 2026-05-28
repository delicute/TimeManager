import { useState, useEffect, useRef } from 'react';
import { List, BookOpen, Palette, Gamepad2, Calendar } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT, navKeyMap } from '../hooks/useI18n';
import {
  formatDuration,
  formatBalance,
} from '../utils/formatting';

const ACTIVITY_ICONS: Record<string, typeof BookOpen> = {
  Study: BookOpen,
  Hobby: Palette,
  Entertainment: Gamepad2,
};

const ACTIVITY_TYPES = ['Study', 'Hobby', 'Entertainment'] as const;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function RecordPage() {
  const { state } = useAppStore();
  const { session } = state;
  const t = useT();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [logs, setLogs] = useState<any[]>([]);

  // Calendar popup
  const calendarRef = useRef<HTMLDivElement>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  useEffect(() => {
    if (!showCalendar) return;
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalendar]);

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
  const weekDayLabels = ['日','一','二','三','四','五','六'];
  const todayDateStr = todayStr();
  const calCells: (number | null)[] = Array(firstDayIndex).fill(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  function selectDate(year: number, month: number, day: number) {
    setSelectedDate(`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
    setShowCalendar(false);
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else { setCalMonth(m => m - 1); }
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else { setCalMonth(m => m + 1); }
  }

  function prevYear() { setCalYear(y => y - 1); }
  function nextYear() { setCalYear(y => y + 1); }

  // Load logs for selected date
  useEffect(() => {
    if (selectedDate === todayStr()) {
      setLogs(state.todayLogs);
    } else {
      window.electronAPI.getLogsForDate(selectedDate).then(setLogs).catch(() => setLogs([]));
    }
  }, [selectedDate, state.todayLogs]);

  // Compute totals
  const totals: Record<string, number> = { Study: 0, Hobby: 0, Entertainment: 0 };
  for (const log of logs) {
    const sec = Math.floor(
      (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000
    );
    totals[log.activityType] = (totals[log.activityType] || 0) + sec;
  }

  // Add active session (only for today)
  if (selectedDate === todayStr() && session.isActive && session.currentType !== 'None' && session.startTime) {
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    totals[session.currentType] = (totals[session.currentType] || 0) + elapsed;
  }

  // Build timeline (sorted newest first)
  const timeline = logs
    .slice()
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .map(log => {
      const TypeIcon = ACTIVITY_ICONS[log.activityType] || BookOpen;
      return {
      icon: <TypeIcon size={16} />,
      name: t(navKeyMap[log.activityType] || log.activityType),
      timeRange: `${fmtTime(log.startTime)} - ${fmtTime(log.endTime)}`,
      duration: formatDuration(
        Math.floor(
          (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000
        )
      ),
      balanceText: formatBalance(log.balanceChange),
      isNegative: log.balanceChange < 0,
    }});

  // Active session at top (today only)
  if (selectedDate === todayStr() && session.isActive && session.currentType !== 'None' && session.startTime) {
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    const ActiveIcon = ACTIVITY_ICONS[session.currentType] || BookOpen;
    timeline.unshift({
      icon: <ActiveIcon size={16} />,
      name: `${t(navKeyMap[session.currentType])} (${t('recordInProgress')})`,
      timeRange: `${fmtTime(session.startTime)} - ${t('recordNow')}`,
      duration: formatDuration(elapsed),
      balanceText: '',
      isNegative: false,
    });
  }

  return (
    <>
      <div className="page-title-row">
        <h1 className="page-title">
          <span className="title-icon"><List size={24} /></span> {t('recordTitle')}
        </h1>
        <div className="calendar-btn-wrap" ref={calendarRef}>
          <button
            className="btn-date-picker"
            onClick={() => setShowCalendar(v => !v)}
            title={selectedDate}
          >
            <Calendar size={18} />
          </button>
          {showCalendar && (
            <div className="calendar-popup">
              <div className="cal-header">
                <button className="cal-nav cal-nav-year" onClick={prevYear} title="前一年">&laquo;</button>
                <button className="cal-nav" onClick={prevMonth}>&lsaquo;</button>
                <span className="cal-title">{calYear}年{calMonth + 1}月</span>
                <button className="cal-nav" onClick={nextMonth}>&rsaquo;</button>
                <button className="cal-nav cal-nav-year" onClick={nextYear} title="后一年">&raquo;</button>
              </div>
              <div className="cal-weekdays">
                {weekDayLabels.map(d => <span key={d} className="cal-wd">{d}</span>)}
              </div>
              <div className="cal-grid">
                {calCells.map((day, i) => {
                  if (day === null) return <div key={i} className="cal-day empty" />;
                  const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  return (
                    <button
                      key={i}
                      className={`cal-day${dateStr === selectedDate ? ' selected' : ''}${dateStr === todayDateStr ? ' today' : ''}`}
                      onClick={() => selectDate(calYear, calMonth, day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="record-cards">
        {([
          { type: 'Study', icon: BookOpen, label: t(navKeyMap['Study']), value: totals.Study || 0, color: 'var(--color-study)' },
          { type: 'Hobby', icon: Palette, label: t(navKeyMap['Hobby']), value: totals.Hobby || 0, color: 'var(--color-hobby)' },
          { type: 'Entertainment', icon: Gamepad2, label: t(navKeyMap['Entertainment']), value: totals.Entertainment || 0, color: 'var(--color-entertainment)' },
        ] as const).map(item => {
          const CardIcon = item.icon;
          return (
          <div key={item.type} className="record-card">
            <div className="card-icon"><CardIcon size={24} /></div>
            <div className="card-label">{item.label}</div>
            <div className="card-value" style={{ color: item.color }}>
              {formatDuration(item.value)}
            </div>
          </div>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="timeline-card">
        <div className="timeline-header">
          <h3>{t('recordTimeline')}</h3>
        </div>
        {timeline.length === 0 ? (
          <div className="empty-hint">{t('recordEmpty')}</div>
        ) : (
          timeline.map((item, i) => (
            <div key={i} className="timeline-item">
              <div className="item-icon">{item.icon}</div>
              <div>
                <div className="item-name">{item.name}</div>
                <div className="item-time">{item.timeRange}</div>
              </div>
              <div className="item-duration">{item.duration}</div>
              <div
                className={`item-balance ${
                  item.balanceText ? (item.isNegative ? 'negative' : 'positive') : ''
                }`}
              >
                {item.balanceText}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function fmtTime(iso: string | number): string {
  const d = typeof iso === 'number' ? new Date(iso) : new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
