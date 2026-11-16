const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  desktopCapturer,
  ipcMain,
  nativeImage,
  screen,
  session,
  shell,
} = require('electron');
const path = require('node:path');
const os = require('node:os');

const APP_ORIGIN = process.env.JARVIS_APP_URL || 'http://localhost:3000';
const ALLOWED_PAGES = new Set([
  'home',
  'chat',
  'voice',
  'files',
  'vision',
  'search',
  'monitor',
  'settings',
  'profile',
  'activity',
]);

let mainWindow = null;
let dockWindow = null;
let voiceWorkerWindow = null;
let tray = null;
let isQuitting = false;

let runtimeVoiceStatus = {
  state: 'standby',
  paused: false,
  micMuted: false,
  backgroundEnabled: true,
  wakePhrase: 'Jarvis',
};

// Ensure single instance so background microphone listeners never duplicate
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

function isTrustedUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.origin === new URL(APP_ORIGIN).origin ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

/**
 * Generates a crisp 16x16 black-and-gold orbital tray icon in memory
 * so the Windows system tray icon always renders without missing external .ico assets.
 */
function createTrayIcon() {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  const cx = 7.5;
  const cy = 7.5;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      const dist = Math.hypot(x - cx, y - cy);

      if (dist <= 3.1) {
        // Glowing golden-amber core
        buffer[idx] = 251;     // R
        buffer[idx + 1] = 191; // G
        buffer[idx + 2] = 36;  // B
        buffer[idx + 3] = 255; // A
      } else if (dist <= 5.2) {
        // Obsidian inner ring
        buffer[idx] = 14;
        buffer[idx + 1] = 13;
        buffer[idx + 2] = 16;
        buffer[idx + 3] = 255;
      } else if (dist <= 7.0) {
        // Outer golden-orange halo ring
        buffer[idx] = 245;
        buffer[idx + 1] = 158;
        buffer[idx + 2] = 11;
        buffer[idx + 3] = 255;
      } else {
        // Transparent outer corners
        buffer[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function broadcastToWindows(channel, payload) {
  for (const win of [mainWindow, voiceWorkerWindow, dockWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function rebuildTrayMenu() {
  if (!tray) return;
  const loginSettings = app.getLoginItemSettings();

  const statusLabel = runtimeVoiceStatus.micMuted
    ? 'JARVIS · Mic Muted'
    : runtimeVoiceStatus.paused
      ? 'JARVIS · Listening Paused'
      : `JARVIS · Wake "${runtimeVoiceStatus.wakePhrase}" (${runtimeVoiceStatus.state})`;

  const menu = Menu.buildFromTemplate([
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    {
      label: 'Open JARVIS',
      click: () => showMainWindow(),
    },
    {
      label: runtimeVoiceStatus.paused ? 'Resume Listening' : 'Pause Listening',
      click: () => {
        const nextPaused = !runtimeVoiceStatus.paused;
        runtimeVoiceStatus.paused = nextPaused;
        broadcastToWindows('jarvis:voice-command', {
          type: nextPaused ? 'pause' : 'resume',
        });
        rebuildTrayMenu();
      },
    },
    {
      label: runtimeVoiceStatus.micMuted ? 'Unmute Microphone' : 'Mute Microphone',
      click: () => {
        const nextMuted = !runtimeVoiceStatus.micMuted;
        runtimeVoiceStatus.micMuted = nextMuted;
        broadcastToWindows('jarvis:voice-command', {
          type: 'mute',
          muted: nextMuted,
        });
        rebuildTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: Boolean(loginSettings.openAtLogin),
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        broadcastToWindows('jarvis:startup-updated', item.checked);
      },
    },
    { type: 'separator' },
    {
      label: 'Exit JARVIS',
      click: () => {
        isQuitting = true;
        if (voiceWorkerWindow && !voiceWorkerWindow.isDestroyed()) {
          voiceWorkerWindow.destroy();
        }
        if (dockWindow && !dockWindow.isDestroyed()) {
          dockWindow.destroy();
        }
        app.quit();
      },
    },
  ]);

  tray.setToolTip(statusLabel);
  tray.setContextMenu(menu);
}

function createSystemTray() {
  if (tray) return;
  tray = new Tray(createTrayIcon());
  tray.on('double-click', () => showMainWindow());
  tray.on('click', () => {
    if (process.platform === 'win32') {
      showMainWindow();
    }
  });
  rebuildTrayMenu();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'JARVIS — AI Companion',
    backgroundColor: '#070708',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.loadURL(APP_ORIGIN);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Closing the main window minimizes to Windows system tray instead of terminating background JARVIS
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      rebuildTrayMenu();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createBackgroundVoiceWorker() {
  if (voiceWorkerWindow && !voiceWorkerWindow.isDestroyed()) return;

  voiceWorkerWindow = new BrowserWindow({
    width: 320,
    height: 240,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  voiceWorkerWindow.loadURL(`${APP_ORIGIN}/?mode=voice-daemon`);

  voiceWorkerWindow.on('closed', () => {
    voiceWorkerWindow = null;
  });
}

function createFloatingDockWindow() {
  if (dockWindow && !dockWindow.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;
  const dockWidth = 540;
  const dockHeight = 76;

  dockWindow = new BrowserWindow({
    width: dockWidth,
    height: dockHeight,
    x: Math.round((screenW - dockWidth) / 2),
    y: screenH - dockHeight - 16,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  dockWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  dockWindow.loadURL(`${APP_ORIGIN}/?mode=dock`);

  dockWindow.on('closed', () => {
    dockWindow = null;
  });
}

function registerSecurityAndPermissions() {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const url = webContents.getURL();
      if (!isTrustedUrl(url)) {
        callback(false);
        return;
      }
      const allowedPermissions = new Set([
        'media',
        'audioCapture',
        'notifications',
        'clipboard-read',
      ]);
      callback(allowedPermissions.has(permission));
    }
  );
}

function registerIpcHandlers() {
  ipcMain.handle('jarvis:get-screen-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 480, height: 270 },
      fetchWindowIcons: true,
    });

    return sources.map((src) => ({
      id: src.id,
      name: src.name,
      kind: src.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnailDataUrl: src.thumbnail.toDataURL(),
    }));
  });

  ipcMain.handle('jarvis:capture-screen-source', async (_event, sourceId) => {
    if (typeof sourceId !== 'string' || !sourceId.trim()) {
      throw new Error('Invalid screen source identifier.');
    }

    const primarySize = screen.getPrimaryDisplay().size;
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: {
        width: Math.min(1920, primarySize.width),
        height: Math.min(1080, primarySize.height),
      },
    });

    const match = sources.find((s) => s.id === sourceId);
    if (!match) {
      throw new Error('Selected screen or window is no longer available.');
    }

    return {
      id: match.id,
      name: match.name,
      dataUrl: match.thumbnail.toDataURL(),
      capturedAt: new Date().toISOString(),
    };
  });

  ipcMain.handle('jarvis:open-file', async (_event, targetPath) => {
    if (typeof targetPath !== 'string' || !targetPath.trim()) {
      return { opened: false, error: 'Invalid path' };
    }
    const resolved = path.resolve(targetPath);
    const home = path.resolve(os.homedir());
    if (resolved !== home && !resolved.startsWith(home + path.sep)) {
      return { opened: false, error: 'Access restricted to user home directory.' };
    }
    const errMsg = await shell.openPath(resolved);
    return { opened: !errMsg, error: errMsg || undefined };
  });

  ipcMain.handle('jarvis:open-external', async (_event, rawUrl) => {
    if (typeof rawUrl !== 'string') return false;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        await shell.openExternal(parsed.toString());
        return true;
      }
    } catch {
      return false;
    }
    return false;
  });

  ipcMain.handle('jarvis:dock-navigate', (_event, pageId) => {
    if (typeof pageId !== 'string' || !ALLOWED_PAGES.has(pageId)) return false;
    showMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('jarvis:navigate-page', pageId);
      return true;
    }
    return false;
  });

  ipcMain.handle('jarvis:sync-active-page', (_event, pageId) => {
    if (typeof pageId !== 'string' || !ALLOWED_PAGES.has(pageId)) return;
    if (dockWindow && !dockWindow.isDestroyed()) {
      dockWindow.webContents.send('jarvis:active-page-updated', pageId);
    }
  });

  ipcMain.handle('jarvis:dock-control', (_event, action, payload) => {
    if (!dockWindow || dockWindow.isDestroyed()) return false;
    if (action === 'pin') {
      dockWindow.setAlwaysOnTop(Boolean(payload), 'screen-saver');
      return true;
    }
    if (action === 'hide') {
      dockWindow.hide();
      return true;
    }
    if (action === 'show') {
      dockWindow.show();
      return true;
    }
    if (action === 'minimize') {
      dockWindow.setSize(220, 54);
      return true;
    }
    if (action === 'expand') {
      dockWindow.setSize(540, 76);
      return true;
    }
    return false;
  });

  // Background Voice Daemon & Settings IPC Sync
  ipcMain.handle('jarvis:send-voice-command', (_event, commandPayload) => {
    if (commandPayload && typeof commandPayload === 'object') {
      if (commandPayload.type === 'pause') runtimeVoiceStatus.paused = true;
      if (commandPayload.type === 'resume') runtimeVoiceStatus.paused = false;
      if (commandPayload.type === 'mute') {
        runtimeVoiceStatus.micMuted = Boolean(commandPayload.muted);
      }
      rebuildTrayMenu();
      broadcastToWindows('jarvis:voice-command', commandPayload);
    }
    return true;
  });

  ipcMain.handle('jarvis:report-voice-status', (_event, statusPayload) => {
    if (statusPayload && typeof statusPayload === 'object') {
      runtimeVoiceStatus = { ...runtimeVoiceStatus, ...statusPayload };
      rebuildTrayMenu();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('jarvis:voice-status-updated', statusPayload);
      }
    }
  });

  ipcMain.handle('jarvis:report-voice-transcript', (_event, entry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('jarvis:voice-transcript-added', entry);
    }
  });

  ipcMain.handle('jarvis:sync-settings', (_event, nextSettings) => {
    if (nextSettings && typeof nextSettings === 'object') {
      if (nextSettings.wakeWord?.phrase) {
        runtimeVoiceStatus.wakePhrase = nextSettings.wakeWord.phrase;
      }
      if (typeof nextSettings.voice?.backgroundListeningEnabled === 'boolean') {
        runtimeVoiceStatus.backgroundEnabled =
          nextSettings.voice.backgroundListeningEnabled;
      }
      if (typeof nextSettings.voice?.micMuted === 'boolean') {
        runtimeVoiceStatus.micMuted = nextSettings.voice.micMuted;
      }
      if (typeof nextSettings.voice?.listeningPaused === 'boolean') {
        runtimeVoiceStatus.paused = nextSettings.voice.listeningPaused;
      }
      rebuildTrayMenu();
      broadcastToWindows('jarvis:settings-updated', nextSettings);
    }
    return true;
  });

  // Windows Startup (Start with Windows)
  ipcMain.handle('jarvis:get-startup', () => {
    return Boolean(app.getLoginItemSettings().openAtLogin);
  });

  ipcMain.handle('jarvis:set-startup', (_event, enabled) => {
    const flag = Boolean(enabled);
    app.setLoginItemSettings({ openAtLogin: flag });
    rebuildTrayMenu();
    return Boolean(app.getLoginItemSettings().openAtLogin);
  });

  ipcMain.handle('jarvis:exit-app', () => {
    isQuitting = true;
    if (voiceWorkerWindow && !voiceWorkerWindow.isDestroyed()) {
      voiceWorkerWindow.destroy();
    }
    app.quit();
  });
}

app.whenReady().then(() => {
  registerSecurityAndPermissions();
  registerIpcHandlers();
  createSystemTray();
  createMainWindow();
  createFloatingDockWindow();
  createBackgroundVoiceWorker();

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Keep running in system tray unless user explicitly selected Exit JARVIS
  if (isQuitting && process.platform !== 'darwin') {
    app.quit();
  }
});
