# UX Enhancements Design

Date: 2026-05-30
Status: Draft

## Overview

Seven UX improvements across the TimeManager app: toast notifications, page animations,
record page loading state, drag-reorder reminders, search/filter reminders, reminder toggle
i18n, and reminder sound settings.

---

## 1. Toast Notification System

Position: **Top-center** of the content area (`.content-area`), stacked vertically.

Types:
- **success**: green border, checkmark icon — settings saved, reminder added/deleted
- **error**: red border, X icon — operation failed
- **info**: neutral border, info icon — general notification

Behavior:
- Auto-dismiss after 2500ms
- Multiple toasts stack downward with 8px gap
- Click to dismiss immediately
- Fade in (top → slide down) + fade out

Implementation:
- `src/components/Toast.tsx` — ToastProvider (React Context) + ToastContainer + ToastItem
- `src/hooks/useToast.ts` — `useToast()` returns `{ showToast(message, type?) }`
- Add ToastProvider to App.tsx wrapping the content area
- Replace `window.electronAPI.saveSettings(...)` calls with toast on success/failure

## 2. Page Animations & Micro-interactions

### Page Transitions
- `.content-inner` fade-up animation on page change: `opacity 0→1, translateY 8px→0`, 250ms ease
- Use a `key` prop on the rendered page to trigger re-animation

### Button Press
- `.btn:active` add `transform: scale(0.97)` — subtle pressed feel

### Card Hover
- `.card:hover` add `box-shadow: 0 4px 16px rgba(0,0,0,0.3)` — subtle lift

### Reminder List Entry
- Reminder cards get staggered `fadeUp` animation with `animation-delay` based on index

All styles go in `src/styles/global.css`.

## 3. Record Page Loading State & Scroll

### Loading State
- When preset changes or custom dates are set, show a pulsing skeleton / spinner above the timeline area while `setLogs` is loading
- State variable: `loadingLogs: boolean` — set true before async load, false after
- Show spinner div with CSS animation when loading

### Scroll-to-top Button
- When timeline length > 15 entries, show a floating button at bottom-right of the timeline
- On click, scroll `.content-area` to top smoothly

## 4. Drag Reorder Reminders

Approach: Native HTML5 Drag & Drop (no extra library).

- Add `draggable="true"` to each reminder card in the list view
- State: `dragIndex` tracking which card is being dragged
- Events:
  - `onDragStart`: set drag data, add visual feedback (opacity 0.4)
  - `onDragOver`: show a visual indicator (colored border-top at drop position)
  - `onDrop`: reorder array, update `reminderRules`, persist via `window.electronAPI.remindersSave`
- Saving the ordered array automatically persists the new order

## 5. Search / Filter Reminders

- Add a search bar above the reminder rule list (filter icon + text input)
- Filter buttons: `全部 | 启用 | 禁用` (`All | Enabled | Disabled`)
- Search matches rule title (case-insensitive)
- Both filters stack: selected status filter + text search

State: `filterText: string`, `filterStatus: 'all' | 'enabled' | 'disabled'`

## 6. Reminder Toggle i18n

Replace hardcoded `'开'` / `'关'` with:
- `t('reminderEnabled')` / `t('reminderDisabled')`
- zh: `开` / `关`
- en: `On` / `Off`

## 7. Reminder Sound Settings

### Data Model
Add optional field to `ReminderRule`:
```typescript
export interface ReminderRule {
  // ...existing fields
  sound?: string; // '' = none, 'builtin:beep' | 'builtin:completion', 'file:/path/to/file'
}
```

### UI — Reminder Edit Form
Add a new row after the urgency selector:
- Label: "音效" / "Sound"
- Dropdown-style buttons:
  - `无` (none)
  - `Beep` (builtin:beep)
  - `Completion` (builtin:completion)
  - `选择文件…` — opens file dialog
- Selected file name shown inline

### Electron IPC
- `electronAPI.playSound(path: string): Promise<void>` — plays audio via `new Audio(path).play()`
- Actually, for the renderer, we can play audio directly with `new Audio()` for web-compatible files. But for custom files we might need a different approach.

Wait — in Electron renderer, `new Audio('file:///path')` may not work due to CSP. Better approach:
- `electronAPI.getSoundUrl(path: string): Promise<string>` — returns a `custom-protocol://` or data URL that the renderer can play
- Or use Electron's `webContents.executeJavaScript` to play from the main process
- Simplest: convert audio files to base64 data URLs in the preload

### Trigger — Playing Sound
When a reminder notification fires, check `rule.sound`:
- If `'builtin:beep'` → play beep.wav (included in build resources)
- If `'builtin:completion'` → play completion.wav
- If `'file:/path/to/file'` → load and play custom file
- If `''` or undefined → no sound

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/types.ts` | Add `sound?: string` to `ReminderRule` |
| `src/components/Toast.tsx` | New file — Toast system |
| `src/hooks/useToast.ts` | New file — Toast hook |
| `src/App.tsx` | Add ToastProvider |
| `src/styles/global.css` | Toast styles, animations, micro-interactions |
| `src/pages/ReminderPage.tsx` | Drag reorder, search/filter, i18n, sound selector |
| `src/pages/RecordPage.tsx` | Loading state, scroll-to-top button |
| `src/i18n/types.ts` | New keys: `reminderEnabled`, `reminderDisabled`, `reminderSoundNone`, `reminderSoundBeep`, `reminderSoundCompletion`, `reminderSoundCustom`, `reminderSoundLabel` |
| `src/i18n/zh.ts` | Chinese translations for new keys |
| `src/i18n/en.ts` | English translations for new keys |
| `electron/preload.ts` | Add `playSound`, `selectAudioFile` |
| `electron/main.ts` | Add IPC handlers for sound, custom file selection |

## Sound Implementation Detail

For playing sounds in Electron renderer:
- Option A: Use Electron's `shell.openPath` for external files — not for audio playback
- Option B: Read audio file in main process, send as base64 data URL via IPC
- Option C: Preload reads asset files and exposes data URLs

**Chosen approach**: Read built-in audio files at app startup, expose data URLs via preload.
- `electron/main.ts`: Add `ipcMain.handle('audio:getBuiltinUrls')` that reads `assets/audio/*.wav` and returns `{beep: 'data:audio/wav;base64,...', completion: 'data:audio/wav;base64,...'}`
- `electron/main.ts`: Add `ipcMain.handle('audio:readFile', (_, path) => readFileAsDataURL(path))` for custom files
- `electron/preload.ts`: Expose `getBuiltinSoundUrls(): Promise<Record<string,string>>` and `readAudioFile(path): Promise<string|null>`
- Renderer: Store data URLs, create `new Audio(url).play()` when reminder triggers
