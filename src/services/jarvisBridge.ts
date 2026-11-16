import type {
  ChatAttachment,
  ConnectionState,
  ElectronScreenSource,
  FilePreviewData,
  FolderCategory,
  JarvisSettings,
  LiveSearchResult,
  LocalFileItem,
  MemoryItem,
  PageId,
  SystemHealthSnapshot,
  VoiceState,
  VoiceTranscriptEntry,
} from '../types/jarvis';

export type VoiceCommandPayload =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'mute'; muted: boolean }
  | { type: 'start-active' }
  | { type: 'stop-listening' }
  | { type: 'stop-speaking' }
  | { type: 'speak-text'; text: string }
  | { type: 'suspend-for-test' }
  | { type: 'resume-after-test' };

export interface VoiceRuntimeStatusPayload {
  state?: VoiceState;
  paused?: boolean;
  micMuted?: boolean;
  backgroundEnabled?: boolean;
  wakePhrase?: string;
  interimText?: string;
  error?: string | null;
  lastMatchedPhrase?: string | null;
  wakeDetectedAt?: number | null;
}

export interface JarvisDesktopBridge {
  isElectron?: boolean;
  platform?: string;
  getScreenSources?: () => Promise<ElectronScreenSource[]>;
  captureScreenSource?: (
    sourceId: string
  ) => Promise<{ id: string; name: string; dataUrl: string; capturedAt: string }>;
  openLocalFile?: (targetPath: string) => Promise<{ opened: boolean; error?: string }>;
  openExternalUrl?: (url: string) => Promise<boolean>;
  navigateFromDock?: (pageId: PageId) => Promise<boolean>;
  syncActivePage?: (pageId: PageId) => Promise<void>;
  controlDock?: (
    action: 'pin' | 'hide' | 'show' | 'minimize' | 'expand',
    payload?: unknown
  ) => Promise<boolean>;
  sendVoiceCommand?: (command: VoiceCommandPayload) => Promise<boolean>;
  reportVoiceStatus?: (status: VoiceRuntimeStatusPayload) => Promise<void>;
  reportVoiceTranscript?: (entry: VoiceTranscriptEntry) => Promise<void>;
  syncSettings?: (settings: JarvisSettings) => Promise<boolean>;
  getStartupEnabled?: () => Promise<boolean>;
  setStartupEnabled?: (enabled: boolean) => Promise<boolean>;
  exitApp?: () => Promise<void>;
  onNavigatePage?: (callback: (pageId: PageId) => void) => () => void;
  onActivePageUpdated?: (callback: (pageId: PageId) => void) => () => void;
  onVoiceCommand?: (callback: (command: VoiceCommandPayload) => void) => () => void;
  onVoiceStatusUpdated?: (
    callback: (status: VoiceRuntimeStatusPayload) => void
  ) => () => void;
  onVoiceTranscriptAdded?: (
    callback: (entry: VoiceTranscriptEntry) => void
  ) => () => void;
  onSettingsUpdated?: (callback: (settings: JarvisSettings) => void) => () => void;
  onStartupUpdated?: (callback: (enabled: boolean) => void) => () => void;
}

declare global {
  interface Window {
    jarvisDesktop?: JarvisDesktopBridge;
  }
}

