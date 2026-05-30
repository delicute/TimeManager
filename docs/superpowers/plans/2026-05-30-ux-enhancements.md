# UX Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 7 UX improvements: toast notifications, page animations, record page loading/scroll, drag-reorder reminders, search/filter reminders, reminder toggle i18n, and reminder sound settings.

**Architecture:** React Context for toast system, CSS animations for page transitions, native HTML5 Drag & Drop for reordering, Electron IPC for sound file reading.

**Tech Stack:** Electron 28+, React 18, TypeScript, CSS3, HTML5 Drag & Drop API

**Plan file:** `docs/superpowers/plans/2026-05-30-ux-enhancements.md`

---

### Task 1: Toast Notification System

**Files:**
- Create: `src/components/Toast.tsx`
- Create: `src/hooks/useToast.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1.1: Create useToast hook + ToastProvider**

Write `src/hooks/useToast.ts`:
```tsx
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  showToast: () => {},
  dismissToast: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++counterRef.current}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => dismissToast(id), 2500);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      {/* Toast container rendered here at the portal level */}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
```

- [ ] **Step 1.2: Create Toast component**

Write `src/components/Toast.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useToast, type ToastItem } from '../hooks/useToast';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ICONS: Record<string, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const COLORS: Record<string, string> = {
  success: 'var(--color-success, #5db872)',
  error: 'var(--color-error, #c64545)',
  info: 'var(--color-on-dark-soft, #a09d96)',
};

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    return () => setVisible(false);
  }, []);

  const Icon = ICONS[item.type] || Info;

  return (
    <div
      onClick={onDismiss}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--color-surface-dark-elevated, #252320)',
        border: `1.5px solid ${COLORS[item.type] || COLORS.info}`,
        borderRadius: 8, padding: '10px 14px',
        minWidth: 240, maxWidth: 360,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-12px)',
        transition: 'opacity 220ms ease-out, transform 220ms ease-out',
        pointerEvents: 'auto',
      }}
    >
      <Icon size={16} style={{ color: COLORS[item.type], flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: '#faf9f5', lineHeight: 1.4 }}>{item.message}</span>
      <X size={14} style={{ color: 'var(--color-on-dark-soft)', flexShrink: 0, opacity: 0.6 }} />
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 9999, pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <ToastItemView key={t.id} item={t} onDismiss={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}
```

Note: The container uses `position: absolute` relative to `.content-area` (which has `position: relative` or will have it added). We'll use `.content-area` as the positioning reference and place the ToastContainer there.

- [ ] **Step 1.3: Integrate ToastProvider and ToastContainer into App.tsx**

Add imports at top:
```tsx
import { ToastProvider } from './hooks/useToast';
import { ToastContainer } from './components/Toast';
```

Wrap the content area (change lines 127-131):
```tsx
<main className="content-area">
  <ToastProvider>
    <div className="content-inner" key={currentPage}>
      {renderPage()}
    </div>
    <ToastContainer />
  </ToastProvider>
