import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, MessageCircle, Plus, Trash2, FileText, Shuffle, ToggleLeft, Search, Clock, Ban } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useT } from '../hooks/useI18n';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Select } from '../components/Select';
import type { ReminderRule, ConditionNode, ReminderMetric, ReminderOperator, SessionType, BoolType } from '../types';
import { useToast } from '../hooks/useToast';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

const NOTIF_TYPES = ['reminder', 'urgent', 'notification', 'info'] as const;
const NOTIF_COLORS: Record<string, string> = { reminder: '#5db8a6', urgent: '#c64545', notification: '#5db872', info: '#a09d96' };
const NOTIF_LU: Record<string, typeof Bell> = { reminder: Bell, urgent: AlertTriangle, notification: MessageCircle, info: FileText };

const metricKeys: ReminderMetric[] = [
  'entertainmentBalance','dailyGiftedBalance','earnedBalance',
  'studyDuration','hobbyDuration','entertainmentDuration',
  'continuousEntertainment','continuousStudy','continuousHobby',
  'totalAvailableBalance','debtAmount',
  'todaySessionCount','currentSessionDuration',
];
const operatorKeys: ReminderOperator[] = ['lt','gt','gte','lte','eq','neq'];
const sessionTypes: SessionType[] = ['Study','Hobby','Entertainment'];
const boolTypeKeys: { value: BoolType; label: (t: ReturnType<typeof useT>) => string }[] = [
  { value: 'currentState', label: (t) => t('reminderBoolCurrentState') },
  { value: 'isDebt', label: (t) => t('reminderBoolIsDebt') },
  { value: 'hasActivityToday', label: (t) => t('reminderBoolHasActivityToday') },
  { value: 'isPaused', label: (t) => t('reminderBoolIsPaused') },
  { value: 'isMilestoneAvailable', label: (t) => t('reminderBoolIsMilestoneAvailable') },
];
const timeOpKeys = ['before', 'after', 'at'] as const;

type Unit = 's'|'m'|'h';
const UNIT_MULT: Record<Unit,number> = { s:1, m:60, h:3600 };

function leaf(v?: number, u?: Unit): ConditionNode {
  return { type: 'leaf', metric: 'totalAvailableBalance', operator: 'lt', value: v ?? 600, unit: u ?? 's' } as any;
}
function boolNode(boolType?: BoolType): ConditionNode {
  if (boolType && boolType !== 'currentState') {
    return { type: 'bool', boolType, expected: true } as ConditionNode;
  }
  return { type: 'bool', boolType: 'currentState', boolValue: 'Study' as SessionType, expected: true };
}
function timeNode(): ConditionNode {
  return { type: 'time', timeOp: 'before', timeValue: '22:00' };
}
function notNode(): ConditionNode {
  return { type: 'not', node: leaf() } as ConditionNode;
}
function grp(logic: 'and'|'or' = 'and'): ConditionNode {
  return { type: 'group', logic, nodes: [leaf()] };
}

/** Auto-clean tree: collapse single-child groups, eliminate double NOT */
function simplifyTree(node: ConditionNode): ConditionNode {
  if (node.type === 'group') {
    const simple = node.nodes.map(n => simplifyTree(n));
    // Remove empty groups (0 children)
    const filtered = simple.filter(n => !(n.type === 'group' && n.nodes.length === 0));
    // Collapse single-child groups (avoids Group(onlyChild) redundancy)
    if (filtered.length === 1) return filtered[0];
    return { ...node, nodes: filtered.length > 2 ? filtered.slice(0, 2) : filtered };
  }
  if (node.type === 'not') {
    const inner = simplifyTree(node.node);
    // Double NOT elimination
    if (inner.type === 'not') return inner.node;
    return { ...node, node: inner };
  }
  return node;
}

/** Cycle node type: leaf → bool → time → not → leaf (not unwraps inner) */
function nextNodeType(node: ConditionNode): ConditionNode {
  switch (node.type) {
    case 'leaf': return boolNode('hasActivityToday');
    case 'bool': return timeNode();
    case 'time': return notNode();
    case 'not': return node.node; // unwrap NOT (double negation)
    default: return leaf();
  }
}