export const jarvisBridge = {
  isElectron(): boolean {
    return Boolean(typeof window !== 'undefined' && window.jarvisDesktop?.isElectron);
  },

  async streamChatPrompt(
    request: {
      prompt: string;
      history: Array<{ role: 'user' | 'jarvis'; content: string }>;
      attachments?: ChatAttachment[];
    },
    settings: JarvisSettings,
    onDelta: (chunk: string, providerLabel?: string) => void
  ): Promise<{ ok: boolean; fullText: string; providerLabel: string; error?: string }> {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: request.prompt,
          history: request.history,
          attachments: request.attachments,
          provider: settings.aiModels.activeProvider,
          ollamaModel: settings.aiModels.ollamaModel,
          ollamaEndpoint: settings.aiModels.ollamaEndpoint || undefined,
          language: settings.voice.language,
          responseStyle: settings.aiModels.responseStyle,
          useLocalMemory: settings.privacy.localMemoryEnabled,
          stream: true,
        }),
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok && !contentType.includes('text/event-stream')) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        return {
          ok: false,
          fullText: '',
          providerLabel: 'Backend',
          error: errBody.error || `Backend returned HTTP ${response.status}`,
        };
      }

      if (!response.body) {
        return {
          ok: false,
          fullText: '',
          providerLabel: 'Backend',
          error: 'No response stream received from server.',
        };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let providerLabel = 'JARVIS Backend';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const parsed = JSON.parse(jsonStr) as {
              meta?: { providerLabel?: string };
              delta?: string;
              error?: string;
            };
            if (parsed.meta?.providerLabel) {
              providerLabel = parsed.meta.providerLabel;
            }
            if (parsed.error) {
              return {
                ok: false,
                fullText,
                providerLabel,
                error: parsed.error,
              };
            }
            if (parsed.delta) {
              fullText += parsed.delta;
              onDelta(parsed.delta, providerLabel);
            }
          } catch {
            // Ignore malformed chunk
          }
        }
      }

      return { ok: true, fullText, providerLabel };
    } catch (err) {
      return {
        ok: false,
        fullText: '',
        providerLabel: 'Backend',
        error:
          err instanceof Error
            ? `Failed to reach JARVIS backend: ${err.message}`
            : 'Failed to reach JARVIS backend.',
      };
    }
  },

  async analyzeVisionImage(
    request: { prompt: string; imageDataUrl: string },
    settings: JarvisSettings
  ): Promise<{
    connected: boolean;
    analysisText?: string;
    providerLabel?: string;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: request.prompt,
          imageDataUrl: request.imageDataUrl,
          provider: settings.aiModels.activeProvider,
          ollamaModel: settings.aiModels.ollamaModel,
          ollamaEndpoint: settings.aiModels.ollamaEndpoint || undefined,
        }),
      });
      const data = (await response.json()) as {
        connected?: boolean;
        analysisText?: string;
        providerLabel?: string;
        error?: string;
      };
      return {
        connected: Boolean(data.connected && response.ok),
        analysisText: data.analysisText,
        providerLabel: data.providerLabel,
        error: data.error,
      };
    } catch (err) {
      return {
        connected: false,
        error:
          err instanceof Error
            ? `Vision request failed: ${err.message}`
            : 'Vision backend unreachable.',
      };
    }
  },

  async runWebSearch(query: string): Promise<{
    connected: boolean;
    summary?: string;
    results: LiveSearchResult[];
    error?: string;
  }> {
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      return (await res.json()) as {
        connected: boolean;
        summary?: string;
        results: LiveSearchResult[];
        error?: string;
      };
    } catch (err) {
      return {
        connected: false,
        results: [],
        error: err instanceof Error ? err.message : 'Search request failed.',
      };
    }
  },

  async browseOsFolder(
    folder: Exclude<FolderCategory, 'all'>,
    customDir?: string
  ): Promise<{
    directory: string;
    exists: boolean;
    items: LocalFileItem[];
    error?: string;
  }> {
    const params = new URLSearchParams({ folder });
    if (customDir) params.set('dir', customDir);
    const res = await fetch(`/api/files/browse?${params.toString()}`);
    return res.json();
  },

  async searchOsFiles(
    query: string,
    folder: FolderCategory,
    searchContent: boolean
  ): Promise<{ items: LocalFileItem[]; searchedFolders: string[] }> {
    const params = new URLSearchParams({
      q: query,
      folder,
      content: String(searchContent),
    });
    const res = await fetch(`/api/files/search?${params.toString()}`);
    return res.json();
  },

  async previewOsFile(fullPath: string): Promise<FilePreviewData> {
    const params = new URLSearchParams({ path: fullPath });
    const res = await fetch(`/api/files/preview?${params.toString()}`);
    return res.json();
  },

  async openOsFile(fullPath: string): Promise<{ opened: boolean; error?: string }> {
    if (window.jarvisDesktop?.openLocalFile) {
      return window.jarvisDesktop.openLocalFile(fullPath);
    }
    const res = await fetch('/api/files/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fullPath }),
    });
    return res.json();
  },

  async getMemory(): Promise<MemoryItem[]> {
    try {
      const res = await fetch('/api/memory');
      const data = (await res.json()) as { items?: MemoryItem[] };
      return data.items || [];
    } catch {
      return [];
    }
  },

  async addMemory(note: string): Promise<MemoryItem[]> {
    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    const data = (await res.json()) as { items?: MemoryItem[] };
    return data.items || [];
  },

  async clearMemory(): Promise<void> {
    await fetch('/api/memory', { method: 'DELETE' });
  },

  async getPersistedSettings(): Promise<Partial<JarvisSettings> | null> {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return null;
      const data = (await res.json()) as { settings?: Partial<JarvisSettings> | null };
      return data.settings || null;
    } catch {
      return null;
    }
  },

  async savePersistedSettings(settings: JarvisSettings): Promise<boolean> {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getSystemSnapshot(settings: JarvisSettings): Promise<SystemHealthSnapshot> {
    let browserStorageUsageMb: number | null = null;
    try {
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        if (typeof estimate.usage === 'number') {
          browserStorageUsageMb = Number((estimate.usage / (1024 * 1024)).toFixed(2));
        }
      }
    } catch {
      browserStorageUsageMb = null;
    }

    let microphonePermission: SystemHealthSnapshot['microphonePermission'] = 'unknown';
    try {
      if (navigator.permissions?.query) {
        const perm = await navigator.permissions.query({
          name: 'microphone' as PermissionName,
        });
        microphonePermission = perm.state;
      }
    } catch {
      microphonePermission = 'unknown';
    }

    const speechSupported =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const screenCaptureSupported =
      Boolean(window.jarvisDesktop?.getScreenSources) ||
      Boolean(navigator.mediaDevices?.getDisplayMedia);

    const statusParams = new URLSearchParams();
    if (settings.aiModels.ollamaEndpoint.trim()) {
      statusParams.set('ollamaUrl', settings.aiModels.ollamaEndpoint.trim());
    }
    if (settings.aiModels.ollamaModel.trim()) {
      statusParams.set('ollamaModel', settings.aiModels.ollamaModel.trim());
    }

    let backendStatus: ConnectionState = 'disconnected';
    let ollamaStatus: ConnectionState = 'disconnected';
    let ollamaModels: string[] = [];
    let selectedOllamaModelInstalled = false;
    let geminiStatus: ConnectionState = 'not_configured';
    let fileSystemStatus: ConnectionState = 'disconnected';
    let sysData: Record<string, unknown> | null = null;
    let telemetryError: string | undefined;

    try {
      const [statusRes, sysRes] = await Promise.all([
        fetch(`/api/status?${statusParams.toString()}`),
        fetch('/api/system'),
      ]);

      if (statusRes.ok) {
        const st = (await statusRes.json()) as {
          backend?: { status?: ConnectionState };
          ollama?: {
            status?: ConnectionState;
            models?: string[];
            selectedModelInstalled?: boolean;
          };
          gemini?: { status?: ConnectionState };
          fileSystem?: { status?: ConnectionState };
        };
        backendStatus = st.backend?.status || 'connected';
        ollamaStatus = st.ollama?.status || 'disconnected';
        ollamaModels = st.ollama?.models || [];
        selectedOllamaModelInstalled = Boolean(st.ollama?.selectedModelInstalled);
        geminiStatus = st.gemini?.status || 'not_configured';
        fileSystemStatus = st.fileSystem?.status || 'error';
      } else {
        backendStatus = 'error';
      }

      if (sysRes.ok) {
        sysData = (await sysRes.json()) as Record<string, unknown>;
      } else {
        telemetryError = `System endpoint returned HTTP ${sysRes.status}`;
      }
    } catch (err) {
      backendStatus = 'disconnected';
      telemetryError =
        err instanceof Error ? err.message : 'Unable to reach JARVIS backend.';
    }

    const cpuObj = (sysData?.cpu as SystemHealthSnapshot['cpu']) || {
      available: false,
      usagePercent: null,
      model: 'Unavailable',
      cores: null,
      physicalCores: null,
      speedGhz: null,
      error: telemetryError || 'Backend unreachable',
    };

    const ramObj = (sysData?.ram as SystemHealthSnapshot['ram']) || {
      available: false,
      totalBytes: null,
      usedBytes: null,
      availableBytes: null,
      usagePercent: null,
      error: telemetryError || 'Backend unreachable',
    };

    const storageObj = (sysData?.storage as SystemHealthSnapshot['storage']) || {
      available: false,
      totalBytes: null,
      usedBytes: null,
      freeBytes: null,
      usagePercent: null,
      drives: [],
      error: telemetryError || 'Backend unreachable',
    };

    const batteryObj = (sysData?.battery as SystemHealthSnapshot['battery']) || {
      available: false,
      hasBattery: false,
      percent: null,
      isCharging: null,
      acConnected: null,
      timeRemainingMinutes: null,
      error: telemetryError || 'Backend unreachable',
    };

    const networkObj = (sysData?.network as SystemHealthSnapshot['network']) || {
      available: false,
      online: typeof navigator !== 'undefined' ? navigator.onLine : false,
      interfaces: [],
      error: telemetryError,
    };

    return {
      collectedAt: (sysData?.collectedAt as string) || null,
      hostname: (sysData?.hostname as string) || 'Local Workstation',
      platform: (sysData?.platform as string) || 'unknown',
      osDistro: (sysData?.osDistro as string) || 'Unavailable',
      uptimeSeconds: (sysData?.uptimeSeconds as number) ?? null,
      cpu: cpuObj,
      ram: ramObj,
      storage: storageObj,
      battery: batteryObj,
      network: networkObj,
      browserStorageUsageMb,
      microphonePermission,
      jarvisBackendStatus: backendStatus,
      ollamaStatus,
      ollamaModels,
      selectedOllamaModelInstalled,
      geminiStatus,
      voiceServiceStatus:
        microphonePermission === 'denied'
          ? 'error'
          : speechSupported
            ? 'connected'
            : 'not_configured',
      screenVisionStatus: screenCaptureSupported ? 'connected' : 'not_configured',
      fileSystemStatus,
      isElectronDesktop: this.isElectron(),
      lastRefreshedAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      telemetryError,
    };
  },

  buildGoogleSearchUrl(query: string, category = 'all') {
    const trimmed = query.trim();
    const qualifierMap: Record<string, string> = {
      all: '',
      docs: ' documentation',
      code: ' github OR stackoverflow',
      news: ' latest news',
      academic: ' site:scholar.google.com OR filetype:pdf',
      video: ' site:youtube.com',
    };
    const suffix = qualifierMap[category] || '';
    return `https://www.google.com/search?q=${encodeURIComponent(`${trimmed}${suffix}`)}`;
  },
};
