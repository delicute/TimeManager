import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useT, navKeyMap } from '../hooks/useI18n';
import type { ReminderRule, ReminderMetric, ReminderOperator, ReminderUrgency } from '../types';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyRule(): ReminderRule {
  return {
    id: '',
    title: '',
    content: '',
    condition: { metric: 'totalAvailableBalance', operator: 'lt', value: 600 },
    urgency: 'medium',
    snoozeMinutes: 5,
    snoozeRepeat: 3,
    enabled: true,
  };
}

const metricKeys: ReminderMetric[] = [
  'entertainmentBalance',
  'studyDuration',
  'hobbyDuration',
  'entertainmentDuration',
  'continuousEntertainment',
  'totalAvailableBalance',
  'debtAmount',
];

const operatorKeys: ReminderOperator[] = ['lt', 'gt', 'gte', 'lte', 'eq'];

const urgencyKeys: ReminderUrgency[] = ['low', 'medium', 'high', 'critical'];

const urgencyColors: Record<ReminderUrgency, string> = {
  low: 'var(--color-on-dark-soft)',
  medium: 'var(--color-accent-amber)',
  high: 'var(--color-accent-orange)',
  critical: 'var(--color-error)',
};

export function ReminderPage() {
  const { state, dispatch } = useAppStore();
  const { reminderRules } = state;
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReminderRule>(emptyRule);

  const startAdd = () => {
    setForm(emptyRule());
    setEditingId('__new__');
  };

  const startEdit = (rule: ReminderRule) => {
    setForm({ ...rule });
    setEditingId(rule.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveRule = () => {
    if (!form.title.trim()) return;
    if (editingId === '__new__') {
      const newRule = { ...form, id: genId() };
      dispatch({ type: 'REMINDER_ADD_RULE', payload: newRule });
      window.electronAPI.remindersSave([...reminderRules, newRule]);
    } else if (editingId) {
      dispatch({ type: 'REMINDER_UPDATE_RULE', payload: form });
      window.electronAPI.remindersSave(
        reminderRules.map(r => (r.id === form.id ? form : r))
      );
    }
    setEditingId(null);
  };

  const deleteRule = (id: string) => {
    if (!window.confirm(t('reminderDeleteConfirm'))) return;
    dispatch({ type: 'REMINDER_DELETE_RULE', payload: id });
    window.electronAPI.remindersSave(reminderRules.filter(r => r.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const toggleEnabled = (rule: ReminderRule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    dispatch({ type: 'REMINDER_UPDATE_RULE', payload: updated });
    window.electronAPI.remindersSave(
      reminderRules.map(r => (r.id === rule.id ? updated : r))
    );
  };

  return (
    <>
      <h1 className="page-title">
        <span className="title-icon">⏰</span> {t('reminderPageTitle')}
      </h1>

      {/* Add button */}
      {editingId !== '__new__' && (
        <button className="btn btn-primary btn-full" onClick={startAdd}>
          + {t('reminderAdd')}
        </button>
      )}

      {/* Inline form */}
      {editingId && (
        <div className="card reminder-form">
          <div className="form-row">
            <label>{t('reminderTitleLabel')}</label>
            <input
              className="form-input"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder={t('reminderTitleLabel')}
            />
          </div>
          <div className="form-row">
            <label>{t('reminderContentLabel')}</label>
            <input
              className="form-input"
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder={t('reminderContentLabel')}
            />
          </div>
          <div className="form-row">
            <label>{t('reminderConditionLabel')}</label>
            <div className="condition-group">
              <select
                className="form-select"
                value={form.condition.metric}
                onChange={e => setForm({ ...form, condition: { ...form.condition, metric: e.target.value as ReminderMetric } })}
              >
                {metricKeys.map(m => (
                  <option key={m} value={m}>{t(`reminderMetric${m.charAt(0).toUpperCase()}${m.slice(1)}` as any)}</option>
                ))}
              </select>
              <select
                className="form-select"
                value={form.condition.operator}
                onChange={e => setForm({ ...form, condition: { ...form.condition, operator: e.target.value as ReminderOperator } })}
              >
                {operatorKeys.map(op => (
                  <option key={op} value={op}>{t(`reminderOper${op.charAt(0).toUpperCase()}${op.slice(1)}` as any)}</option>
                ))}
              </select>
              <input
                className="form-input"
                type="number"
                value={form.condition.value}
                onChange={e => {
                  const v = Number(e.target.value);
                  setForm(prev => ({ ...prev, condition: { ...prev.condition, value: v } }));
                }}
                style={{ width: 80 }}
              />
              <span className="hint-text" style={{ margin: 0 }}>{t('reminderSeconds')}</span>
            </div>
          </div>
          <div className="form-row">
            <label>{t('reminderUrgencyLabel')}</label>
            <div className="urgency-group">
              {urgencyKeys.map(u => (
                <button
                  key={u}
                  className={`urgency-btn ${form.urgency === u ? 'active' : ''}`}
                  style={{
                    '--urgency-color': urgencyColors[u],
                    borderColor: form.urgency === u ? urgencyColors[u] : undefined,
                    color: form.urgency === u ? urgencyColors[u] : undefined,
                  } as React.CSSProperties}
                  onClick={() => setForm({ ...form, urgency: u })}
                >
                  {t(`reminderUrgency${u.charAt(0).toUpperCase()}${u.slice(1)}` as any)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label>{t('reminderSnoozeLabel')}</label>
            <div className="snooze-group">
              <div className="snooze-field">
                <span>{t('reminderSnoozeMinutes')}</span>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  value={form.snoozeMinutes}
                  onChange={e => setForm({ ...form, snoozeMinutes: Math.max(1, Number(e.target.value)) })}
                  style={{ width: 60 }}
                />
              </div>
              <div className="snooze-field">
                <span>{t('reminderSnoozeRepeat')}</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  value={form.snoozeRepeat}
                  onChange={e => setForm({ ...form, snoozeRepeat: Math.max(0, Number(e.target.value)) })}
                  style={{ width: 60 }}
                />
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={saveRule}>
              {editingId === '__new__' ? t('reminderAdd') : t('reminderEdit')}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {reminderRules.length === 0 && editingId !== '__new__' ? (
        <div className="empty-hint" style={{ marginTop: 32 }}>
          {t('reminderNoRules')}
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {reminderRules.map(rule => (
            <div key={rule.id} className="reminder-rule-card">
              <div className="rule-header">
                <div className="rule-title-row">
                  <span
                    className="rule-urgency-dot"
                    style={{ background: urgencyColors[rule.urgency] }}
                  />
                  <span className="rule-title">{rule.title}</span>
                  <span
                    className="rule-badge"
                    style={{
                      background: urgencyColors[rule.urgency] + '22',
                      color: urgencyColors[rule.urgency],
                    }}
                  >
                    {t(`reminderUrgency${rule.urgency.charAt(0).toUpperCase()}${rule.urgency.slice(1)}` as any)}
                  </span>
                </div>
                <label className="toggle" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleEnabled(rule)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
              {rule.content && (
                <div className="rule-content">{rule.content}</div>
              )}
              <div className="rule-condition">
                {t(`reminderMetric${rule.condition.metric.charAt(0).toUpperCase()}${rule.condition.metric.slice(1)}` as any)}{' '}
                {t(`reminderOper${rule.condition.operator.charAt(0).toUpperCase()}${rule.condition.operator.slice(1)}` as any)}{' '}
                {rule.condition.value}{t('reminderSeconds')}
              </div>
              <div className="rule-actions">
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 12px', height: 28, fontSize: 12 }}
                  onClick={() => startEdit(rule)}
                >
                  {t('reminderEdit')}
                </button>
                <button
                  className="btn btn-stop"
                  style={{ padding: '4px 12px', height: 28, fontSize: 12 }}
                  onClick={() => deleteRule(rule.id)}
                >
                  {t('reminderDelete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