const ipt: React.CSSProperties = {
  padding:'3px 6px', borderRadius:4, border:'1px solid rgba(255,255,255,0.12)',
  background:'rgba(255,255,255,0.06)', color:'#faf9f5', fontSize:12, height:28, boxSizing:'border-box',
};
const tinyBtn: React.CSSProperties = {
  ...ipt, height:22, fontSize:10, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:3,
};

function LeafView({ node, onChange }: { node:ConditionNode; onChange:(n:ConditionNode)=>void }) {
  const t = useT();

  // ─── Bool condition ─────────────────────────────────────────
  if (node.type==='bool') {
    const isCurrentState = node.boolType === 'currentState';
    return (
      <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
        <ToggleLeft size={13} style={{ color:'var(--color-accent-teal)', flexShrink:0 }} />
        <Select
          options={boolTypeKeys.map(bt => ({ value: bt.value, label: bt.label(t) }))}
          value={node.boolType}
          onChange={val => {
            if (val === 'currentState') {
              onChange({ type:'bool', boolType:'currentState', boolValue:'Study', expected: true });
            } else {
              onChange({ type:'bool', boolType: val, expected: true });
            }
          }}
          width={130}
        />
        {isCurrentState && (
          <>
            <span style={{ fontSize:12, color:'var(--color-on-dark-soft)' }}>=</span>
            <Select
              options={sessionTypes.map(st => ({
                value: st,
                label: st==='Study'?t('navStudy'):st==='Hobby'?t('navHobby'):t('navEntertainment'),
              }))}
              value={node.boolValue!}
              onChange={val => onChange({...node, boolValue:val as SessionType})}
              width={100}
            />
          </>
        )}
        <span style={{ fontSize:12, color:'var(--color-on-dark-soft)' }}>=</span>
        <div style={{ display:'flex', gap:2 }}>
          <button onClick={()=>onChange({...node, expected:true})}
            style={{ padding:'2px 10px', borderRadius:4, fontSize:11, cursor:'pointer', height:24,
              border:node.expected?'1.5px solid var(--color-accent-teal)':'1px solid rgba(255,255,255,0.12)',
              background:node.expected?'rgba(93,184,166,0.15)':'transparent',
              color:node.expected?'var(--color-accent-teal)':'#faf9f5', fontWeight:node.expected?600:400 }}>{t('reminderBoolTrue')}</button>
          <button onClick={()=>onChange({...node, expected:false})}
            style={{ padding:'2px 10px', borderRadius:4, fontSize:11, cursor:'pointer', height:24,
              border:!node.expected?'1.5px solid var(--color-accent-teal)':'1px solid rgba(255,255,255,0.12)',
              background:!node.expected?'rgba(93,184,166,0.15)':'transparent',
              color:!node.expected?'var(--color-accent-teal)':'#faf9f5', fontWeight:!node.expected?600:400 }}>{t('reminderBoolFalse')}</button>
        </div>
      </div>
    );
  }

  // ─── Time condition ─────────────────────────────────────────
  if (node.type === 'time') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
        <Clock size={13} style={{ color:'var(--color-accent-teal)', flexShrink:0 }} />
        <Select
          options={[
            { value: 'before', label: t('reminderTimeBefore') },
            { value: 'after', label: t('reminderTimeAfter') },
            { value: 'at', label: t('reminderTimeAt') },
          ]}
          value={node.timeOp}
          onChange={val => onChange({...node, timeOp: val as 'before' | 'after' | 'at'})}
          width={80}
        />
        <input type="time" value={node.timeValue}
          onChange={e => onChange({...node, timeValue: e.target.value})}
          style={{ ...ipt, width: 100, colorScheme:'dark' }}
          className="dark-time-input" />
      </div>
    );
  }

  // ─── NOT condition ──────────────────────────────────────────
  if (node.type === 'not') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
        <Ban size={13} style={{ color:'var(--color-accent-teal)', flexShrink:0 }} />
        <span style={{ fontSize:12, color:'var(--color-accent-teal)', fontWeight:600 }}>{t('reminderNot')}</span>
        <span style={{ fontSize:12, color:'var(--color-on-dark-soft)' }}>(</span>
        <div style={{ flex:1, minWidth:200 }}>
          <BinNode node={node.node} onChange={n=>onChange({...node, node:n})}
            onDelete={()=>{}} />
        </div>
        <span style={{ fontSize:12, color:'var(--color-on-dark-soft)' }}>)</span>
      </div>
    );
  }

  // ─── Leaf condition (metric) ────────────────────────────────
  if (node.type === 'group') return null;
  const u: Unit = (node as any).unit || 's';
  const displayVal = Math.round(node.value / UNIT_MULT[u]);
  const metricOptions = metricKeys.map(m => ({
    value: m,
    label: t(`reminderMetric${m.charAt(0).toUpperCase()}${m.slice(1)}` as any),
  }));
  const operatorOptions = operatorKeys.map(op => ({
    value: op,
    label: t(`reminderOper${op.charAt(0).toUpperCase()}${op.slice(1)}` as any),
  }));
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
      <FileText size={13} style={{ color:'var(--color-accent-teal)', flexShrink:0 }} />
      <Select options={metricOptions} value={node.metric}
        onChange={val => onChange({...node, metric: val as ReminderMetric})} width={140} />
      <Select options={operatorOptions} value={node.operator}
        onChange={val => onChange({...node, operator: val as ReminderOperator})} width={60} />
      <input type="text" inputMode="numeric" value={displayVal}
        onChange={e=>onChange({...node, value:Number(e.target.value)*UNIT_MULT[u]})}
        style={{ ...ipt, width:70 }} />
      <div style={{ display:'flex', gap:2 }}>
        {(['s','m','h'] as Unit[]).map(unit => (
          <button key={unit} onClick={() => {
            const oldV = node.value / UNIT_MULT[u];
            onChange({...node, unit, value: Math.round(oldV * UNIT_MULT[unit])} as any);
          }} style={{ padding:'2px 6px', borderRadius:3, fontSize:10, cursor:'pointer', height:22,
            border: u===unit ? '1.5px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
            background: u===unit ? 'rgba(93,184,166,0.15)' : 'transparent',
            color: u===unit ? 'var(--color-accent-teal)' : '#faf9f5',
          }}>{t(`reminderUnit${unit.toUpperCase()}` as any)}</button>
        ))}
      </div>
    </div>
  );
}

