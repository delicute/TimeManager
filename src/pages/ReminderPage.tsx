import React, { useState } from 'react';
import { Bell, AlertTriangle, Info, Circle, Plus, Trash2, GitBranch, FileText } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT } from '../hooks/useI18n';
import type { ReminderRule, ConditionNode, ReminderMetric, ReminderOperator } from '../types';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

const NOTIF_TYPES = ['reminder', 'urgent', 'notification', 'info'] as const;
const NOTIF_COLORS: Record<string, string> = { reminder: '#5db8a6', urgent: '#c64545', notification: '#5db872', info: '#a09d96' };
const NOTIF_LU: Record<string, typeof Bell> = { reminder: Bell, urgent: AlertTriangle, notification: Info, info: Circle };

const metricKeys: ReminderMetric[] = [
  'entertainmentBalance', 'dailyGiftedBalance', 'earnedBalance',
  'studyDuration', 'hobbyDuration', 'entertainmentDuration',
  'continuousEntertainment', 'totalAvailableBalance', 'debtAmount',
];
const operatorKeys: ReminderOperator[] = ['lt', 'gt', 'gte', 'lte', 'eq'];

function makeLeaf(): ConditionNode {
  return { type: 'leaf', metric: 'totalAvailableBalance', operator: 'lt', value: 600 };
}
function makeGroup(): ConditionNode {
  return { type: 'group', logic: 'and', nodes: [makeLeaf(), makeLeaf()] };
}
function emptyRule(): ReminderRule {
  return { id: '', title: '', content: '', conditionTree: makeGroup(), urgency: 'reminder', enabled: true };
}

const inputS: React.CSSProperties = {
  padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)', color: '#faf9f5', fontSize: 12, height: 28,
  boxSizing: 'border-box',
};

function LeafNode({ node, onChange }: { node: ConditionNode; onChange: (n: ConditionNode) => void }) {
  const t = useT();
  if (node.type !== 'leaf') return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <FileText size={12} style={{ color: 'var(--color-on-dark-soft)', flexShrink: 0 }} />
      <select value={node.metric} onChange={e => onChange({ ...node, metric: e.target.value as ReminderMetric })} style={{ ...inputS, width: 130 }}>
        {metricKeys.map(m => (
          <option key={m} value={m}>{t(`reminderMetric${m.charAt(0).toUpperCase()}${m.slice(1)}` as any)}</option>
        ))}
      </select>
      <select value={node.operator} onChange={e => onChange({ ...node, operator: e.target.value as ReminderOperator })} style={{ ...inputS, width: 60 }}>
        {operatorKeys.map(op => (
          <option key={op} value={op}>{t(`reminderOper${op.charAt(0).toUpperCase()}${op.slice(1)}` as any)}</option>
        ))}
      </select>
      <input type="number" value={node.value} onChange={e => onChange({ ...node, value: Number(e.target.value) })} style={{ ...inputS, width: 70 }} />
      <span style={{ fontSize: 11, color: 'var(--color-on-dark-soft)' }}>{t('reminderSeconds')}</span>
    </div>
  );
}

function TreeNode({ node, onChange, depth = 0 }: { node: ConditionNode; onChange: (n: ConditionNode) => void; depth?: number }) {
  const t = useT();
  if (node.type === 'leaf') {
    return <LeafNode node={node} onChange={onChange} />;
  }
  const left = node.nodes[0] || makeLeaf();
  const right = node.nodes[1] || makeLeaf();
  const setLeft = (n: ConditionNode) => onChange({ ...node, nodes: [n, right] });
  const setRight = (n: ConditionNode) => onChange({ ...node, nodes: [left, n] });

  return (
    <div style={{ position: 'relative' }}>
      {/* Logic toggle row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <GitBranch size={12} style={{ color: 'var(--color-accent-teal)' }} />
        <button onClick={() => onChange({ ...node, logic: 'and' })}
          style={{ padding: '1px 10px', borderRadius: 3, fontSize: 10, cursor: 'pointer', height: 22,
            border: node.logic === 'and' ? '1px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
            background: node.logic === 'and' ? 'rgba(93,184,166,0.15)' : 'transparent',
            color: node.logic === 'and' ? 'var(--color-accent-teal)' : '#faf9f5' }}>AND</button>
        <button onClick={() => onChange({ ...node, logic: 'or' })}
          style={{ padding: '1px 10px', borderRadius: 3, fontSize: 10, cursor: 'pointer', height: 22,
            border: node.logic === 'or' ? '1px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
            background: node.logic === 'or' ? 'rgba(93,184,166,0.15)' : 'transparent',
            color: node.logic === 'or' ? 'var(--color-accent-teal)' : '#faf9f5' }}>OR</button>
      </div>

      {/* Children with tree lines */}
      <div style={{ position: 'relative', paddingLeft: 16 }}>
        {/* Vertical line for the whole subtree */}
        <div style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.1)' }} />

        {/* Left child */}
        <div style={{ position: 'relative', marginBottom: 4 }}>
          {/* Horizontal connector */}
          <div style={{ position: 'absolute', left: -10, top: 14, width: 10, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TreeNode node={left} onChange={setLeft} depth={depth + 1} />
            </div>
            <button onClick={() => { const l = left.type === 'group' ? makeLeaf() : makeGroup(); setLeft(l); }}
              style={{ background: 'none', border: 'none', color: 'var(--color-on-dark-soft)', cursor: 'pointer', padding: '2px', fontSize: 10, flexShrink: 0 }}
              title={left.type === 'group' ? t('reminderRemoveCondition') : t('reminderGroup')}>
              {left.type === 'group' ? <Trash2 size={12} /> : <Plus size={12} />}
            </button>
          </div>
        </div>

        {/* Right child */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: -10, top: 14, width: 10, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TreeNode node={right} onChange={setRight} depth={depth + 1} />
            </div>
            <button onClick={() => { const r = right.type === 'group' ? makeLeaf() : makeGroup(); setRight(r); }}
              style={{ background: 'none', border: 'none', color: 'var(--color-on-dark-soft)', cursor: 'pointer', padding: '2px', fontSize: 10, flexShrink: 0 }}
              title={right.type === 'group' ? t('reminderRemoveCondition') : t('reminderGroup')}>
              {right.type === 'group' ? <Trash2 size={12} /> : <Plus size={12} />}
            </button>
          </div>
        </div>
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
      <h1 className="page-title"><span className="title-icon"><Bell size={24} /></span> {t('reminderPageTitle')}</h1>

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
            <TreeNode node={form.conditionTree} onChange={n => setForm({ ...form, conditionTree: n })} />
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
                  {React.createElement(NOTIF_LU[nt] || Bell, { size: 14, style: { marginRight: 4 } })}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 3, height: 24, borderRadius: 2, background: NOTIF_COLORS[rule.urgency] || '#e8a55a', flexShrink: 0 }} />
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
