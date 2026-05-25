import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useT, useLocale } from '../hooks/useI18n';
import { formatWeight } from '../utils/formatting';

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

  // Load base path on mount
  useState(() => {
    window.electronAPI.getBasePath().then(setBasePath).catch(() => {});
  });

  const updateSetting = (partial: Partial<typeof s>) => {
    const updated = { ...s, ...partial };
    dispatch({ type: 'SET_SETTINGS', payload: updated });
    window.electronAPI.saveSettings(updated);
  };

  return (
    <>
      <h1 className="page-title">
        <span className="title-icon">⚙</span> {t('settingsTitle')}
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
        <div className="data-path">{basePath || t('selectFolder')}</div>
        <button
          className="btn btn-secondary"
          style={{ marginTop: 12, width: '100%' }}
          onClick={async () => {
            const folder = await window.electronAPI.selectFolder();
            if (folder) {
              setBasePath(folder);
              updateSetting({ dataPath: folder });
            }
          }}
        >
          {t('selectFolder')}
        </button>
      </div>

      <div className="hint-text">
        {t('hintMinimize')}
      </div>
    </>
  );
}