</main>
```

Also add `position: relative` to `.content-area` in global.css so the absolute-positioned ToastContainer anchors correctly:
```css
.content-area {
  position: relative;
  /* ...existing properties... */
}
```

- [ ] **Step 1.4: Add toast calls to key save operations**

In `ReminderPage.tsx`, add import:
```tsx
import { useToast } from '../hooks/useToast';
```

Add inside ReminderPage function:
```tsx
const { showToast } = useToast();
```

Update `saveRule()` to show toast:
```tsx
const saveRule = () => {
  if (!form.title.trim()) return;
  if (editingId==='__new__') {
    const nr={...form,id:genId()};
    dispatch({type:'REMINDER_ADD_RULE',payload:nr});
    window.electronAPI.remindersSave([...reminderRules,nr]);
    showToast(t('reminderSaved'), 'success');
  } else if (editingId) {
    dispatch({type:'REMINDER_UPDATE_RULE',payload:form});
    window.electronAPI.remindersSave(reminderRules.map(r=>r.id===form.id?form:r));
    showToast(t('reminderUpdated'), 'success');
  }
  setEditingId(null);
};
```

Update `confirmDelete()`:
```tsx
const confirmDelete = () => {
  if (!deleteId) return;
  dispatch({type:'REMINDER_DELETE_RULE',payload:deleteId});
  window.electronAPI.remindersSave(reminderRules.filter(r=>r.id!==deleteId));
  if (editingId===deleteId) setEditingId(null);
  setDeleteId(null);
  showToast(t('reminderDeleted'), 'success');
};
```

In `SettingsPage.tsx`, add import:
```tsx
import { useToast } from '../hooks/useToast';
```

Add inside SettingsPage:
```tsx
const { showToast } = useToast();
```

Add toast to `updateSetting`:
```tsx
const updateSetting = (partial: Partial<typeof s>) => {
  const updated = { ...s, ...partial };
  dispatch({ type: 'SET_SETTINGS', payload: updated });
  window.electronAPI.saveSettings(updated);
  showToast(t('settingsSaved'), 'success');
};
```

Add i18n keys for toast messages in `src/i18n/types.ts`:
```tsx
reminderSaved: string;
reminderUpdated: string;
reminderDeleted: string;
settingsSaved: string;
```

Add zh translations in `src/i18n/zh.ts`:
```tsx
reminderSaved: '提醒已保存',
reminderUpdated: '提醒已更新',
reminderDeleted: '提醒已删除',
settingsSaved: '设置已保存',
```

Add en translations in `src/i18n/en.ts`:
```tsx
reminderSaved: 'Reminder saved',
reminderUpdated: 'Reminder updated',
reminderDeleted: 'Reminder deleted',
settingsSaved: 'Settings saved',
```

- [ ] **Step 1.5: Commit**

```bash
git add src/components/Toast.tsx src/hooks/useToast.ts src/App.tsx src/styles/global.css src/pages/ReminderPage.tsx src/pages/SettingsPage.tsx src/i18n/types.ts src/i18n/zh.ts src/i18n/en.ts
git commit -m "feat: add toast notification system"
```

---

### Task 2: Page Animations & Micro-interactions (CSS)

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 2.1: Add fade-up keyframes and content-inner animation**

Add to `src/styles/global.css`:
```css
/* ── Page Transitions ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.content-inner {
  animation: fadeUp 250ms ease-out;
}
```

- [ ] **Step 2.2: Add button press micro-interaction**

```css
/* ── Button Press ── */
.btn:active {
  transform: scale(0.97);
}
```

- [ ] **Step 2.3: Add card hover elevation**

```css
/* ── Card Hover ── */
.card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.card {
  transition: box-shadow 0.2s ease;
}
```

- [ ] **Step 2.4: Add reminder list staggered entry**

Add to global.css:
```css
/* ── Reminder Card Entry Animation ── */
.reminder-card {
  animation: fadeUp 300ms ease-out both;
}

.reminder-card:nth-child(1) { animation-delay: 0ms; }
.reminder-card:nth-child(2) { animation-delay: 40ms; }
.reminder-card:nth-child(3) { animation-delay: 80ms; }
.reminder-card:nth-child(4) { animation-delay: 120ms; }
.reminder-card:nth-child(5) { animation-delay: 160ms; }
.reminder-card:nth-child(6) { animation-delay: 200ms; }
.reminder-card:nth-child(7) { animation-delay: 240ms; }
.reminder-card:nth-child(8) { animation-delay: 280ms; }
```

Add `className="reminder-card"` to the card div in ReminderPage.tsx (the map returns a div with `key={rule.id}` and `className="card"` — change to `className="card reminder-card"`).

- [ ] **Step 2.5: Add content-area `position: relative`** (needed for ToastContainer anchoring)

Add to the `.content-area` block:
```css
.content-area {
  position: relative;
  /* ...existing... */
}
```

- [ ] **Step 2.6: Add key prop to trigger re-animation on page change**

In `App.tsx`, add `key={currentPage}` to the content-inner div:
```tsx
<div className="content-inner" key={currentPage}>
  {renderPage()}
