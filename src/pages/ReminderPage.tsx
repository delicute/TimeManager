import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useT, navKeyMap } from '../hooks/useI18n';
import type { ReminderRule, ReminderCondition, ReminderMetric, ReminderOperator, ReminderUrgency } from '../types';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyCondition(): ReminderCondition {
  return { metric: 'totalAvailableBalance', operator: 'lt', value: 600 };
}

function emptyRule(): ReminderRule {
  return {
    id: '',
    title: '',
    content: '',
    condition: emptyCondition(),
    urgency: 'medium',
    snoozeRepeat: 3,
    enabled: true,
  };
}

const metricKeys: ReminderMetric[] = [
  'entertainmentBalance',
  'dailyGiftedBalance',
  'earnedBalance',
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
  medium: 'var(--color-accent-teal)',
  high: 'var(--color-accent-amber)',
  critical: 'var(--color-error)',
};

function ConditionRow({ condition, onChange }: {
  condition: ReminderCondition;
  onChange: (c: ReminderCondition) => void;
}) {
  const t = useT();
  return (
    <div className="condition-group">
      <select
        className="form-select"
        value={condition.metric}
        onChange={e => onChange({ ...condition, metric: e.target.value as ReminderMetric })}
      >
        {metricKeys.map(m => (
          <option key={m} value={m}>{t(`reminderMetric${m.charAt(0).toUpperCase()}${m.slice(1)}` as any)}</option>
        ))}
      </select>
      <select
        className="form-select"
        value={condition.operator}
        onChange={e => onChange({ ...condition, operator: e.target.value as ReminderOperator })}
      >
        {operatorKeys.map(op => (
          <option key={op} value={op}>{t(`reminderOper${op.charAt(0).toUpperCase()}${op.slice(1)}` as any)}</option>
        ))}
      </select>
      <input
        className="form-input"
        type="number"
        value={condition.value}
        onChange={e => {
          const v = Number(e.target.value);
          onChange({ ...condition, value: v });
        }}
        style={{ width: 80 }}
      />
      <span className="hint-text" style={{ margin: 0 }}>{t('reminderSeconds')}</span>
    </div>
  );
}

function displayCondition(c: ReminderCondition, t: ReturnType<typeof useT>): string {
  const metricKey = `reminderMetric${c.metric.charAt(0).toUpperCase()}${c.metric.slice(1)}` as any;
  const opKey = `reminderOper${c.operator.charAt(0).toUpperCase()}${c.operator.slice(1)}` as any;
  return `${t(metricKey)} ${t(opKey)} ${c.value}${t('reminderSeconds')}`;
}

export function ReminderPage() {
  const { state, dispatch } = useAppStore();
  const { reminderRules } = state;
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReminderRule>(emptyRule);
  const [showCondition2, setShowCondition2] = useState(false);

  const startAdd = () => {
    setForm(emptyRule());
    setEditingId('__new__');
    setShowCondition2(false);
  };

  const startEdit = (rule: ReminderRule) => {
    setForm({ ...rule });
    setEditingId(rule.id);
    setShowCondition2(!!rule.condition2);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveRule = () => {
    if (!form.title.trim()) return;
    const toSave: ReminderRule = { ...form };
    if (!showCondition2) {
      delete toSave.condition2;
      delete toSave.logic;
    } else if (!toSave.condition2) {
      toSave.condition2 = emptyCondition();
    }
    if (editingId === '__new__') {
      const newRule = { ...toSave, id: genId() };
      dispatch({ type: 'REMINDER_ADD_RULE', payload: newRule });
      window.electronAPI.remindersSave([...reminderRules, newRule]);
    } else if (editingId) {
      dispatch({ type: 'REMINDER_UPDATE_RULE', payload: toSave });
      window.electronAPI.remindersSave(
        reminderRules.map(r => (r.id === toSave.id ? toSave : r))
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

          {/* Condition 1 */}
          <div className="form-row">
            <label>{t('reminderConditionLabel')} 1</label>
            <ConditionRow
              condition={form.condition}
              onChange={c => setForm({ ...form, condition: c })}
            />
          </div>

          {/* AND/OR toggle + condition 2 */}
          {showCondition2 && (
            <div className="form-row">
              <div className="logic-group">
                <button
                  className={`logic-btn ${form.logic !== 'or' ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, logic: 'and' })}
                >
                  {t('reminderAnd')}
                </button>
                <button
                  className={`logic-btn ${form.logic === 'or' ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, logic: 'or' })}
                >
                  {t('reminderOr')}
                </button>
              </div>
            </div>
          )}

          {showCondition2 && (
            <div className="form-row">
              <label>{t('reminderConditionLabel')} 2</label>
              <ConditionRow
                condition={form.condition2 || emptyCondition()}
                onChange={c => setForm({ ...form, condition2: c })}
              />
            </div>
          )}

          <div className="form-row">
            <button
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '4px 12px', height: 28 }}
              onClick={() => {
                if (showCondition2) {
                  const f = { ...form };
                  delete f.condition2;
                  delete f.logic;
                  setForm(f);
                }
                setShowCondition2(!showCondition2);
              }}
            >
              {showCondition2 ? t('reminderRemoveCondition') : t('reminderAddCondition')}
            </button>
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
                {displayCondition(rule.condition, t)}
              </div>
              {rule.condition2 && (
                <div className="rule-condition" style={{ marginTop: 2 }}>
                  <span style={{ color: 'var(--color-accent-teal)', fontWeight: 600 }}>
                    {rule.logic === 'or' ? t('reminderOr') : t('reminderAnd')}
                  </span>{' '}
                  {displayCondition(rule.condition2, t)}
                </div>
              )}
              <div className="rule-actions">
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 12px', height: 28, fontSize: 12 }}
                  onClick={() => startEdit(rule)}
                >
                  {t('reminderEdit')}
                </button>
                <button
                  className="btn-text-link"
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
