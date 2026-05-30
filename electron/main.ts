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

let currentSessionState: { isActive: boolean; type: string } = { isActive: false, type: 'None' };
let minimizeToTrayEnabled = true;
let isQuitting = false;

// ─── Notification Container (single BrowserWindow) ──────────
const NOTIF_CONTAINER_WIDTH = 320;
const NOTIF_RIGHT = 20;
const NOTIF_CARD_WIDTH = 280;
const NOTIF_BOTTOM = 25;
const NOTIF_GAP = 15;
const NOTIF_FADE_MS = 350;
const NOTIF_SLIDE_MS = 200;

let notifContainer: BrowserWindow | null = null;
let containerReady = false;
let notifQueue: { id: string; title: string; body: string; color: string }[] = [];
interface ContainerNotif { id: string; expireTimer: ReturnType<typeof setTimeout>; }
let containerNotifs: ContainerNotif[] = [];

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
    return { earnedBalance: 0, dailyGiftedRemaining: 1800, lastDate: '', milestones: { studyContinuous: 0, hobbyContinuous: 0, studyClaimed: 0, hobbyClaimed: 0 } };
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

  ipcMain.handle('logs:getForDate', (_, dateStr: string) => {
    const filePath = path.join(getLogsPath(), `${dateStr}.json`);
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

  ipcMain.handle('settings:setMinimizeToTray', (_, value: boolean) => {
    minimizeToTrayEnabled = value;
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

  ipcMain.handle('reminder:resize', (_, height: number) => {
    try {
      const clamped = Math.min(200, height);
      if (reminderToastWindow && !reminderToastWindow.isDestroyed()) {
        const [w] = reminderToastWindow.getSize();
        reminderToastWindow.setSize(w, clamped);
        positionReminderToast();
      }
    } catch { /* ignore */ }
  });

  ipcMain.handle('reminder:toastDismiss', () => {
    closeReminderToast();
    mainWindow?.webContents.send('reminder:toastAction', { action: 'dismiss' });
  });

  ipcMain.handle('reminder:toastSnooze', (_, minutes) => {
    closeReminderToast();
    mainWindow?.webContents.send('reminder:toastAction', { action: 'snooze', minutes });
  });

  // ─── Session Notification (single container window) ──
  ipcMain.handle('notification:show', (_, data: { type: string; title: string; body: string; color: string; duration: number }) => {
    showContainerNotification(data);
  });

  ipcMain.handle('notification:dismiss', (_, id: string) => {
    dismissContainerNotification(id);
  });

  // ─── Tray Session IPC ────────────────────────────
  ipcMain.handle('session:stateUpdate', (_, state) => {
    currentSessionState = state;
    rebuildTrayMenu();
  });

  // Forward tray actions to renderer
  ipcMain.handle('tray:startSession', (_, type) => {
    mainWindow?.webContents.send('tray:startSession', type);
  });
  ipcMain.handle('tray:stopSession', () => {
    mainWindow?.webContents.send('tray:stopSession');
  });
  ipcMain.handle('tray:navSettings', () => {
    mainWindow?.webContents.send('tray:navSettings');
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
    width: 335,
    height: 120,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    backgroundColor: '#252320',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const html = generateToastHtml(rule, beepDataUrl);
  reminderToastWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Measure content height after load, resize to fit, then show
  reminderToastWindow.webContents.on('did-finish-load', () => {
    if (!reminderToastWindow || reminderToastWindow.isDestroyed()) return;
    reminderToastWindow.webContents.executeJavaScript('document.documentElement.scrollHeight').then(h => {
      if (!reminderToastWindow || reminderToastWindow.isDestroyed()) return;
      const clamped = Math.max(120, Math.min(200, h));
      reminderToastWindow.setSize(335, clamped);
      positionReminderToast();
      reminderToastWindow.showInactive();
    }).catch(() => {
      if (!reminderToastWindow || reminderToastWindow.isDestroyed()) return;
      positionReminderToast();
      reminderToastWindow.showInactive();
    });
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

// Metric label maps for toast display (no i18n available in main process)
const METRIC_LABELS_EN: Record<string, string> = {
  entertainmentBalance: 'Entertainment Balance',
  dailyGiftedBalance: 'Gifted Balance',
  earnedBalance: 'Earned Balance',
  studyDuration: "Today's Study",
  hobbyDuration: "Today's Hobby",
  entertainmentDuration: "Today's Entertainment",
  continuousEntertainment: 'Continuous Entertainment',
  totalAvailableBalance: 'Total Available',
  debtAmount: 'Debt Amount',
};

const METRIC_LABELS_ZH: Record<string, string> = {
  entertainmentBalance: '娱乐余额',
  dailyGiftedBalance: '赠送余额',
  earnedBalance: '赚取余额',
  studyDuration: '今日学习',
  hobbyDuration: '今日爱好',
  entertainmentDuration: '今日娱乐',
  continuousEntertainment: '连续娱乐',
  totalAvailableBalance: '可用总额',
  debtAmount: '债务金额',
};

function metricLabel(metric: string, locale: string): string {
  const map = locale === 'zh' ? METRIC_LABELS_ZH : METRIC_LABELS_EN;
  return map[metric] || metric;
}

function renderTreeHtml(node: any, values: Record<string, number>, path: string, barColor: string, locale: string): string {
  if (!node) return '';
  if (node.type === 'leaf') {
    const metric = node?.metric || '';
    const op = node?.operator || '';
    const thresh = node?.value != null ? node.value : '';
    const val = values ? (values[path] ?? values['_first'] ?? 0) : 0;
    return `<div class="cv-row">
  <span class="cv-label">${escapeHtml(metricLabel(metric, locale))}</span>
  <span><span class="cv-val">${Math.round(val)}</span><span class="cv-op"> ${operatorSymbol(op)} </span><span class="cv-thresh">${thresh}</span></span>
</div>`;
  }
  if (node.type === 'group') {
    let html = '';
    for (let i = 0; i < node.nodes.length; i++) {
      if (i > 0) {
        const logicLabel = node.logic === 'or' ? 'OR' : 'AND';
        html += `<div class="cv-logic" style="color:${barColor}">${logicLabel}</div>`;
      }
      const child = node.nodes[i];
      const childPath = `${path || ''}n${i}`;
      if (child.type === 'leaf') {
        html += renderTreeHtml(child, values, childPath, barColor, locale);
      } else {
        // Sub-group: render children with indentation
        html += `<div class="cv-subgroup">${renderTreeHtml(child, values, childPath, barColor, locale)}</div>`;
      }
    }
    return html;
  }
  return '';
}

function generateToastHtml(rule: any, beepDataUrl: string): string {
  const urgencyColors: Record<string, string> = {
    low: '#a09d96', medium: '#5db8a6', high: '#e8a55a', critical: '#c64545',
  };
  const barColor = urgencyColors[rule.urgency] || '#e8a55a';
  const animClass = rule.urgency === 'critical' ? 'toast-alert' : rule.urgency === 'high' ? 'toast-pulse' : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
*:focus{outline:none}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#faf9f5;background:#252320;user-select:none}
.ub{height:4px;background:${barColor}}
.bd{padding:14px 16px 6px;display:flex;flex-direction:column;min-height:0;position:relative}
.ul{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.ul-badge{font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${barColor};background:${barColor}25;padding:1px 6px;border-radius:3px}
.ul-time{font-size:10px;color:#888}
.tt{font-size:15px;font-weight:600;color:#faf9f5;margin-bottom:3px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ct{font-size:12px;color:#b0ada6;line-height:1.35;margin-bottom:6px;min-height:17px}
.ac{display:flex;gap:8px}
.ac .btn{flex:1;padding:6px 12px;height:30px;border-radius:6px;font:inherit;font-size:12px;font-weight:500;cursor:pointer;border:none;transition:all .12s;text-align:center}
.bdismiss{background:#cc785c;color:#fff}
.bdismiss:hover{background:#a9583e}
.bsnooze{background:rgba(255,255,255,.06);color:#faf9f5;border:1px solid rgba(255,255,255,.12)}
.bsnooze:hover{background:rgba(255,255,255,.1)}
.sp{position:absolute;left:0;right:0;bottom:0;padding:8px 16px 12px;background:#252320;border-top:1px solid rgba(255,255,255,.08);border-radius:0 0 10px 10px;display:none;flex-direction:column;gap:6px;z-index:10}
.spr{display:flex;gap:5px}
.spr .btn{flex:1;padding:4px 2px;height:26px;border-radius:5px;font:inherit;font-size:11px;font-weight:500;cursor:pointer;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#faf9f5;transition:all .12s;text-align:center;min-width:0}
.spr .btn:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25)}
.scu{display:flex;gap:6px;align-items:center}
.scu input{width:55px;padding:3px 6px;border:1px solid rgba(255,255,255,.15);border-radius:4px;background:rgba(255,255,255,.06);color:#faf9f5;font-size:12px;outline:none;height:24px}
.scu input:focus{border-color:#cc785c}
.scu .lbl{font-size:11px;color:#a09d96}
.scu .bcn{padding:3px 14px;height:24px;border-radius:5px;font:inherit;font-size:11px;font-weight:500;cursor:pointer;border:none;background:#cc785c;color:#fff;transition:all .12s}
.scu .bcn:hover{background:#a9583e}
.toast-glow{position:absolute;inset:0;border-radius:10px;pointer-events:none;will-change:opacity}
.toast-pulse .toast-glow{box-shadow:0 0 24px rgba(232,165,90,.25);animation:glowPulse 2.5s ease-in-out infinite}
.toast-alert .toast-glow{box-shadow:inset 0 0 16px rgba(198,69,69,.25);animation:glowAlert 1.5s ease-in-out infinite}
@keyframes glowPulse{0%,100%{opacity:.35}50%{opacity:.9}}
@keyframes glowAlert{0%,100%{opacity:.3}50%{opacity:.8}}
</style>
</head>
<body>
${beepDataUrl ? `<audio autoplay src="${beepDataUrl}"></audio>` : ''}
<div class="ub"></div>
<div class="bd${animClass ? ' ' + animClass : ''}">
${animClass ? '<div class="toast-glow"></div>' : ''}
<div class="ul">
<span class="ul-badge">${(rule.urgency || '').toUpperCase()}</span>
<span class="ul-time">${new Date().toLocaleTimeString()}</span>
</div>
<div class="tt">${escapeHtml(rule.title || '')}</div>
<div class="ct">${rule.content ? escapeHtml(rule.content) : ''}</div>
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
function resize(){var h=document.documentElement.scrollHeight;var MAX=200;var ct=document.querySelector('.ct');if(h<=MAX){if(ct){ct.style.overflow='';ct.style.display='';ct.style.webkitBoxOrient='';ct.style.webkitLineClamp=''}window.electronAPI.reminderResize(h)}else{if(ct){var sp=document.getElementById('sp');var ml=sp&&sp.style.display==='flex'?2:5;ct.style.overflow='hidden';ct.style.display='-webkit-box';ct.style.webkitBoxOrient='vertical';ct.style.webkitLineClamp=String(ml)}window.electronAPI.reminderResize(Math.min(MAX,document.documentElement.scrollHeight))}}
resize();
function dismiss(){window.electronAPI.reminderToastDismiss()}
function ts(){var p=document.getElementById('sp');p.style.display=p.style.display==='none'?'flex':'none';setTimeout(resize,50)}
function s(m){window.electronAPI.reminderToastSnooze(m)}
function sc(){var v=parseInt(document.getElementById('cm').value)||15;window.electronAPI.reminderToastSnooze(v)}
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var p=document.getElementById('sp');if(p&&p.style.display!=='none'){p.style.display='none';setTimeout(resize,50)}}})
</script>
</body>
</html>`;
}

// ─── Session Notification Container ─────────────────────────

function createNotificationContainer() {
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;

  const win = new BrowserWindow({
    width: NOTIF_CONTAINER_WIDTH,
    height: sh,
    x: sw - NOTIF_CONTAINER_WIDTH,
    y: 0,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
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

  // Let all mouse events pass through to windows behind (requires layered window)
  win.setIgnoreMouseEvents(true);

  const html = generateContainerHtml();
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  win.once('ready-to-show', () => {
    containerReady = true;
    // Flush queued notifications
    for (const item of notifQueue) {
      win.webContents.send('container:add', item);
    }
    notifQueue = [];
    // Only show if there are already notifications
    if (containerNotifs.length > 0) {
      win.showInactive();
    }
  });
  notifContainer = win;
}

const NOTIF_SVGS: Record<string, string> = {
  session:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  reminder:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  urgent:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  notification:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/></svg>',
  info:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
  warning:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
  milestone:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
};

function showContainerNotification(data: { type: string; notifType?: string; title: string; body: string; color: string; duration: number }) {
  if (!notifContainer || notifContainer.isDestroyed()) return;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const expireTimer = setTimeout(() => dismissContainerNotification(id), data.duration * 1000);
  containerNotifs.push({ id, expireTimer });

  const nt = data.notifType || 'info';
  const iconSvg = NOTIF_SVGS[nt] || NOTIF_SVGS.info;
  const payload = { id, iconSvg, title: data.title, body: data.body, color: data.color };
  if (containerReady) {
    notifContainer.webContents.send('container:add', payload);
    if (!notifContainer.isVisible()) {
      notifContainer.showInactive();
      notifContainer.setIgnoreMouseEvents(true);
    }
  } else {
    notifQueue.push(payload);
  }
}

function dismissContainerNotification(id: string) {
  const idx = containerNotifs.findIndex(n => n.id === id);
  if (idx === -1) {
    // Also check if still queued (dismiss before container ready)
    const qIdx = notifQueue.findIndex(n => n.id === id);
    if (qIdx !== -1) notifQueue.splice(qIdx, 1);
    return;
  }
  clearTimeout(containerNotifs[idx].expireTimer);
  containerNotifs.splice(idx, 1);

  if (notifContainer && !notifContainer.isDestroyed()) {
    notifContainer.webContents.send('container:remove', id);
    // Hide window when empty
    if (containerNotifs.length === 0 && notifQueue.length === 0) {
      notifContainer.hide();
    }
  }
}

function generateContainerHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:transparent;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
#stack{position:fixed;right:${NOTIF_RIGHT}px;bottom:${NOTIF_BOTTOM}px;display:flex;flex-direction:column-reverse;gap:${NOTIF_GAP}px;pointer-events:none}
.notif{width:${NOTIF_CARD_WIDTH}px;background:#252320;border-radius:6px;padding:0 0 0 0;color:#faf9f5;font-size:13px;opacity:0;transform:translate(40px,0);transition:opacity 220ms ease-out,transform ${NOTIF_SLIDE_MS}ms ease-out;pointer-events:none;overflow:hidden}
.notif.show{opacity:1;transform:translate(0,0)}
.notif.leaving{opacity:0;transition:opacity ${NOTIF_FADE_MS}ms ease-in}
.ninner{display:flex;align-items:flex-start;gap:8px;padding:8px 12px}
.nbar{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch}
.nh{font-size:13px;font-weight:600;color:#faf9f5;line-height:1.4}
.nb{font-size:12px;color:#b0ada6;line-height:1.4;margin-top:1px}
</style>
</head>
<body>
<div id="stack"></div>
<script>
var st=document.getElementById('stack');
var ndb={};
var nfSvg={
  session:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  reminder:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  urgent:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  notification:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/></svg>',
  info:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
  warning:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
  milestone:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  low:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
  medium:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/></svg>',
  high:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
  critical:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
};
function addNotif(d){
  console.log("NOTIF_DEBUG",JSON.stringify(d));
  var svg=d.iconSvg;
  var e=document.createElement('div');
  e.className='notif';
  e.id='n'+d.id;
  e.innerHTML='<div class="ninner"><div class="nbar" style="background:'+d.color+'"></div><div><div style="display:flex;align-items:center;gap:6px"><span style="color:'+d.color+';flex-shrink:0;display:flex">'+svg+'</span><div class="nh">'+_e(d.title)+'</div></div>'+(d.body?'<div class="nb">'+_e(d.body)+'</div>':'')+'</div></div>';
  st.appendChild(e);
  ndb[d.id]=e;
  requestAnimationFrame(function(){requestAnimationFrame(function(){e.classList.add('show')})});
}
function removeNotif(id){
  var e=ndb[id];
  if(!e)return;
  delete ndb[id];
  // FLIP: snapshot positions before DOM removal
  var sib=[];for(var i=0;i<st.children.length;i++){var c=st.children[i];if(c!==e)sib.push(c);}
  var oldTops=sib.map(function(s){return s.getBoundingClientRect().top});
  e.classList.add('leaving');
  setTimeout(function(){
    e.remove();
    // FLIP: filter for elements still in DOM, matching oldTops per-element
    var valid=[],validOld=[];
    for(var i=0;i<sib.length;i++){if(sib[i].parentNode===st){valid.push(sib[i]);validOld.push(oldTops[i]);}}
    var newTops=valid.map(function(s){return s.getBoundingClientRect().top});
    valid.forEach(function(s,i){
      var dy=newTops[i]-validOld[i];
      if(dy!==0){s.style.transition='none';s.style.transform='translate(0,'+(-dy)+'px)';}
    });
    requestAnimationFrame(function(){requestAnimationFrame(function(){
      valid.forEach(function(s,i){
        var dy=newTops[i]-validOld[i];
        if(dy!==0){s.style.transition='';s.style.transform='';}
      });
    })});
  },${NOTIF_FADE_MS});
}
function _e(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
if(window.containerBridge){
  window.containerBridge.onAdd(function(d){addNotif(d)});
  window.containerBridge.onRemove(function(id){removeNotif(id)});
}
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
    if (isQuitting || !minimizeToTrayEnabled) {
      tray?.destroy();
      app.quit();
    } else {
      e.preventDefault();
      mainWindow?.hide();
      mainWindow?.setSkipTaskbar(true);
    }
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

function rebuildTrayMenu() {
  if (!tray) return;
  const { isActive, type: currentType } = currentSessionState;

  function showWindow() {
    mainWindow?.show();
    mainWindow?.setSkipTaskbar(false);
    mainWindow?.focus();
  }

  const sessionItems: Electron.MenuItemConstructorOptions[] = [
    { label: '学习模式', enabled: !(isActive && currentType === 'Study'), click: () => { showWindow(); mainWindow?.webContents.send('tray:startSession', 'Study'); } },
    { label: '爱好模式', enabled: !(isActive && currentType === 'Hobby'), click: () => { showWindow(); mainWindow?.webContents.send('tray:startSession', 'Hobby'); } },
    { label: '娱乐模式', enabled: !(isActive && currentType === 'Entertainment'), click: () => { showWindow(); mainWindow?.webContents.send('tray:startSession', 'Entertainment'); } },
    { label: '退出当前状态', enabled: isActive, click: () => { showWindow(); mainWindow?.webContents.send('tray:stopSession'); } },
  ];

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示', click: showWindow },
    { type: 'separator' },
    ...sessionItems,
    { type: 'separator' },
    { label: '设置', click: () => { showWindow(); mainWindow?.webContents.send('tray:navSettings'); } },
    { type: 'separator' },
    { label: '重启', click: () => { isQuitting = true; app.relaunch(); app.quit(); } },
    { label: '退出', click: () => { isQuitting = true; tray?.destroy(); app.quit(); } },
  ]));
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

  rebuildTrayMenu();
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
    createNotificationContainer();
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
