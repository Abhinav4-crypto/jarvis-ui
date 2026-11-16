import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Database,
  Info,
  Mic,
  MicOff,
  Palette,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings as SettingsIcon,
  Shield,
  Trash2,
} from 'lucide-react';
import { useJarvis } from '../context/JarvisContext';
import type { LanguagePreference, PageId } from '../types/jarvis';
import {
  getRecognitionLangCode,
  getSynthesisLangCode,
  pickNextAcknowledgement,
} from '../utils/hinglishVoice';
import { matchCustomWakeWord } from '../utils/wakeWordMatcher';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusIndicator } from '../components/ui/StatusIndicator';

type SettingsSectionId =
  | 'general'
  | 'appearance'
  | 'aiModels'
  | 'voiceAndWake'
  | 'privacy'
  | 'storage';

const SECTIONS: Array<{ id: SettingsSectionId; label: string; icon: typeof SettingsIcon }> = [
  { id: 'voiceAndWake', label: 'Voice & Wake Word', icon: Radio },
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'aiModels', label: 'AI Models', icon: Cpu },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'storage', label: 'Storage', icon: Database },
];

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-amber-900/10 dark:border-white/[0.06] last:border-b-0">
      <div>
        <p className="text-sm font-medium text-[#171411] dark:text-[#FAF6EE]">{title}</p>
        <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0',
          checked ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700',
        ].join(' ')}
      >
        <span
          className={[
            'block w-5 h-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

interface SpeechRecognitionMinimal {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function SettingsPage() {
  const {
    settings,
    updateSettings,
    setStartupLaunch,
    voiceState,
    pauseVoiceListening,
    resumeVoiceListening,
    toggleMicMute,
    suspendVoiceForTest,
    resumeVoiceAfterTest,
    clearLocalCache,
    clearMemoryNotes,
    memoryNotes,
    openConfirmDialog,
    refreshSystemHealth,
    systemHealth,
  } = useJarvis();

  const [activeSection, setActiveSection] = useState<SettingsSectionId>('voiceAndWake');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Custom wake word editor & live tester state
  const [draftWakePhrase, setDraftWakePhrase] = useState(settings.wakeWord.phrase);
  const [wakeSaveNotice, setWakeSaveNotice] = useState<string | null>(null);
  const [isTestingWake, setIsTestingWake] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'listening' | 'matched' | 'missed' | 'error';
    message: string;
  } | null>(null);

  const testRecRef = useRef<SpeechRecognitionMinimal | null>(null);
  const testTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setDraftWakePhrase(settings.wakeWord.phrase);
  }, [settings.wakeWord.phrase]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (testTimeoutRef.current) window.clearTimeout(testTimeoutRef.current);
      try {
        testRecRef.current?.stop();
      } catch {
        // Ignore
      }
    };
  }, []);

  const stopWakeTest = () => {
    if (testTimeoutRef.current) {
      window.clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = null;
    }
    try {
      testRecRef.current?.stop();
    } catch {
      // Ignore
    }
    testRecRef.current = null;
    setIsTestingWake(false);
    resumeVoiceAfterTest();
  };

  const handleSaveWakeWord = () => {
    const cleaned = draftWakePhrase.trim();
    if (!cleaned) {
      setWakeSaveNotice('Wake phrase cannot be empty.');
      return;
    }
    updateSettings('wakeWord', { phrase: cleaned, enabled: true });
    setWakeSaveNotice(`Saved "${cleaned}" and synced with active wake detector.`);
    window.setTimeout(() => setWakeSaveNotice(null), 3500);
  };

  const handleResetWakeWord = () => {
    setDraftWakePhrase('Jarvis');
    updateSettings('wakeWord', { phrase: 'Jarvis', enabled: true });
    setWakeSaveNotice('Reset wake word back to default "Jarvis".');
    window.setTimeout(() => setWakeSaveNotice(null), 3000);
  };

  const handleTestWakeWord = () => {
    if (isTestingWake) {
      stopWakeTest();
      return;
    }

    const phraseToTest = draftWakePhrase.trim() || settings.wakeWord.phrase || 'Jarvis';
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionMinimal;
      webkitSpeechRecognition?: new () => SpeechRecognitionMinimal;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setTestResult({
        status: 'error',
        message: 'SpeechRecognition is unavailable in this browser/runtime.',
      });
      return;
    }

    suspendVoiceForTest();
    setIsTestingWake(true);
    setTestResult({
      status: 'listening',
      message: `Listening for 6s... Say "${phraseToTest}" aloud now.`,
    });

    try {
      const rec = new SpeechRec();
      rec.lang = getRecognitionLangCode(settings.voice.language);
      rec.continuous = true;
      rec.interimResults = true;
      testRecRef.current = rec;

      let matchedAlready = false;

      rec.onresult = (event) => {
        if (matchedAlready) return;
        let combined = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          combined += event.results[i][0].transcript;
        }
        const heard = combined.trim();
        if (!heard) return;

        const check = matchCustomWakeWord(
          heard,
          phraseToTest,
          settings.wakeWord.sensitivity
        );

        if (check.matched) {
          matchedAlready = true;
          setTestResult({
            status: 'matched',
            message: `Matched "${heard}" (${Math.round(check.score * 100)}% match for "${phraseToTest}")!`,
          });

          // Speak authentic acknowledgement so user hears exact wake response
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const ack = pickNextAcknowledgement(settings.voice.language);
            const utter = new SpeechSynthesisUtterance(ack);
            utter.lang = getSynthesisLangCode(settings.voice.language);
            utter.rate = settings.voice.speechRate;
            window.speechSynthesis.speak(utter);
          }

          window.setTimeout(() => stopWakeTest(), 450);
        } else {
          setTestResult({
            status: 'listening',
            message: `Heard "${heard}" (score ${Math.round(check.score * 100)}%) — keep trying "${phraseToTest}"...`,
          });
        }
      };

      rec.onerror = (evt) => {
        if (evt.error !== 'aborted') {
          setTestResult({
            status: 'error',
            message: `Microphone test error: ${evt.error}`,
          });
        }
        stopWakeTest();
      };

      rec.onend = () => {
        if (!matchedAlready) {
          setIsTestingWake(false);
          resumeVoiceAfterTest();
        }
      };

      rec.start();

      testTimeoutRef.current = window.setTimeout(() => {
        if (!matchedAlready) {
          setTestResult({
            status: 'missed',
            message: `Did not detect "${phraseToTest}". Try High sensitivity or a clearer phrase.`,
          });
        }
        stopWakeTest();
      }, 6500);
    } catch {
      setTestResult({
        status: 'error',
        message: 'Could not start microphone for wake-word test.',
      });
      stopWakeTest();
    }
  };

  const inputClass =
    'w-full rounded-xl border border-amber-900/15 dark:border-amber-500/20 bg-white dark:bg-[#141316] px-3.5 py-2.5 text-sm text-[#171411] dark:text-[#FAF6EE] focus:outline-none focus:border-amber-500';

  const modelOptions =
    systemHealth.ollamaModels.length > 0
      ? systemHealth.ollamaModels
      : ['llama3.2', 'mistral', 'qwen2.5', 'llava'];

  const micStatusState = settings.voice.micMuted
    ? 'disconnected'
    : settings.voice.listeningPaused
      ? 'not_configured'
      : voiceState === 'listening' || voiceState === 'standby'
        ? 'active'
        : systemHealth.microphonePermission === 'denied'
          ? 'error'
          : systemHealth.voiceServiceStatus;

  const micStatusDetail = settings.voice.micMuted
    ? 'Microphone Muted'
    : settings.voice.listeningPaused
      ? 'Background Listening Paused'
      : voiceState === 'standby'
        ? `Standby ("${settings.wakeWord.phrase}")`
        : voiceState === 'listening'
          ? 'Active Conversation'
          : `Permission: ${systemHealth.microphonePermission}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-page-enter pb-20">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#171411] dark:text-[#FAF6EE]">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-0.5">
          Configure background voice assistant, custom wake word, Hinglish language preferences, Windows startup, and AI models.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <GlassCard padding="sm" className="lg:col-span-3 space-y-1">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={[
                  'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-amber-500/16 text-amber-900 dark:text-amber-300 border border-amber-500/35'
                    : 'text-stone-700 dark:text-stone-300 border border-transparent hover:bg-amber-950/5 dark:hover:bg-white/[0.04]',
                ].join(' ')}
              >
                <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </GlassCard>

        <GlassCard padding="lg" className="lg:col-span-9 space-y-6">
          {activeSection === 'voiceAndWake' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-amber-900/10 dark:border-amber-500/15">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#171411] dark:text-[#FAF6EE]">
                    Voice &amp; Wake Word
                  </h2>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                    Background wake-word standby, immediate Hinglish acknowledgements, and microphone controls.
                  </p>
                </div>
                <StatusIndicator
                  label="Mic Status"
                  state={micStatusState}
                  detail={micStatusDetail}
                />
              </div>

              {/* Quick Live Controls: Pause/Resume + Mute Microphone */}
              <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06]">
                {settings.voice.listeningPaused ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Play className="w-3.5 h-3.5" />}
                    onClick={resumeVoiceListening}
                  >
                    Resume Listening
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Pause className="w-3.5 h-3.5" />}
                    onClick={pauseVoiceListening}
                  >
                    Pause Listening
                  </Button>
                )}

                <Button
                  variant={settings.voice.micMuted ? 'danger' : 'secondary'}
                  size="sm"
                  icon={
                    settings.voice.micMuted ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )
                  }
                  onClick={() => toggleMicMute()}
                >
                  {settings.voice.micMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                </Button>

                <span className="text-xs text-stone-600 dark:text-stone-300 ml-auto">
                  Active Phrase:{' '}
                  <strong className="text-amber-700 dark:text-amber-300">
                    &ldquo;{settings.wakeWord.phrase}&rdquo;
                  </strong>
                </span>
              </div>

              {/* Background & Startup Toggles */}
              <div className="divide-y divide-amber-900/10 dark:divide-white/[0.06]">
                <ToggleRow
                  title="Enable Background Listening"
                  description="Keep listening for the wake word when JARVIS is minimized or closed to Windows system tray."
                  checked={settings.voice.backgroundListeningEnabled}
                  onChange={(v) =>
                    updateSettings('voice', { backgroundListeningEnabled: v })
                  }
                />
                <ToggleRow
                  title="Wake Word Activation"
                  description="Trigger immediate spoken acknowledgement when your custom wake word is heard."
                  checked={settings.wakeWord.enabled}
                  onChange={(v) => updateSettings('wakeWord', { enabled: v })}
                />
                <ToggleRow
                  title="Auto Speak Responses"
                  description="Read JARVIS replies aloud naturally while guarding the microphone against self-echo."
                  checked={settings.voice.autoSpeakResponses}
                  onChange={(v) => updateSettings('voice', { autoSpeakResponses: v })}
                />
                <ToggleRow
                  title="Start with Windows"
                  description="Launch JARVIS automatically in the background when you sign in to Windows (requires Electron desktop app)."
                  checked={settings.general.launchOnStartup}
                  onChange={(v) => void setStartupLaunch(v)}
                />
              </div>

              {/* Custom Wake Word Editor + Test + Save + Reset */}
              <div className="rounded-xl border border-amber-900/15 dark:border-amber-500/20 p-4 space-y-4 bg-white/40 dark:bg-white/[0.02]">
                <div>
                  <h3 className="text-sm font-semibold text-[#171411] dark:text-[#FAF6EE]">
                    Custom Wake Word
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                    Change the wake phrase from &ldquo;Jarvis&rdquo; to any word or short phrase (e.g. &ldquo;Hey Nova&rdquo;, &ldquo;Suno Buddy&rdquo;). Saved locally and connected directly to the live detector.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="custom-wake-input"
                      className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5"
                    >
                      Wake Phrase
                    </label>
                    <input
                      id="custom-wake-input"
                      type="text"
                      value={draftWakePhrase}
                      onChange={(e) => setDraftWakePhrase(e.target.value)}
                      placeholder="Jarvis"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="wake-sensitivity-select"
                      className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5"
                    >
                      Wake Word Sensitivity
                    </label>
                    <select
                      id="wake-sensitivity-select"
                      value={settings.wakeWord.sensitivity}
                      onChange={(e) =>
                        updateSettings('wakeWord', {
                          sensitivity: e.target.value as 'low' | 'medium' | 'high',
                        })
                      }
                      className={inputClass}
                    >
                      <option value="low">Low (Strict exactness)</option>
                      <option value="medium">Medium (Balanced)</option>
                      <option value="high">High (Phonetic tolerance)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Mic className="w-3.5 h-3.5" />}
                    onClick={handleTestWakeWord}
                  >
                    {isTestingWake ? 'Stop Test' : 'Test Wake Word'}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    onClick={handleSaveWakeWord}
                  >
                    Save Wake Word
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={handleResetWakeWord}
                  >
                    Reset
                  </Button>
                </div>

                {wakeSaveNotice && (
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {wakeSaveNotice}
                  </p>
                )}

                {testResult && (
                  <div
                    className={[
                      'rounded-lg px-3 py-2 text-xs border',
                      testResult.status === 'matched'
                        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : testResult.status === 'error' || testResult.status === 'missed'
                          ? 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300'
                          : 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300',
                    ].join(' ')}
                  >
                    {testResult.message}
                  </div>
                )}

                <div className="flex items-start gap-2 text-[11px] text-stone-600 dark:text-stone-400 pt-1">
                  <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p>
                    Engine note: Custom wake-word detection uses live speech-to-text transcription with sensitivity-calibrated phonetic matching (`matchCustomWakeWord`) rather than a compiled offline `.ppn` neural wake-word binary. Common English and Hinglish phrases work reliably; highly invented words that speech recognition cannot transcribe may require High sensitivity.
                  </p>
                </div>
              </div>

              {/* Language, Voice & Speech Speed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="voice-lang-select"
                    className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5"
                  >
                    Language Selection
                  </label>
                  <select
                    id="voice-lang-select"
                    value={settings.voice.language}
                    onChange={(e) =>
                      updateSettings('voice', {
                        language: e.target.value as LanguagePreference,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="hinglish">Hinglish (Default — Roman Hindi + English)</option>
                    <option value="auto">Auto Detect</option>
                    <option value="hindi">Hindi (hi-IN)</option>
                    <option value="english">English (en-US)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="voice-uri-select"
                    className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5"
                  >
                    Voice Selection
                  </label>
                  <select
                    id="voice-uri-select"
                    value={settings.voice.selectedVoiceUri}
                    onChange={(e) =>
                      updateSettings('voice', { selectedVoiceUri: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">System Default Voice</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-stone-600 dark:text-stone-400">Speech Speed</span>
                  <span className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
                    {settings.voice.speechRate.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.5"
                  step="0.1"
                  value={settings.voice.speechRate}
                  onChange={(e) =>
                    updateSettings('voice', { speechRate: Number(e.target.value) })
                  }
                  className="w-full max-w-md accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeSection === 'general' && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-[#171411] dark:text-[#FAF6EE]">
                General Preferences
              </h2>
              <ToggleRow
                title="Start with Windows"
                description="Automatically launch JARVIS desktop shell when Windows starts."
                checked={settings.general.launchOnStartup}
                onChange={(v) => void setStartupLaunch(v)}
              />
              <ToggleRow
                title="Desktop Notifications"
                description="Show completion alerts for voice captures and file actions."
                checked={settings.general.notificationsEnabled}
                onChange={(v) => updateSettings('general', { notificationsEnabled: v })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Preferred Language Mode
                  </label>
                  <select
                    value={settings.general.interfaceLanguage}
                    onChange={(e) => {
                      const next = e.target.value as LanguagePreference;
                      updateSettings('general', { interfaceLanguage: next });
                      updateSettings('voice', { language: next });
                    }}
                    className={inputClass}
                  >
                    <option value="hinglish">Hinglish (Default)</option>
                    <option value="auto">Auto Detect</option>
                    <option value="hindi">Hindi</option>
                    <option value="english">English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Default Landing Page
                  </label>
                  <select
                    value={settings.general.defaultLandingPage}
                    onChange={(e) =>
                      updateSettings('general', {
                        defaultLandingPage: e.target.value as PageId,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="home">Home Dashboard</option>
                    <option value="chat">AI Chat</option>
                    <option value="voice">Voice Assistant</option>
                    <option value="files">My Files</option>
                    <option value="vision">Vision</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold text-[#171411] dark:text-[#FAF6EE]">
                Appearance &amp; Golden Theme
              </h2>
              <div>
                <p className="text-xs font-medium text-stone-600 dark:text-stone-400 mb-2">
                  Color Theme
                </p>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  {(['dark', 'light'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateSettings('appearance', { theme: mode })}
                      className={[
                        'px-4 py-3 rounded-xl border text-sm font-medium capitalize cursor-pointer transition-all',
                        settings.appearance.theme === mode
                          ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                          : 'border-amber-900/15 dark:border-amber-500/20 text-stone-700 dark:text-stone-300',
                      ].join(' ')}
                    >
                      {mode} Mode
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-stone-600 dark:text-stone-400 mb-2">
                  Golden Accent Intensity
                </p>
                <div className="grid grid-cols-3 gap-2.5 max-w-md">
                  {(['subtle', 'balanced', 'radiant'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() =>
                        updateSettings('appearance', { accentIntensity: level })
                      }
                      className={[
                        'px-3 py-2 rounded-xl border text-xs font-medium capitalize cursor-pointer',
                        settings.appearance.accentIntensity === level
                          ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                          : 'border-amber-900/15 dark:border-amber-500/20 text-stone-700 dark:text-stone-300',
                      ].join(' ')}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <ToggleRow
                title="Futuristic Animations"
                description="Enable smooth orb harmonic motion and page transitions."
                checked={settings.appearance.animationsEnabled}
                onChange={(v) => updateSettings('appearance', { animationsEnabled: v })}
              />
            </div>
          )}

          {activeSection === 'aiModels' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-[#171411] dark:text-[#FAF6EE]">
                  AI Models &amp; Backend Engines
                </h2>
                <div className="flex items-center gap-3">
                  <StatusIndicator label="Ollama" state={systemHealth.ollamaStatus} />
                  <StatusIndicator label="Gemini" state={systemHealth.geminiStatus} />
                </div>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-400">
                Gemini API keys are managed strictly on the server via environment variables (`GEMINI_API_KEY`) and are never exposed in frontend code.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Active Reasoning Mode
                  </label>
                  <select
                    value={settings.aiModels.activeProvider}
                    onChange={(e) => {
                      updateSettings('aiModels', {
                        activeProvider: e.target.value as 'ollama' | 'gemini' | 'hybrid',
                      });
                      refreshSystemHealth();
                    }}
                    className={inputClass}
                  >
                    <option value="ollama">Ollama (Local Only)</option>
                    <option value="gemini">Gemini API (Server-Side)</option>
                    <option value="hybrid">Hybrid (Ollama first, Gemini fallback)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Local Ollama Model{' '}
                    {systemHealth.ollamaModels.length > 0
                      ? `(${systemHealth.ollamaModels.length} detected)`
                      : ''}
                  </label>
                  <select
                    value={settings.aiModels.ollamaModel}
                    onChange={(e) =>
                      updateSettings('aiModels', { ollamaModel: e.target.value })
                    }
                    className={inputClass}
                  >
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Local Ollama Server URL
                  </label>
                  <input
                    type="text"
                    placeholder="http://127.0.0.1:11434"
                    value={settings.aiModels.ollamaEndpoint}
                    onChange={(e) =>
                      updateSettings('aiModels', { ollamaEndpoint: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>

                <div className="flex items-end">
                  <Button variant="secondary" onClick={() => refreshSystemHealth()}>
                    Test Ollama &amp; Gemini Status
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                  AI Response Style
                </label>
                <div className="grid grid-cols-3 gap-2.5 max-w-md">
                  {(['concise', 'balanced', 'detailed'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => updateSettings('aiModels', { responseStyle: style })}
                      className={[
                        'px-3 py-2 rounded-xl border text-xs font-medium capitalize cursor-pointer',
                        settings.aiModels.responseStyle === style
                          ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                          : 'border-amber-900/15 dark:border-amber-500/20 text-stone-700 dark:text-stone-300',
                      ].join(' ')}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'privacy' && (
            <div className="space-y-2">
              <h2 className="font-display text-lg font-semibold text-[#171411] dark:text-[#FAF6EE] mb-2">
                Privacy &amp; Local Memory Controls
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400 mb-3">
                Background wake-word detection filters speech locally and only forwards queries to your AI backend after wake-word activation.
              </p>
              <ToggleRow
                title="Local Memory"
                description="Include saved local memory notes (.jarvis-data/memory.json) in AI prompts."
                checked={settings.privacy.localMemoryEnabled}
                onChange={(v) => updateSettings('privacy', { localMemoryEnabled: v })}
              />
              <ToggleRow
                title="Save Chat History Locally"
                description="Persist conversation threads in local storage."
                checked={settings.privacy.saveChatHistory}
                onChange={(v) => updateSettings('privacy', { saveChatHistory: v })}
              />
              <ToggleRow
                title="Strict Local File Permissions"
                description="Keep private files on disk unless you explicitly attach or ask about a document."
                checked={settings.privacy.indexSelectedFilesOnly}
                onChange={(v) =>
                  updateSettings('privacy', { indexSelectedFilesOnly: v })
                }
              />
              <ToggleRow
                title="Store Activity Logs"
                description="Record searches, chats, and vision captures in Activity History."
                checked={settings.privacy.storeActivityLogs}
                onChange={(v) => updateSettings('privacy', { storeActivityLogs: v })}
              />
            </div>
          )}

          {activeSection === 'storage' && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold text-[#171411] dark:text-[#FAF6EE]">
                Storage &amp; Memory Management
              </h2>
              <div className="rounded-xl border border-amber-900/12 dark:border-amber-500/18 p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-600 dark:text-stone-400">
                    Browser Cache Storage Used
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-300">
                    {systemHealth.browserStorageUsageMb !== null
                      ? `${systemHealth.browserStorageUsageMb} MB`
                      : 'Unavailable'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-600 dark:text-stone-400">
                    Saved Disk Memory Notes
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-300">
                    {memoryNotes.length} notes
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div>
                  <p className="text-sm font-medium text-[#171411] dark:text-[#FAF6EE]">
                    Clear Local Cache &amp; Memory
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Clears saved chats, search history, activity logs, and disk memory notes.
                  </p>
                </div>
                <Button
                  variant="danger"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() =>
                    openConfirmDialog({
                      title: 'Clear Local Cache & Memory',
                      description:
                        'This will permanently clear all locally saved chat threads, search history, activity logs, and local memory notes.',
                      confirmLabel: 'Clear All',
                      onConfirm: () => {
                        clearLocalCache();
                        clearMemoryNotes();
                      },
                    })
                  }
                >
                  Clear Cache
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