</div>
```

(This was already added in Task 1 step 3 — just confirm it's present.)

- [ ] **Step 2.7: Commit**

```bash
git add src/styles/global.css src/pages/ReminderPage.tsx src/App.tsx
git commit -m "feat: add page animations, button press effect, card hover, reminder entry stagger"
```

---

### Task 3: Reminder Toggle i18n

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/zh.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/pages/ReminderPage.tsx`

- [ ] **Step 3.1: Add i18n keys**

In `src/i18n/types.ts`, add:
```tsx
reminderEnabled: string;
reminderDisabled: string;
```

In `src/i18n/zh.ts`:
```tsx
reminderEnabled: '开',
reminderDisabled: '关',
```

In `src/i18n/en.ts`:
```tsx
reminderEnabled: 'On',
reminderDisabled: 'Off',
```

- [ ] **Step 3.2: Replace hardcoded 开/关 in ReminderPage.tsx**

Find the toggle button in the reminder card (inside the map's card):
```tsx
{rule.enabled?'开':'关'}
```

Replace with:
```tsx
{rule.enabled ? t('reminderEnabled') : t('reminderDisabled')}
```

- [ ] **Step 3.3: Commit**

```bash
git add src/i18n/types.ts src/i18n/zh.ts src/i18n/en.ts src/pages/ReminderPage.tsx
git commit -m "i18n: add reminder enabled/disabled translations"
```

---

### Task 4: Record Page Loading State + Scroll

**Files:**
- Modify: `src/pages/RecordPage.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 4.1: Add loading state and spinner**

In `RecordPage.tsx`, add loading state alongside existing hooks:
```tsx
const [loadingLogs, setLoadingLogs] = useState(false);
```

Update the `useEffect` that loads logs:
```tsx
useEffect(() => {
  async function load() {
    setLoadingLogs(true);
    try {
      if (preset === 'today') { setLogs(state.todayLogs); return; }
      // ... rest of existing load logic ...
    } finally {
      setLoadingLogs(false);
    }
  }
  load();
}, [preset, customFrom, customTo, state.todayLogs]);
```

Show loading spinner above timeline when loading:
```tsx
{loadingLogs ? (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'20px 0' }}>
    <div className="loading-spinner" />
    <span style={{ fontSize:12, color:'var(--color-on-dark-soft)' }}>{t('recordLoading')}</span>
  </div>
) : (
  <>
    {/* Timeline content */}
  </>
)}
```

Add i18n key `recordLoading: string` to types.ts, zh.ts (`'加载中...'`), en.ts (`'Loading...'`).

- [ ] **Step 4.2: Add loading spinner CSS**

In `global.css`:
```css
/* ── Loading Spinner ── */
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.1);
  border-top-color: var(--color-accent-teal);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 4.3: Add scroll-to-top button**

In `RecordPage.tsx`, add state:
```tsx
const [showScrollTop, setShowScrollTop] = useState(false);
```

Add scroll listener effect:
```tsx
useEffect(() => {
  const container = document.querySelector('.content-area');
  if (!container) return;
  const handleScroll = () => {
    setShowScrollTop(container.scrollTop > 300);
  };
  container.addEventListener('scroll', handleScroll);
  return () => container.removeEventListener('scroll', handleScroll);
}, []);
```

Add scroll-to-top button below the timeline section, visible only when `timeline.length > 15` and `showScrollTop`:
```tsx
{timeline.length > 15 && showScrollTop && (
  <button
    onClick={() => document.querySelector('.content-area')?.scrollTo({ top: 0, behavior: 'smooth' })}
    style={{
      position: 'sticky', bottom: 16, left: '100%',
      width: 36, height: 36, borderRadius: '50%',
      background: 'var(--color-surface-dark-elevated)',
      border: '1px solid rgba(255,255,255,0.12)',
      color: '#faf9f5', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      zIndex: 10, marginLeft: 'auto',
    }}
  >
    ↑
  </button>
)}
```

Place this button right after the timeline-card closing div but before the closing fragment.

- [ ] **Step 4.4: Commit**

