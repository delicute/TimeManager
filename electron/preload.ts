import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Balance
  loadBalance: () => ipcRenderer.invoke('balance:load'),
  saveBalance: (data: any) => ipcRenderer.invoke('balance:save', data),
  saveBalanceSync: (data: any) => ipcRenderer.sendSync('balance:saveSync', data),

  // Settings
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (data: any) => ipcRenderer.invoke('settings:save', data),

  // Logs
  getTodayLogs: () => ipcRenderer.invoke('logs:getToday'),
  getLogsForDate: (dateStr: string) => ipcRenderer.invoke('logs:getForDate', dateStr),
  writeLogEntry: (entry: any) => ipcRenderer.invoke('logs:write', entry),
  writeLogEntrySync: (entry: any) => ipcRenderer.sendSync('logs:writeSync', entry),
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
    const handler = (_event: any, action: any) => callback(action);
    ipcRenderer.on('reminder:toastAction', handler);
    return () => ipcRenderer.removeListener('reminder:toastAction', handler);
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
    const handler = (_event: any, id: string) => callback(id);
    ipcRenderer.on('globalShortcut:trigger', handler);
    return () => ipcRenderer.removeListener('globalShortcut:trigger', handler);
  },

  // ─── Tray & Background Sync IPC ────────────────────
  sessionUpdateState: (state: any) => ipcRenderer.invoke('session:stateUpdate', state),
  onSessionTick: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('session:tick', handler);
    return () => ipcRenderer.removeListener('session:tick', handler);
  },
  onBalanceSync: (callback: (balance: any) => void) => {
    const handler = (_event: any, balance: any) => callback(balance);
    ipcRenderer.on('balance:sync', handler);
    return () => ipcRenderer.removeListener('balance:sync', handler);
  },
  onTrayAction: (callback: (action: any) => void) => {
    const h1 = (_event: any, type: string) => callback({ action: 'startSession', type });
    const h2 = () => callback({ action: 'stopSession' });
    const h3 = () => callback({ action: 'navigate', page: 'Settings' });
    ipcRenderer.on('tray:startSession', h1);
    ipcRenderer.on('tray:stopSession', h2);
    ipcRenderer.on('tray:navSettings', h3);
    return () => {
      ipcRenderer.removeListener('tray:startSession', h1);
      ipcRenderer.removeListener('tray:stopSession', h2);
      ipcRenderer.removeListener('tray:navSettings', h3);
    };
  },
});

// ─── Notification container bridge ──────────────────────
contextBridge.exposeInMainWorld('containerBridge', {
  onAdd: (callback: (data: { id: string; iconSvg: string; title: string; body: string; color: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('container:add', handler);
    return () => ipcRenderer.removeListener('container:add', handler);
  },
  onRemove: (callback: (id: string) => void) => {
    const handler = (_event: any, id: string) => callback(id);
    ipcRenderer.on('container:remove', handler);
    return () => ipcRenderer.removeListener('container:remove', handler);
  },
});
