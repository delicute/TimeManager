import React, { useState, useEffect } from 'react';
import { Bug, Plus, Minus, Bell, Clock } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT } from '../hooks/useI18n';
import type { SessionType } from '../types';

type NotifType = 'reminder'|'urgent'|'notification'|'info';
const NOTIF_TYPES: NotifType[] = ['reminder','urgent','notification','info'];
const NOTIF_COLORS: Record<string,string> = { reminder:'#5db8a6', urgent:'#c64545', notification:'#5db872', info:'#a09d96' };

export function DebugPage() {
  const { state, dispatch } = useAppStore();
  const { balance, session } = state;
  const t = useT();
  const [, forceUpdate] = useState(0);

  const [includeLog, setIncludeLog] = useState(false);
  const [customVal, setCustomVal] = useState('1');
  const [customUnit, setCustomUnit] = useState<'m'|'h'>('m');
  const [notifCount, setNotifCount] = useState(1);
  const [notifType, setNotifType] = useState<NotifType>('info');

  // Live running time
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

  const runTime = (type: SessionType) => {
    if (session.isActive && session.currentType === type && session.startTime) {
      return Math.floor((now - session.startTime) / 1000);
    }
    return 0;
  };

  // Balance: direct IPC save to bypass reducer restrictions
  const setBalance = (val: number) => {
    window.electronAPI.loadBalance().then((b: any) => {
      const updated = { ...b, earnedBalance: val };
      window.electronAPI.saveBalance(updated);
      dispatch({ type: 'SET_BALANCE', payload: updated });
    });
  };

  const adjustTime = (type: SessionType, seconds: number) => {
    if (!includeLog) return;
    const ts = Date.now();
    window.electronAPI.writeLogEntry({
      startTime: new Date(ts - Math.abs(seconds) * 1000).toISOString(),
      endTime: new Date(ts).toISOString(),
      activityType: type,
      balanceChange: 0,
      debug: true,
    });
    window.electronAPI.getTodayLogs().then(logs => dispatch({ type: 'SET_TODAY_LOGS', payload: logs }));
  };

  const unitMult = customUnit === "h" ? 3600 : 60;
  const customValNum = () => Number(customVal) * unitMult;
  const inpS: React.CSSProperties = {
    padding:'4px 8px', borderRadius:4, border:'1px solid rgba(255,255,255,0.12)',
    background:'rgba(255,255,255,0.06)', color:'#ffffff', fontSize:12, height:28,
    boxSizing:'border-box',
  };
  const btn: React.CSSProperties = {
    ...inpS, height:28, cursor:'pointer', display:'inline-flex', alignItems:'center',
    gap:3, padding:'4px 10px', color:'#ffffff',
  };

  return (
    <>
      <h1 className="page-title" style={{color:'#ffffff',fontWeight:700}}><span className="title-icon"><Bug size={24}/></span> {t('debugTitle')}</h1>

      {/* Include in Logs */}
      <div className="card" style={{padding:'6px 12px',marginBottom:8}}>
        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'#ffffff'}}>
          <input type="checkbox" checked={includeLog} onChange={e=>setIncludeLog(e.target.checked)} style={{accentColor:'#5db8a6'}} />
          <Clock size={14}/> {t('debugIncludeLog')}
        </label>
      </div>

      {/* Time adjustment */}
      <div className="card" style={{padding:12,marginBottom:8}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:8,color:'#ffffff'}}>{t('debugTitle')}</div>
        {(['Study','Hobby','Entertainment'] as SessionType[]).map(type => (
          <div key={type} style={{display:'flex',alignItems:'center',gap:6,marginBottom:6,fontSize:12}}>
            <span style={{width:80,flexShrink:0,color:'#ffffff'}}>{t(type==='Study'?'navStudy':type==='Hobby'?'navHobby':'navEntertainment')}</span>
            <span style={{color:'var(--color-accent-teal)',fontSize:11,width:50}}>
              {session.isActive && session.currentType===type ? `${Math.floor(runTime(type)/60)}m` : '-'}
            </span>
            <button onClick={()=>adjustTime(type, -customValNum())} style={btn}><Minus size={12}/></button>
            <button onClick={()=>adjustTime(type, customValNum())} style={btn}><Plus size={12}/></button>
          </div>
        ))}
        {/* Custom value + unit */}
        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4,fontSize:12}}>
          <input type="number" value={customVal} onChange={e=>setCustomVal(e.target.value)} style={{...inpS,width:70}} min={0} />
          {(['m','h'] as const).map(u => (
            <button key={u} onClick={()=>setCustomUnit(u)}
              style={{...btn, padding:'2px 10px', height:24,
                border: customUnit===u ? '1.5px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
                background: customUnit===u ? 'rgba(93,184,166,0.15)' : 'transparent',
                color: customUnit===u ? 'var(--color-accent-teal)' : '#ffffff',
              }}>{u}</button>
          ))}
        </div>
      </div>

      {/* Balance */}
      <div className="card" style={{padding:12,marginBottom:8}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:8,color:'#ffffff'}}>{t('debugBalance')}: <span style={{color:'var(--color-accent-teal)'}}>{balance.earnedBalance}</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
          <span style={{color:'#ffffff'}}>{t('debugSet')}</span>
          <input type="number" id="balVal" defaultValue={0} style={{...inpS,width:100}} />
          <button onClick={()=>{const v=Number((document.getElementById('balVal')as HTMLInputElement)?.value||0);setBalance(v);}} style={btn}>{t('debugSet')}</button>
        </div>
      </div>

      {/* Send notification */}
      <div className="card" style={{padding:12,marginBottom:8}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:8,color:'#ffffff'}}>{t('debugSendNotification')}</div>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,flexWrap:'wrap'}}>
          <span style={{color:'#ffffff'}}>{t('debugAmount')}</span>
          <input type="number" value={notifCount} onChange={e=>setNotifCount(Math.max(1,Number(e.target.value)))} style={{...inpS,width:60}} min={1} />
          {NOTIF_TYPES.map(nt => (
            <button key={nt} onClick={()=>setNotifType(nt)}
              style={{...btn, padding:'2px 8px',height:24,
                border: notifType===nt ? `1.5px solid ${NOTIF_COLORS[nt]}` : '1px solid rgba(255,255,255,0.12)',
                background: notifType===nt ? `${NOTIF_COLORS[nt]}22` : 'transparent',
                color: notifType===nt ? NOTIF_COLORS[nt] : '#ffffff',
              }}>{nt}</button>
          ))}
          <button onClick={()=>{for(let i=0;i<notifCount;i++)window.electronAPI.notificationShow({type:'debug',notifType,title:`Debug ${i+1}/${notifCount}`,body:'',color:NOTIF_COLORS[notifType],duration:state.settings.notificationDuration??5});}}
            style={btn}><Bell size={12}/> {t('debugSendNotification')}</button>
        </div>
      </div>
    </>
  );
}