```bash
git add src/pages/RecordPage.tsx src/styles/global.css src/i18n/types.ts src/i18n/zh.ts src/i18n/en.ts
git commit -m "feat: add record page loading spinner and scroll-to-top button"
```

---

### Task 5: Drag Reorder Reminders

**Files:**
- Modify: `src/pages/ReminderPage.tsx`

- [ ] **Step 5.1: Add drag state and handlers in ReminderPage**

Add state inside `ReminderPage()`:
```tsx
const [dragIndex, setDragIndex] = useState<number | null>(null);
const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
```

Create drag handlers as local functions inside `ReminderPage()`:
```tsx
const handleDragStart = (index: number) => (e: React.DragEvent) => {
  setDragIndex(index);
  e.dataTransfer.effectAllowed = 'move';
  // Make the dragged element semi-transparent
  (e.target as HTMLElement).style.opacity = '0.4';
};

const handleDragEnd = (e: React.DragEvent) => {
  setDragIndex(null);
  setDragOverIndex(null);
  (e.target as HTMLElement).style.opacity = '';
};

const handleDragOver = (index: number) => (e: React.DragEvent) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  setDragOverIndex(index);
};

const handleDrop = (index: number) => (e: React.DragEvent) => {
  e.preventDefault();
  if (dragIndex === null || dragIndex === index) {
    setDragIndex(null);
    setDragOverIndex(null);
    return;
  }

  const reordered = [...reminderRules];
  const [moved] = reordered.splice(dragIndex, 1);
  reordered.splice(index, 0, moved);

  // Persist
  window.electronAPI.remindersSave(reordered);
  // Update via REMINDER_LOAD_RULES (replaces entire rules array)
  dispatch({ type: 'REMINDER_LOAD_RULES', payload: reordered });

  setDragIndex(null);
  setDragOverIndex(null);
  showToast(t('reminderReordered'), 'success');
};
```

- [ ] **Step 5.2: Add draggable attributes to reminder cards**

Change the card div in the map to include drag handlers and conditional styles:
```tsx
{reminderRules.map((rule, index) => (
  <div key={rule.id}
    className="card reminder-card"
    draggable={!editingId}
    onDragStart={handleDragStart(index)}
    onDragEnd={handleDragEnd}
    onDragOver={handleDragOver(index)}
    onDrop={handleDrop(index)}
    style={{
      padding:'10px 12px', margin:'0 0 6px', breakInside:'avoid',
      opacity:rule.enabled?1:0.5,
      border: dragOverIndex === index ? '2px dashed var(--color-accent-teal)' : undefined,
      ...(dragIndex === index ? { opacity: 0.4 } : {}),
    }}
  >
    {/* ...existing card content... */}
  </div>
))}
```

Note: The original inline style object already has `opacity: rule.enabled ? 1 : 0.5`. The new drag styles need to be merged carefully. Replace the existing style with:
```tsx
style={{
  padding:'10px 12px', margin:'0 0 6px', breakInside:'avoid',
  opacity: dragIndex === index ? 0.4 : (rule.enabled ? 1 : 0.5),
  border: dragOverIndex === index ? '2px dashed var(--color-accent-teal)' : undefined,
}}
```

- [ ] **Step 5.3: Add i18n key**

Add to i18n types, zh, en:
```tsx
reminderReordered: string; // '提醒已排序' / 'Reminders reordered'
```

- [ ] **Step 5.4: Commit**

```bash
git add src/pages/ReminderPage.tsx src/i18n/types.ts src/i18n/zh.ts src/i18n/en.ts
git commit -m "feat: add drag-and-drop reminder reordering"
```

---

### Task 6: Search/Filter Reminders

