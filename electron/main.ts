import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, dialog, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

let BASE_PATH = path.join(app.getPath('userData'), 'data');

function getLogsPath() { return path.join(BASE_PATH, 'logs'); }
function getBalancePath() { return path.join(BASE_PATH, 'balance.json'); }
function getSettingsPath() { return path.join(BASE_PATH, 'settings.json'); }

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let reminderToastWindow: BrowserWindow | null = null;
let startSilent = process.argv.includes('--silent');

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
    try {
      if (enabled) {
        if (app.isPackaged) {
          app.setLoginItemSettings({ openAtLogin: true, args: ['--silent'] });
        } else {
          // For unpackaged dev setup: create startup batch file
          const startupDir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
          ensureDir(startupDir);
          // Find the project root (parent of electron dir)
          const projectDir = path.resolve(__dirname, '..');
          const npxPath = path.join(app.getPath('home'), 'AppData', 'Roaming', 'npm', 'npx.cmd');
          const batContent =
            `@echo off\r\n` +
            `cd /d "${projectDir}"\r\n` +
            `start "" /B "${npxPath}" electron . --silent\r\n`;
          fs.writeFileSync(path.join(startupDir, 'TimeManager.cmd'), batContent, 'utf-8');
        }
      } else {
        // Disable: clear both registry and batch file
        app.setLoginItemSettings({ openAtLogin: false });
        const startupDir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        for (const name of ['TimeManager.cmd', 'TimeManager.bat', 'TimeManager.lnk']) {
          try { const p = path.join(startupDir, name); if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
        }
      }
    } catch (e) {
      debugLog(`Auto-start error: ${e}`);
    }
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

  // Reminder toast notification window
  ipcMain.handle('reminder:showToast', (_, rule) => {
    showReminderToast(rule);
  });

  ipcMain.handle('reminder:toastDismiss', () => {
    closeReminderToast();
    mainWindow?.webContents.send('reminder:toastAction', { action: 'dismiss' });
  });

  ipcMain.handle('reminder:toastSnooze', (_, minutes) => {
    closeReminderToast();
    mainWindow?.webContents.send('reminder:toastAction', { action: 'snooze', minutes });
  });

}

function closeReminderToast() {
  if (reminderToastWindow && !reminderToastWindow.isDestroyed()) {
    reminderToastWindow.close();
    reminderToastWindow = null;
  }
}

