import React, { useState, useEffect } from 'react';
import { Bug, Plus, Minus, Bell, Clock, ToggleLeft } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT } from '../hooks/useI18n';
import type { SessionType } from '../types';

type NotifType = 'reminder'|'urgent'|'notification'|'info';
const NOTIF_TYPES: NotifType[] = ['reminder','urgent','notification','info'];
const NOTIF_COLORS: Record<string,string> = { reminder:'#5db8a6', urgent:'#c64545', notification:'#5db872', info:'#a09d96' };
const SESSION_TYPES: SessionType[] = ['Study','Hobby','Entertainment'];
const UNIT_LABELS: Record<string,string> = { s:'s', m:'m', h:'h' };

export function DebugPage() {
  const { state, dispatch } = useAppStore();
  const { balance, session } = state;
  const t = useT();

  const [includeLog, setIncludeLog] = useState(true);
  const [notifCount, setNotifCount] = useState(1);
  const [notifType, setNotifType] = useState<NotifType>('notification');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');

  // Per-type values and units
  const [val, setVal] = useState<Record<string,string>>({ Study:'1', Hobby:'1', Entertainment:'1', balance:'100' });
  const [unit, setUnit] = useState<Record<string,'s'|'m'|'h'>>({ Study:'m', Hobby:'m', Entertainment:'m', balance:'s' });

  // Live time
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

  const runTime = (type: SessionType) =>
    session.isActive && session.currentType === type && session.startTime
      ? Math.floor((now - session.startTime) / 1000) : 0;

  const mult = (u: string) => u === 'h' ? 3600 : u === 'm' ? 60 : 1;
  const numVal = (key: string) => Math.floor(Number(val[key] || 0) * mult(unit[key] || 'm'));

  // Notify after change
  const notify = (title: string, body: string) => {
    window.electronAPI.notificationShow({
      type: 'debug', notifType: 'notification', title, body, color: '#5db872',
      duration: state.settings.notificationDuration ?? 5,
    });
  };

  // Toggle debug setting (persists)
  const toggleDebug = () => {
    const updated = { ...state.settings, debug: !state.settings.debug };
    dispatch({ type: 'SET_SETTINGS', payload: updated });
    window.electronAPI.saveSettings(updated);
  };

  // Adjust time for a session type
  const adjTime = (type: SessionType, delta: number) => {
    const sec = delta > 0 ? delta : -delta;
    const ts = Date.now();
    window.electronAPI.writeLogEntry({
      startTime: new Date(ts - sec * 1000).toISOString(),
      endTime: new Date(ts).toISOString(),
      activityType: type, balanceChange: 0, debug: true,
    });
    window.electronAPI.getTodayLogs().then(logs => dispatch({ type: 'SET_TODAY_LOGS', payload: logs }));
    const label = type === 'Study' ? '学习' : type === 'Hobby' ? '爱好' : '娱乐';
    const n = Math.floor(sec / mult(unit[type]));
    notify(`Debug: ${label}`, `${delta > 0 ? '+' : '-'}${n}${unit[type]}`);
  };

  // Set balance to a specific value
  const setBal = (target: number) => {
    window.electronAPI.loadBalance().then((b: any) => {
      const updated = { ...b, earnedBalance: target };
      window.electronAPI.saveBalance(updated);
      dispatch({ type: 'SET_BALANCE', payload: updated });
      notify('Debug: 余额', `设定为 ${target}`);
    });
  };

  const inpS: React.CSSProperties = {
    padding:'3px 6px', borderRadius:4, border:'1px solid rgba(255,255,255,0.12)',
    background:'rgba(255,255,255,0.06)', color:'#ffffff', fontSize:12, height:26, boxSizing:'border-box',
  };
  const btn: React.CSSProperties = {
    ...inpS, height:26, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:2, padding:'3px 8px', color:'#ffffff',
  };

  return (
    <>
      <h1 className="page-title" style={{color:'#ffffff',fontWeight:700}}><span className="title-icon"><Bug size={24}/></span> {t('debugTitle')}</h1>

      {/* Debug 设置持久化 */}
      <div className="card" style={{padding:'5px 12px',marginBottom:6}}>
        <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:'#ffffff'}}>
          <input type="checkbox" checked={!!state.settings.debug} onChange={toggleDebug} style={{accentColor:'#5db8a6'}} />
          <ToggleLeft size={13}/> {t('debugKeepOpen')}
        </label>
      </div>

      {/* Include Logs toggle */}
      <div className="card" style={{padding:'5px 12px',marginBottom:6}}>
        <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:'#ffffff'}}>
          <input type="checkbox" checked={includeLog} onChange={e=>setIncludeLog(e.target.checked)} style={{accentColor:'#5db8a6'}} />
          <Clock size={13}/> {t('debugIncludeLog')}
        </label>
      </div>

      {/* 数值更改 */}
      <div className="card" style={{padding:12,marginBottom:6}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:6,color:'#ffffff'}}>{t('debugValueEdit')}</div>
        {[...SESSION_TYPES, 'balance' as const].map(key => {
          const isBal = key === 'balance';
          const label = isBal ? t('debugBalance') : t(`timer${key}` as any);
          return (
            <div key={key} style={{display:'flex',alignItems:'center',gap:4,marginBottom:4,fontSize:12,flexWrap:'wrap'}}>
              <span style={{width:90,flexShrink:0,color:'#ffffff',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</span>
              {/* Value input */}
              <input type="text" inputMode="numeric" value={val[key]||''} onChange={e=>setVal({...val,[key]:e.target.value})}
                style={{...inpS,width:55}} />
              {/* Unit toggle */}
              {(['s','m','h'] as const).map(u => (
                <button key={u} onClick={()=>setUnit({...unit,[key]:u})}
                  style={{...inpS, height:22, width:24, padding:0, textAlign:'center', fontSize:10, cursor:'pointer',
                    border: unit[key]===u ? '1.5px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
                    background: unit[key]===u ? 'rgba(93,184,166,0.15)' : 'transparent',
                    color: unit[key]===u ? 'var(--color-accent-teal)' : '#ffffff',
                  }}>{u}</button>
              ))}
              {/* +/- buttons */}
              <button onClick={() => { if(isBal) { const nv=numVal('balance'); setBal(balance.earnedBalance + nv); } else adjTime(key as SessionType, numVal(key)); }}
                style={{...btn, padding:'3px 6px'}}><Plus size={12}/></button>
              <button onClick={() => { if(isBal) { const nv=numVal('balance'); setBal(balance.earnedBalance - nv); } else adjTime(key as SessionType, -numVal(key)); }}
                style={{...btn, padding:'3px 6px'}}><Minus size={12}/></button>
              <button onClick={() => { if(isBal) { const nv = numVal('balance'); setBal(nv); } else adjTime(key as SessionType, numVal(key)); }} style={{...btn, fontSize:10}}>{t('debugSet')}</button>
            </div>
          );
        })}
      </div>

      {/* Send notification */}
      <div className="card" style={{padding:12,marginBottom:6}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:6,color:'#ffffff'}}>{t('debugSendNotification')}</div>
        <div style={{display:'flex',flexDirection:'column',gap:6,fontSize:12}}>
          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            <span style={{color:'#ffffff',fontSize:12}}>{t('debugTitleLabel')}</span>
            <input value={notifTitle} onChange={e=>setNotifTitle(e.target.value)} placeholder="Debug"
              style={{...inpS,width:'100%'}} />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            <span style={{color:'#ffffff',fontSize:12}}>{t('debugBodyLabel')}</span>
            <textarea value={notifBody} onChange={e=>setNotifBody(e.target.value)} placeholder="（可选）"
              style={{...inpS,width:'100%',minHeight:56,resize:'vertical',fontFamily:'inherit'}} />
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
            <span style={{color:'#ffffff',fontSize:12}}>{t('debugAmount')}</span>
            <input type="text" inputMode="numeric" value={notifCount} onChange={e=>setNotifCount(Math.max(1,Number(e.target.value)))}
              style={{...inpS,width:50}} min={1} />
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
            <span style={{color:'#ffffff',fontSize:12}}>{t('debugTypeLabel')}:</span>
            {NOTIF_TYPES.map(nt => (
              <button key={nt} onClick={()=>setNotifType(nt)}
                style={{...btn, height:22, padding:'2px 8px',
                  border: notifType===nt ? `1.5px solid ${NOTIF_COLORS[nt]}` : '1px solid rgba(255,255,255,0.12)',
                  background: notifType===nt ? `${NOTIF_COLORS[nt]}22` : 'transparent',
                  color: notifType===nt ? NOTIF_COLORS[nt] : '#ffffff',
                }}>{t(`reminderNotifType${nt.charAt(0).toUpperCase()+nt.slice(1)}` as any)}</button>
            ))}
            <button onClick={()=>{for(let i=0;i<notifCount;i++)window.electronAPI.notificationShow({type:'debug',notifType,title:notifTitle||'Debug',body:notifBody,color:NOTIF_COLORS[notifType],duration:state.settings.notificationDuration??5});}}
              style={{...btn,marginLeft:'auto'}}><Bell size={12}/> {t('debugSend')}</button>
          </div>
        </div>
      </div>
    </>
  );
}