**Files:**
- Modify: `src/pages/ReminderPage.tsx`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/zh.ts`
- Modify: `src/i18n/en.ts`

- [ ] **Step 6.1: Add filter state and search input UI**

Add state inside `ReminderPage()`:
```tsx
const [filterText, setFilterText] = useState('');
const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
```

Add filter bar above the reminder list (after the "+ 添加提醒" button and before the rules map):
```tsx
<div style={{ marginTop: 12, marginBottom: 8 }}>
  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
    <div style={{ position: 'relative', flex: 1 }}>
      <Search size={14} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--color-on-dark-soft)' }} />
      <input
        type="text"
        value={filterText}
        onChange={e => setFilterText(e.target.value)}
        placeholder={t('reminderSearchPlaceholder')}
        style={{
          width: '100%', height: 30, padding: '4px 8px 4px 28px',
          borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.06)', color: '#faf9f5',
          fontSize: 12, fontFamily: 'inherit', outline: 'none',
        }}
      />
    </div>
  </div>
  <div style={{ display: 'flex', gap: 4 }}>
    {(['all', 'enabled', 'disabled'] as const).map(status => (
      <button key={status} onClick={() => setFilterStatus(status)}
        style={{
          padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', height: 24,
          border: filterStatus === status ? '1.5px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
          background: filterStatus === status ? 'rgba(93,184,166,0.15)' : 'transparent',
          color: filterStatus === status ? 'var(--color-accent-teal)' : '#faf9f5',
          fontFamily: 'inherit', fontWeight: filterStatus === status ? 600 : 400,
        }}
      >
        {t(status === 'all' ? 'reminderFilterAll' : status === 'enabled' ? 'reminderEnabled' : 'reminderDisabled')}
      </button>
    ))}
  </div>
