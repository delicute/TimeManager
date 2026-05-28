import React, { useState } from 'react';
import { Bell, AlertTriangle, Info, Circle, Plus, Trash2, FileText, Shuffle, ToggleLeft } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT } from '../hooks/useI18n';
import type { ReminderRule, ConditionNode, ReminderMetric, ReminderOperator, SessionType } from '../types';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

const NOTIF_TYPES = ['reminder', 'urgent', 'notification', 'info'] as const;
const NOTIF_COLORS: Record<string, string> = { reminder: '#5db8a6', urgent: '#c64545', notification: '#5db872', info: '#a09d96' };
const NOTIF_LU: Record<string, typeof Bell> = { reminder: Bell, urgent: AlertTriangle, notification: Info, info: Circle };

const metricKeys: ReminderMetric[] = [
  'entertainmentBalance','dailyGiftedBalance','earnedBalance',
  'studyDuration','hobbyDuration','entertainmentDuration',
  'continuousEntertainment','totalAvailableBalance','debtAmount',
];
const operatorKeys: ReminderOperator[] = ['lt','gt','gte','lte','eq'];

function leaf(v?: number): ConditionNode {
  return { type: 'leaf', metric: 'totalAvailableBalance', operator: 'lt', value: v ?? 600 };
}
function boolNode(): ConditionNode {
  return { type: 'bool', boolType: 'currentState', boolValue: 'Study' as SessionType, expected: true };
}
function grp(logic: 'and'|'or' = 'and'): ConditionNode {
  return { type: 'group', logic, nodes: [leaf()] };
}

const sessionTypes: SessionType[] = ['Study','Hobby','Entertainment'];

const ipt: React.CSSProperties = {
  padding:'3px 6px', borderRadius:4, border:'1px solid rgba(255,255,255,0.12)',
  background:'rgba(255,255,255,0.06)', color:'#faf9f5', fontSize:12, height:28, boxSizing:'border-box',
};
const tinyBtn: React.CSSProperties = {
  ...ipt, height:22, fontSize:10, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:3,
};

function LeafView({ node, onChange }: { node:ConditionNode; onChange:(n:ConditionNode)=>void }) {
  const t = useT();
  if (node.type==='bool') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
        <ToggleLeft size={13} style={{ color:'var(--color-accent-teal)', flexShrink:0 }} />
        <select value={node.boolValue} onChange={e=>onChange({...node, boolValue:e.target.value as SessionType})} style={{ ...ipt, width:110 }}>
          {sessionTypes.map(st => <option key={st} value={st} style={{background:'#252320',color:'#faf9f5'}}>
            {st==='Study'?t('navStudy'):st==='Hobby'?t('navHobby'):t('navEntertainment')}
          </option>)}
        </select>
        <span style={{ fontSize:12, color:'var(--color-on-dark-soft)' }}>=</span>
        <select value={node.expected?'true':'false'} onChange={e=>onChange({...node, expected:e.target.value==='true'})} style={{ ...ipt, width:80 }}>
          <option value="true" style={{background:'#252320',color:'#faf9f5'}}>True</option>
          <option value="false" style={{background:'#252320',color:'#faf9f5'}}>False</option>
        </select>
      </div>
    );
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
      <FileText size={13} style={{ color:'var(--color-accent-teal)', flexShrink:0 }} />
      <select value={node.metric} onChange={e=>onChange({...node, metric:e.target.value as ReminderMetric})} style={{ ...ipt, width:130 }}>
        {metricKeys.map(m => <option key={m} value={m} style={{background:'#252320',color:'#faf9f5'}}>{t(`reminderMetric${m.charAt(0).toUpperCase()}${m.slice(1)}` as any)}</option>)}
      </select>
      <select value={node.operator} onChange={e=>onChange({...node, operator:e.target.value as ReminderOperator})} style={{ ...ipt, width:60 }}>
        {operatorKeys.map(op => <option key={op} value={op} style={{background:'#252320',color:'#faf9f5'}}>{t(`reminderOper${op.charAt(0).toUpperCase()}${op.slice(1)}` as any)}</option>)}
      </select>
      <input type="number" value={node.value} onChange={e=>onChange({...node, value:Number(e.target.value)})} style={{ ...ipt, width:70 }} />
      <span style={{ fontSize:11, color:'var(--color-on-dark-soft)' }}>{t('reminderSeconds')}</span>
    </div>
  );
}

