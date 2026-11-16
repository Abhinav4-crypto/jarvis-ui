export type PageId =
  | 'home'
  | 'chat'
  | 'voice'
  | 'files'
  | 'vision'
  | 'search'
  | 'monitor'
  | 'settings'
  | 'profile'
  | 'activity';

export type ThemeMode = 'dark' | 'light';

export type VoiceState =
  | 'idle'
  | 'standby'
  | 'acknowledged'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'paused'
  | 'muted';

export type LanguagePreference = 'auto' | 'hinglish' | 'hindi' | 'english';

export type ConnectionState =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'not_configured';

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
  textSnippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'jarvis';
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  sourceNote?: string;
  isError?: boolean;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface VoiceTranscriptEntry {
  id: string;
  speaker: 'user' | 'jarvis';
  text: string;
  language: LanguagePreference;
  timestamp: string;
}

export type FolderCategory =
  | 'all'
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'pictures'
  | 'videos';

export type FileTypeFilter = 'all' | 'document' | 'image' | 'code' | 'media' | 'folder';

export interface LocalFileItem {
  id: string;
  name: string;
  fullPath: string;
  folder: Exclude<FolderCategory, 'all'> | 'home';
  typeCategory: Exclude<FileTypeFilter, 'all'> | 'other';
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  isDirectory: boolean;
  matchSnippet?: string;
}

export interface FilePreviewData {
  fullPath: string;
  name: string;
  sizeBytes: number;
  modifiedAt: string;
  extension: string;
  previewKind: 'text' | 'image' | 'unsupported';
  textContent?: string;
  truncated?: boolean;
  error?: string;
}

export interface ElectronScreenSource {
  id: string;
  name: string;
  kind: 'screen' | 'window';
  thumbnailDataUrl: string;
}

export interface VisionCapture {
  id: string;
  label: string;
  source: 'upload' | 'camera' | 'screen' | 'electron_screen';
  dataUrl: string;
  capturedAt: string;
  note?: string;
}

export type SearchCategory = 'all' | 'docs' | 'code' | 'news' | 'academic' | 'video';

export interface LiveSearchResult {
  title: string;
  url: string;
  description: string;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  category: SearchCategory;
  timestamp: string;
  saved: boolean;
}

export interface ActivityLogItem {
  id: string;
  category: 'chat' | 'voice' | 'files' | 'vision' | 'search' | 'system';
  title: string;
  detail: string;
  timestamp: string;
}

export interface MemoryItem {
  id: string;
  note: string;
  createdAt: string;
}

export interface JarvisSettings {
  general: {
    launchOnStartup: boolean;
    notificationsEnabled: boolean;
    interfaceLanguage: LanguagePreference;
    defaultLandingPage: PageId;
  };
  appearance: {
    theme: ThemeMode;
    accentIntensity: 'subtle' | 'balanced' | 'radiant';
    animationsEnabled: boolean;
    compactSidebar: boolean;
  };
  aiModels: {
    activeProvider: 'ollama' | 'gemini' | 'hybrid';
    ollamaEndpoint: string;
    ollamaModel: string;
    geminiBridgeUrl: string;
    responseStyle: 'concise' | 'balanced' | 'detailed';
    temperature: number;
  };
  voice: {
    backgroundListeningEnabled: boolean;
    selectedVoiceUri: string;
    language: LanguagePreference;
    speechRate: number;
    autoSpeakResponses: boolean;
    microphoneAutoGain: boolean;
    micMuted: boolean;
    listeningPaused: boolean;
  };
  wakeWord: {
    enabled: boolean;
    phrase: string;
    sensitivity: 'low' | 'medium' | 'high';
  };
  privacy: {
    localMemoryEnabled: boolean;
    saveChatHistory: boolean;
    indexSelectedFilesOnly: boolean;
    storeActivityLogs: boolean;
  };
  storage: {
    maxHistoryItems: number;
    autoTrimCache: boolean;
  };
}

export interface UserProfile {
  name: string;
  handle: string;
  role: string;
  email: string;
  location: string;
  timezone: string;
  bio: string;
  avatarUrl: string;
  preferredGreeting: string;
  companionTone: 'executive' | 'friendly' | 'technical';
  shareTelemetryWithLocalBackend: boolean;
}

export interface DriveMetric {
  fs: string;
  mount: string;
  type: string;
  sizeBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
}

export interface SystemHealthSnapshot {
  collectedAt: string | null;
  hostname: string;
  platform: string;
  osDistro: string;
  uptimeSeconds: number | null;
  cpu: {
    available: boolean;
    usagePercent: number | null;
    model: string;
    cores: number | null;
    physicalCores: number | null;
    speedGhz: number | null;
    error?: string;
  };
  ram: {
    available: boolean;
    totalBytes: number | null;
    usedBytes: number | null;
    availableBytes: number | null;
    usagePercent: number | null;
    error?: string;
  };
  storage: {
    available: boolean;
    totalBytes: number | null;
    usedBytes: number | null;
    freeBytes: number | null;
    usagePercent: number | null;
    drives: DriveMetric[];
    error?: string;
  };
  battery: {
    available: boolean;
    hasBattery: boolean;
    percent: number | null;
    isCharging: boolean | null;
    acConnected: boolean | null;
    timeRemainingMinutes: number | null;
    error?: string;
  };
  network: {
    available: boolean;
    online: boolean;
    interfaces: Array<{
      iface: string;
      type: string;
      ip4: string;
      operstate: string;
      internal: boolean;
    }>;
    error?: string;
  };
  browserStorageUsageMb: number | null;
  microphonePermission: 'granted' | 'denied' | 'prompt' | 'unknown';
  jarvisBackendStatus: ConnectionState;
  ollamaStatus: ConnectionState;
  ollamaModels: string[];
  selectedOllamaModelInstalled: boolean;
  geminiStatus: ConnectionState;
  voiceServiceStatus: ConnectionState;
  screenVisionStatus: ConnectionState;
  fileSystemStatus: ConnectionState;
  isElectronDesktop: boolean;
  lastRefreshedAt: string;
  telemetryError?: string;
}

export type DockMode = 'expanded' | 'minimized' | 'hidden';
