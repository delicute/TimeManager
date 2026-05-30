import React, { useState } from 'react';
import { Bug, Plus, Minus, Bell, Save } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT } from '../hooks/useI18n';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { todayStr } from '../utils/formatting';
import type { SessionType } from '../types';

export function DebugPage() {
  const { state, dispatch } = useAppStore();
  const { balance, todayLogs } = state;
  const t = useT();
  const [includeLog, setIncludeLog] = useState(false);

  const now = new Date();

  const adjustTime = (type: SessionType, delta: number) => {
    if (!includeLog) return;
    const total = todayLogs.filter(l => l.activityType === type && !l.debug).reduce((s, l) => s + (new Date(l.endTime).getTime() - new Date(l.startTime).getTime()) / 1000, 0);
    const fakeEnd = new Date(now.getTime() + (delta > 0 ? delta * 1000 : 0));
    const fakeStart = new Date(fakeEnd.getTime() - Math.abs(delta) * 1000);
    window.electronAPI.writeLogEntry({
      startTime: fakeStart.toISOString(),
      endTime: fakeEnd.toISOString(),
      activityType: type,
      balanceChange: 0,
      debug: true,
    });
    window.electronAPI.getTodayLogs().then(logs => dispatch({ type: 'SET_TODAY_LOGS', payload: logs }));
  };

  const adjustBalance = (delta: number) => {
    dispatch({ type: 'BALANCE_ADD_EARNED', payload: delta });
  };

  const setBalance = (val: number) => {
    const current = balance.earnedBalance;
    dispatch({ type: 'BALANCE_ADD_EARNED', payload: val - current });
  };

  const sendNotif = (count: number) => {
    const cfg = state.settings;
    for (let i = 0; i < count; i++) {
      window.electronAPI.notificationShow({
        type: 'debug',
        notifType: 'info',
        title: `Debug ${i + 1}/${count}`,
        body: t('debugTag'),
        color: '#a09d96',
        duration: cfg.notificationDuration ?? 5,
      });
    }
  };

  const debugLogs = todayLogs.filter(l => l.debug);

  const inputS: React.CSSProperties = {
    padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)', color: '#faf9f5', fontSize: 12, height: 28, width: 70,
    boxSizing: 'border-box',
  };
  const btnS: React.CSSProperties = {
    ...inputS, height: 28, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, width: 'auto', padding: '4px 10px',
  };

  return (
    <>
      <h1 className="page-title"><span className="title-icon"><Bug size={24} /></span> {t('debugTitle')}</h1>

      {/* Record toggle */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={includeLog} onChange={e => setIncludeLog(e.target.checked)} style={{ accentColor: '#5db8a6' }} />
          <Save size={14} /> {t('debugIncludeLog')}
        </label>
      </div>

      {/* Time adjustment */}
      <div className="card" style={{ padding: 12, marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('debugTitle')}</div>
        {(['Study', 'Hobby', 'Entertainment'] as SessionType[]).map(type => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12 }}>
            <span style={{ width: 80, flexShrink: 0 }}>{t(type === 'Study' ? 'navStudy' : type === 'Hobby' ? 'navHobby' : 'navEntertainment')}</span>
            <button onClick={() => adjustTime(type, -1)} style={btnS}><Minus size={12} />1{t('debugMinutes')}</button>
            <button onClick={() => adjustTime(type, -5)} style={btnS}><Minus size={12} />5</button>
            <button onClick={() => adjustTime(type, -10)} style={btnS}><Minus size={12} />10</button>
            <span style={{ color: 'var(--color-on-dark-soft)' }}>|</span>
            <button onClick={() => adjustTime(type, 1)} style={btnS}><Plus size={12} />1{t('debugMinutes')}</button>
            <button onClick={() => adjustTime(type, 5)} style={btnS}><Plus size={12} />5</button>
            <button onClick={() => adjustTime(type, 10)} style={btnS}><Plus size={12} />10</button>
          </div>
        ))}
      </div>

      {/* Balance adjustment */}
      <div className="card" style={{ padding: 12, marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('debugBalance')}: {balance.earnedBalance}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
          <button onClick={() => adjustBalance(10)} style={btnS}><Plus size={12} />10</button>
          <button onClick={() => adjustBalance(100)} style={btnS}><Plus size={12} />100</button>
          <button onClick={() => adjustBalance(1000)} style={btnS}><Plus size={12} />1000</button>
          <span style={{ color: 'var(--color-on-dark-soft)' }}>|</span>
          <button onClick={() => adjustBalance(-10)} style={btnS}><Minus size={12} />10</button>
          <button onClick={() => adjustBalance(-100)} style={btnS}><Minus size={12} />100</button>
          <button onClick={() => adjustBalance(-1000)} style={btnS}><Minus size={12} />1000</button>
          <span style={{ color: 'var(--color-on-dark-soft)' }}>|</span>
          <input type="number" id="balSet" defaultValue={0} style={{ ...inputS, width: 80 }} />
          <button onClick={() => { const v = Number((document.getElementById('balSet') as HTMLInputElement)?.value || 0); setBalance(v); }} style={btnS}>{t('debugSet')}</button>
        </div>
      </div>

      {/* Send notification */}
      <div className="card" style={{ padding: 12, marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('debugSendNotification')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input type="number" id="notifCount" defaultValue={1} min={1} style={{ ...inputS, width: 70 }} />
          <button onClick={() => { const c = Number((document.getElementById('notifCount') as HTMLInputElement)?.value || 1); sendNotif(c); }} style={btnS}><Bell size={12} />{t('debugSendNotification')}</button>
        </div>
      </div>

      {/* Debug logs */}
      {debugLogs.length > 0 && (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('debugTitle')} Logs</div>
          {debugLogs.slice(-10).reverse().map((log, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--color-on-dark-soft)', marginBottom: 2 }}>
              {log.activityType} {new Date(log.startTime).toLocaleTimeString()} {t('debugTag')}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog open={false} title="" message="" onConfirm={() => {}} onCancel={() => {}} />
    </>
  );
}
