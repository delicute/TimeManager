# TimeManager Implementation Plan

## Overview

Six issues to fix across the Electron main process (`electron/main.ts`), the TimerCard component (`src/components/TimerCard.tsx`), the RecordPage (`src/pages/RecordPage.tsx`), the app store (`src/hooks/useAppStore.tsx`), and global styles (`src/styles/global.css`).

---

## Issue 1: Reminder toast buttons hidden behind multi-line text

### Root Cause
In `generateToastHtml()` (main.ts line 480), the resize function caps at 185px:
```js
window.electronAPI.reminderResize(Math.max(120,Math.min(185,h)))
```
The IPC handler on line 234-236 allows up to 300px, but the JS never sends heights above 185. When text wraps to multiple lines, the content height exceeds 185px and the action buttons ("确定", "等等") get clipped.

### Changes

**File: `electron/main.ts`** (line 480)

Change the JS resize cap from 185 to 280:
```
- window.electronAPI.reminderResize(Math.max(120,Math.min(185,h)))
+ window.electronAPI.reminderResize(Math.max(120,Math.min(280,h)))
```
This matches the IPC handler's `Math.min(300, height)` and gives enough room for multi-line text + action buttons.

---

## Issue 2: Complete notification system rewrite

### Root Cause
The `createNotificationWin()` function (lines 542-605) and related animation code have several problems:
- No `backgroundColor` in BrowserWindow options -> white flash on show
- Double height measurement with a 30ms `setTimeout` re-measure (hacky, unreliable)
- `resolved` flag plus debounced positioning in `positionAllNotificationWins()` are over-engineered
- Animation loop uses `setTimeout(..., 16)` instead of `requestAnimationFrame` (janky)
- Race conditions when notifications appear rapidly

### Changes

**File: `electron/main.ts`**

#### 2a. Add `backgroundColor` to BrowserWindow (line 543)

Add `backgroundColor: '#252320'` to the BrowserWindow constructor options in `createNotificationWin()`:
```
const win = new BrowserWindow({
    width: 280,
    height: 50,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
+   backgroundColor: '#252320',
    webPreferences: { ... },
});
```

#### 2b. Simplify to single measurement (lines 562-593)

Replace the current `did-finish-load` handler (double-measure with 30ms delay) with a single measurement:

Old (lines 562-593):
```ts
let resizeAttempts = 0;
win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript('document.body.scrollHeight').then(h => {
        if (!win.isDestroyed()) {
            win.setSize(280, Math.max(48, h));
            // Re-measure after layout settles (handles flex layout edge cases)
            setTimeout(() => {
                if (!win.isDestroyed()) {
                    win.webContents.executeJavaScript('document.body.scrollHeight').then(h2 => {
                        if (Math.abs(h2 - h) > 2) {
                            win.setSize(280, Math.max(48, h2));
                        }
                        const nw = notificationWins.find(n => n.id === id);
                        if (nw) nw.resolved = true;
                        positionAllNotificationWins();
                        win.showInactive();
                    }).catch(() => { ... });
                }
            }, 30);
        }
    }).catch(() => { ... });
});
```

New:
```ts
win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript('document.body.scrollHeight').then(h => {
        if (!win.isDestroyed()) {
            win.setSize(280, Math.max(48, h));
            const nw = notificationWins.find(n => n.id === id);
            if (nw) nw.resolved = true;
            positionAllNotificationWins();
            win.showInactive();
        }
    }).catch(() => {
        const nw = notificationWins.find(n => n.id === id);
        if (nw) nw.resolved = true;
        positionAllNotificationWins();
        if (!win.isDestroyed()) win.showInactive();
    });
});
```

Key changes:
- Single `executeJavaScript` call, no setTimeout re-measure
- `resolved = true` set immediately after single measurement
- `positionAllNotificationWins()` called once after measurement
- `win.showInactive()` called once
- Removed `resizeAttempts` variable (unused dead code)

#### 2c. Replace setTimeout animation loop with requestAnimationFrame (lines 496-518)

Replace the existing `tickAnimations` and `animateWindowPosition` functions:

Old `animFrame` variable (line 495):
```ts
let animFrame: ReturnType<typeof setTimeout> | null = null;
```

New:
```ts
let animFrameId: number | null = null;
```

Old `animateWindowPosition` (lines 498-504):
```ts
function animateWindowPosition(win: BrowserWindow, targetX: number, targetY: number, duration = 200, easing?: (t: number) => number) {
    if (win.isDestroyed()) return;
    const [startX, startY] = win.getPosition();
    if (startX === targetX && startY === targetY) return;
    animEntries.set(win, { sx: startX, sy: startY, tx: targetX, ty: targetY, t0: Date.now(), dur: duration, ease: easing || ((p) => p) });
    if (!animFrame) animFrame = setTimeout(tickAnimations, 16);
}
```

New:
```ts
function animateWindowPosition(win: BrowserWindow, targetX: number, targetY: number, duration = 200, easing?: (t: number) => number) {
    if (win.isDestroyed()) return;
    const [startX, startY] = win.getPosition();
    if (startX === targetX && startY === targetY) return;
    animEntries.set(win, { sx: startX, sy: startY, tx: targetX, ty: targetY, t0: Date.now(), dur: duration, ease: easing || ((p) => p) });
    if (animFrameId === null) animFrameId = requestAnimationFrame(tickAnimations);
}
```