</div>
```

Add `Search` to the lucide-react import at the top:
```tsx
import { Bell, AlertTriangle, MessageCircle, Plus, Trash2, FileText, Shuffle, ToggleLeft, Search } from 'lucide-react';
```

- [ ] **Step 6.2: Apply filters to reminder list**

Before the map, compute filtered list:
```tsx
const filteredRules = reminderRules.filter(rule => {
  if (filterStatus === 'enabled' && !rule.enabled) return false;
  if (filterStatus === 'disabled' && rule.enabled) return false;
  if (filterText.trim()) {
    const lower = filterText.toLowerCase();
    const matchTitle = rule.title.toLowerCase().includes(lower);
    const matchContent = (rule.content || '').toLowerCase().includes(lower);
    if (!matchTitle && !matchContent) return false;
  }
  return true;
});
```

Change the map to use `filteredRules` instead of `reminderRules`:
```tsx
{filteredRules.map((rule, index) => (
```

- [ ] **Step 6.3: Add i18n keys**

```tsx
// types.ts
reminderSearchPlaceholder: string;
reminderFilterAll: string;

// zh.ts
reminderSearchPlaceholder: '搜索提醒…',
reminderFilterAll: '全部',

// en.ts
reminderSearchPlaceholder: 'Search reminders…',
reminderFilterAll: 'All',
```

- [ ] **Step 6.4: Commit**

```bash
git add src/pages/ReminderPage.tsx src/i18n/types.ts src/i18n/zh.ts src/i18n/en.ts
git commit -m "feat: add reminder search and filter by enabled/disabled status"
```

---

### Task 7: Reminder Sound Settings

**Files:**
- Modify: `src/types.ts`
- Modify: `src/pages/ReminderPage.tsx`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/zh.ts`
- Modify: `src/i18n/en.ts`

- [ ] **Step 7.1: Add sound field to ReminderRule type**

In `src/types.ts`, add to `ReminderRule`:
```tsx
export interface ReminderRule {
  // ...existing fields...
  sound?: string; // '' = none, 'builtin:beep', 'builtin:completion', 'file:base64,<dataUrl>'
}
```

- [ ] **Step 7.2: Add IPC handlers in electron/main.ts**

Add two new IPC handlers before the final closing brace of `setupIPC()`:
```typescript
// Read and return built-in audio files as base64 data URLs
ipcMain.handle('audio:getBuiltinUrls', () => {
  const result: Record<string, string> = {};
  const audioDir = getAssetPath('assets/audio');
  try {
    if (fs.existsSync(audioDir)) {
      const files = fs.readdirSync(audioDir);
      for (const file of files) {
        if (file.endsWith('.wav') || file.endsWith('.mp3') || file.endsWith('.ogg')) {
          const name = path.parse(file).name;
          const buf = fs.readFileSync(path.join(audioDir, file));
          const ext = path.extname(file).slice(1);
          result[name] = `data:audio/${ext};base64,${buf.toString('base64')}`;
        }
      }
    }
  } catch { /* ignore */ }
  return result;
});

// Read a custom audio file and return as base64 data URL
ipcMain.handle('audio:readFile', async (_, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mime = ext === 'mp3' ? 'mpeg' : ext === 'ogg' ? 'ogg' : 'wav';
      return `data:audio/${mime};base64,${buf.toString('base64')}`;
    }
  } catch { /* ignore */ }
  return null;
});

// File dialog for selecting custom audio
ipcMain.handle('dialog:selectAudioFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg'] },
    ],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});
```

- [ ] **Step 7.3: Add preload API for sound**

In `electron/preload.ts`, add:
```tsx
// Audio
getBuiltinSoundUrls: () => ipcRenderer.invoke('audio:getBuiltinUrls'),
readAudioFile: (filePath: string) => ipcRenderer.invoke('audio:readFile', filePath),
selectAudioFile: () => ipcRenderer.invoke('dialog:selectAudioFile'),
```

Add to the `Window.electronAPI` type in `src/types.ts` if not already present:
```tsx
getBuiltinSoundUrls: () => Promise<Record<string, string>>;
readAudioFile: (filePath: string) => Promise<string | null>;
selectAudioFile: () => Promise<string | null>;
```

- [ ] **Step 7.4: Add sound selector UI to reminder edit form**

In `ReminderPage.tsx`, add state for sound data URLs:
```tsx
const [builtinSounds, setBuiltinSounds] = useState<Record<string, string>>({});
```

Load built-in sounds on mount:
```tsx
useEffect(() => {
  window.electronAPI.getBuiltinSoundUrls().then(setBuiltinSounds).catch(() => {});
}, []);
```

Add a sound selection row in the form (after the urgency selector, before the buttons):
```tsx
<div style={{ marginBottom: 12 }}>
  <label style={{ display: 'block', fontSize: 12, color: 'var(--color-on-dark-soft)', marginBottom: 4 }}>{t('reminderSoundLabel')}</label>
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    {/* None */}
    <button onClick={() => setForm({...form, sound: ''})}
      style={{
        padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', height: 26,
        border: !form.sound ? '1.5px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
        background: !form.sound ? 'rgba(93,184,166,0.15)' : 'transparent',
        color: !form.sound ? 'var(--color-accent-teal)' : '#faf9f5',
        fontFamily: 'inherit', fontWeight: !form.sound ? 600 : 400,
      }}
    >{t('reminderSoundNone')}</button>
    {/* Built-in sounds */}
    {Object.keys(builtinSounds).map(name => (
      <button key={name} onClick={() => setForm({...form, sound: `builtin:${name}`})}
        style={{
          padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', height: 26,
          border: form.sound === `builtin:${name}` ? '1.5px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
          background: form.sound === `builtin:${name}` ? 'rgba(93,184,166,0.15)' : 'transparent',
          color: form.sound === `builtin:${name}` ? 'var(--color-accent-teal)' : '#faf9f5',
          fontFamily: 'inherit', fontWeight: form.sound === `builtin:${name}` ? 600 : 400,
          textTransform: 'capitalize',
        }}
      >{name}</button>
    ))}
    {/* Custom file */}
    <button onClick={async () => {
        const path = await window.electronAPI.selectAudioFile();
        if (path) {
          const dataUrl = await window.electronAPI.readAudioFile(path);
          if (dataUrl) {
            setForm({...form, sound: `file:${dataUrl}`});
            showToast(t('reminderSoundSelected'), 'success');
          }
        }
      }}
      style={{
        padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', height: 26,
        border: form.sound?.startsWith('file:') ? '1.5px solid var(--color-accent-teal)' : '1px solid rgba(255,255,255,0.12)',
        background: form.sound?.startsWith('file:') ? 'rgba(93,184,166,0.15)' : 'transparent',
        color: form.sound?.startsWith('file:') ? 'var(--color-accent-teal)' : '#faf9f5',
        fontFamily: 'inherit', fontWeight: form.sound?.startsWith('file:') ? 600 : 400,
      }}
    >{form.sound?.startsWith('file:') ? t('reminderSoundCustomSelected') : t('reminderSoundCustom')}</button>
  </div>
</div>
```

- [ ] **Step 7.5: Play sound when reminder toast appears**

Find where `reminderShowToast` is called (the code that triggers the reminder notification). In the main process, the `showReminderToast` function in `electron/main.ts` currently plays hardcoded `beep.wav`. Update it to use the rule's sound setting.

In `electron/main.ts`, update `showReminderToast` to read the rule's sound config:

Find the line:
```typescript
let beepDataUrl = '';
try {
  const audioPath = getAssetPath('assets/audio/beep.wav');
  if (fs.existsSync(audioPath)) {
    const buf = fs.readFileSync(audioPath);
    beepDataUrl = `data:audio/wav;base64,${buf.toString('base64')}`;
  }
} catch { /* ignore */ }
```

Replace with:
```typescript
let audioDataUrl = '';
const soundSetting = rule.sound || '';
if (soundSetting.startsWith('builtin:')) {
  const name = soundSetting.slice(8); // 'builtin:beep' → 'beep'
  const audioPath = getAssetPath(`assets/audio/${name}.wav`);
  try {
    if (fs.existsSync(audioPath)) {
      const buf = fs.readFileSync(audioPath);
      audioDataUrl = `data:audio/wav;base64,${buf.toString('base64')}`;
    }
  } catch { /* ignore */ }
} else if (soundSetting.startsWith('file:')) {
  audioDataUrl = soundSetting.slice(5); // already a data URL
}
```

Then replace `beepDataUrl` references in the HTML generation with `audioDataUrl`:
```typescript
const html = generateToastHtml(rule, audioDataUrl);
```

- [ ] **Step 7.6: Add i18n keys for sound**

```tsx
// types.ts
reminderSoundLabel: string;
reminderSoundNone: string;
reminderSoundCustom: string;
reminderSoundCustomSelected: string;
reminderSoundSelected: string;

// zh.ts
reminderSoundLabel: '提醒音效',
reminderSoundNone: '无',
reminderSoundCustom: '选择文件…',
reminderSoundCustomSelected: '自定义',
reminderSoundSelected: '音效已选择',

// en.ts
reminderSoundLabel: 'Sound',
reminderSoundNone: 'None',
reminderSoundCustom: 'Browse…',
reminderSoundCustomSelected: 'Custom',
reminderSoundSelected: 'Sound selected',
```

- [ ] **Step 7.7: Commit**

```bash
git add src/types.ts src/pages/ReminderPage.tsx electron/main.ts electron/preload.ts src/i18n/types.ts src/i18n/zh.ts src/i18n/en.ts
git commit -m "feat: add reminder sound settings (built-in, custom file, or none)"
```

---

## Implementation Order

The tasks should be implemented in this order as a practical sequence (each builds on files modified by the previous):

1. **Task 3** — Reminder Toggle i18n (small, independent)
2. **Task 1** — Toast System (new context + component)
3. **Task 2** — Page Animations (CSS + minor JSX)
4. **Task 4** — Record Page Loading + Scroll (independent page change)
5. **Task 5** — Drag Reorder Reminders (relies on ReminderPage from Task 1, 3)
6. **Task 6** — Search/Filter Reminders (relies on ReminderPage from Task 1, 3, 5)
7. **Task 7** — Sound Settings (relies on ReminderPage + main.ts + preload.ts)

Each task compiles independently and can be tested after completion.

## Self-Review Checklist

- [x] **Spec coverage:** All 7 features from design doc are covered
- [x] **Placeholder scan:** No TBDs, TODOs, or "implement later" patterns
- [x] **Type consistency:** All function signatures, prop names, and i18n keys consistent across tasks
- [x] **No scope creep:** Each task is focused on its specific feature
