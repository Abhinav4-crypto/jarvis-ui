import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useBackgroundVoiceEngine } from '../hooks/useBackgroundVoiceEngine';
import { jarvisBridge } from '../services/jarvisBridge';
import type {
  ActivityLogItem,
  ChatAttachment,
  ChatMessage,
  ChatSession,
  DockMode,
  JarvisSettings,
  LanguagePreference,
  MemoryItem,
  PageId,
  SearchCategory,
  SearchHistoryEntry,
  SystemHealthSnapshot,
  UserProfile,
  VisionCapture,
  VoiceState,
  VoiceTranscriptEntry,
} from '../types/jarvis';

const STORAGE_KEYS = {
  settings: 'jarvis_settings_v1',
  profile: 'jarvis_profile_v1',
  chats: 'jarvis_chats_v1',
  searches: 'jarvis_searches_v1',
  activity: 'jarvis_activity_v1',
};

export const DEFAULT_SETTINGS: JarvisSettings = {
  general: {
    launchOnStartup: false,
    notificationsEnabled: true,
    interfaceLanguage: 'hinglish',
    defaultLandingPage: 'home',
  },
  appearance: {
    theme: 'dark',
    accentIntensity: 'balanced',
    animationsEnabled: true,
    compactSidebar: false,
  },
  aiModels: {
    activeProvider: 'hybrid',
    ollamaEndpoint: 'http://127.0.0.1:11434',
    ollamaModel: 'llama3.2',
    geminiBridgeUrl: '/api/chat',
    responseStyle: 'balanced',
    temperature: 0.4,
  },
  voice: {
    backgroundListeningEnabled: true,
    selectedVoiceUri: '',
    language: 'hinglish',
    speechRate: 1.0,
    autoSpeakResponses: true,
    microphoneAutoGain: true,
    micMuted: false,
    listeningPaused: false,
  },
  wakeWord: {
    enabled: true,
    phrase: 'Jarvis',
    sensitivity: 'medium',
  },
  privacy: {
    localMemoryEnabled: true,
    saveChatHistory: true,
    indexSelectedFilesOnly: true,
    storeActivityLogs: true,
  },
  storage: {
    maxHistoryItems: 100,
    autoTrimCache: true,
  },
};

const DEFAULT_PROFILE: UserProfile = {
  name: 'Alex Mercer',
  handle: '@alex.workspace',
  role: 'AI Systems Builder',
  email: 'alex@jarvis.local',
  location: 'Windows Desktop Workstation',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  bio: 'Running JARVIS with real local system monitoring, Ollama local models, Gemini reasoning, Screen Vision, and background Hinglish voice control.',
  avatarUrl: '/src/assets/images/user_profile_avatar_1794841433458.jpg',
  preferredGreeting: 'Good day',
  companionTone: 'executive',
  shareTelemetryWithLocalBackend: false,
};

function normalizeLanguagePref(val: unknown): LanguagePreference {
  if (val === 'auto' || val === 'hinglish' || val === 'hindi' || val === 'english') {
    return val;
  }
  if (val === 'Hindi' || val === 'hi-IN') return 'hindi';
  if (val === 'English' || val === 'en-US') return 'english';
  return 'hinglish';
}

function mergeSettingsWithDefaults(raw: Partial<JarvisSettings> | null): JarvisSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const rawVoice = (raw.voice || {}) as Partial<JarvisSettings['voice']> & {
    speechLanguage?: string;
  };
  const rawGeneral = (raw.general || {}) as Partial<JarvisSettings['general']> & {
    interfaceLanguage?: unknown;
  };

  return {
    general: {
      ...DEFAULT_SETTINGS.general,
      ...rawGeneral,
      interfaceLanguage: normalizeLanguagePref(rawGeneral.interfaceLanguage),
    },
    appearance: {
      ...DEFAULT_SETTINGS.appearance,
      ...(raw.appearance || {}),
    },
    aiModels: {
      ...DEFAULT_SETTINGS.aiModels,
      ...(raw.aiModels || {}),
    },
    voice: {
      ...DEFAULT_SETTINGS.voice,
      ...rawVoice,
      language: normalizeLanguagePref(rawVoice.language ?? rawVoice.speechLanguage),
    },
    wakeWord: {
      ...DEFAULT_SETTINGS.wakeWord,
      ...(raw.wakeWord || {}),
      phrase:
        typeof raw.wakeWord?.phrase === 'string' && raw.wakeWord.phrase.trim()
          ? raw.wakeWord.phrase
          : DEFAULT_SETTINGS.wakeWord.phrase,
    },
    privacy: {
      ...DEFAULT_SETTINGS.privacy,
      ...(raw.privacy || {}),
    },
    storage: {
      ...DEFAULT_SETTINGS.storage,
      ...(raw.storage || {}),
    },
  };
}

function safeReadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota issues
  }
}

function nowFormatted(): string {
  return new Date().toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

interface JarvisContextValue {
  activePage: PageId;
  navigateTo: (page: PageId) => void;
  settings: JarvisSettings;
  updateSettings: <K extends keyof JarvisSettings>(
    section: K,
    patch: Partial<JarvisSettings[K]>
  ) => void;
  setStartupLaunch: (enabled: boolean) => Promise<void>;
  toggleTheme: () => void;
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  chats: ChatSession[];
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  createNewChat: () => string;
  deleteChatSession: (id: string) => void;
  sendChatMessage: (
    content: string,
    attachments?: ChatAttachment[],
    targetChatId?: string | null
  ) => Promise<void>;
  regenerateLastPrompt: (chatId: string) => Promise<void>;
  isSendingChat: boolean;
  voiceState: VoiceState;
  setVoiceState: (state: VoiceState) => void;
  voiceInterimText: string;
  voiceError: string | null;
  wakeDetectedAt: number | null;
  lastMatchedPhrase: string | null;
  voiceTranscript: VoiceTranscriptEntry[];
  addVoiceTranscript: (entry: Omit<VoiceTranscriptEntry, 'id' | 'timestamp'>) => void;
  appendRemoteTranscript: (entry: VoiceTranscriptEntry) => void;
  clearVoiceTranscript: () => void;
  startActiveVoiceListening: () => void;
  stopVoiceListening: () => void;
  pauseVoiceListening: () => void;
  resumeVoiceListening: () => void;
  toggleMicMute: (forceMuted?: boolean) => void;
  stopVoiceSpeaking: () => void;
  speakVoiceText: (text: string) => void;
  suspendVoiceForTest: () => void;
  resumeVoiceAfterTest: () => void;
  visionCaptures: VisionCapture[];
  activeVisionId: string | null;
  setActiveVisionId: (id: string | null) => void;
  addVisionCapture: (capture: Omit<VisionCapture, 'id' | 'capturedAt'>) => VisionCapture;
  searches: SearchHistoryEntry[];
  recordSearch: (query: string, category: SearchCategory) => void;
  toggleSaveSearch: (id: string) => void;
  removeSearchEntry: (id: string) => void;
  activityLog: ActivityLogItem[];
  logActivity: (
    category: ActivityLogItem['category'],
    title: string,
    detail: string
  ) => void;
  clearActivityHistory: () => void;
  clearLocalCache: () => void;
  memoryNotes: MemoryItem[];
  addMemoryNote: (note: string) => Promise<void>;
  clearMemoryNotes: () => Promise<void>;
  systemHealth: SystemHealthSnapshot;
  refreshSystemHealth: () => Promise<void>;
  dockMode: DockMode;
  setDockMode: (mode: DockMode) => void;
  dockPinned: boolean;
  setDockPinned: (pinned: boolean) => void;
  confirmDialog: ConfirmOptions | null;
  openConfirmDialog: (options: ConfirmOptions) => void;
  closeConfirmDialog: () => void;
  pendingChatPrefill: { prompt: string; attachments?: ChatAttachment[] } | null;
  consumePendingChatPrefill: () => { prompt: string; attachments?: ChatAttachment[] } | null;
  openChatWithPrompt: (prompt: string, attachments?: ChatAttachment[]) => void;
}

const JarvisContext = createContext<JarvisContextValue | null>(null);

const INITIAL_HEALTH: SystemHealthSnapshot = {
  collectedAt: null,
  hostname: 'Detecting...',
  platform: 'unknown',
  osDistro: 'Detecting...',
  uptimeSeconds: null,
  cpu: {
    available: false,
    usagePercent: null,
    model: 'Checking...',
    cores: null,
    physicalCores: null,
    speedGhz: null,
  },
  ram: {
    available: false,
    totalBytes: null,
    usedBytes: null,
    availableBytes: null,
    usagePercent: null,
  },
  storage: {
    available: false,
    totalBytes: null,
    usedBytes: null,
    freeBytes: null,
    usagePercent: null,
    drives: [],
  },
  battery: {
    available: false,
    hasBattery: false,
    percent: null,
    isCharging: null,
    acConnected: null,
    timeRemainingMinutes: null,
  },
  network: {
    available: false,
    online: typeof navigator !== 'undefined' ? navigator.onLine : false,
    interfaces: [],
  },
  browserStorageUsageMb: null,
  microphonePermission: 'unknown',
  jarvisBackendStatus: 'disconnected',
  ollamaStatus: 'disconnected',
  ollamaModels: [],
  selectedOllamaModelInstalled: false,
  geminiStatus: 'not_configured',
  voiceServiceStatus: 'not_configured',
  screenVisionStatus: 'not_configured',
  fileSystemStatus: 'disconnected',
  isElectronDesktop: false,
  lastRefreshedAt: '--:--:--',
};

export function JarvisProvider({ children }: { children: React.ReactNode }) {
  const windowMode =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('mode')
      : null;
  const isDaemonWindow = windowMode === 'voice-daemon';
  const isDockWindow = windowMode === 'dock';
  const isElectron =
    typeof window !== 'undefined' && Boolean(window.jarvisDesktop?.isElectron);

  const [settings, setSettings] = useState<JarvisSettings>(() => {
    const stored = safeReadStorage<Partial<JarvisSettings> | null>(
      STORAGE_KEYS.settings,
      null
    );
    return mergeSettingsWithDefaults(stored);
  });

  const [activePage, setActivePage] = useState<PageId>(
    () => settings.general.defaultLandingPage || 'home'
  );
  const [profile, setProfile] = useState<UserProfile>(() =>
    safeReadStorage(STORAGE_KEYS.profile, DEFAULT_PROFILE)
  );
  const [chats, setChats] = useState<ChatSession[]>(() =>
    safeReadStorage(STORAGE_KEYS.chats, [])
  );
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    const stored = safeReadStorage<ChatSession[]>(STORAGE_KEYS.chats, []);
    return stored[0]?.id ?? null;
  });
  const [isSendingChat, setIsSendingChat] = useState(false);

  const [remoteVoiceState, setRemoteVoiceState] = useState<VoiceState>(() =>
    settings.voice.micMuted
      ? 'muted'
      : settings.voice.listeningPaused
        ? 'paused'
        : settings.voice.backgroundListeningEnabled
          ? 'standby'
          : 'idle'
  );
  const [remoteInterimText, setRemoteInterimText] = useState('');
  const [remoteVoiceError, setRemoteVoiceError] = useState<string | null>(null);
  const [remoteWakeDetectedAt, setRemoteWakeDetectedAt] = useState<number | null>(null);
  const [remoteLastMatchedPhrase, setRemoteLastMatchedPhrase] = useState<string | null>(null);

  const [voiceTranscript, setVoiceTranscript] = useState<VoiceTranscriptEntry[]>([]);
  const [visionCaptures, setVisionCaptures] = useState<VisionCapture[]>([]);
  const [activeVisionId, setActiveVisionId] = useState<string | null>(null);

  const [searches, setSearches] = useState<SearchHistoryEntry[]>(() =>
    safeReadStorage(STORAGE_KEYS.searches, [])
  );
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>(() =>
    safeReadStorage(STORAGE_KEYS.activity, [])
  );
  const [memoryNotes, setMemoryNotes] = useState<MemoryItem[]>([]);

  const [dockMode, setDockMode] = useState<DockMode>('expanded');
  const [dockPinned, setDockPinned] = useState<boolean>(true);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmOptions | null>(null);
  const [pendingChatPrefill, setPendingChatPrefill] = useState<{
    prompt: string;
    attachments?: ChatAttachment[];
  } | null>(null);

  const [systemHealth, setSystemHealth] = useState<SystemHealthSnapshot>(INITIAL_HEALTH);
  const ignoreNextSyncRef = useRef(false);

  const logActivity = useCallback(
    (category: ActivityLogItem['category'], title: string, detail: string) => {
      if (!settings.privacy.storeActivityLogs) return;
      const item: ActivityLogItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category,
        title,
        detail,
        timestamp: nowFormatted(),
      };
      setActivityLog((prev) =>
        [item, ...prev].slice(0, settings.storage.maxHistoryItems)
      );
    },
    [settings.privacy.storeActivityLogs, settings.storage.maxHistoryItems]
  );

  const appendRemoteTranscript = useCallback(
    (entry: VoiceTranscriptEntry) => {
      setVoiceTranscript((prev) => [...prev, entry]);
      if (entry.speaker === 'user') {
        logActivity('voice', `Voice command (${entry.language})`, entry.text);
      }
    },
    [logActivity]
  );

  const updateSettings = useCallback(
    <K extends keyof JarvisSettings>(section: K, patch: Partial<JarvisSettings[K]>) => {
      setSettings((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          ...patch,
        },
      }));
    },
    []
  );

  // Browser-mode centralized single background voice engine (disabled in Electron main & dock windows
  // because Electron runs the dedicated always-alive BackgroundVoiceDaemon worker window).
  const browserVoiceEngine = useBackgroundVoiceEngine({
    enabled: !isElectron && !isDaemonWindow && !isDockWindow,
    settings,
    transcript: voiceTranscript,
    onTranscriptEntry: appendRemoteTranscript,
    onUpdateVoiceSettings: (patch) => updateSettings('voice', patch),
  });

  // Load persisted disk settings (.jarvis-data/settings.json) and Electron startup state on boot
  useEffect(() => {
    if (isDockWindow) return;

    jarvisBridge.getPersistedSettings().then((diskSettings) => {
      if (diskSettings) {
        ignoreNextSyncRef.current = true;
        setSettings((prev) => mergeSettingsWithDefaults({ ...prev, ...diskSettings }));
      }
    });

    if (window.jarvisDesktop?.getStartupEnabled) {
      window.jarvisDesktop.getStartupEnabled().then((enabled) => {
        ignoreNextSyncRef.current = true;
        setSettings((prev) => ({
          ...prev,
          general: { ...prev.general, launchOnStartup: enabled },
        }));
      });
    }
  }, [isDockWindow]);

  // Sync theme & persist settings to localStorage, backend disk store, and Electron daemon
  useEffect(() => {
    const root = document.documentElement;
    if (settings.appearance.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    safeWriteStorage(STORAGE_KEYS.settings, settings);

    if (ignoreNextSyncRef.current) {
      ignoreNextSyncRef.current = false;
      return;
    }

    if (!isDaemonWindow && !isDockWindow) {
      void jarvisBridge.savePersistedSettings(settings);
      void window.jarvisDesktop?.syncSettings?.(settings);
    }
  }, [settings, isDaemonWindow, isDockWindow]);

  // Receive synced settings updates from main window or tray menu inside Electron
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    if (window.jarvisDesktop?.onSettingsUpdated) {
      cleanups.push(
        window.jarvisDesktop.onSettingsUpdated((next) => {
          if (isDaemonWindow) {
            ignoreNextSyncRef.current = true;
            setSettings(mergeSettingsWithDefaults(next));
          }
        })
      );
    }

    if (window.jarvisDesktop?.onStartupUpdated) {
      cleanups.push(
        window.jarvisDesktop.onStartupUpdated((enabled) => {
          ignoreNextSyncRef.current = true;
          setSettings((prev) => ({
            ...prev,
            general: { ...prev.general, launchOnStartup: enabled },
          }));
        })
      );
    }

    // Main Electron window receives voice status, transcripts, and tray pause/mute commands
    if (isElectron && !isDaemonWindow && !isDockWindow) {
      if (window.jarvisDesktop?.onVoiceStatusUpdated) {
        cleanups.push(
          window.jarvisDesktop.onVoiceStatusUpdated((status) => {
            if (status.state) setRemoteVoiceState(status.state);
            if (typeof status.interimText === 'string') {
              setRemoteInterimText(status.interimText);
            }
            if (status.error !== undefined) {
              setRemoteVoiceError(status.error);
            }
            if (status.lastMatchedPhrase !== undefined) {
              setRemoteLastMatchedPhrase(status.lastMatchedPhrase);
            }
            if (status.wakeDetectedAt !== undefined) {
              setRemoteWakeDetectedAt(status.wakeDetectedAt);
            }
          })
        );
      }

      if (window.jarvisDesktop?.onVoiceTranscriptAdded) {
        cleanups.push(
          window.jarvisDesktop.onVoiceTranscriptAdded((entry) => {
            appendRemoteTranscript(entry);
          })
        );
      }

      if (window.jarvisDesktop?.onVoiceCommand) {
        cleanups.push(
          window.jarvisDesktop.onVoiceCommand((cmd) => {
            if (cmd.type === 'pause') {
              updateSettings('voice', { listeningPaused: true });
            } else if (cmd.type === 'resume') {
              updateSettings('voice', { listeningPaused: false, micMuted: false });
            } else if (cmd.type === 'mute') {
              updateSettings('voice', { micMuted: cmd.muted });
            }
          })
        );
      }
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [appendRemoteTranscript, isDaemonWindow, isDockWindow, isElectron, updateSettings]);

  useEffect(() => {
    safeWriteStorage(STORAGE_KEYS.profile, profile);
  }, [profile]);

  useEffect(() => {
    if (settings.privacy.saveChatHistory) {
      safeWriteStorage(STORAGE_KEYS.chats, chats);
    }
  }, [chats, settings.privacy.saveChatHistory]);

  useEffect(() => {
    safeWriteStorage(STORAGE_KEYS.searches, searches);
  }, [searches]);

  useEffect(() => {
    if (settings.privacy.storeActivityLogs) {
      safeWriteStorage(STORAGE_KEYS.activity, activityLog);
    }
  }, [activityLog, settings.privacy.storeActivityLogs]);

  // Listen to Electron floating dock navigation events
  useEffect(() => {
    if (!window.jarvisDesktop?.onNavigatePage) return;
    return window.jarvisDesktop.onNavigatePage((pageId) => {
      setActivePage(pageId);
    });
  }, []);

  useEffect(() => {
    if (!isDaemonWindow && !isDockWindow) {
      window.jarvisDesktop?.syncActivePage?.(activePage);
    }
  }, [activePage, isDaemonWindow, isDockWindow]);

  const refreshSystemHealth = useCallback(async () => {
    const snapshot = await jarvisBridge.getSystemSnapshot(settings);
    setSystemHealth(snapshot);
  }, [settings]);

  // Initial load + periodic non-blocking polling (skipped in headless voice daemon)
  useEffect(() => {
    if (isDaemonWindow || isDockWindow) return;

    refreshSystemHealth();
    jarvisBridge.getMemory().then(setMemoryNotes);

    const intervalMs = activePage === 'monitor' ? 4000 : 12000;
    const timer = setInterval(() => {
      refreshSystemHealth();
    }, intervalMs);

    const handleOnlineChange = () => refreshSystemHealth();
    window.addEventListener('online', handleOnlineChange);
    window.addEventListener('offline', handleOnlineChange);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnlineChange);
      window.removeEventListener('offline', handleOnlineChange);
    };
  }, [activePage, isDaemonWindow, isDockWindow, refreshSystemHealth]);

  const navigateTo = useCallback((page: PageId) => {
    setActivePage(page);
  }, []);

  const setStartupLaunch = useCallback(
    async (enabled: boolean) => {
      if (window.jarvisDesktop?.setStartupEnabled) {
        const actual = await window.jarvisDesktop.setStartupEnabled(enabled);
        updateSettings('general', { launchOnStartup: actual });
      } else {
        updateSettings('general', { launchOnStartup: enabled });
      }
    },
    [updateSettings]
  );

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        theme: prev.appearance.theme === 'dark' ? 'light' : 'dark',
      },
    }));
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const createNewChat = useCallback(() => {
    const id = `chat-${Date.now()}`;
    const newSession: ChatSession = {
      id,
      title: 'New Conversation',
      createdAt: nowFormatted(),
      updatedAt: nowFormatted(),
      messages: [],
    };
    setChats((prev) => [newSession, ...prev]);
    setActiveChatId(id);
    return id;
  }, []);

  const deleteChatSession = useCallback(
    (id: string) => {
      setChats((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (activeChatId === id) {
          setActiveChatId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
    },
    [activeChatId]
  );

  const sendChatMessage = useCallback(
    async (
      content: string,
      attachments: ChatAttachment[] = [],
      targetChatId?: string | null
    ) => {
      const trimmed = content.trim();
      if (!trimmed && attachments.length === 0) return;

      let chatId = targetChatId ?? activeChatId;
      if (!chatId) {
        chatId = `chat-${Date.now()}`;
        const initialTitle =
          trimmed.slice(0, 42) || attachments[0]?.name || 'New Conversation';
        const created: ChatSession = {
          id: chatId,
          title: initialTitle,
          createdAt: nowFormatted(),
          updatedAt: nowFormatted(),
          messages: [],
        };
        setChats((prev) => [created, ...prev]);
        setActiveChatId(chatId);
      }

      const userMsg: ChatMessage = {
        id: `msg-u-${Date.now()}`,
        role: 'user',
        content: trimmed || `Shared ${attachments.length} attachment(s)`,
        timestamp: nowFormatted(),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      const jarvisMsgId = `msg-j-${Date.now() + 1}`;
      const placeholderJarvisMsg: ChatMessage = {
        id: jarvisMsgId,
        role: 'jarvis',
        content: '',
        timestamp: nowFormatted(),
        sourceNote: 'Connecting...',
        isStreaming: true,
      };

      let historySnapshot: Array<{ role: 'user' | 'jarvis'; content: string }> = [];

      setChats((prev) =>
        prev.map((session) => {
          if (session.id !== chatId) return session;
          historySnapshot = session.messages.map((m) => ({
            role: m.role,
            content: m.content,
          }));
          return {
            ...session,
            title:
              session.messages.length === 0
                ? (trimmed || attachments[0]?.name || 'New Conversation').slice(0, 44)
                : session.title,
            updatedAt: nowFormatted(),
            messages: [...session.messages, userMsg, placeholderJarvisMsg],
          };
        })
      );

      logActivity('chat', 'Prompt sent to JARVIS', trimmed.slice(0, 90) || 'Attachment');

      setIsSendingChat(true);
      try {
        const result = await jarvisBridge.streamChatPrompt(
          {
            prompt: trimmed,
            history: historySnapshot,
            attachments,
          },
          settings,
          (delta, providerLabel) => {
            setChats((prev) =>
              prev.map((session) =>
                session.id !== chatId
                  ? session
                  : {
                      ...session,
                      messages: session.messages.map((m) =>
                        m.id === jarvisMsgId
                          ? {
                              ...m,
                              content: m.content + delta,
                              sourceNote: providerLabel || m.sourceNote,
                            }
                          : m
                      ),
                    }
              )
            );
          }
        );

        setChats((prev) =>
          prev.map((session) =>
            session.id !== chatId
              ? session
              : {
                  ...session,
                  updatedAt: nowFormatted(),
                  messages: session.messages.map((m) =>
                    m.id === jarvisMsgId
                      ? {
                          ...m,
                          content: result.ok
                            ? result.fullText || 'No text output returned.'
                            : result.error || 'Failed to receive AI response.',
                          sourceNote: result.providerLabel,
                          isError: !result.ok,
                          isStreaming: false,
                        }
                      : m
                  ),
                }
          )
        );
      } finally {
        setIsSendingChat(false);
      }
    },
    [activeChatId, logActivity, settings]
  );

  const regenerateLastPrompt = useCallback(
    async (chatId: string) => {
      const session = chats.find((c) => c.id === chatId);
      if (!session) return;
      const lastUserIndex = [...session.messages]
        .reverse()
        .findIndex((m) => m.role === 'user');
      if (lastUserIndex === -1) return;
      const actualIdx = session.messages.length - 1 - lastUserIndex;
      const lastUserMsg = session.messages[actualIdx];

      const jarvisMsgId = `msg-j-${Date.now()}`;
      const streamingReply: ChatMessage = {
        id: jarvisMsgId,
        role: 'jarvis',
        content: '',
        timestamp: nowFormatted(),
        sourceNote: 'Regenerating...',
        isStreaming: true,
      };

      const historyBeforeUser = session.messages
        .slice(0, actualIdx)
        .map((m) => ({ role: m.role, content: m.content }));

      setChats((prev) =>
        prev.map((s) =>
          s.id !== chatId
            ? s
            : {
                ...s,
                messages: [...s.messages.slice(0, actualIdx + 1), streamingReply],
              }
        )
      );

      setIsSendingChat(true);
      try {
        const result = await jarvisBridge.streamChatPrompt(
          {
            prompt: lastUserMsg.content,
            history: historyBeforeUser,
            attachments: lastUserMsg.attachments,
          },
          settings,
          (delta, providerLabel) => {
            setChats((prev) =>
              prev.map((s) =>
                s.id !== chatId
                  ? s
                  : {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === jarvisMsgId
                          ? {
                              ...m,
                              content: m.content + delta,
                              sourceNote: providerLabel || m.sourceNote,
                            }
                          : m
                      ),
                    }
              )
            );
          }
        );

        setChats((prev) =>
          prev.map((s) =>
            s.id !== chatId
              ? s
              : {
                  ...s,
                  updatedAt: nowFormatted(),
                  messages: s.messages.map((m) =>
                    m.id === jarvisMsgId
                      ? {
                          ...m,
                          content: result.ok
                            ? result.fullText
                            : result.error || 'Failed to regenerate.',
                          sourceNote: result.providerLabel,
                          isError: !result.ok,
                          isStreaming: false,
                        }
                      : m
                  ),
                }
          )
        );
      } finally {
        setIsSendingChat(false);
      }
    },
    [chats, settings]
  );

  const addVoiceTranscript = useCallback(
    (entry: Omit<VoiceTranscriptEntry, 'id' | 'timestamp'>) => {
      const item: VoiceTranscriptEntry = {
        ...entry,
        id: `vt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
      appendRemoteTranscript(item);
    },
    [appendRemoteTranscript]
  );

  const clearVoiceTranscript = useCallback(() => {
    setVoiceTranscript([]);
  }, []);

  // Unified voice actions routed either to Electron daemon or local browser engine
  const startActiveVoiceListening = useCallback(() => {
    if (isElectron) {
      updateSettings('voice', { micMuted: false, listeningPaused: false });
      void window.jarvisDesktop?.sendVoiceCommand?.({ type: 'start-active' });
    } else {
      browserVoiceEngine.startActiveListening();
    }
  }, [browserVoiceEngine, isElectron, updateSettings]);

  const stopVoiceListening = useCallback(() => {
    if (isElectron) {
      void window.jarvisDesktop?.sendVoiceCommand?.({ type: 'stop-listening' });
    } else {
      browserVoiceEngine.stopListening();
    }
  }, [browserVoiceEngine, isElectron]);

  const pauseVoiceListening = useCallback(() => {
    updateSettings('voice', { listeningPaused: true });
    if (isElectron) {
      void window.jarvisDesktop?.sendVoiceCommand?.({ type: 'pause' });
    } else {
      browserVoiceEngine.pauseListening();
    }
  }, [browserVoiceEngine, isElectron, updateSettings]);

  const resumeVoiceListening = useCallback(() => {
    updateSettings('voice', { listeningPaused: false, micMuted: false });
    if (isElectron) {
      void window.jarvisDesktop?.sendVoiceCommand?.({ type: 'resume' });
    } else {
      browserVoiceEngine.resumeListening();
    }
  }, [browserVoiceEngine, isElectron, updateSettings]);

  const toggleMicMute = useCallback(
    (forceMuted?: boolean) => {
      const next =
        typeof forceMuted === 'boolean' ? forceMuted : !settings.voice.micMuted;
      updateSettings('voice', { micMuted: next });
      if (isElectron) {
        void window.jarvisDesktop?.sendVoiceCommand?.({ type: 'mute', muted: next });
      } else {
        browserVoiceEngine.toggleMicMute(next);
      }
    },
    [browserVoiceEngine, isElectron, settings.voice.micMuted, updateSettings]
  );

  const stopVoiceSpeaking = useCallback(() => {
    if (isElectron) {
      void window.jarvisDesktop?.sendVoiceCommand?.({ type: 'stop-speaking' });
    } else {
      browserVoiceEngine.stopSpeaking();
    }
  }, [browserVoiceEngine, isElectron]);

  const speakVoiceText = useCallback(
    (text: string) => {
      if (isElectron) {
        void window.jarvisDesktop?.sendVoiceCommand?.({ type: 'speak-text', text });
      } else {
        void browserVoiceEngine.speakText(text);
      }
    },
    [browserVoiceEngine, isElectron]
  );

  const suspendVoiceForTest = useCallback(() => {
    if (isElectron) {
      void window.jarvisDesktop?.sendVoiceCommand?.({ type: 'suspend-for-test' });
    } else {
      browserVoiceEngine.suspendForTest();
    }
  }, [browserVoiceEngine, isElectron]);

  const resumeVoiceAfterTest = useCallback(() => {
    if (isElectron) {
      void window.jarvisDesktop?.sendVoiceCommand?.({ type: 'resume-after-test' });
    } else {
      browserVoiceEngine.resumeAfterTest();
    }
  }, [browserVoiceEngine, isElectron]);

  const activeVoiceState: VoiceState = isElectron
    ? remoteVoiceState
    : browserVoiceEngine.voiceState;
  const activeInterimText = isElectron
    ? remoteInterimText
    : browserVoiceEngine.interimText;
  const activeVoiceError = isElectron
    ? remoteVoiceError
    : browserVoiceEngine.voiceError;
  const activeWakeDetectedAt = isElectron
    ? remoteWakeDetectedAt
    : browserVoiceEngine.wakeDetectedAt;
  const activeLastMatchedPhrase = isElectron
    ? remoteLastMatchedPhrase
    : browserVoiceEngine.lastMatchedPhrase;

  const setVoiceStateCompat = useCallback(
    (next: VoiceState) => {
      if (isElectron) {
        setRemoteVoiceState(next);
      }
    },
    [isElectron]
  );

  const addVisionCapture = useCallback(
    (capture: Omit<VisionCapture, 'id' | 'capturedAt'>) => {
      const item: VisionCapture = {
        ...capture,
        id: `vis-${Date.now()}`,
        capturedAt: nowFormatted(),
      };
      setVisionCaptures((prev) => [item, ...prev]);
      setActiveVisionId(item.id);
      logActivity('vision', `Screen/Image captured (${capture.source})`, capture.label);
      return item;
    },
    [logActivity]
  );

  const recordSearch = useCallback(
    (query: string, category: SearchCategory) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      const entry: SearchHistoryEntry = {
        id: `srch-${Date.now()}`,
        query: trimmed,
        category,
        timestamp: nowFormatted(),
        saved: false,
      };
      setSearches((prev) => [entry, ...prev].slice(0, 50));
      logActivity('search', `Web search: ${trimmed}`, `Category: ${category}`);
    },
    [logActivity]
  );

  const toggleSaveSearch = useCallback((id: string) => {
    setSearches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, saved: !s.saved } : s))
    );
  }, []);

  const removeSearchEntry = useCallback((id: string) => {
    setSearches((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearActivityHistory = useCallback(() => {
    setActivityLog([]);
    safeWriteStorage(STORAGE_KEYS.activity, []);
  }, []);

  const clearLocalCache = useCallback(() => {
    setChats([]);
    setActiveChatId(null);
    setSearches([]);
    setActivityLog([]);
    setVoiceTranscript([]);
    Object.values(STORAGE_KEYS).forEach((k) => {
      if (k !== STORAGE_KEYS.settings && k !== STORAGE_KEYS.profile) {
        localStorage.removeItem(k);
      }
    });
  }, []);

  const addMemoryNote = useCallback(async (note: string) => {
    const items = await jarvisBridge.addMemory(note);
    setMemoryNotes(items);
  }, []);

  const clearMemoryNotes = useCallback(async () => {
    await jarvisBridge.clearMemory();
    setMemoryNotes([]);
  }, []);

  const openConfirmDialog = useCallback((options: ConfirmOptions) => {
    setConfirmDialog(options);
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  const openChatWithPrompt = useCallback(
    (prompt: string, attachments?: ChatAttachment[]) => {
      setPendingChatPrefill({ prompt, attachments });
      setActivePage('chat');
    },
    []
  );

  const consumePendingChatPrefill = useCallback(() => {
    const val = pendingChatPrefill;
    setPendingChatPrefill(null);
    return val;
  }, [pendingChatPrefill]);

  return (
    <JarvisContext.Provider
      value={{
        activePage,
        navigateTo,
        settings,
        updateSettings,
        setStartupLaunch,
        toggleTheme,
        profile,
        updateProfile,
        chats,
        activeChatId,
        setActiveChatId,
        createNewChat,
        deleteChatSession,
        sendChatMessage,
        regenerateLastPrompt,
        isSendingChat,
        voiceState: activeVoiceState,
        setVoiceState: setVoiceStateCompat,
        voiceInterimText: activeInterimText,
        voiceError: activeVoiceError,
        wakeDetectedAt: activeWakeDetectedAt,
        lastMatchedPhrase: activeLastMatchedPhrase,
        voiceTranscript,
        addVoiceTranscript,
        appendRemoteTranscript,
        clearVoiceTranscript,
        startActiveVoiceListening,
        stopVoiceListening,
        pauseVoiceListening,
        resumeVoiceListening,
        toggleMicMute,
        stopVoiceSpeaking,
        speakVoiceText,
        suspendVoiceForTest,
        resumeVoiceAfterTest,
        visionCaptures,
        activeVisionId,
        setActiveVisionId,
        addVisionCapture,
        searches,
        recordSearch,
        toggleSaveSearch,
        removeSearchEntry,
        activityLog,
        logActivity,
        clearActivityHistory,
        clearLocalCache,
        memoryNotes,
        addMemoryNote,
        clearMemoryNotes,
        systemHealth,
        refreshSystemHealth,
        dockMode,
        setDockMode,
        dockPinned,
        setDockPinned,
        confirmDialog,
        openConfirmDialog,
        closeConfirmDialog,
        pendingChatPrefill,
        consumePendingChatPrefill,
        openChatWithPrompt,
      }}
    >
      {children}
    </JarvisContext.Provider>
  );
}

export function useJarvis() {
  const ctx = useContext(JarvisContext);
  if (!ctx) {
    throw new Error('useJarvis must be used within JarvisProvider');
  }
  return ctx;
}