/** Tree node: shows leaf or group editor, with child-level actions */
function BinNode({ node, onChange, onDelete, onConvert, onToggleType, onAddLeaf }: {
  node:ConditionNode; onChange:(n:ConditionNode)=>void;
  onDelete:()=>void; onConvert:()=>void;
  onToggleType?:()=>void; onAddLeaf?:()=>void;
}) {
  const t = useT();
  const isVar = node.type==='leaf' || node.type==='bool';
  return (
    <div style={{ border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'8px 10px', background:'rgba(255,255,255,0.02)' }}>
      {isVar ? <LeafView node={node} onChange={onChange} /> : <BinTree node={node} onChange={onChange} />}
      <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
        {isVar && onToggleType && (
          <button onClick={onToggleType} style={{ ...tinyBtn, color:'var(--color-accent-teal)' }}>
            <Shuffle size={10} />{node.type==='bool' ? '变量' : 'Boolean'}
          </button>
        )}
        {!isVar && onConvert && (
          <button onClick={onConvert} style={{ ...tinyBtn }}><FileText size={10} />{t('reminderRemoveCondition')}</button>
        )}
        {onAddLeaf && <button onClick={onAddLeaf} style={{ ...tinyBtn }}><Plus size={10} />{t('reminderAddCondition')}</button>}
        <button onClick={onDelete} style={{ ...tinyBtn, color:'var(--color-error)' }}><Trash2 size={10} />{t('reminderDelete')}</button>
      </div>
    </div>
  );
}