function BinNode({ node, onChange, onDelete, onCycleType, onWrapNot, onAddLeaf }: {
  node:ConditionNode; onChange:(n:ConditionNode)=>void;
  onDelete:()=>void; onCycleType?:()=>void; onWrapNot?:()=>void; onAddLeaf?:()=>void;
}) {
  const t = useT();
  const isSimple = node.type==='leaf' || node.type==='bool' || node.type==='time' || node.type==='not';
  const nextLabel = node.type==='leaf' ? t('reminderBool') : node.type==='bool' ? t('reminderTime') : node.type==='time' ? t('reminderNot') : t('reminderBoolVar');
  return (
    <div style={{ border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'8px 10px', background:'rgba(255,255,255,0.02)' }}>
      {isSimple ? (
        <LeafView node={node} onChange={onChange} />
      ) : (
        <BinTree node={node} onChange={onChange} />
      )}
      <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
        {isSimple && onCycleType && (
          <button onClick={onCycleType} style={{ ...tinyBtn, color:'#faf9f5' }}>
            <Shuffle size={10} />{nextLabel}
          </button>
        )}
        {isSimple && onWrapNot && (
          <button onClick={onWrapNot} style={{ ...tinyBtn, color:'#faf9f5' }}>
            <Ban size={10} />{t('reminderNot')}
          </button>
        )}
        {onAddLeaf && <button onClick={onAddLeaf} style={{ ...tinyBtn }}><Plus size={10} />{t('reminderAddCondition')}</button>}
        <button onClick={onDelete} style={{ ...tinyBtn, color:'var(--color-error)' }}><Trash2 size={10} />{t('reminderDelete')}</button>
      </div>
    </div>
  );
}

