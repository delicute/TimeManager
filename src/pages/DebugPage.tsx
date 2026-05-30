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

// Module-level cache so state survives page switches
let _val: Record<string,string> = { Study:'1', Hobby:'1', Entertainment:'1', balance:'100' };
let _unit: Record<string,'s'|'m'|'h'> = { Study:'m', Hobby:'m', Entertainment:'m', balance:'s' };
let _includeLog = true;
let _notifCount = 1;
let _notifType: NotifType = 'notification';
let _notifTitle = '';
let _notifBody = '';

export function DebugPage() {
  const { state, dispatch } = useAppStore();
  const { balance, session } = state;
  const t = useT();

  const [includeLog, setIncludeLog] = useState(_includeLog);
  const [notifCount, setNotifCount] = useState(_notifCount);
  const [notifType, setNotifType] = useState<NotifType>(_notifType);
  const [notifTitle, setNotifTitle] = useState(_notifTitle);
  const [notifBody, setNotifBody] = useState(_notifBody);

  // Per-type values and units
  const [val, setVal] = useState<Record<string,string>>(_val);
  const [unit, setUnit] = useState<Record<string,'s'|'m'|'h'>>(_unit);

  // Live time
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

  // Sync debug form state to module cache so it survives page switches
  useEffect(() => { _val = val; }, [val]);
  useEffect(() => { _unit = unit; }, [unit]);
  useEffect(() => { _includeLog = includeLog; }, [includeLog]);
  useEffect(() => { _notifCount = notifCount; }, [notifCount]);
  useEffect(() => { _notifType = notifType; }, [notifType]);
  useEffect(() => { _notifTitle = notifTitle; }, [notifTitle]);
  useEffect(() => { _notifBody = notifBody; }, [notifBody]);

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
    const sec = Math.abs(delta);
    const ts = Date.now();
    const isStudy = type === 'Study';
    const isHobby = type === 'Hobby';
    const isEntertainment = type === 'Entertainment';
    const weight = isStudy ? state.settings.studyWeight : state.settings.hobbyWeight;
    // Study/Hobby: earn 1 per `weight` seconds.
    // Entertainment: consume 1 per second (2 when in debt), matching real session.
    const debtRate = state.balance.earnedBalance < 0 ? 2 : 1;
    const raw = isEntertainment ? sec * debtRate : Math.floor(sec / (weight || 1));
    // Entertainment consumes balance (negative), Study/Hobby earns (positive when delta>0)
    const balanceChange = isEntertainment ? -raw : (delta > 0 ? raw : -raw);

    // Compute current today total for this type (respecting existing override)
    const currentOverride = state.balance.debugTodayOverride?.[type];
    let currentTotal = 0;
    if (currentOverride !== undefined) {
      currentTotal = currentOverride;
    } else {
      for (const log of state.todayLogs) {
        if (log.activityType === type) {
          currentTotal += Math.floor(
            (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000
          );
        }
      }
    }

    // Apply the delta to today's total via debugTodayOverride
    const newTotal = Math.max(0, currentTotal + (delta > 0 ? sec : -sec));
    const debugOverride = { ...(state.balance.debugTodayOverride || {}), [type]: newTotal };

    // Write log entry for balance tracking
    window.electronAPI.writeLogEntry({
      startTime: new Date(ts - sec * 1000).toISOString(),
      endTime: new Date(ts).toISOString(),
      activityType: type, balanceChange, debug: true,
    });
    window.electronAPI.getTodayLogs().then(logs => dispatch({ type: 'SET_TODAY_LOGS', payload: logs }));

    // Update balance + milestone continuous time (entertainment has no milestones)
    window.electronAPI.loadBalance().then((b: any) => {
      if (isEntertainment) {
        // Consume: dailyGiftedRemaining first, then earnedBalance (can go negative)
        const consume = Math.abs(balanceChange);
        const gifted = b.dailyGiftedRemaining || 0;
        const newGifted = Math.max(0, gifted - consume);
        const remainder = consume - (gifted - newGifted);
        const newEarned = (b.earnedBalance || 0) - remainder;
        const updated = {
          ...b,
          earnedBalance: newEarned,
          dailyGiftedRemaining: newGifted,
        };
        window.electronAPI.saveBalance(updated);
        dispatch({ type: 'SET_BALANCE', payload: { ...updated, debugTodayOverride: debugOverride } });
        return;
      }

      const m = b.milestones || { studyContinuous:0, hobbyContinuous:0, studyClaimed:0, hobbyClaimed:0 };
      const contKey = isStudy ? 'studyContinuous' : 'hobbyContinuous';
      const claimKey = isStudy ? 'studyClaimed' : 'hobbyClaimed';
      const newCont = Math.max(0, (m[contKey] || 0) + (delta > 0 ? sec : -sec));
      let claimed = (m[claimKey] || 0) as number;
      let rewardTotal = 0;
      const locale = state.settings.locale || 'zh';

      // Milestone definitions (same as useAppStore)
      const msList = isStudy
        ? [{ threshold:3600, reward:900, labelZH:'连续学习≥1h', labelEN:'Continuous study ≥1h' },
           { threshold:10800, reward:2700, labelZH:'连续学习≥3h', labelEN:'Continuous study ≥3h' },
           { threshold:18000, reward:3600, labelZH:'连续学习≥5h', labelEN:'Continuous study ≥5h' }]
        : [{ threshold:3600, reward:600, labelZH:'连续爱好≥1h', labelEN:'Continuous hobby ≥1h' },
           { threshold:10800, reward:1800, labelZH:'连续爱好≥3h', labelEN:'Continuous hobby ≥3h' },
           { threshold:18000, reward:2700, labelZH:'连续爱好≥5h', labelEN:'Continuous hobby ≥5h' }];

      msList.forEach((ms, i) => {
        if (!(claimed & (1 << i)) && newCont >= ms.threshold && delta > 0) {
          claimed |= (1 << i);
          rewardTotal += ms.reward;
          const label = locale === 'zh' ? ms.labelZH : ms.labelEN;
          const rewardMin = Math.round(ms.reward / 60);
          const desc = locale === 'zh'
            ? `连续大于${ms.threshold >= 3600 ? `${Math.round(ms.threshold / 3600)}h` : `${Math.round(ms.threshold / 60)}min`}，获得${rewardMin}min赠送余额`
            : `Continuous >${ms.threshold >= 3600 ? `${Math.round(ms.threshold / 3600)}h` : `${Math.round(ms.threshold / 60)}min`}, earned ${rewardMin}min gifted balance`;
          window.electronAPI.notificationShow({
            type, notifType: 'milestone', title: label, body: desc,
            color: '#e8a55a', duration: state.settings.notificationDuration ?? 5,
          });
        }
      });

      // Session earnings → earnedBalance, milestone gifts → dailyGiftedRemaining
      const updated = {
        ...b,
        earnedBalance: Math.max(0, (b.earnedBalance || 0) + balanceChange),
        dailyGiftedRemaining: (b.dailyGiftedRemaining || 1800) + rewardTotal,
        milestones: { ...m, [contKey]: newCont, [claimKey]: claimed },
      };
      window.electronAPI.saveBalance(updated);
      dispatch({ type: 'SET_BALANCE', payload: { ...updated, debugTodayOverride: debugOverride } });
    });
    const label = type === 'Study' ? '学习' : type === 'Hobby' ? '爱好' : '娱乐';
    const n = Math.floor(sec / mult(unit[type]));
    const rateInfo = isEntertainment && debtRate > 1 ? ` (负债率×${debtRate})` : '';
    notify(`Debug: ${label}`, `余额${balanceChange >= 0 ? '+' : ''}${balanceChange} (${delta > 0 ? '+' : '-'}${n}${unit[type]}${rateInfo})`);
  };

  // Set today's total for a session type to a specific value (does NOT change balance)
  const setTodayTotal = (type: SessionType, targetSeconds: number) => {
    const currentOverride = state.balance.debugTodayOverride || {};
    const updated = {
      ...state.balance,
      debugTodayOverride: { ...currentOverride, [type]: targetSeconds } as Record<string, number>,
    };
    dispatch({ type: 'SET_BALANCE', payload: updated });
    const label = type === 'Study' ? '学习' : type === 'Hobby' ? '爱好' : '娱乐';
    const n = Math.floor(targetSeconds / mult(unit[type]));
    notify(`Debug: ${label}`, `设定为 ${n}${unit[type]}`);
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
              <span style={{whiteSpace:'nowrap',flexShrink:0,color:'#ffffff'}}>{label}</span>
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
              <button onClick={() => { if(isBal) { const nv = numVal('balance'); setBal(nv); } else setTodayTotal(key as SessionType, numVal(key)); }} style={{...btn, fontSize:10}}>{t('debugSet')}</button>
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