Old `tickAnimations` (lines 506-518):
```ts
function tickAnimations() {
    const now = Date.now();
    let alive = false;
    for (const [win, e] of animEntries) {
        if (win.isDestroyed()) { animEntries.delete(win); continue; }
        const p = Math.min((now - e.t0) / e.dur, 1);
        const k = e.ease(p);
        win.setPosition(Math.round(e.sx + (e.tx - e.sx) * k), Math.round(e.sy + (e.ty - e.sy) * k));
        if (p >= 1) { animEntries.delete(win); continue; }
        alive = true;
    }
    animFrame = alive ? setTimeout(tickAnimations, 16) : null;
}
```

New:
```ts
function tickAnimations() {
    const now = Date.now();
    let alive = false;
    for (const [win, e] of animEntries) {
        if (win.isDestroyed()) { animEntries.delete(win); continue; }
        const p = Math.min((now - e.t0) / e.dur, 1);
        const k = e.ease(p);
        win.setPosition(Math.round(e.sx + (e.tx - e.sx) * k), Math.round(e.sy + (e.ty - e.sy) * k));
        if (p >= 1) { animEntries.delete(win); continue; }
        alive = true;
    }
    animFrameId = alive ? requestAnimationFrame(tickAnimations) : null;
}
```

#### 2d. Position all notifications without debounce delay (lines 607-630)

Simplify `positionAllNotificationWins` by removing the `setTimeout(..., 16)` debounce:

Replace the existing function:
```ts
let positionTimer: ReturnType<typeof setTimeout> | null = null;

function positionAllNotificationWins() {
    if (positionTimer) clearTimeout(positionTimer);
    positionTimer = setTimeout(() => {
        positionTimer = null;
        ...
    }, 16);
}
```

With:
```ts
function positionAllNotificationWins() {
    const display = screen.getPrimaryDisplay();
    const { width: sw, height: sh } = display.workAreaSize;
    const gap = 25;

    const alive = notificationWins.filter(n => !n.win.isDestroyed() && n.resolved);
    let botOff = 25;
    for (let i = alive.length - 1; i >= 0; i--) {
        const nw = alive[i];
        const [w, h] = nw.win.getSize();
        const targetX = sw - 280 - 20;
        const targetY = sh - h - botOff;
        animateWindowPosition(nw.win, targetX, targetY, 200, linear);
        botOff += h + gap;
    }
}
```

Also remove the now-unused `positionTimer` variable declaration (line 607).

---

## Issue 3: Hobby reward milestones use wrong thresholds

### Root Cause
The hobby milestones currently use 600s (10min), 1800s (30min), 2700s (45min) as thresholds. The correct thresholds should be 3600s (1h), 10800s (3h), 18000s (5h), matching the study milestones pattern.

### Changes

**File: `src/hooks/useAppStore.tsx`** (lines 18-22)

Replace:
```ts
const HOBBY_MILESTONES = [
  { threshold: 600, reward: 600, labelZH: '连续爱好≥10min', labelEN: 'Continuous hobby ≥10min' },
  { threshold: 1800, reward: 1800, labelZH: '连续爱好≥30min', labelEN: 'Continuous hobby ≥30min' },
  { threshold: 2700, reward: 2700, labelZH: '连续爱好≥45min', labelEN: 'Continuous hobby ≥45min' },
];
```

With:
```ts
const HOBBY_MILESTONES = [
  { threshold: 3600, reward: 600, labelZH: '连续爱好≥1h', labelEN: 'Continuous hobby ≥1h' },
  { threshold: 10800, reward: 1800, labelZH: '连续爱好≥3h', labelEN: 'Continuous hobby ≥3h' },
  { threshold: 18000, reward: 2700, labelZH: '连续爱好≥5h', labelEN: 'Continuous hobby ≥5h' },
];
```

**File: `src/components/TimerCard.tsx`** (lines 14-18)

Replace:
```ts
const HOBBY_MILESTONES = [
  { threshold: 600, label: '10m' },
  { threshold: 1800, label: '30m' },
  { threshold: 2700, label: '45m' },
];
```

With:
```ts
const HOBBY_MILESTONES = [
  { threshold: 3600, label: '1h' },
  { threshold: 10800, label: '3h' },
  { threshold: 18000, label: '5h' },
];
```

Reward values are unchanged (600 / 1800 / 2700 seconds gifted at each milestone), only the thresholds (time needed) change.

---

## Issue 4: Progress bar overlap with timer display

### Root Cause
The timer display has `font-size: 48px` and `padding: var(--space-md) 0` (16px top/bottom). The milestone bar section starts immediately after the stats grid with only `margin-top: 12px` on `.milestone-bar-wrap`. The continuous duration label at the bottom of the progress bar can visually overlap with the start button below.

### Changes

**File: `src/styles/global.css`** (lines 402-405)