function BinTree({ node, onChange }: { node:ConditionNode; onChange:(n:ConditionNode)=>void }) {
  const t = useT(); if (node.type!=='group') return null;
  const nc = node.nodes.length;
  const safe = (nc<1) ? [leaf()] : (nc>2 ? node.nodes.slice(0,2) : node.nodes);
  if (safe.length!==node.nodes.length) onChange(simplifyTree({...node, nodes:safe}));

  const L = safe[0]; const R = safe.length>1 ? safe[1] : null;
  const change = (n: ConditionNode) => onChange(simplifyTree(n));
  const setL = (n:ConditionNode) => change({...node, nodes:[n, ...(R ? [R] : [])]});
  const setR = R ? (n:ConditionNode) => change({...node, nodes:[L, n]}) : undefined;

  const addSibling = (newNode: ConditionNode, side:'L'|'R') => {
    if (!R) change({...node, nodes: side==='L' ? [L, newNode] : [newNode, L]});
    else {
      const sub: ConditionNode = {type:'group', logic:'and', nodes:[newNode, leaf()]};
      change({...node, nodes: side==='L' ? [sub, R] : [L, sub]});
    }
  };

  const wrapNot = (item: ConditionNode) =>
    item.type === 'not' ? item.node : { type:'not', node: item } as ConditionNode;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <BinNode node={L} onChange={setL}
        onDelete={() => change({...node, nodes: R ? [R] : [leaf()]})}
        onCycleType={() => change({...node, nodes:[nextNodeType(L), ...(R ? [R] : [])]})}
        onWrapNot={() => change({...node, nodes:[wrapNot(L), ...(R ? [R] : [])]})}
        onAddLeaf={() => addSibling(leaf(), 'L')} />

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
          onDelete={() => change({...node, nodes:[L]})}
          onCycleType={() => change({...node, nodes:[L, nextNodeType(R)]})}
          onWrapNot={() => change({...node, nodes:[L, wrapNot(R)]})}
          onAddLeaf={() => addSibling(leaf(), 'R')} />
      )}
    </div>
  );
}

function displayTree(node:ConditionNode, t:ReturnType<typeof useT>, wrap=false): string {
  if (node.type==='leaf') {
    const mk = `reminderMetric${node.metric.charAt(0).toUpperCase()}${node.metric.slice(1)}` as any;
    const ok = `reminderOper${node.operator.charAt(0).toUpperCase()}${node.operator.slice(1)}` as any;
    const u: Unit = (node as any).unit || 's';
    const dv = Math.round(node.value / UNIT_MULT[u]);
    return `${t(mk)} ${t(ok)} ${dv}${t(`reminderUnit${u.toUpperCase()}` as any)}`;
  }
  if (node.type==='bool') {
    if (node.boolType === 'currentState') {
      const label = node.boolValue==='Study'?t('navStudy'):node.boolValue==='Hobby'?t('navHobby'):t('navEntertainment');
      return `${t('reminderBoolCurrentState')} = ${label} (${node.expected?t('reminderBoolTrue'):t('reminderBoolFalse')})`;
    }
    const btKey = `reminderBool${node.boolType.charAt(0).toUpperCase()}${node.boolType.slice(1)}` as any;
    return `${t(btKey)} = ${node.expected ? t('reminderBoolTrue') : t('reminderBoolFalse')}`;
  }
  if (node.type==='time') {
    const opLabel = node.timeOp==='before'?t('reminderTimeBefore'):node.timeOp==='after'?t('reminderTimeAfter'):t('reminderTimeAt');
    return `${t('reminderTime')} ${opLabel} ${node.timeValue}`;
  }
  if (node.type==='not') {
    return `${t('reminderNot')}(${displayTree(node.node, t, false)})`;
  }
  const inner = node.nodes.map(n => displayTree(n, t, true)).join(` ${t(node.logic==='and'?'reminderAnd':'reminderOr')} `);
  return wrap ? `(${inner})` : inner;
}

