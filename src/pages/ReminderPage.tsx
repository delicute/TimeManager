import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useT } from '../hooks/useI18n';
import type { ReminderRule, ConditionNode, ReminderMetric, ReminderOperator } from '../types';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

const NOTIF_TYPES = ['reminder', 'urgent', 'notification', 'info'] as const;
const NOTIF_COLORS: Record<string, string> = { reminder: '#5db8a6', urgent: '#c64545', notification: '#5db872', info: '#a09d96' };
const NOTIF_ICONS: Record<string, string> = { reminder: '▸', urgent: '▲', notification: '●', info: '·', low: '·', medium: '●', high: '▲', critical: '▲' };

const metricKeys: ReminderMetric[] = [
  'entertainmentBalance', 'dailyGiftedBalance', 'earnedBalance',
  'studyDuration', 'hobbyDuration', 'entertainmentDuration',
  'continuousEntertainment', 'totalAvailableBalance', 'debtAmount',
];
const operatorKeys: ReminderOperator[] = ['lt', 'gt', 'gte', 'lte', 'eq'];

function makeLeaf(): ConditionNode {
  return { type: 'leaf', metric: 'totalAvailableBalance', operator: 'lt', value: 600 };
}

function emptyRule(): ReminderRule {
  return {
    id: '', title: '', content: '',
    conditionTree: { type: 'group', logic: 'and', nodes: [makeLeaf(), makeLeaf()] },
    urgency: 'reminder',
    enabled: true,
  };
}

const s: React.CSSProperties = {
  padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)', color: '#faf9f5', fontSize: 13, height: 32,
  boxSizing: 'border-box',
};

function LeafEditor({ node, onChange }: { node: ConditionNode; onChange: (n: ConditionNode) => void }) {
  const t = useT();
  if (node.type !== 'leaf') return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <select value={node.metric} onChange={e => onChange({ ...node, metric: e.target.value as ReminderMetric })} style={{ ...s, width: 140 }}>
        {metricKeys.map(m => (
          <option key={m} value={m}>{t(`reminderMetric${m.charAt(0).toUpperCase()}${m.slice(1)}` as any)}</option>
        ))}
      </select>
      <select value={node.operator} onChange={e => onChange({ ...node, operator: e.target.value as ReminderOperator })} style={{ ...s, width: 70 }}>
        {operatorKeys.map(op => (
          <option key={op} value={op}>{t(`reminderOper${op.charAt(0).toUpperCase()}${op.slice(1)}` as any)}</option>
        ))}
      </select>
      <input type="number" value={node.value} onChange={e => onChange({ ...node, value: Number(e.target.value) })} style={{ ...s, width: 80 }} />
      <span style={{ fontSize: 12, color: 'var(--color-on-dark-soft)' }}>{t('reminderSeconds')}</span>
    </div>
  );
}

function NodeSlot({ node, onChange, depth }: { node: ConditionNode; onChange: (n: ConditionNode) => void; depth: number }) {
  const t = useT();
  const isGroup = node.type === 'group';

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {isGroup ? (
        <BinaryTreeEditor node={node} onChange={onChange} depth={depth} />
      ) : (
        <LeafEditor node={node} onChange={onChange} />
      )}
      <button onClick={() => onChange(isGroup ? makeLeaf() : { type: 'group', logic: 'and', nodes: [makeLeaf(), makeLeaf()] })}
        style={{ ...s, height: 24, fontSize: 10, cursor: 'pointer', marginTop: 4, width: '100%', textAlign: 'center', color: 'var(--color-on-dark-soft)' }}>
        {t(isGroup ? 'reminderRemoveCondition' : 'reminderGroup')}
      </button>
    </div>
  );
}