Increase the top margin on `.milestone-bar-wrap` from 12px to 20px to create more breathing room between the timer display/stats and the progress bar:
```css
.milestone-bar-wrap {
-  margin-top: 12px;
+  margin-top: 20px;
}
```

Additionally, ensure the bottom margin between the progress bar labels and the start button is adequate. The button already has `margin-top: 24px`, but adding extra padding to the `.milestone-bar-labels` section helps:
```css
.milestone-bar-labels {
  ...
  margin-top: -15px;
  position: relative;
+ padding-bottom: 4px;
}
```

This creates a total gap of ~28px between the progress bar area and the start button below, preventing overlap.

Milestone dot positions (calculated as `(threshold / maxTh) * 100`) remain unchanged.

---

## Issue 5: Chart hover popup on wrong element

### Root Cause
In `RecordPage.tsx`, a `hoverCard` state with `onMouseEnter`/`onMouseLeave` on summary cards was incorrectly added. The original intent was chart bar tooltips only, which already work via the `hoverInfo` system on `.chart-bar-wrap` elements.

### Changes

**File: `src/pages/RecordPage.tsx`**

1. **Remove `hoverCard` state** (line 39):
```ts
- const [hoverCard, setHoverCard] = useState<'Study' | 'Hobby' | 'Entertainment' | null>(null);
```

2. **Remove `onMouseEnter`/`onMouseLeave` from summary cards** (lines 174-175):
```tsx
- onMouseEnter={() => setHoverCard(item.type)}
- onMouseLeave={() => setHoverCard(null)}
```
Keep `onClick` and `style={{ cursor: 'pointer' }}` as they serve the filter function.

3. **Remove the card-hover-popup JSX block** (lines 188-200):
```tsx
- {hoverCard && (
-   <div className="card-hover-popup" style={{ borderColor: `var(--color-${hoverCard.toLowerCase()})` }}>
-     ...
-   </div>
- )}
```

4. **Remove unused import** — check if `hoverCard` was the only use of `useState`. Since `hoverInfo` and `filterType` also use `useState`, keep the import.

**File: `src/styles/global.css`**

Remove the `.card-hover-popup`, `.popup-title`, `.popup-row`, `.popup-day`, `.popup-value` CSS rules (lines 676-702):
```css
- /* ── Card Hover Popup ── */
- .card-hover-popup { ... }
- .popup-title { ... }
- .popup-row { ... }
- .popup-day { ... }
- .popup-value { ... }
```

No changes to the chart bar tooltip system (`hoverInfo`, `.chart-tooltip`) — it already works correctly.

---

## Issue 6: Gift box icon on progress bars

### Requirement
Show a golden gift box icon above the progress bar for Study and Hobby timer cards, displaying the daily gifted remaining balance.

### Changes

**File: `src/components/TimerCard.tsx`**

1. **Import `Gift` icon** from lucide-react (line 2):
```ts
- import { Play, Square } from 'lucide-react';
+ import { Play, Square, Gift } from 'lucide-react';
```

2. **Add gift icon section in the progress bar area**, between the milestone-bar-wrap div and the stats grid above it. Insert just before the milestone bar content (around line 126, inside the `(type === 'Study' || type === 'Hobby')` block):

```tsx
{/* Gift Icon - shows daily gifted remaining */}
<div className="gift-indicator">
  <Gift size={16} className="gift-icon" />
  <span className="gift-amount">{formatDuration(state.balance.dailyGiftedRemaining)}</span>
</div>
```

This goes before the `<div className="milestone-bar-wrap">` element.

**File: `src/styles/global.css`**

Add gift indicator CSS rules at the end of the milestone bar section (after line 467):
```css
/* ── Gift Icon Indicator ── */
.gift-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 10px;
  margin-top: 4px;
}

.gift-icon {
  color: var(--color-accent-amber);
  filter: drop-shadow(0 0 4px rgba(232, 165, 90, 0.3));
}

.gift-amount {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-accent-amber);
  font-variant-numeric: tabular-nums;
}
```

---

## Summary of Files Changed

| File | Changes |
|------|---------|
| `electron/main.ts` | Issue 1: raise 185 cap to 280 in reminder toast resize. Issue 2: add `backgroundColor`, single measurement, rAF, remove debounce |
| `src/styles/global.css` | Issue 4: increase milestone-bar-wrap margin-top from 12px to 20px, add padding-bottom to labels. Issue 5: remove card-hover-popup CSS. Issue 6: add gift indicator CSS |
| `src/pages/RecordPage.tsx` | Issue 5: remove hoverCard state, onMouseEnter/onMouseLeave, card-hover-popup JSX |
| `src/components/TimerCard.tsx` | Issue 3: fix hobby milestone thresholds. Issue 6: add Gift icon import + gift indicator JSX |
| `src/hooks/useAppStore.tsx` | Issue 3: fix hobby milestone thresholds in HOBBY_MILESTONES constant |
| `src/pages/HobbyPage.tsx` | No changes needed (TimerCard already reads `state` from useAppStore) |
| `src/pages/StudyPage.tsx` | No changes needed (TimerCard already reads `state` from useAppStore) |