export function ReminderPage() {
  const { state, dispatch } = useAppStore();
  const { reminderRules } = state;
  const t = useT();
  const { showToast } = useToast();
  const [builtinSounds, setBuiltinSounds] = useState<Record<string,string>>({});
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm] = useState<ReminderRule>({id:'',title:'',content:'',conditionTree:grp('and'),urgency:'notification',enabled:true});
  const [deleteId, setDeleteId] = useState<string|null>(null);
  const [dragIndex, setDragIndex] = useState<number|null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number|null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all'|'enabled'|'disabled'>('all');

  const filteredRules = reminderRules.filter(rule => {
    if (filterStatus==='enabled' && !rule.enabled) return false;
    if (filterStatus==='disabled' && rule.enabled) return false;
    if (filterText.trim()) { const l=filterText.toLowerCase(); const mt=rule.title.toLowerCase().includes(l); const mc=(rule.content||'').toLowerCase().includes(l); if (!mt && !mc) return false; }
    return true;
  });

  const handleDragStart = (index:number) => (e:React.DragEvent) => { setDragIndex(index); e.dataTransfer.effectAllowed='move'; (e.target as HTMLElement).style.opacity='0.3'; };
  const handleDragEnd = (e:React.DragEvent) => { setDragIndex(null); setDragOverIndex(null); (e.target as HTMLElement).style.opacity=''; };
  const handleDragOver = (index:number) => (e:React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; setDragOverIndex(index); };
  const handleDrop = (index:number) => (e:React.DragEvent) => {
    e.preventDefault();
    if (dragIndex===null || dragIndex===index) { setDragIndex(null); setDragOverIndex(null); return; }
    const reordered = [...reminderRules];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    window.electronAPI.remindersSave(reordered);
    dispatch({type:'REMINDER_LOAD_RULES', payload:reordered});
    setDragIndex(null); setDragOverIndex(null);
    showToast(t('reminderReordered'),'success');
  };

  useEffect(() => { window.electronAPI.getBuiltinSoundUrls().then(setBuiltinSounds).catch(() => {}); }, []);

  const startAdd = () => { setForm({id:'',title:'',content:'',conditionTree:grp('and'),urgency:'notification',enabled:true}); setEditingId('__new__'); };
  const startEdit = (rule:ReminderRule) => { setForm(JSON.parse(JSON.stringify(rule))); setEditingId(rule.id); };
  const cancelEdit = () => setEditingId(null);
  const saveRule = () => {
    if (!form.title.trim()) return;
    if (editingId==='__new__') { const nr={...form,id:genId()}; dispatch({type:'REMINDER_ADD_RULE',payload:nr}); window.electronAPI.remindersSave([...reminderRules,nr]); showToast(t('reminderSaved'),'success'); }
    else if (editingId) { dispatch({type:'REMINDER_UPDATE_RULE',payload:form}); window.electronAPI.remindersSave(reminderRules.map(r=>r.id===form.id?form:r)); showToast(t('reminderUpdated'),'info'); }
    setEditingId(null);
  };
  const confirmDelete = () => {
    if (!deleteId) return;
    dispatch({type:'REMINDER_DELETE_RULE',payload:deleteId}); window.electronAPI.remindersSave(reminderRules.filter(r=>r.id!==deleteId));
    if (editingId===deleteId) setEditingId(null);
    setDeleteId(null);
    showToast(t('reminderDeleted'),'success');
  };
  const toggleEnabled = (rule:ReminderRule) => {
    const upd={...rule,enabled:!rule.enabled}; dispatch({type:'REMINDER_UPDATE_RULE',payload:upd}); window.electronAPI.remindersSave(reminderRules.map(r=>r.id===rule.id?upd:r));
  };

  return (
    <>
      <h1 className="page-title" style={{color:'#ffffff', fontWeight:700}}><span className="title-icon"><Bell size={24}/></span> {t('reminderPageTitle')}</h1>

      {editingId ? (
        <div className="card" style={{padding:16,marginTop:12}}>
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
            <BinTree node={form.conditionTree} onChange={n=>setForm({...form, conditionTree: n.type==='group' ? n : {type:'group', logic:'and', nodes:[n]}})}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{display:'block',fontSize:12,color:'var(--color-on-dark-soft)',marginBottom:4}}>{t('reminderNotifTypeLabel')}</label>
            <div style={{display:'flex',gap:6}}>{NOTIF_TYPES.map(nt=>(
              <button key={nt} onClick={()=>setForm({...form,urgency:nt})}
                style={{flex:1,padding:'6px 8px',borderRadius:6,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:4,
                  border:form.urgency===nt?`2px solid ${NOTIF_COLORS[nt]}`:'1px solid rgba(255,255,255,0.12)',
                  background:form.urgency===nt?`${NOTIF_COLORS[nt]}22`:'transparent',
                  color:form.urgency===nt?NOTIF_COLORS[nt]:'#faf9f5'}}>
                {React.createElement(NOTIF_LU[nt]||Bell,{size:14})}
                {t(`reminderNotifType${nt.charAt(0).toUpperCase()+nt.slice(1)}` as any)}
              </button>
            ))}</div>
          </div>
          {/* Sound selector */}
          <div style={{marginBottom:12}}>
            <label style={{display:'block',fontSize:12,color:'var(--color-on-dark-soft)',marginBottom:4}}>{t('reminderSoundLabel')}</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button onClick={()=>setForm({...form,sound:''})}
                style={{padding:'4px 10px',borderRadius:4,fontSize:11,cursor:'pointer',height:26,
                  border:!form.sound?'1.5px solid var(--color-accent-teal)':'1px solid rgba(255,255,255,0.12)',
                  background:!form.sound?'rgba(93,184,166,0.15)':'transparent',
                  color:!form.sound?'var(--color-accent-teal)':'#faf9f5',fontFamily:'inherit',fontWeight:!form.sound?600:400,
                }}>{t('reminderSoundNone')}</button>
              {Object.keys(builtinSounds).map(name => (
                <button key={name} onClick={()=>setForm({...form,sound:`builtin:${name}`})}
                  style={{padding:'4px 10px',borderRadius:4,fontSize:11,cursor:'pointer',height:26,
                    border:form.sound===`builtin:${name}`?'1.5px solid var(--color-accent-teal)':'1px solid rgba(255,255,255,0.12)',
                    background:form.sound===`builtin:${name}`?'rgba(93,184,166,0.15)':'transparent',
                    color:form.sound===`builtin:${name}`?'var(--color-accent-teal)':'#faf9f5',
                    fontFamily:'inherit',fontWeight:form.sound===`builtin:${name}`?600:400,textTransform:'capitalize',
                  }}>{name}</button>
              ))}
              <button onClick={async()=>{const p=await window.electronAPI.selectAudioFile();if(p){const d=await window.electronAPI.readAudioFile(p);if(d){setForm({...form,sound:`file:${d}`});showToast(t('reminderSoundSelected'),'success');}}}}
                style={{padding:'4px 10px',borderRadius:4,fontSize:11,cursor:'pointer',height:26,
                  border:form.sound?.startsWith('file:')?'1.5px solid var(--color-accent-teal)':'1px solid rgba(255,255,255,0.12)',
                  background:form.sound?.startsWith('file:')?'rgba(93,184,166,0.15)':'transparent',
                  color:form.sound?.startsWith('file:')?'var(--color-accent-teal)':'#faf9f5',
                  fontFamily:'inherit',fontWeight:form.sound?.startsWith('file:')?600:400,
                }}>{form.sound?.startsWith('file:')?t('reminderSoundCustomSelected'):t('reminderSoundCustom')}</button>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-primary" style={{height:28,fontSize:12,padding:'4px 14px'}} onClick={saveRule}>{t('reminderConfirm')}</button>
            <button className="btn btn-secondary" style={{height:28,fontSize:12,padding:'4px 14px'}} onClick={cancelEdit}>{t('reminderCancel')}</button>
          </div>
        </div>
      ) : (
        <>
          <button className="btn btn-primary btn-full" onClick={startAdd}>+ {t('reminderAdd')}</button>

          {/* Search & Filter */}
          <div style={{marginTop:12,marginBottom:8}}>
            <div style={{position:'relative',marginBottom:6}}>
              <Search size={14} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--color-on-dark-soft)'}} />
              <input type="text" value={filterText} onChange={e=>setFilterText(e.target.value)} placeholder={t('reminderSearchPlaceholder')}
                style={{width:'100%',height:30,padding:'4px 8px 4px 28px',borderRadius:6,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'#faf9f5',fontSize:12,fontFamily:'inherit',outline:'none'}} />
            </div>
            <div style={{display:'flex',gap:4}}>
              {(['all','enabled','disabled'] as const).map(status => (
                <button key={status} onClick={()=>setFilterStatus(status)}
                  style={{padding:'3px 10px',borderRadius:4,fontSize:11,cursor:'pointer',height:24,
                    border:filterStatus===status?'1.5px solid var(--color-accent-teal)':'1px solid rgba(255,255,255,0.12)',
                    background:filterStatus===status?'rgba(93,184,166,0.15)':'transparent',
                    color:filterStatus===status?'var(--color-accent-teal)':'#faf9f5',
                    fontFamily:'inherit',fontWeight:filterStatus===status?600:400,
                  }}>{t(status==='all'?'reminderFilterAll':status==='enabled'?'reminderEnabled':'reminderDisabled')}</button>
              ))}
            </div>
          </div>

          {filteredRules.length===0
            ? <div className="empty-hint" style={{marginTop:32}}>{t('reminderNoRules')}</div>
            : <div style={{marginTop:4,columnCount:2,columnGap:6}}>{filteredRules.map((rule, index)=>(
                <div key={rule.id} className="card reminder-card" draggable={!editingId} onDragStart={handleDragStart(index)} onDragEnd={handleDragEnd} onDragOver={handleDragOver(index)} onDrop={handleDrop(index)} style={{padding:'10px 12px',margin:'0 0 6px',breakInside:'avoid',opacity:dragIndex===index?0.3:(rule.enabled?1:0.55),filter:rule.enabled?'none':'grayscale(0.65)',border:dragOverIndex===index?'2px dashed var(--color-accent-teal)':undefined}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:rule.content?4:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0,flex:1}}>
                      <div style={{width:3,height:20,borderRadius:2,background:NOTIF_COLORS[rule.urgency]||'#e8a55a',flexShrink:0}}/>
                      <span style={{fontWeight:600,fontSize:13,color:'#ffffff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{rule.title}</span>
                      <span style={{fontSize:9,color:NOTIF_COLORS[rule.urgency]||'#888',background:(NOTIF_COLORS[rule.urgency]||'#888')+'22',padding:'1px 5px',borderRadius:3,flexShrink:0}}>
                        {t(`reminderNotifType${rule.urgency.charAt(0).toUpperCase()+rule.urgency.slice(1)}` as any)||rule.urgency}
                      </span>
                    </div>
                    <button onClick={()=>toggleEnabled(rule)}
                      style={{flexShrink:0,padding:'2px 10px',height:24,fontSize:11,borderRadius:4,cursor:'pointer',
                        border:rule.enabled?'1.5px solid var(--color-accent-teal)':'1px solid rgba(255,255,255,0.12)',
                        background:rule.enabled?'rgba(93,184,166,0.15)':'transparent',
                        color:rule.enabled?'var(--color-accent-teal)':'var(--color-on-dark-soft)',
                        fontWeight:rule.enabled?600:400}}>{rule.enabled?t('reminderEnabled'):t('reminderDisabled')}</button>
                  </div>
                  {rule.content && <div style={{fontSize:11,color:'var(--color-on-dark-soft)',marginBottom:4,lineHeight:1.4}}>{rule.content}</div>}
                  <div style={{marginTop:6,display:'flex',gap:6}}>
                    <button className="btn btn-secondary" style={{padding:'4px 10px',height:26,fontSize:11}} onClick={()=>startEdit(rule)}>{t('reminderEdit')}</button>
                    <button className="btn btn-danger" style={{padding:'4px 10px',height:26,fontSize:11}} onClick={()=>setDeleteId(rule.id)}>{t('reminderDelete')}</button>
                  </div>
                </div>
            ))}</div>}
        </>
      )}

      <ConfirmDialog open={!!deleteId} title={t('reminderDeleteConfirm')} message=""
        confirmLabel={t('reminderConfirm')} cancelLabel={t('cancelLabel')}
        onConfirm={confirmDelete} onCancel={()=>setDeleteId(null)} danger />
    </>
  );
}