function showReminderToast(rule: any) {
  closeReminderToast();

  // Read beep.wav for audio playback
  let beepDataUrl = '';
  try {
    const audioPath = getAssetPath('assets/audio/beep.wav');
    if (fs.existsSync(audioPath)) {
      const buf = fs.readFileSync(audioPath);
      beepDataUrl = `data:audio/wav;base64,${buf.toString('base64')}`;
    }
  } catch { /* ignore */ }

  reminderToastWindow = new BrowserWindow({
    width: 360,
    height: 240,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const html = generateToastHtml(rule, beepDataUrl);
  reminderToastWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  reminderToastWindow.once('ready-to-show', () => {
    positionReminderToast();
    reminderToastWindow?.show();
    // Enable focus after showing to allow button clicks (no focus steal)
    setTimeout(() => {
      if (reminderToastWindow && !reminderToastWindow.isDestroyed()) {
        reminderToastWindow.setFocusable(true);
      }
    }, 150);
  });

  reminderToastWindow.on('closed', () => {
    reminderToastWindow = null;
  });
}

function positionReminderToast() {
  if (!reminderToastWindow || reminderToastWindow.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const [winWidth, winHeight] = reminderToastWindow.getSize();
  reminderToastWindow.setPosition(width - winWidth - 20, height - winHeight - 20);
}

function generateToastHtml(rule: any, beepDataUrl: string): string {
  const urgencyColors: Record<string, string> = {
    low: '#a09d96', medium: '#5db8a6', high: '#e8a55a', critical: '#c64545',
  };
  const barColor = urgencyColors[rule.urgency] || '#e8a55a';
  const bgTint = barColor + '15';

  const cond = rule.condition || {};
  const threshold = cond.value != null ? cond.value : '';
  const currentVal = rule._currentValue != null ? Math.round(rule._currentValue) : '';
  const cond2 = rule.condition2;
  const currentVal2 = rule._currentValue2 != null ? Math.round(rule._currentValue2) : '';

  const animClass = rule.urgency === 'critical' ? 'toast-alert' : rule.urgency === 'high' ? 'toast-pulse' : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#faf9f5;background:#252320;overflow:hidden;user-select:none}
.ub{height:4px;background:${barColor}}
.bd{padding:14px 16px 12px;display:flex;flex-direction:column;height:236px}
.ul{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.ul-badge{font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${barColor};background:${barColor}25;padding:1px 6px;border-radius:3px}
.ul-time{font-size:10px;color:#888}
.tt{font-size:15px;font-weight:600;color:#faf9f5;margin-bottom:3px;line-height:1.3}
.ct{font-size:12px;color:#b0ada6;line-height:1.35;margin-bottom:6px;flex-shrink:0}
.cv{margin-top:auto;margin-bottom:8px;display:flex;flex-direction:column;gap:3px;padding:8px 10px;background:${bgTint};border-radius:6px;flex-shrink:0}
.cv-row{display:flex;justify-content:space-between;align-items:center;font-size:11px}
.cv-label{color:#aaa}
.cv-val{font-weight:600;color:#faf9f5;font-variant-numeric:tabular-nums}
.cv-op{color:${barColor};font-weight:600;margin:0 2px}
.cv-thresh{color:#faf9f5}
.cv-sep{height:1px;background:${barColor}20;margin:2px 0}
.ac{display:flex;gap:8px;flex-shrink:0}
.ac .btn{flex:1;padding:6px 12px;height:30px;border-radius:6px;font:inherit;font-size:12px;font-weight:500;cursor:pointer;border:none;transition:all .12s;text-align:center}
.bdismiss{background:#cc785c;color:#fff}
.bdismiss:hover{background:#a9583e}
.bsnooze{background:rgba(255,255,255,.06);color:#faf9f5;border:1px solid rgba(255,255,255,.12)}
.bsnooze:hover{background:rgba(255,255,255,.1)}
.sp{margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);display:none;flex-direction:column;gap:6px;flex-shrink:0}
.spr{display:flex;gap:5px}
.spr .btn{flex:1;padding:4px 2px;height:26px;border-radius:5px;font:inherit;font-size:11px;font-weight:500;cursor:pointer;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#faf9f5;transition:all .12s;text-align:center;min-width:0}
.spr .btn:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25)}
.scu{display:flex;gap:6px;align-items:center}
.scu input{width:55px;padding:3px 6px;border:1px solid rgba(255,255,255,.15);border-radius:4px;background:rgba(255,255,255,.06);color:#faf9f5;font-size:12px;outline:none;height:24px}
.scu input:focus{border-color:#cc785c}
.scu .lbl{font-size:11px;color:#a09d96}
.scu .bcn{padding:3px 14px;height:24px;border-radius:5px;font:inherit;font-size:11px;font-weight:500;cursor:pointer;border:none;background:#cc785c;color:#fff;transition:all .12s}
.scu .bcn:hover{background:#a9583e}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(232,165,90,.4)}50%{box-shadow:0 0 0 8px rgba(232,165,90,0)}}
@keyframes alert{0%,100%{box-shadow:inset 0 0 0 0 rgba(198,69,69,.3)}50%{box-shadow:inset 0 0 0 2px rgba(198,69,69,.3)}}
.toast-alert{animation:alert 1.5s ease-in-out infinite}
.toast-pulse{animation:pulse 2.5s ease-in-out infinite}
</style>
</head>
<body>
${beepDataUrl ? `<audio autoplay src="${beepDataUrl}"></audio>` : ''}
<div class="ub"></div>
<div class="bd ${animClass}">
<div class="ul">
<span class="ul-badge">${(rule.urgency || '').toUpperCase()}</span>
<span class="ul-time">${new Date().toLocaleTimeString()}</span>
</div>
<div class="tt">${escapeHtml(rule.title || '')}</div>
${rule.content ? `<div class="ct">${escapeHtml(rule.content)}</div>` : ''}
<div class="cv">
<div class="cv-row">
<span class="cv-label">${escapeHtml(cond.metric || '')}</span>
<span><span class="cv-val">${currentVal}</span><span class="cv-op"> ${operatorSymbol(cond.operator)} </span><span class="cv-thresh">${threshold}</span></span>
</div>
${cond2 ? `
<div class="cv-sep"></div>
<div class="cv-row">
<span class="cv-label" style="color:${barColor}">${rule.logic === 'or' ? 'OR' : 'AND'}</span>
</div>
<div class="cv-row">
<span class="cv-label">${escapeHtml(cond2.metric)}</span>
<span><span class="cv-val">${currentVal2}</span><span class="cv-op"> ${operatorSymbol(cond2.operator)} </span><span class="cv-thresh">${cond2.value}</span></span>
</div>` : ''}
</div>
<div class="ac">
<button class="btn bdismiss" onclick="dismiss()">确定</button>
<button class="btn bsnooze" onclick="ts()">等等</button>
</div>
<div class="sp" id="sp">
<div class="spr">
<button class="btn" onclick="s(1)">1分钟</button>
<button class="btn" onclick="s(5)">5分钟</button>
<button class="btn" onclick="s(10)">10分钟</button>
<button class="btn" onclick="s(30)">30分钟</button>
</div>
<div class="scu">
<input type="number" id="cm" value="15" min="1">
<span class="lbl">分钟</span>
<button class="bcn" onclick="sc()">确定</button>
</div>
</div>
</div>
<script>
function dismiss(){window.electronAPI.reminderToastDismiss()}
function ts(){var p=document.getElementById('sp');p.style.display=p.style.display==='none'?'flex':'none'}
function s(m){window.electronAPI.reminderToastSnooze(m)}
function sc(){var v=parseInt(document.getElementById('cm').value)||15;window.electronAPI.reminderToastSnooze(v)}
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function operatorSymbol(op: string): string {
  switch (op) {
    case 'lt': return '<';
    case 'gt': return '>';
    case 'gte': return '>=';
    case 'lte': return '<=';
    case 'eq': return '=';
    default: return op;
  }
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
    // Check if user has enabled minimize-to-tray
    try {
      const p = getSettingsPath();
      if (fs.existsSync(p)) {
        const s = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (s.minimizeToTray === true) {
          e.preventDefault();
          mainWindow?.hide();
          mainWindow?.setSkipTaskbar(true);
          return;
        }
      }
    } catch { /* ignore */ }
    // minimizeToTray disabled or unknown — let window close normally
  });

  mainWindow.once('ready-to-show', () => {
    if (!startSilent) {
      mainWindow?.show();
    } else {
      mainWindow?.setSkipTaskbar(true);
    }
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
  });

  app.on('window-all-closed', () => {
    tray?.destroy();
    app.quit();
  });

  app.on('before-quit', () => {
    tray?.destroy();
  });
}
