import { useState, useEffect } from 'react';
import { Settings, RotateCcw, FolderOpen, Trash2 } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT, useLocale } from '../hooks/useI18n';
import { formatWeight } from '../utils/formatting';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { HotkeySettingsPage } from './HotkeySettingsPage';
import { useToast } from '../hooks/useToast';
import type { AppSettings } from '../types';

const DEFAULTS: AppSettings = {
  autoStart: false, silentStart: false, minimizeToTray: true,
  studyWeight: 2, studyWeightMin: 0.5, studyWeightMax: 60, studyWeightStep: 0.5,
  hobbyWeight: 4, hobbyWeightMin: 0.5, hobbyWeightMax: 120, hobbyWeightStep: 0.5,
  notificationEnabled: true, notificationDuration: 5, debug: false,
};

const SECTION_TABS = [
  { id: 'general', key: 'settingsTabGeneral' as const },
  { id: 'weight', key: 'settingsTabWeight' as const },
  { id: 'data', key: 'settingsTabData' as const },
  { id: 'hotkey', key: 'settingsTabHotkey' as const },
  { id: 'other', key: 'settingsTabOther' as const },
];

export function SettingsPage({ initialTab }: { initialTab?: string }) {
  const { state, dispatch } = useAppStore();
  const s = state.settings;
  const t = useT();
  const [locale, setLocale] = useLocale();

  const { showToast } = useToast();

  const [studyMin, setStudyMin] = useState(String(s.studyWeightMin));
  const [studyMax, setStudyMax] = useState(String(s.studyWeightMax));
  const [studyStep, setStudyStep] = useState(String(s.studyWeightStep));
  const [hobbyMin, setHobbyMin] = useState(String(s.hobbyWeightMin));
  const [hobbyMax, setHobbyMax] = useState(String(s.hobbyWeightMax));
  const [hobbyStep, setHobbyStep] = useState(String(s.hobbyWeightStep));
  const [basePath, setBasePath] = useState('');
  const [section, setSection] = useState(initialTab || 'general');

  // Sync when initialTab changes (e.g. navigating between Hotkey/Settings nav)
  useEffect(() => {
    setSection(initialTab || 'general');
  }, [initialTab]);
  const [dangerUnlocked, setDangerUnlocked] = useState(false);
  const [confirmState, setConfirmState] = useState<{open:boolean;title:string;message:string;onConfirm:()=>void;danger?:boolean}>({open:false,title:'',message:'',onConfirm:()=>{}});

  // Load base path on mount
  useEffect(() => {
    window.electronAPI.getBasePath().then(setBasePath).catch(() => {});
  }, []);

  const updateSetting = (partial: Partial<typeof s>) => {
    const updated = { ...s, ...partial };
    dispatch({ type: 'SET_SETTINGS', payload: updated });
    window.electronAPI.saveSettings(updated);
    showToast(t('settingsSaved'), 'success');
  };

  const showConfirm = (title:string, message:string, onConfirm:()=>void, danger?:boolean) => {
    setConfirmState({ open: true, title, message, onConfirm, danger });
  };

  const handleReset = () => {
    const reset = { ...DEFAULTS, dataPath: s.dataPath };
    dispatch({ type: 'SET_SETTINGS', payload: reset });
    window.electronAPI.saveSettings(reset);
    setStudyMin(String(DEFAULTS.studyWeightMin));
    setStudyMax(String(DEFAULTS.studyWeightMax));
    setStudyStep(String(DEFAULTS.studyWeightStep));
    setHobbyMin(String(DEFAULTS.hobbyWeightMin));
    setHobbyMax(String(DEFAULTS.hobbyWeightMax));
    setHobbyStep(String(DEFAULTS.hobbyWeightStep));
    setConfirmState(c=>({...c,open:false}));
  };

  const handleClearData = () => {
    dispatch({ type: 'SET_TODAY_LOGS', payload: [] });
    window.electronAPI.saveBalance({ earnedBalance: 0, dailyGiftedRemaining: 1800, lastDate: '' });
    dispatch({ type: 'SET_BALANCE', payload: { earnedBalance: 0, dailyGiftedRemaining: 1800, lastDate: '' } });
    setConfirmState(c=>({...c,open:false}));
  };

  const handleOpenFolder = () => {
    const p = basePath || '';
    if (p) window.electronAPI.shellOpenPath(p);
  };

  const navTab: React.CSSProperties = {
    padding:'4px 14px',borderRadius:6,fontSize:12,cursor:'pointer',height:30,border:'1px solid rgba(255,255,255,0.12)',
    background:'transparent',color:'#faf9f5',fontFamily:'inherit',
  };
  const navTabActive: React.CSSProperties = {
    ...navTab, border:'1.5px solid var(--color-accent-teal)',
    background:'rgba(93,184,166,0.15)', color:'var(--color-accent-teal)', fontWeight:600,
  };
  const cardStyle: React.CSSProperties = { padding:'8px 12px', marginBottom:11 };
  const rowStyle: React.CSSProperties = { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 0' };
  const labelStyle: React.CSSProperties = { fontSize:13, color:'var(--color-on-dark)' };

  return (
    <>
      <h1 className="page-title">
        <span className="title-icon"><Settings size={24} /></span> {t('settingsTitle')}
      </h1>

      {/* Navigation */}
      <div style={{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap"}}>
        {SECTION_TABS.map(sec => (
          <button key={sec.id} onClick={()=>setSection(sec.id)}
            style={section===sec.id ? navTabActive : navTab}>{t(sec.key)}</button>
        ))}
      </div>

      {/* ===== 通用 ===== */}
      {section === 'general' && <>
        <div className="card" style={cardStyle}>
          <div style={{fontSize:14,fontWeight:600,color:'var(--color-on-dark)',marginBottom:4}}>{t('language')}</div>
          <div className="lang-toggle" style={{gap:4}}>
            <button className={`lang-btn${locale==='zh'?' active':''}`} onClick={()=>setLocale('zh')}
              style={{padding:'5px 14px',height:30,fontSize:12}}>中文</button>
            <button className={`lang-btn${locale==='en'?' active':''}`} onClick={()=>setLocale('en')}
              style={{padding:'5px 14px',height:30,fontSize:12}}>English</button>
          </div>
        </div>

        <div className="card" style={cardStyle}>
          <div style={{fontSize:14,fontWeight:600,color:'var(--color-on-dark)',marginBottom:4}}>{t('startupOptions')}</div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t('autoStart')}</span>
            <label className="toggle"><input type="checkbox" checked={s.autoStart} onChange={e=>{updateSetting({autoStart:e.target.checked});window.electronAPI.setAutoStart(e.target.checked);}}/><span className="toggle-slider"/></label>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t('silentStart')}</span>
            <label className="toggle"><input type="checkbox" checked={s.silentStart} onChange={e=>updateSetting({silentStart:e.target.checked})}/><span className="toggle-slider"/></label>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t('minimizeToTray')}</span>
            <label className="toggle"><input type="checkbox" checked={s.minimizeToTray} onChange={e=>updateSetting({minimizeToTray:e.target.checked})}/><span className="toggle-slider"/></label>
          </div>
        </div>

        <div className="card" style={cardStyle}>
          <div style={{fontSize:14,fontWeight:600,color:'var(--color-on-dark)',marginBottom:4}}>{t('notifTitle')}</div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t('notifEnabled')}</span>
            <label className="toggle"><input type="checkbox" checked={s.notificationEnabled} onChange={e=>updateSetting({notificationEnabled:e.target.checked})}/><span className="toggle-slider"/></label>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t('notifDuration')}</span>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div className="slider-wrap" style={{width:120}}>
                <div className="slider-track"><div className="slider-fill" style={{width:`${((s.notificationDuration-2)/(20-2))*100}%`}} /></div>
                <input type="range" min={2} max={20} step={1} value={s.notificationDuration} onChange={e=>updateSetting({notificationDuration:parseInt(e.target.value)})} />
              </div>
              <span style={{fontSize:13,fontWeight:500,color:'var(--color-on-dark)',minWidth:28,textAlign:'right'}}>{s.notificationDuration}{t('notifDurationUnit')}</span>
            </div>
          </div>
        </div>
      </>}

      {/* ===== 权重 ===== */}
      {section === 'weight' && <>
        <div className="card" style={cardStyle}>
          <div style={{fontSize:14,fontWeight:600,color:'var(--color-on-dark)',marginBottom:4}}>{t('weightSettings')}</div>

          <div style={{color:'var(--color-study)',fontWeight:600,fontSize:13,marginBottom:2}}>{t('navStudy')}</div>
          <div style={{fontSize:11,color:'var(--color-on-dark-soft)',marginBottom:4}}>{t('earnPerSecond',{time:formatWeight(s.studyWeight)})}</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div className="slider-wrap">
              <div className="slider-track"><div className="slider-fill" style={{width:`${((s.studyWeight-s.studyWeightMin)/(s.studyWeightMax-s.studyWeightMin))*100}%`}} /></div>
              <input type="range" min={s.studyWeightMin} max={s.studyWeightMax} step={s.studyWeightStep} value={s.studyWeight} onChange={e=>updateSetting({studyWeight:parseFloat(e.target.value)})} />
            </div>
            <span style={{fontSize:13,fontWeight:500,color:'var(--color-on-dark)',minWidth:28,textAlign:'right'}}>{formatWeight(s.studyWeight)}</span>
          </div>
          <div className="limit-inputs" style={{marginTop:2,gap:6}}>
            <div className="limit-input"><label style={{fontSize:10}}>{t('min')}</label><input type="text" value={studyMin} onChange={e=>setStudyMin(e.target.value)} style={{width:46}} onBlur={()=>{const v=parseFloat(studyMin);if(!isNaN(v)&&v<s.studyWeightMax)updateSetting({studyWeightMin:v})}}/></div>
            <div className="limit-input"><label style={{fontSize:10}}>{t('max')}</label><input type="text" value={studyMax} onChange={e=>setStudyMax(e.target.value)} style={{width:46}} onBlur={()=>{const v=parseFloat(studyMax);if(!isNaN(v)&&v>s.studyWeightMin)updateSetting({studyWeightMax:v})}}/></div>
            <div className="limit-input"><label style={{fontSize:10}}>{t('step')}</label><input type="text" value={studyStep} onChange={e=>setStudyStep(e.target.value)} style={{width:46}} onBlur={()=>{const v=parseFloat(studyStep);if(!isNaN(v)&&v>0)updateSetting({studyWeightStep:v})}}/></div>
          </div>

          <hr style={{border:'none',height:1,background:'rgba(255,255,255,0.08)',margin:'8px 0'}}/>

          <div style={{color:'var(--color-hobby)',fontWeight:600,fontSize:13,marginBottom:2}}>{t('navHobby')}</div>
          <div style={{fontSize:11,color:'var(--color-on-dark-soft)',marginBottom:4}}>{t('earnPerSecond',{time:formatWeight(s.hobbyWeight)})}</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div className="slider-wrap">
              <div className="slider-track"><div className="slider-fill" style={{width:`${((s.hobbyWeight-s.hobbyWeightMin)/(s.hobbyWeightMax-s.hobbyWeightMin))*100}%`}} /></div>
              <input type="range" min={s.hobbyWeightMin} max={s.hobbyWeightMax} step={s.hobbyWeightStep} value={s.hobbyWeight} onChange={e=>updateSetting({hobbyWeight:parseFloat(e.target.value)})} />
            </div>
            <span style={{fontSize:13,fontWeight:500,color:'var(--color-on-dark)',minWidth:28,textAlign:'right'}}>{formatWeight(s.hobbyWeight)}</span>
          </div>
          <div className="limit-inputs" style={{marginTop:2,gap:6}}>
            <div className="limit-input"><label style={{fontSize:10}}>{t('min')}</label><input type="text" value={hobbyMin} onChange={e=>setHobbyMin(e.target.value)} style={{width:46}} onBlur={()=>{const v=parseFloat(hobbyMin);if(!isNaN(v)&&v<s.hobbyWeightMax)updateSetting({hobbyWeightMin:v})}}/></div>
            <div className="limit-input"><label style={{fontSize:10}}>{t('max')}</label><input type="text" value={hobbyMax} onChange={e=>setHobbyMax(e.target.value)} style={{width:46}} onBlur={()=>{const v=parseFloat(hobbyMax);if(!isNaN(v)&&v>s.hobbyWeightMin)updateSetting({hobbyWeightMax:v})}}/></div>
            <div className="limit-input"><label style={{fontSize:10}}>{t('step')}</label><input type="text" value={hobbyStep} onChange={e=>setHobbyStep(e.target.value)} style={{width:46}} onBlur={()=>{const v=parseFloat(hobbyStep);if(!isNaN(v)&&v>0)updateSetting({hobbyWeightStep:v})}}/></div>
          </div>
        </div>
      </>}

      {/* ===== 数据 ===== */}
      {section === 'data' && <>
        <div className="card" style={cardStyle}>
          <div style={{fontSize:12,color:'var(--color-on-dark-soft)',marginBottom:4}}>{t('dataPath')}</div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <div style={{flex:1,fontSize:11,color:'var(--color-on-dark-soft)',wordBreak:'break-all',background:'rgba(255,255,255,0.04)',padding:'4px 8px',borderRadius:4,lineHeight:'22px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{basePath || t('settingsDefaultPath')}</div>
            <button style={{padding:'3px 10px',height:28,fontSize:11,flexShrink:0,borderRadius:4,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'#faf9f5',cursor:'pointer',fontFamily:'inherit'}}
              onClick={async()=>{const folder=await window.electronAPI.selectFolder();if(folder){setBasePath(folder);updateSetting({dataPath:folder})}}}>{t('selectFolder')}</button>
            <button style={{padding:'3px 10px',height:28,fontSize:11,flexShrink:0,borderRadius:4,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'#faf9f5',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}
              onClick={handleOpenFolder}><FolderOpen size={12}/> {t('settingsOpenFolder')}</button>
          </div>
        </div>

        <div className="card" style={cardStyle}>
          <div style={rowStyle}>
            <span style={labelStyle}>{t('settingsMinSessionLog')}</span>
            <label className="toggle"><input type="checkbox" checked={!!s.minSessionLogEnabled} onChange={e=>updateSetting({minSessionLogEnabled:e.target.checked})}/><span className="toggle-slider"/></label>
          </div>
          {s.minSessionLogEnabled && (
            <div style={{display:'flex',alignItems:'center',gap:4,marginTop:2}}>
              <span style={{fontSize:12,color:'var(--color-on-dark-soft)'}}>&lt; </span>
              <input type="text" inputMode="numeric" value={s.minSessionLogSec??10} onChange={e=>updateSetting({minSessionLogSec:Number(e.target.value)})}
                style={{width:60,padding:'2px 6px',borderRadius:4,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'#faf9f5',fontSize:12,height:24}} />
              <span style={{fontSize:12,color:'var(--color-on-dark-soft)'}}>s {t('settingsHideLabel')}</span>
            </div>
          )}
        </div>
      </>}

      {/* ===== 快捷键 ===== */}
      {section === 'hotkey' && <>
        <div className="card" style={cardStyle}>
          <div style={rowStyle}>
            <span style={labelStyle}>{t('settingsGlobalHotkeys')}</span>
            <label className="toggle"><input type="checkbox" checked={!!s.globalHotkeys} onChange={e=>updateSetting({globalHotkeys:e.target.checked})}/><span className="toggle-slider"/></label>
          </div>
        </div>
        <HotkeySettingsPage embedded />
      </>}

      {/* ===== 其他 ===== */}
      {section === 'other' && <>
        <div className="card" style={{...cardStyle,border: dangerUnlocked ? '1px solid rgba(198,69,69,0.3)' : '1px solid rgba(255,255,255,0.12)'}}>
          <div style={rowStyle}>
            <span style={{fontSize:14,fontWeight:600,color:dangerUnlocked?'var(--color-error)':'var(--color-on-dark)'}}>{t('settingsDangerZone')}</span>
            <label className="toggle">
              <input type="checkbox" checked={dangerUnlocked}
                onChange={e=>{
                  if(e.target.checked){
                    showConfirm(t('settingsConfirmDangerTitle'),t('settingsConfirmDangerMsg'),
                      ()=>{setDangerUnlocked(true);setConfirmState(c=>({...c,open:false}));},true);
                  }else{setDangerUnlocked(false);}
                }} />
              <span className="toggle-slider" />
            </label>
          </div>
          {dangerUnlocked && <>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('settingsResetSettings')}</span>
              <button className="btn btn-danger" style={{padding:'3px 12px',height:28,fontSize:11,borderRadius:4,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}
                onClick={()=>showConfirm(t('settingsConfirmResetTitle'),t('settingsConfirmResetMsg'),handleReset,true)}><RotateCcw size={12}/> {t('settingsReset')}</button>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('settingsClearData')}</span>
              <button className="btn btn-danger" style={{padding:'3px 12px',height:28,fontSize:11,borderRadius:4,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}
                onClick={()=>showConfirm(t('settingsConfirmClearTitle'),t('settingsConfirmClearMsg'),handleClearData,true)}><Trash2 size={12}/> {t('settingsClear')}</button>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('settingsDebugPanel')}</span>
              <label className="toggle"><input type="checkbox" checked={!!s.debug} onChange={e=>{
                const next = e.target.checked;
                showConfirm(t('settingsConfirmDebugTitle'),next ? t('debugConfirmEnable') : t('debugConfirmDisable'),
                  ()=>{updateSetting({debug:next});setConfirmState(c=>({...c,open:false}));},false);
              }}/><span className="toggle-slider"/></label>
            </div>
          </>}
        </div>
      </>}

      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message}
        confirmLabel={t('reminderConfirm')} onConfirm={confirmState.onConfirm} onCancel={()=>setConfirmState(c=>({...c,open:false}))}
        danger={confirmState.danger} />
    </>
  );
}
