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
  writeLogEntry: (entry: any) => ipcRenderer.invoke('logs:write', entry),

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

  // Reminders
  remindersLoad: () => ipcRenderer.invoke('reminders:load'),
  remindersSave: (rules: any) => ipcRenderer.invoke('reminders:save', rules),

  // Window always-on-top
  windowSetAlwaysOnTop: (onTop: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', onTop),

  // Audio
  getBeepDataUrl: () => ipcRenderer.invoke('audio:getBeepDataUrl'),

});
