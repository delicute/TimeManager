import { useState } from 'react';
import { Settings, RotateCcw } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT, useLocale } from '../hooks/useI18n';
import { formatWeight } from '../utils/formatting';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { AppSettings } from '../types';

const DEFAULTS: AppSettings = {
  autoStart: false,
  silentStart: false,
  minimizeToTray: true,
  studyWeight: 2,
  studyWeightMin: 0.5,
  studyWeightMax: 60,
  studyWeightStep: 0.5,
  hobbyWeight: 4,
  hobbyWeightMin: 0.5,
  hobbyWeightMax: 120,
  hobbyWeightStep: 0.5,
  notificationEnabled: true,
  notificationDuration: 5,
  debug: false,
};

export function SettingsPage() {
  const { state, dispatch } = useAppStore();
  const s = state.settings;
  const t = useT();
  const [locale, setLocale] = useLocale();

  const [studyMin, setStudyMin] = useState(String(s.studyWeightMin));
  const [studyMax, setStudyMax] = useState(String(s.studyWeightMax));
  const [studyStep, setStudyStep] = useState(String(s.studyWeightStep));
  const [hobbyMin, setHobbyMin] = useState(String(s.hobbyWeightMin));
  const [hobbyMax, setHobbyMax] = useState(String(s.hobbyWeightMax));
  const [hobbyStep, setHobbyStep] = useState(String(s.hobbyWeightStep));
  const [basePath, setBasePath] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDebugConfirm, setShowDebugConfirm] = useState(false);
  const [showDanger, setShowDanger] = useState(false);
  const [dangerAction, setDangerAction] = useState<string|null>(null);
  const [dangerConfirm2, setDangerConfirm2] = useState(false);
  const [section, setSection] = useState('general');

  // Load base path on mount
  useState(() => {
    window.electronAPI.getBasePath().then(setBasePath).catch(() => {});
  });

  const updateSetting = (partial: Partial<typeof s>) => {
    const updated = { ...s, ...partial };
    dispatch({ type: 'SET_SETTINGS', payload: updated });
    window.electronAPI.saveSettings(updated);
  };

  const handleResetConfirm = () => {
    const reset = { ...DEFAULTS, dataPath: s.dataPath };
    dispatch({ type: 'SET_SETTINGS', payload: reset });
    window.electronAPI.saveSettings(reset);
    setStudyMin(String(DEFAULTS.studyWeightMin));
    setStudyMax(String(DEFAULTS.studyWeightMax));
    setStudyStep(String(DEFAULTS.studyWeightStep));
    setHobbyMin(String(DEFAULTS.hobbyWeightMin));
    setHobbyMax(String(DEFAULTS.hobbyWeightMax));
    setHobbyStep(String(DEFAULTS.hobbyWeightStep));
    setShowResetConfirm(false);
  };

      {/* Navigation */}
      <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
        {["general","weight","data","other"].map(sec => (
          <button key={sec} onClick={()=>setSection(sec)}
            style={{padding:"4px 14px",borderRadius:6,fontSize:12,cursor:"pointer",height:30,
              border:section===sec?"1.5px solid var(--color-accent-teal)":"1px solid rgba(255,255,255,0.12)",
              background:section===sec?"rgba(93,184,166,0.15)":"transparent",
              color:section===sec?"var(--color-accent-teal)":"#faf9f5"}}>{sec}</button>
        ))}
      </div>
  return (
    <>
      <h1 className="page-title">
        <span className="title-icon"><Settings size={24} /></span> {t('settingsTitle')}
      </h1>

      {/* Language */}
      <div className="card">
        <div className="settings-section-title">{t('language')}</div>
        <div className="setting-row">
          <div className="lang-toggle">
            <button
              className={`lang-btn${locale === 'zh' ? ' active' : ''}`}
              onClick={() => setLocale('zh')}
            >
              中文
            </button>
            <button
              className={`lang-btn${locale === 'en' ? ' active' : ''}`}
              onClick={() => setLocale('en')}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Startup Options */}
      <div className="card">
        <div className="settings-section-title">{t('startupOptions')}</div>

        <div className="setting-row">
          <span className="setting-label">{t('autoStart')}</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={s.autoStart}
              onChange={e => {
                const val = e.target.checked;
                updateSetting({ autoStart: val });
                window.electronAPI.setAutoStart(val);
              }}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="setting-row">
          <span className="setting-label">{t('silentStart')}</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={s.silentStart}
              onChange={e => updateSetting({ silentStart: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="setting-row">
          <span className="setting-label">{t('minimizeToTray')}</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={s.minimizeToTray}
              onChange={e => updateSetting({ minimizeToTray: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="card">
        <div className="settings-section-title">{t('notifTitle')}</div>
        <div className="setting-row">
          <span className="setting-label">{t('notifEnabled')}</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={s.notificationEnabled}
              onChange={e => updateSetting({ notificationEnabled: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="setting-row">
          <span className="setting-label">{t('notifDuration')}</span>
          <div className="slider-group">
            <input
              type="range"
              min={2}
              max={20}
              step={1}
              value={s.notificationDuration}
              onChange={e => updateSetting({ notificationDuration: parseInt(e.target.value) })}
            />
            <span className="slider-value">{s.notificationDuration}{t('notifDurationUnit')}</span>
          </div>
        </div>
      </div>

      {/* Weight Settings */}
      <div className="card">
        <div className="settings-section-title">{t('weightSettings')}</div>

        {/* Study Weight */}
        <div style={{ color: 'var(--color-study)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          {t('navStudy')}
        </div>
        <div className="weight-desc">
          {t('earnPerSecond', { time: formatWeight(s.studyWeight) })}
        </div>
        <div className="slider-group">
          <input
            type="range"
            min={s.studyWeightMin}
            max={s.studyWeightMax}
            step={s.studyWeightStep}
            value={s.studyWeight}
            onChange={e => updateSetting({ studyWeight: parseFloat(e.target.value) })}
          />
          <span className="slider-value">{formatWeight(s.studyWeight)}</span>
        </div>
        <div className="limit-inputs">
          <div className="limit-input">
            <label>{t('min')}</label>
            <input
              type="text"
              value={studyMin}
              onChange={e => setStudyMin(e.target.value)}
              onBlur={() => {
                const val = parseFloat(studyMin);
                if (!isNaN(val) && val < s.studyWeightMax) {
                  updateSetting({ studyWeightMin: val });
                }
              }}
            />
          </div>
          <div className="limit-input">
            <label>{t('max')}</label>
            <input
              type="text"
              value={studyMax}
              onChange={e => setStudyMax(e.target.value)}
              onBlur={() => {
                const val = parseFloat(studyMax);
                if (!isNaN(val) && val > s.studyWeightMin) {
                  updateSetting({ studyWeightMax: val });
                }
              }}
            />
          </div>
          <div className="limit-input">
            <label>{t('step')}</label>
            <input
              type="text"
              value={studyStep}
              onChange={e => setStudyStep(e.target.value)}
              onBlur={() => {
                const val = parseFloat(studyStep);
                if (!isNaN(val) && val > 0) {
                  updateSetting({ studyWeightStep: val });
                }
              }}
            />
          </div>
        </div>

        <hr className="separator" />

        {/* Hobby Weight */}
        <div style={{ color: 'var(--color-hobby)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          {t('navHobby')}
        </div>
        <div className="weight-desc">
          {t('earnPerSecond', { time: formatWeight(s.hobbyWeight) })}
        </div>
        <div className="slider-group">
          <input
            type="range"
            min={s.hobbyWeightMin}
            max={s.hobbyWeightMax}
            step={s.hobbyWeightStep}
            value={s.hobbyWeight}
            onChange={e => updateSetting({ hobbyWeight: parseFloat(e.target.value) })}
          />
          <span className="slider-value">{formatWeight(s.hobbyWeight)}</span>
        </div>
        <div className="limit-inputs">
          <div className="limit-input">
            <label>{t('min')}</label>
            <input
              type="text"
              value={hobbyMin}
              onChange={e => setHobbyMin(e.target.value)}
              onBlur={() => {
                const val = parseFloat(hobbyMin);
                if (!isNaN(val) && val < s.hobbyWeightMax) {
                  updateSetting({ hobbyWeightMin: val });
                }
              }}
            />
          </div>
          <div className="limit-input">
            <label>{t('max')}</label>
            <input
              type="text"
              value={hobbyMax}
              onChange={e => setHobbyMax(e.target.value)}
              onBlur={() => {
                const val = parseFloat(hobbyMax);
                if (!isNaN(val) && val > s.hobbyWeightMin) {
                  updateSetting({ hobbyWeightMax: val });
                }
              }}
            />
          </div>
          <div className="limit-input">
            <label>{t('step')}</label>
            <input
              type="text"
              value={hobbyStep}
              onChange={e => setHobbyStep(e.target.value)}
              onBlur={() => {
                const val = parseFloat(hobbyStep);
                if (!isNaN(val) && val > 0) {
                  updateSetting({ hobbyWeightStep: val });
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Data */}
      <div className="card">
        <div className="settings-section-title">{t('dataSection')}</div>
        <div style={{ fontSize: 12, color: 'var(--color-on-dark-soft)' }}>{t('dataPath')}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <div className="data-path" style={{ flex: 1 }}>{basePath || t('selectFolder')}</div>
          <button className="btn btn-secondary" style={{ padding: '4px 12px', height: 32, fontSize: 12, flexShrink: 0 }}
            onClick={async () => {
              const folder = await window.electronAPI.selectFolder();
              if (folder) { setBasePath(folder); updateSetting({ dataPath: folder }); }
            }}>{t('selectFolder')}</button>
        </div>
      </div>

      {/* Min session log time */}
      <div className="card">
        <div className="setting-row">
          <span className="setting-label">时间线最短记录</span>
          <label className="toggle">
            <input type="checkbox" checked={!!s.minSessionLogEnabled} onChange={e => updateSetting({ minSessionLogEnabled: e.target.checked })} />
            <span className="toggle-slider" />
          </label>
        </div>
        {s.minSessionLogEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--color-on-dark-soft)' }}>{'<'} </span>
            <input type="number" value={s.minSessionLogSec ?? 10} onChange={e => updateSetting({ minSessionLogSec: Number(e.target.value) })}
              style={{ width: 60, padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#faf9f5', fontSize: 12, height: 28 }} />
            <span style={{ fontSize: 12, color: 'var(--color-on-dark-soft)' }}>s 不显示</span>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="card" style={{ border: '1px solid rgba(198,69,69,0.3)' }}>
        <div className="setting-row">
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-error)' }}>危险设置</span>
          <label className="toggle">
            <input type="checkbox" checked={showDanger} onChange={e => {
              if (e.target.checked) setShowDebugConfirm(true);
              else setShowDanger(false);
            }} />
            <span className="toggle-slider" />
          </label>
        </div>
        {showDanger && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            <button className="btn btn-secondary" style={{ width: '100%', padding: '6px 12px', height: 32, fontSize: 12 }}
              onClick={() => { setDangerAction('reset'); setDangerConfirm2(true); }}>重置设置选项</button>
            <button className="btn btn-secondary" style={{ width: '100%', padding: '6px 12px', height: 32, fontSize: 12 }}
              onClick={() => { setDangerAction('clear'); setDangerConfirm2(true); }}>清除所有数据</button>
            <button className="btn btn-secondary" style={{ width: '100%', padding: '6px 12px', height: 32, fontSize: 12 }}
              onClick={() => updateSetting({ debug: true })}>调试面板</button>
          </div>
        )}
      </div>

      <div className="hint-text">
        {t('hintMinimize')}
      </div>
      <ConfirmDialog open={showResetConfirm}
        title={locale === 'zh' ? '重置设置' : 'Reset Settings'}
        message={locale === 'zh' ? '确定将所有设置重置为默认值吗？' : 'Reset all settings to defaults?'}
        confirmLabel={locale === 'zh' ? '重置' : 'Reset'}
        onConfirm={handleResetConfirm} onCancel={() => setShowResetConfirm(false)} danger />
      <ConfirmDialog open={showDebugConfirm}
        title={locale === 'zh' ? '启用危险设置' : 'Enable Danger Zone'}
        message={locale === 'zh' ? '确定要启用危险设置吗？' : 'Are you sure?'}
        onConfirm={() => { setShowDanger(true); setShowDebugConfirm(false); }}
        onCancel={() => setShowDebugConfirm(false)} />
      <ConfirmDialog open={dangerConfirm2}
        title={locale === 'zh' ? '二次确认' : 'Confirm Again'}
        message={locale === 'zh' ? '此操作不可撤销，确定要执行吗？' : 'This cannot be undone. Proceed?'}
        onConfirm={() => {
          if (dangerAction === 'reset') handleResetConfirm();
          else if (dangerAction === 'clear') { updateSetting({ dataPath: undefined } as any); }
          setDangerConfirm2(false); setDangerAction(null);
        }}
        onCancel={() => { setDangerConfirm2(false); setDangerAction(null); }} danger />
    </>
  );
}
