import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Cpu,
  Eye,
  FolderSearch,
  Globe,
  HardDrive,
  MessageSquare,
} from 'lucide-react';
import { useJarvis } from '../context/JarvisContext';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { getRecognitionLangCode } from '../utils/hinglishVoice';
import { GlassCard } from '../components/ui/GlassCard';
import { SearchBar } from '../components/ui/SearchBar';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { VoiceOrb } from '../components/ui/VoiceOrb';

function toGb(bytes: number | null): string {
  if (bytes === null) return '--';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1);
}

export function HomeDashboardPage() {
  const {
    profile,
    settings,
    navigateTo,
    openChatWithPrompt,
    sendChatMessage,
    systemHealth,
    activityLog,
    voiceState,
    startActiveVoiceListening,
    stopVoiceListening,
    suspendVoiceForTest,
    resumeVoiceAfterTest,
  } = useJarvis();

  const [promptInput, setPromptInput] = useState('');

  const speech = useSpeechInput({
    language: getRecognitionLangCode(settings.voice.language),
    onTranscript: (text, isFinal) => {
      setPromptInput(text);
      if (isFinal) {
        resumeVoiceAfterTest();
      }
    },
  });

  const handleToggleMic = () => {
    if (speech.isListening) {
      speech.stop();
      resumeVoiceAfterTest();
    } else {
      suspendVoiceForTest();
      const started = speech.start();
      if (!started) resumeVoiceAfterTest();
    }
  };

  const handleOrbClick = () => {
    if (voiceState === 'listening' || voiceState === 'speaking') {
      stopVoiceListening();
    } else {
      startActiveVoiceListening();
    }
  };

  const handleSubmitPrompt = async () => {
    if (!promptInput.trim()) return;
    if (speech.isListening) {
      speech.stop();
      resumeVoiceAfterTest();
    }
    const prompt = promptInput.trim();
    setPromptInput('');
    openChatWithPrompt(prompt);
    await sendChatMessage(prompt, []);
  };

  const quickActions = [
    {
      id: 'chat' as const,
      title: 'Chat with JARVIS',
      description: 'Real streaming AI conversation via Ollama or Gemini.',
      icon: MessageSquare,
    },
    {
      id: 'files' as const,
      title: 'Search Files',
      description: 'Browse Desktop, Documents, Downloads and search file contents.',
      icon: FolderSearch,
    },
    {
      id: 'vision' as const,
      title: 'Vision Mode',
      description: 'Share your screen or window and analyze visible UI with AI.',
      icon: Eye,
    },
    {
      id: 'search' as const,
      title: 'Web Search',
      description: 'Run live grounded web queries and open verified sources.',
      icon: Globe,
    },
  ];

  const cpuPct = systemHealth.cpu.available ? systemHealth.cpu.usagePercent ?? 0 : null;
  const ramPct = systemHealth.ram.available ? systemHealth.ram.usagePercent ?? 0 : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-page-enter pb-20">
      {/* Hero Greeting + Glowing Voice Orb + Main Prompt Input */}
      <GlassCard glow padding="lg" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[520px] h-[260px] rounded-full bg-amber-500/12 dark:bg-amber-500/14 blur-3xl"
        />

        <div className="relative flex flex-col items-center text-center">
          <p className="text-xs sm:text-sm font-medium tracking-wide text-amber-700 dark:text-amber-400">
            {profile.preferredGreeting}, {profile.name}
          </p>

          <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#171411] dark:text-[#FAF6EE] max-w-2xl">
            How can I help you today?
          </h1>

          <p className="mt-2.5 text-sm sm:text-base text-stone-600 dark:text-stone-400 max-w-xl">
            Your Personal AI Companion for Hinglish &amp; English voice control, local files, screen vision, and live system diagnostics.
          </p>

          <div className="my-7">
            <VoiceOrb
              state={speech.isListening ? 'listening' : voiceState}
              size="lg"
              onClick={handleOrbClick}
            />
          </div>

          <div className="mb-5">
            <StatusIndicator
              label="JARVIS Core"
              state={systemHealth.jarvisBackendStatus}
              detail={
                systemHealth.jarvisBackendStatus === 'connected'
                  ? systemHealth.isElectronDesktop
                    ? 'Desktop & Backend Online'
                    : 'Local Backend Connected'
                  : 'Backend Offline'
              }
            />
          </div>

          <div className="w-full max-w-2xl">
            <SearchBar
              value={promptInput}
              onChange={setPromptInput}
              onSubmit={handleSubmitPrompt}
              placeholder="Ask JARVIS a question, or dictate with your microphone..."
              submitLabel="Send"
              showMic
              isListening={speech.isListening}
              onToggleMic={handleToggleMic}
            />
            {speech.error && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                {speech.error}
              </p>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Four Quick-Action Cards */}
      <section aria-label="Quick Actions">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <GlassCard
                key={action.id}
                interactive
                padding="md"
                onClick={() => navigateTo(action.id)}
                className="flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/14 border border-amber-500/25 flex items-center justify-center text-amber-700 dark:text-amber-300">
                    <Icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
                    {action.title}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                    {action.description}
                  </p>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>

      {/* Bottom Grid: Real System Status + CPU/RAM + Recent Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <GlassCard padding="md" className="lg:col-span-6 flex flex-col justify-between gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#171411] dark:text-[#FAF6EE]">
                System Status
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                {systemHealth.hostname} · {systemHealth.osDistro}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('monitor')}
              className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              Open Monitor
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 border-y border-amber-900/10 dark:border-amber-500/12">
            <StatusIndicator
              label="Ollama"
              state={systemHealth.ollamaStatus}
              detail={
                systemHealth.ollamaStatus === 'connected'
                  ? `${systemHealth.ollamaModels.length} model(s)`
                  : undefined
              }
            />
            <StatusIndicator label="Gemini API" state={systemHealth.geminiStatus} />
            <StatusIndicator label="File System" state={systemHealth.fileSystemStatus} />
            <StatusIndicator
              label="Network"
              state={systemHealth.network.online ? 'connected' : 'disconnected'}
              detail={systemHealth.network.online ? 'Online' : 'Offline'}
            />
          </div>

          <div className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#171411] dark:text-[#FAF6EE]">
                  <Cpu className="w-3.5 h-3.5 text-amber-500" />
                  <span>CPU Load</span>
                </span>
                <span className="font-mono tabular-nums text-amber-700 dark:text-amber-300 font-semibold">
                  {cpuPct !== null ? `${cpuPct}%` : 'Unavailable'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-amber-950/10 dark:bg-white/[0.06] overflow-hidden">
                <div
                  style={{ width: `${cpuPct ?? 0}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#171411] dark:text-[#FAF6EE]">
                  <HardDrive className="w-3.5 h-3.5 text-amber-500" />
                  <span>RAM Usage</span>
                </span>
                <span className="font-mono tabular-nums text-amber-700 dark:text-amber-300 font-semibold">
                  {ramPct !== null
                    ? `${toGb(systemHealth.ram.usedBytes)} / ${toGb(systemHealth.ram.totalBytes)} GB (${ramPct}%)`
                    : 'Unavailable'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-amber-950/10 dark:bg-white/[0.06] overflow-hidden">
                <div
                  style={{ width: `${ramPct ?? 0}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300"
                />
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="md" className="lg:col-span-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#171411] dark:text-[#FAF6EE]">
                Recent Activity
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                Latest actions recorded across your JARVIS workspace
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('activity')}
              className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              View All
            </button>
          </div>

          {activityLog.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <Activity className="w-8 h-8 text-amber-500/60 mb-2.5" />
              <p className="text-sm font-medium text-[#171411] dark:text-[#FAF6EE]">
                No activity logged yet
              </p>
              <p className="mt-1 text-xs text-stone-600 dark:text-stone-400 max-w-xs">
                Send a chat prompt, browse local files, or analyze your screen to populate this timeline.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-amber-900/10 dark:divide-white/[0.06]">
              {activityLog.slice(0, 4).map((item) => (
                <div key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#171411] dark:text-[#FAF6EE] truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-stone-600 dark:text-stone-400 truncate">
                      <span className="capitalize">{item.category}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.detail}</span>
                    </p>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-stone-500 dark:text-stone-400 shrink-0">
                    {item.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>
    </div>
  );
}
