import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Balance
  loadBalance: () => ipcRenderer.invoke('balance:load'),
  saveBalance: (data: any) => ipcRenderer.invoke('balance:save', data),

  // Settings
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (data: any) => ipcRenderer.invoke('settings:save', data),

  // Logs
  getTodayLogs: () => ipcRenderer.invoke('logs:getToday'),
  getLogsForDate: (dateStr: string) => ipcRenderer.invoke('logs:getForDate', dateStr),
  writeLogEntry: (entry: any) => ipcRenderer.invoke('logs:write', entry),
  clearAllLogs: () => ipcRenderer.invoke('logs:clearAll'),

  // Notifications
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('notify:show', { title, body }),

  // Window
  minimizeToTray: () => ipcRenderer.invoke('window:minimizeToTray'),
  restoreWindow: () => ipcRenderer.invoke('window:restore'),
  quitApp: () => ipcRenderer.invoke('window:quit'),

  // Info
  getBasePath: () => ipcRenderer.invoke('settings:getBasePath'),

  // Auto-start
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('settings:setAutoStart', enabled),

  // Folder picker
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Open folder in explorer
  shellOpenPath: (dirPath: string) => ipcRenderer.invoke('shell:openPath', dirPath),

  // Reminders
  remindersLoad: () => ipcRenderer.invoke('reminders:load'),
  remindersSave: (rules: any) => ipcRenderer.invoke('reminders:save', rules),

  // Window always-on-top
  windowSetAlwaysOnTop: (onTop: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', onTop),

  // Audio
  getBeepDataUrl: () => ipcRenderer.invoke('audio:getBeepDataUrl'),
  getBuiltinSoundUrls: () => ipcRenderer.invoke('audio:getBuiltinUrls'),
  readAudioFile: (filePath: string) => ipcRenderer.invoke('audio:readFile', filePath),
  selectAudioFile: () => ipcRenderer.invoke('dialog:selectAudioFile'),

  // Reminder toast window
  reminderShowToast: (rule: any) => ipcRenderer.invoke('reminder:showToast', rule),
  reminderToastDismiss: () => ipcRenderer.invoke('reminder:toastDismiss'),
  reminderToastSnooze: (minutes: number) => ipcRenderer.invoke('reminder:toastSnooze', minutes),
  reminderResize: (height: number) => ipcRenderer.invoke('reminder:resize', height),
  onReminderToastAction: (callback: (action: any) => void) => {
    ipcRenderer.on('reminder:toastAction', (_event, action) => callback(action));
  },

  // Minimize-to-tray sync
  setMinimizeToTray: (value: boolean) => ipcRenderer.invoke('settings:setMinimizeToTray', value),

  // Session notifications
  notificationShow: (data: any) => ipcRenderer.invoke('notification:show', data),
  notificationDismiss: (id: string) => ipcRenderer.invoke('notification:dismiss', id),

  // ─── Global Hotkeys ──────────────────────────────
  registerGlobalHotkeys: (hotkeys: Record<string, string>) =>
    ipcRenderer.invoke('settings:registerGlobalHotkeys', hotkeys),
  unregisterGlobalHotkeys: () => ipcRenderer.invoke('settings:unregisterGlobalHotkeys'),
  onGlobalShortcutTrigger: (callback: (id: string) => void) => {
    ipcRenderer.on('globalShortcut:trigger', (_event, id) => callback(id));
  },

  // ─── Tray IPC ─────────────────────────────────────
  sessionUpdateState: (state: any) => ipcRenderer.invoke('session:stateUpdate', state),
  onTrayAction: (callback: (action: any) => void) => {
    ipcRenderer.on('tray:startSession', (_event, type) => callback({ action: 'startSession', type }));
    ipcRenderer.on('tray:stopSession', () => callback({ action: 'stopSession' }));
    ipcRenderer.on('tray:navSettings', () => callback({ action: 'navigate', page: 'Settings' }));
  },
});

// ─── Notification container bridge ──────────────────────
contextBridge.exposeInMainWorld('containerBridge', {
  onAdd: (callback: (data: { id: string; iconSvg: string; title: string; body: string; color: string }) => void) => {
    ipcRenderer.on('container:add', (_event, data) => callback(data));
  },
  onRemove: (callback: (id: string) => void) => {
    ipcRenderer.on('container:remove', (_event, id) => callback(id));
  },
});
