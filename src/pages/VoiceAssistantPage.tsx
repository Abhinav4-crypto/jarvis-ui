import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useJarvis } from '../context/JarvisContext';
import type { LanguagePreference, VoiceState } from '../types/jarvis';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { VoiceOrb } from '../components/ui/VoiceOrb';

const LANGUAGE_OPTIONS: Array<{ code: LanguagePreference; label: string; hint: string }> = [
  { code: 'hinglish', label: 'Hinglish (Default)', hint: 'Roman Hindi + English' },
  { code: 'auto', label: 'Auto Detect', hint: 'Matches user tone' },
  { code: 'hindi', label: 'Hindi', hint: 'हिन्दी (hi-IN)' },
  { code: 'english', label: 'English', hint: 'English (en-US)' },
];

export function VoiceAssistantPage() {
  const {
    settings,
    updateSettings,
    voiceState,
    voiceInterimText,
    voiceError,
    wakeDetectedAt,
    lastMatchedPhrase,
    voiceTranscript,
    clearVoiceTranscript,
    startActiveVoiceListening,
    stopVoiceListening,
    pauseVoiceListening,
    resumeVoiceListening,
    toggleMicMute,
    stopVoiceSpeaking,
    speakVoiceText,
    systemHealth,
  } = useJarvis();

  const [audioLevel, setAudioLevel] = useState(0.16);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Visual waveform meter runs only while actively listening on this page
  useEffect(() => {
    let cancelled = false;

    const stopMeter = () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setAudioLevel(0.16);
    };

    const startMeter = async () => {
      if (
        voiceState !== 'listening' ||
        settings.voice.micMuted ||
        settings.voice.listeningPaused ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        stopMeter();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioContextCtor();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((acc, v) => acc + v, 0) / data.length;
          setAudioLevel(Math.min(1, avg / 100));
          animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setAudioLevel(0.22);
      }
    };

    void startMeter();
    return () => {
      cancelled = true;
      stopMeter();
    };
  }, [voiceState, settings.voice.micMuted, settings.voice.listeningPaused]);

  const isSpeaking = voiceState === 'speaking' || voiceState === 'acknowledged';
  const isListeningOrStandby =
    voiceState === 'listening' || voiceState === 'standby' || isSpeaking;

  const states: Array<{ id: VoiceState; label: string }> = [
    { id: 'standby', label: 'Standby' },
    { id: 'acknowledged', label: 'Acknowledged' },
    { id: 'listening', label: 'Listening' },
    { id: 'thinking', label: 'Thinking' },
    { id: 'speaking', label: 'Speaking' },
    { id: 'paused', label: 'Paused' },
    { id: 'muted', label: 'Muted' },
  ];

  const barCount = 24;
  const recentWakeActive =
    wakeDetectedAt !== null && Date.now() - wakeDetectedAt < 12000;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-page-enter pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <GlassCard
          glow
          padding="lg"
          className="lg:col-span-7 flex flex-col items-center justify-between gap-6"
        >
          <div className="w-full flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#171411] dark:text-[#FAF6EE]">
                Voice Assistant
              </h1>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                Wake Word: &ldquo;{settings.wakeWord.phrase}&rdquo; ·{' '}
                {settings.voice.backgroundListeningEnabled
                  ? 'Background Standby Enabled'
                  : 'Manual Activation'}
                {recentWakeActive && lastMatchedPhrase
                  ? ` · Triggered ("${lastMatchedPhrase}")`
                  : ''}
              </p>
            </div>
            <StatusIndicator
              label="Microphone"
              state={
                settings.voice.micMuted
                  ? 'disconnected'
                  : settings.voice.listeningPaused
                    ? 'not_configured'
                    : isListeningOrStandby
                      ? 'active'
                      : systemHealth.microphonePermission === 'denied'
                        ? 'error'
                        : systemHealth.voiceServiceStatus
              }
              detail={
                settings.voice.micMuted
                  ? 'Muted'
                  : settings.voice.listeningPaused
                    ? 'Paused'
                    : voiceState === 'listening'
                      ? 'Active Conversation'
                      : voiceState === 'standby'
                        ? 'Standby for Wake Word'
                        : `Permission: ${systemHealth.microphonePermission}`
              }
            />
          </div>

          <VoiceOrb
            state={voiceState}
            size="xl"
            audioLevel={audioLevel}
            onClick={() =>
              voiceState === 'listening'
                ? stopVoiceListening()
                : startActiveVoiceListening()
            }
          />

          {/* Live Voice Waveform */}
          <div className="w-full max-w-md flex items-end justify-center gap-1 h-12 px-4">
            {Array.from({ length: barCount }).map((_, idx) => {
              const centerBias = 1 - Math.abs(idx - barCount / 2) / (barCount / 2);
              const heightPx =
                voiceState === 'listening'
                  ? Math.max(
                      6,
                      Math.round(8 + audioLevel * 38 * (0.4 + centerBias * 0.6))
                    )
                  : isSpeaking
                    ? Math.max(8, Math.round(14 + ((idx * 7) % 22) * centerBias))
                    : voiceState === 'standby'
                      ? Math.max(5, Math.round(7 + centerBias * 4))
                      : 5;
              return (
                <span
                  key={idx}
                  style={{ height: `${heightPx}px` }}
                  className={[
                    'w-1.5 rounded-full transition-all duration-100',
                    settings.voice.micMuted || settings.voice.listeningPaused
                      ? 'bg-stone-500/40'
                      : 'bg-gradient-to-t from-orange-600 via-amber-400 to-amber-200',
                  ].join(' ')}
                />
              );
            })}
          </div>

          {voiceInterimText && (
            <p className="text-sm italic text-amber-700 dark:text-amber-300 text-center max-w-lg">
              &ldquo;{voiceInterimText}&rdquo;
            </p>
          )}

          {voiceError && (
            <p className="text-xs text-red-600 dark:text-red-400 text-center max-w-lg">
              {voiceError}
            </p>
          )}

          <div className="w-full flex flex-wrap items-center justify-center gap-2.5">
            {voiceState !== 'listening' ? (
              <Button
                variant="primary"
                size="md"
                icon={<Mic className="w-4 h-4" />}
                onClick={startActiveVoiceListening}
              >
                Start Listening
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                icon={<MicOff className="w-4 h-4" />}
                onClick={stopVoiceListening}
              >
                Return to Standby
              </Button>
            )}

            {settings.voice.listeningPaused ? (
              <Button
                variant="secondary"
                size="md"
                icon={<Play className="w-4 h-4" />}
                onClick={resumeVoiceListening}
              >
                Resume Listening
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                icon={<Pause className="w-4 h-4" />}
                onClick={pauseVoiceListening}
              >
                Pause Listening
              </Button>
            )}

            <Button
              variant={settings.voice.micMuted ? 'danger' : 'secondary'}
              size="md"
              icon={
                settings.voice.micMuted ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )
              }
              onClick={() => toggleMicMute()}
            >
              {settings.voice.micMuted ? 'Unmute Mic' : 'Mute Mic'}
            </Button>

            {isSpeaking && (
              <Button
                variant="secondary"
                size="md"
                icon={<VolumeX className="w-4 h-4" />}
                onClick={stopVoiceSpeaking}
              >
                Stop Speaking
              </Button>
            )}
          </div>

          {/* Live Voice Engine State Indicators (read-only live status pills) */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-xl bg-amber-950/5 dark:bg-white/[0.04] border border-amber-900/10 dark:border-amber-500/15">
            {states.map((st) => (
              <span
                key={st.id}
                className={[
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors',
                  voiceState === st.id
                    ? 'bg-amber-500 text-[#0A0908] font-semibold'
                    : 'text-stone-500 dark:text-stone-400',
                ].join(' ')}
              >
                {st.label}
              </span>
            ))}
          </div>
        </GlassCard>

        <div className="lg:col-span-5 flex flex-col gap-5">
          <GlassCard padding="md" className="space-y-4">
            <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
              Language &amp; Voice Preferences
            </h2>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-2">
                Conversation &amp; Reply Language
              </label>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() =>
                      updateSettings('voice', { language: lang.code })
                    }
                    className={[
                      'px-3 py-2 rounded-xl border text-left transition-all cursor-pointer',
                      settings.voice.language === lang.code
                        ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                        : 'border-amber-900/12 dark:border-amber-500/15 text-stone-700 dark:text-stone-300 hover:border-amber-500/40',
                    ].join(' ')}
                  >
                    <p className="text-xs font-semibold">{lang.label}</p>
                    <p className="text-[10px] opacity-75">{lang.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="voice-select"
                className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5"
              >
                System Synthesizer Voice
              </label>
              <select
                id="voice-select"
                value={settings.voice.selectedVoiceUri}
                onChange={(e) =>
                  updateSettings('voice', { selectedVoiceUri: e.target.value })
                }
                className="w-full rounded-xl border border-amber-900/15 dark:border-amber-500/20 bg-white dark:bg-[#141316] px-3 py-2 text-xs text-[#171411] dark:text-[#FAF6EE] focus:outline-none focus:border-amber-500"
              >
                <option value="">Default System Voice</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
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
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-amber-900/10 dark:border-white/[0.06]">
              <div>
                <p className="text-xs font-medium text-[#171411] dark:text-[#FAF6EE]">
                  Auto Speak Responses
                </p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Speak Hinglish/English replies aloud with echo guard
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.voice.autoSpeakResponses}
                onClick={() =>
                  updateSettings('voice', {
                    autoSpeakResponses: !settings.voice.autoSpeakResponses,
                  })
                }
                className={[
                  'w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer',
                  settings.voice.autoSpeakResponses
                    ? 'bg-amber-500'
                    : 'bg-stone-300 dark:bg-stone-700',
                ].join(' ')}
              >
                <span
                  className={[
                    'block w-5 h-5 rounded-full bg-white transition-transform',
                    settings.voice.autoSpeakResponses
                      ? 'translate-x-5'
                      : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>
          </GlassCard>

          <GlassCard padding="md" className="flex-1 flex flex-col min-h-[260px]">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-amber-900/10 dark:border-white/[0.06]">
              <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
                Voice Conversation Log
              </h2>
              {voiceTranscript.length > 0 && (
                <button
                  type="button"
                  onClick={clearVoiceTranscript}
                  className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-red-500 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto mt-3 space-y-2.5 max-h-[280px]">
              {voiceTranscript.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400 py-8 text-center">
                  Say &ldquo;{settings.wakeWord.phrase}&rdquo; or press Start Listening. JARVIS acknowledges immediately in Hinglish and connects to your AI backend.
                </p>
              ) : (
                voiceTranscript.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-amber-900/10 dark:border-amber-500/15 bg-white/60 dark:bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 mb-1">
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        {entry.speaker === 'user' ? 'You' : 'JARVIS'}
                      </span>
                      <div className="flex items-center gap-2">
                        {entry.speaker === 'jarvis' && (
                          <button
                            type="button"
                            onClick={() => speakVoiceText(entry.text)}
                            aria-label="Replay spoken response"
                            className="hover:text-amber-500 cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="font-mono tabular-nums">
                          {entry.language} · {entry.timestamp}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-[#171411] dark:text-[#FAF6EE]">
                      {entry.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