function BinaryTreeEditor({ node, onChange, depth = 0 }: { node: ConditionNode; onChange: (n: ConditionNode) => void; depth?: number }) {
  const t = useT();
  if (node.type !== 'group') return null;
  const left = node.nodes[0] || makeLeaf();
  const right = node.nodes[1] || makeLeaf();

  const updateLeft = (n: ConditionNode) => onChange({ ...node, nodes: [n, right] });
  const updateRight = (n: ConditionNode) => onChange({ ...node, nodes: [left, n] });

  return (
    <div style={{ border: depth > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none', borderRadius: 8, padding: depth > 0 ? 8 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <NodeSlot node={left} onChange={updateLeft} depth={depth + 1} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <button onClick={() => onChange({ ...node, logic: 'and' })}
            style={{ padding: '1px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
              border: node.logic === 'and' ? '1px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
              background: node.logic === 'and' ? 'rgba(93,184,166,0.15)' : 'transparent',
              color: node.logic === 'and' ? 'var(--color-accent-teal)' : '#faf9f5' }}>{t('reminderAnd')}</button>
          <button onClick={() => onChange({ ...node, logic: 'or' })}
            style={{ padding: '1px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
              border: node.logic === 'or' ? '1px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
              background: node.logic === 'or' ? 'rgba(93,184,166,0.15)' : 'transparent',
              color: node.logic === 'or' ? 'var(--color-accent-teal)' : '#faf9f5' }}>{t('reminderOr')}</button>
        </div>
        <NodeSlot node={right} onChange={updateRight} depth={depth + 1} />
      </div>
    </div>
  );
}

function displayTree(node: ConditionNode, t: ReturnType<typeof useT>, wrap = false): string {
  if (node.type === 'leaf') {
    const mk = `reminderMetric${node.metric.charAt(0).toUpperCase()}${node.metric.slice(1)}` as any;
    const ok = `reminderOper${node.operator.charAt(0).toUpperCase()}${node.operator.slice(1)}` as any;
    return `${t(mk)} ${t(ok)} ${node.value}${t('reminderSeconds')}`;
  }
  const left = displayTree(node.nodes[0] || makeLeaf(), t, true);
  const right = displayTree(node.nodes[1] || makeLeaf(), t, true);
  const inner = `${left} ${t(node.logic === 'and' ? 'reminderAnd' : 'reminderOr')} ${right}`;
  return wrap ? `(${inner})` : inner;
}

export function ReminderPage() {
  const { state, dispatch } = useAppStore();
  const { reminderRules } = state;
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReminderRule>(emptyRule);

  const startAdd = () => { setForm(emptyRule()); setEditingId('__new__'); };
  const startEdit = (rule: ReminderRule) => { setForm({ ...rule }); setEditingId(rule.id); };
  const cancelEdit = () => setEditingId(null);

  const saveRule = () => {
    if (!form.title.trim()) return;
    if (editingId === '__new__') {
      const newRule = { ...form, id: genId() };
      dispatch({ type: 'REMINDER_ADD_RULE', payload: newRule });
      window.electronAPI.remindersSave([...reminderRules, newRule]);
    } else if (editingId) {
      dispatch({ type: 'REMINDER_UPDATE_RULE', payload: form });
      window.electronAPI.remindersSave(reminderRules.map(r => r.id === form.id ? form : r));
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
    window.electronAPI.remindersSave(reminderRules.map(r => r.id === rule.id ? updated : r));
  };

  return (
    <>
      <h1 className="page-title"><span className="title-icon">⏰</span> {t('reminderPageTitle')}</h1>

      {editingId !== '__new__' && (
        <button className="btn btn-primary btn-full" onClick={startAdd}>+ {t('reminderAdd')}</button>
      )}

      {editingId && (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--color-on-dark-soft)', marginBottom: 4 }}>{t('reminderTitleLabel')}</label>
            <input style={{ ...s, width: '100%' }} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t('reminderTitleLabel')} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--color-on-dark-soft)', marginBottom: 4 }}>{t('reminderContentLabel')}</label>
            <textarea style={{ ...s, width: '100%', height: 64, resize: 'vertical' }} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder={t('reminderContentLabel')} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--color-on-dark-soft)', marginBottom: 4 }}>{t('reminderConditionLabel')}</label>
            <BinaryTreeEditor node={form.conditionTree} onChange={n => setForm({ ...form, conditionTree: n })} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--color-on-dark-soft)', marginBottom: 4 }}>{t('reminderNotifTypeLabel')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {NOTIF_TYPES.map(nt => (
                <button key={nt} onClick={() => setForm({ ...form, urgency: nt })}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                    border: form.urgency === nt ? `2px solid ${NOTIF_COLORS[nt]}` : '1px solid rgba(255,255,255,0.12)',
                    background: form.urgency === nt ? `${NOTIF_COLORS[nt]}22` : 'transparent',
                    color: form.urgency === nt ? NOTIF_COLORS[nt] : '#faf9f5',
                  }}>
                  <span style={{ fontSize: 16, marginRight: 4 }}>{NOTIF_ICONS[nt]}</span>
                  {t(`reminderNotifType${nt.charAt(0).toUpperCase()}${nt.slice(1)}` as any)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={saveRule}>
              {editingId === '__new__' ? t('reminderAdd') : t('reminderEdit')}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>{t('reminderCancel')}</button>
          </div>
        </div>
      )}

      {reminderRules.length === 0 && editingId !== '__new__' ? (
        <div className="empty-hint" style={{ marginTop: 32 }}>{t('reminderNoRules')}</div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {reminderRules.map(rule => (
            <div key={rule.id} className="card" style={{ padding: '12px 16px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: rule.content ? 4 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: NOTIF_COLORS[rule.urgency] || '#e8a55a', fontSize: 14 }}>{NOTIF_ICONS[rule.urgency] || '▸'}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{rule.title}</span>
                  <span style={{ fontSize: 10, color: NOTIF_COLORS[rule.urgency] || '#888', background: (NOTIF_COLORS[rule.urgency] || '#888') + '22', padding: '1px 6px', borderRadius: 4 }}>
                    {t(`reminderNotifType${rule.urgency.charAt(0).toUpperCase()}${rule.urgency.slice(1)}` as any) || rule.urgency}
                  </span>
                </div>
                <label className="toggle" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={rule.enabled} onChange={() => toggleEnabled(rule)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              {rule.content && <div style={{ fontSize: 12, color: 'var(--color-on-dark-soft)', marginBottom: 4 }}>{rule.content}</div>}
              <div style={{ fontSize: 11, color: 'var(--color-on-dark-soft)', lineHeight: 1.5 }}>
                {displayTree(rule.conditionTree, t)}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ padding: '4px 12px', height: 28, fontSize: 12 }} onClick={() => startEdit(rule)}>{t('reminderEdit')}</button>
                <button className="btn-text-link" onClick={() => deleteRule(rule.id)}>{t('reminderDelete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