/** Binary tree: up to 2 children, AND/OR between them */
function BinTree({ node, onChange }: { node:ConditionNode; onChange:(n:ConditionNode)=>void }) {
  const t = useT(); if (node.type!=='group') return null;
  const nc = node.nodes.length;
  const safe = (nc<1) ? [leaf()] : (nc>2 ? node.nodes.slice(0,2) : node.nodes);
  if (safe.length!==node.nodes.length) onChange({...node, nodes:safe});

  const L = safe[0]; const R = safe.length>1 ? safe[1] : null;
  const setL = (n:ConditionNode) => onChange({...node, nodes:[n, ...(R ? [R] : [])]});
  const setR = R ? (n:ConditionNode) => onChange({...node, nodes:[L, n]}) : undefined;

  const convert = (item:ConditionNode): ConditionNode =>
    (item.type==='leaf'||item.type==='bool') ? {type:'group', logic:'and', nodes:[item]} : item.nodes[0];

  const addSibling = (item:ConditionNode, side:'L'|'R') => {
    if (!R) onChange({...node, nodes: side==='L' ? [L, leaf()] : [leaf(), L]});
    else { const sub: ConditionNode = {type:'group', logic:'and', nodes:[item, leaf()]};
      onChange({...node, nodes: side==='L' ? [sub, R] : [L, sub]}); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <BinNode node={L} onChange={setL}
        onDelete={() => onChange({...node, nodes: R ? [R] : [leaf()]})}
        onConvert={() => onChange({...node, nodes:[convert(L), ...(R ? [R] : [])]})}
        onToggleType={() => onChange({...node, nodes:[L.type==='bool'?leaf():boolNode(), ...(R ? [R] : [])]})}
        onAddLeaf={() => addSibling(L, 'L')} />

      {R && <>
        <div style={{ display:'flex', alignItems:'center', gap:8, margin:'2px 0' }}>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
          <div style={{ display:'flex', gap:2 }}>
            <button onClick={()=>onChange({...node, logic:'and'})}
              style={{ padding:'2px 14px', borderRadius:4, fontSize:11, cursor:'pointer', height:24,
                border:node.logic==='and'?'1.5px solid var(--color-accent-teal)':'1px solid rgba(255,255,255,0.12)',
                background:node.logic==='and'?'rgba(93,184,166,0.15)':'transparent',
                color:node.logic==='and'?'var(--color-accent-teal)':'#faf9f5', fontWeight:node.logic==='and'?600:400 }}>AND</button>
            <button onClick={()=>onChange({...node, logic:'or'})}
              style={{ padding:'2px 14px', borderRadius:4, fontSize:11, cursor:'pointer', height:24,
                border:node.logic==='or'?'1.5px solid var(--color-accent-teal)':'1px solid rgba(255,255,255,0.12)',
                background:node.logic==='or'?'rgba(93,184,166,0.15)':'transparent',
                color:node.logic==='or'?'var(--color-accent-teal)':'#faf9f5', fontWeight:node.logic==='or'?600:400 }}>OR</button>
          </div>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
        </div>
      </>}

      {R && setR && (
        <BinNode node={R} onChange={setR}
          onDelete={() => onChange({...node, nodes:[L]})}
          onConvert={() => onChange({...node, nodes:[L, convert(R)]})}
          onToggleType={() => onChange({...node, nodes:[L, R.type==='bool'?leaf():boolNode()]})}
          onAddLeaf={() => addSibling(R, 'R')} />
      )}
    </div>
  );
}

function displayTree(node:ConditionNode, t:ReturnType<typeof useT>, wrap=false): string {
  if (node.type==='leaf') {
    const mk = `reminderMetric${node.metric.charAt(0).toUpperCase()}${node.metric.slice(1)}` as any;
    const ok = `reminderOper${node.operator.charAt(0).toUpperCase()}${node.operator.slice(1)}` as any;
    return `${t(mk)} ${t(ok)} ${node.value}${t('reminderSeconds')}`;
  }
  if (node.type==='bool') {
    const label = node.boolValue==='Study'?t('navStudy'):node.boolValue==='Hobby'?t('navHobby'):t('navEntertainment');
    return `${t('navReminder')} = ${label} (${node.expected?'True':'False'})`;
  }
  const inner = node.nodes.map(n => displayTree(n, t, true)).join(` ${t(node.logic==='and'?'reminderAnd':'reminderOr')} `);
  return wrap ? `(${inner})` : inner;
}

export function ReminderPage() {
  const { state, dispatch } = useAppStore();
  const { reminderRules } = state;
  const t = useT();
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm] = useState<ReminderRule>({id:'',title:'',content:'',conditionTree:grp('and'),urgency:'reminder',enabled:true});

  const startAdd = () => { setForm({id:'',title:'',content:'',conditionTree:grp('and'),urgency:'reminder',enabled:true}); setEditingId('__new__'); };
  const startEdit = (rule:ReminderRule) => { setForm(JSON.parse(JSON.stringify(rule))); setEditingId(rule.id); };
  const cancelEdit = () => setEditingId(null);
  const saveRule = () => {
    if (!form.title.trim()) return;
    if (editingId==='__new__') { const nr={...form,id:genId()}; dispatch({type:'REMINDER_ADD_RULE',payload:nr}); window.electronAPI.remindersSave([...reminderRules,nr]); }
    else if (editingId) { dispatch({type:'REMINDER_UPDATE_RULE',payload:form}); window.electronAPI.remindersSave(reminderRules.map(r=>r.id===form.id?form:r)); }
    setEditingId(null);
  };
  const deleteRule = (id:string) => {
    if (!window.confirm(t('reminderDeleteConfirm'))) return;
    dispatch({type:'REMINDER_DELETE_RULE',payload:id}); window.electronAPI.remindersSave(reminderRules.filter(r=>r.id!==id));
    if (editingId===id) setEditingId(null);
  };
  const toggleEnabled = (rule:ReminderRule) => {
    const upd={...rule,enabled:!rule.enabled}; dispatch({type:'REMINDER_UPDATE_RULE',payload:upd}); window.electronAPI.remindersSave(reminderRules.map(r=>r.id===rule.id?upd:r));
  };

  return (
    <>
      <h1 className="page-title"><span className="title-icon"><Bell size={24}/></span> {t('reminderPageTitle')}</h1>
      {editingId!=='__new__' && <button className="btn btn-primary btn-full" onClick={startAdd}>+ {t('reminderAdd')}</button>}

      {editingId && <div className="card" style={{padding:16,marginTop:12}}>
        <div style={{marginBottom:12}}>
          <label style={{display:'block',fontSize:12,color:'var(--color-on-dark-soft)',marginBottom:4}}>{t('reminderTitleLabel')}</label>
          <input style={{...ipt,width:'100%'}} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder={t('reminderTitleLabel')}/>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:'block',fontSize:12,color:'var(--color-on-dark-soft)',marginBottom:4}}>{t('reminderContentLabel')}</label>
          <textarea style={{...ipt,width:'100%',height:64,resize:'vertical'}} value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder={t('reminderContentLabel')}/>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:'block',fontSize:12,color:'var(--color-on-dark-soft)',marginBottom:4}}>{t('reminderConditionLabel')}</label>
          <BinTree node={form.conditionTree} onChange={n=>setForm({...form,conditionTree:n})}/>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:'block',fontSize:12,color:'var(--color-on-dark-soft)',marginBottom:4}}>{t('reminderNotifTypeLabel')}</label>
          <div style={{display:'flex',gap:6}}>{NOTIF_TYPES.map(nt=>(
            <button key={nt} onClick={()=>setForm({...form,urgency:nt})}
              style={{flex:1,padding:'6px 8px',borderRadius:6,cursor:'pointer',fontSize:12,
                border:form.urgency===nt?`2px solid ${NOTIF_COLORS[nt]}`:'1px solid rgba(255,255,255,0.12)',
                background:form.urgency===nt?`${NOTIF_COLORS[nt]}22`:'transparent',
                color:form.urgency===nt?NOTIF_COLORS[nt]:'#faf9f5'}}>
              {React.createElement(NOTIF_LU[nt]||Bell,{size:14,style:{marginRight:4}})}
              {t(`reminderNotifType${nt.charAt(0).toUpperCase()+nt.slice(1)}` as any)}
            </button>
          ))}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" onClick={saveRule}>{editingId==='__new__'?t('reminderAdd'):t('reminderEdit')}</button>
          <button className="btn btn-secondary" onClick={cancelEdit}>{t('reminderCancel')}</button>
        </div>
      </div>}

      {reminderRules.length===0 && editingId!=='__new__'
        ? <div className="empty-hint" style={{marginTop:32}}>{t('reminderNoRules')}</div>
        : <div style={{marginTop:16}}>{reminderRules.map(rule=>(
            <div key={rule.id} className="card" style={{padding:'12px 16px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:rule.content?4:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:3,height:24,borderRadius:2,background:NOTIF_COLORS[rule.urgency]||'#e8a55a',flexShrink:0}}/>
                  <span style={{fontWeight:600,fontSize:14}}>{rule.title}</span>
                  <span style={{fontSize:10,color:NOTIF_COLORS[rule.urgency]||'#888',background:(NOTIF_COLORS[rule.urgency]||'#888')+'22',padding:'1px 6px',borderRadius:4}}>
                    {t(`reminderNotifType${rule.urgency.charAt(0).toUpperCase()+rule.urgency.slice(1)}` as any)||rule.urgency}
                  </span>
                </div>
                <label className="toggle" onClick={e=>e.stopPropagation()}>
                  <input type="checkbox" checked={rule.enabled} onChange={()=>toggleEnabled(rule)}/><span className="toggle-slider"/>
                </label>
              </div>
              {rule.content && <div style={{fontSize:12,color:'var(--color-on-dark-soft)',marginBottom:4}}>{rule.content}</div>}
              <div style={{fontSize:11,color:'var(--color-on-dark-soft)',lineHeight:1.5}}>{displayTree(rule.conditionTree,t)}</div>
              <div style={{marginTop:8,display:'flex',gap:8}}>
                <button className="btn btn-secondary" style={{padding:'4px 12px',height:28,fontSize:12}} onClick={()=>startEdit(rule)}>{t('reminderEdit')}</button>
                <button className="btn-text-link" onClick={()=>deleteRule(rule.id)}>{t('reminderDelete')}</button>
              </div>
            </div>
        ))}</div>}
    </>
  );
}
