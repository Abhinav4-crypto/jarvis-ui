const { contextBridge, ipcRenderer } = require('electron');

const VALID_PAGES = new Set([
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

contextBridge.exposeInMainWorld('jarvisDesktop', {
  isElectron: true,
  platform: process.platform,

  getScreenSources: () => ipcRenderer.invoke('jarvis:get-screen-sources'),
  captureScreenSource: (sourceId) =>
    ipcRenderer.invoke('jarvis:capture-screen-source', sourceId),

  openLocalFile: (targetPath) => ipcRenderer.invoke('jarvis:open-file', targetPath),
  openExternalUrl: (url) => ipcRenderer.invoke('jarvis:open-external', url),

  navigateFromDock: (pageId) => {
    if (VALID_PAGES.has(pageId)) {
      return ipcRenderer.invoke('jarvis:dock-navigate', pageId);
    }
    return Promise.resolve(false);
  },

  syncActivePage: (pageId) => {
    if (VALID_PAGES.has(pageId)) {
      return ipcRenderer.invoke('jarvis:sync-active-page', pageId);
    }
    return Promise.resolve();
  },

  controlDock: (action, payload) =>
    ipcRenderer.invoke('jarvis:dock-control', action, payload),

  sendVoiceCommand: (commandPayload) =>
    ipcRenderer.invoke('jarvis:send-voice-command', commandPayload),

  reportVoiceStatus: (statusPayload) =>
    ipcRenderer.invoke('jarvis:report-voice-status', statusPayload),

  reportVoiceTranscript: (entry) =>
    ipcRenderer.invoke('jarvis:report-voice-transcript', entry),

  syncSettings: (settings) => ipcRenderer.invoke('jarvis:sync-settings', settings),

  getStartupEnabled: () => ipcRenderer.invoke('jarvis:get-startup'),
  setStartupEnabled: (enabled) => ipcRenderer.invoke('jarvis:set-startup', enabled),
  exitApp: () => ipcRenderer.invoke('jarvis:exit-app'),

  onNavigatePage: (callback) => {
    const handler = (_event, pageId) => callback(pageId);
    ipcRenderer.on('jarvis:navigate-page', handler);
    return () => ipcRenderer.removeListener('jarvis:navigate-page', handler);
  },

  onActivePageUpdated: (callback) => {
    const handler = (_event, pageId) => callback(pageId);
    ipcRenderer.on('jarvis:active-page-updated', handler);
    return () => ipcRenderer.removeListener('jarvis:active-page-updated', handler);
  },

  onVoiceCommand: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('jarvis:voice-command', handler);
    return () => ipcRenderer.removeListener('jarvis:voice-command', handler);
  },

  onVoiceStatusUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('jarvis:voice-status-updated', handler);
    return () => ipcRenderer.removeListener('jarvis:voice-status-updated', handler);
  },

  onVoiceTranscriptAdded: (callback) => {
    const handler = (_event, entry) => callback(entry);
    ipcRenderer.on('jarvis:voice-transcript-added', handler);
    return () => ipcRenderer.removeListener('jarvis:voice-transcript-added', handler);
  },

  onSettingsUpdated: (callback) => {
    const handler = (_event, settings) => callback(settings);
    ipcRenderer.on('jarvis:settings-updated', handler);
    return () => ipcRenderer.removeListener('jarvis:settings-updated', handler);
  },

  onStartupUpdated: (callback) => {
    const handler = (_event, enabled) => callback(enabled);
    ipcRenderer.on('jarvis:startup-updated', handler);
    return () => ipcRenderer.removeListener('jarvis:startup-updated', handler);
  },
});
