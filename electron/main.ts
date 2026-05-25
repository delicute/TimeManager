import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

let BASE_PATH = path.join(app.getPath('userData'), 'data');

function getLogsPath() { return path.join(BASE_PATH, 'logs'); }
function getBalancePath() { return path.join(BASE_PATH, 'balance.json'); }
function getSettingsPath() { return path.join(BASE_PATH, 'settings.json'); }

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getAssetPath(relativePath: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, '..', relativePath);
}

function debugLog(msg: string) {
  try {
    const logPath = path.join(BASE_PATH, 'debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* ignore */ }
}

// ─── IPC Handlers ─────────────────────────────────────────────

function setupIPC() {
  // Balance
  ipcMain.handle('balance:load', () => {
    try {
      const p = getBalancePath();
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    } catch { /* ignore */ }
    return { earnedBalance: 0, dailyGiftedRemaining: 1800, lastDate: '' };
  });

  ipcMain.handle('balance:save', (_, data) => {
    ensureDir(BASE_PATH);
    fs.writeFileSync(getBalancePath(), JSON.stringify(data));
  });

  // Settings
  ipcMain.handle('settings:load', () => {
    try {
      const p = getSettingsPath();
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    } catch { /* ignore */ }
    return null;
  });

  ipcMain.handle('settings:save', (_, data) => {
    ensureDir(BASE_PATH);
    fs.writeFileSync(getSettingsPath(), JSON.stringify(data, null, 2));
    // If dataPath is specified, migrate BASE_PATH
    if (data.dataPath && data.dataPath !== BASE_PATH) {
      BASE_PATH = data.dataPath;
    }
  });

  // Folder picker
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择数据存储路径',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Logs
  ipcMain.handle('logs:getToday', () => {
    const today = new Date();
    const filePath = path.join(getLogsPath(), `${fmtDate(today)}.json`);
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch { /* ignore */ }
    return [];
  });

  ipcMain.handle('logs:write', (_, entry) => {
    ensureDir(getLogsPath());
    const filePath = path.join(getLogsPath(), `${fmtDate(new Date(entry.startTime))}.json`);
    let entries: any[] = [];
    try {
      if (fs.existsSync(filePath)) {
        entries = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch { /* ignore */ }
    entries.push(entry);
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2));
  });

  // Notifications
  ipcMain.handle('notify:show', (_, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  // Window control
  ipcMain.handle('window:minimizeToTray', () => {
    mainWindow?.hide();
  });

  ipcMain.handle('window:restore', () => {
    mainWindow?.show();
    mainWindow?.setSkipTaskbar(false);
    mainWindow?.focus();
  });

  ipcMain.handle('window:quit', () => {
    tray?.destroy();
    app.quit();
  });

  ipcMain.handle('settings:getBasePath', () => BASE_PATH);

  // Auto-start
  ipcMain.handle('settings:setAutoStart', (_, enabled: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: ['--silent'],
    });
  });

  // Reminders
  ipcMain.handle('reminders:load', () => {
    const p = path.join(BASE_PATH, 'reminders.json');
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { /* ignore */ }
    return [];
  });

  ipcMain.handle('reminders:save', (_, rules) => {
    ensureDir(BASE_PATH);
    fs.writeFileSync(path.join(BASE_PATH, 'reminders.json'), JSON.stringify(rules, null, 2));
  });

  // Window always-on-top
  ipcMain.handle('window:setAlwaysOnTop', (_, onTop: boolean) => {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(onTop);
      if (onTop) { mainWindow.show(); mainWindow.focus(); }
    }
  });

  // Audio: read beep.wav and return as base64 data URL
  ipcMain.handle('audio:getBeepDataUrl', () => {
    const audioPath = getAssetPath('assets/audio/beep.wav');
    try {
      const buf = fs.readFileSync(audioPath);
      return `data:audio/wav;base64,${buf.toString('base64')}`;
    } catch {
      // Return a minimal silent WAV as fallback
      return '';
    }
  });

}

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


function createWindow() {
  // Remove default menu bar
  Menu.setApplicationMenu(null);

  const icoPath = getAssetPath('assets/ico/ico_256x256.ico');

  mainWindow = new BrowserWindow({
    width: 780,
    height: 650,
    minWidth: 600,
    minHeight: 400,
    title: 'TimeManager',
    icon: nativeImage.createFromPath(icoPath),
    center: true,
    show: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (e) => {
    // We handle close in renderer via IPC, but prevent default
    // so the app stays in tray
    e.preventDefault();
    mainWindow?.hide();
    mainWindow?.setSkipTaskbar(true);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });
}

// ─── Tray ────────────────────────────────────────────────────

function createFallbackIcon(size: number): Electron.NativeImage {
  // Build a minimal PNG from raw RGBA data
  const raw = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    raw[i * 4] = 0xcc; raw[i * 4 + 1] = 0x78;
    raw[i * 4 + 2] = 0x5c; raw[i * 4 + 3] = 0xff;
  }
  const scanlines = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    scanlines[y * (1 + size * 4)] = 0; // filter none
    raw.copy(scanlines, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const compressed = zlib.deflateSync(scanlines);

  function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let v = n; for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1; table[n] = v; }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function pngChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeB, data]);
    const crcV = Buffer.alloc(4); crcV.writeUInt32BE(crc32(crcData));
    return Buffer.concat([len, typeB, data, crcV]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return nativeImage.createFromBuffer(
    Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]),
    { width: size, height: size }
  );
}

function createTray() {
  const trayIconPath = getAssetPath('assets/ico/ico_16x16.ico');
  const iconExists = fs.existsSync(trayIconPath);
  debugLog(`Tray icon path: ${trayIconPath}`);
  debugLog(`Tray icon exists: ${iconExists}`);
  debugLog(`app.isPackaged: ${app.isPackaged}`);
  debugLog(`resourcesPath: ${process.resourcesPath}`);
  let icon = nativeImage.createFromPath(trayIconPath);
  if (icon.isEmpty()) {
    debugLog('Tray icon is empty, using fallback');
    icon = createFallbackIcon(16);
  } else {
    debugLog(`Tray icon loaded OK, size: ${JSON.stringify(icon.getSize())}`);
  }
  tray = new Tray(icon);
  tray.setToolTip('TimeManager');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示', click: () => { mainWindow?.show(); mainWindow?.setSkipTaskbar(false); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: '退出', click: () => { tray?.destroy(); app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.setSkipTaskbar(false);
    mainWindow?.focus();
  });
}

// ─── App Lifecycle ───────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Check for custom data path in settings
    try {
      const p = getSettingsPath();
      if (fs.existsSync(p)) {
        const s = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (s.dataPath) BASE_PATH = s.dataPath;
      }
    } catch { /* ignore */ }

    ensureDir(BASE_PATH);
    ensureDir(getLogsPath());
    setupIPC();
    createWindow();
    createTray();

    // Auto-start setting
    app.setLoginItemSettings({
      openAtLogin: false, // Will be set from renderer
    });
  });

  app.on('window-all-closed', () => {
    // Don't quit on close - tray keeps running
  });

  app.on('before-quit', () => {
    tray?.destroy();
  });
}
