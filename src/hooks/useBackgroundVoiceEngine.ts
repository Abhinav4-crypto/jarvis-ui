import { useCallback, useEffect, useRef, useState } from 'react';
import {
  jarvisBridge,
  type VoiceCommandPayload,
  type VoiceRuntimeStatusPayload,
} from '../services/jarvisBridge';
import type {
  JarvisSettings,
  LanguagePreference,
  VoiceState,
  VoiceTranscriptEntry,
} from '../types/jarvis';
import {
  cleanTextForSpeech,
  getRecognitionLangCode,
  getSynthesisLangCode,
  isConversationEndPhrase,
  pickNextAcknowledgement,
} from '../utils/hinglishVoice';
import { matchCustomWakeWord } from '../utils/wakeWordMatcher';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstanceLike;

function getSpeechConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function getBackendErrorSpeech(language: LanguagePreference): string {
  if (language === 'english') {
    return 'Sorry, I could not connect to the AI backend right now. Please check Ollama or your settings.';
  }
  if (language === 'hindi') {
    return 'माफ़ कीजिए, अभी AI बैकएंड से कनेक्ट नहीं हो पा रहा है। कृपया सेटिंग्स जांचें।';
  }
  return 'Maaf kijiye, abhi AI backend connected nahi hai. Kripya Ollama start karein ya Settings check karein.';
}

function getGoodbyeSpeech(language: LanguagePreference): string {
  if (language === 'english') {
    return 'Alright, I am going back to standby.';
  }
  if (language === 'hindi') {
    return 'ठीक है, मैं स्टैंडबाय पर हूँ। ज़रूरत हो तो बुलाइएगा।';
  }
  return 'Theek hai, main standby par hoon. Jab zaroorat ho tab bulaiye.';
}

interface UseBackgroundVoiceEngineOptions {
  enabled: boolean;
  settings: JarvisSettings;
  transcript: VoiceTranscriptEntry[];
  onTranscriptEntry: (entry: VoiceTranscriptEntry) => void;
  onUpdateVoiceSettings?: (patch: Partial<JarvisSettings['voice']>) => void;
  onStatusBroadcast?: (status: VoiceRuntimeStatusPayload) => void;
}

export function useBackgroundVoiceEngine({
  enabled,
  settings,
  transcript,
  onTranscriptEntry,
  onUpdateVoiceSettings,
  onStatusBroadcast,
}: UseBackgroundVoiceEngineOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>(() => {
    if (settings.voice.micMuted) return 'muted';
    if (settings.voice.listeningPaused) return 'paused';
    return settings.voice.backgroundListeningEnabled ? 'standby' : 'idle';
  });
  const [interimText, setInterimText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastMatchedPhrase, setLastMatchedPhrase] = useState<string | null>(null);
  const [wakeDetectedAt, setWakeDetectedAt] = useState<number | null>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;

  const onTranscriptEntryRef = useRef(onTranscriptEntry);
  onTranscriptEntryRef.current = onTranscriptEntry;
  const onUpdateVoiceSettingsRef = useRef(onUpdateVoiceSettings);
  onUpdateVoiceSettingsRef.current = onUpdateVoiceSettings;
  const onStatusBroadcastRef = useRef(onStatusBroadcast);
  onStatusBroadcastRef.current = onStatusBroadcast;

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const isRecognizingRef = useRef(false);
  const isSpeakingGuardRef = useRef(false);
  const suspendedForTestRef = useRef(false);
  const conversationActiveRef = useRef(false);
  const isProcessingAiRef = useRef(false);

  const restartTimerRef = useRef<number | null>(null);
  const echoCooldownTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const interimWakeTimerRef = useRef<number | null>(null);
  const lastWakeTriggerAtRef = useRef<number>(0);
  const consecutiveErrorsRef = useRef<number>(0);

  const broadcastState = useCallback(
    (
      nextState: VoiceState,
      extra?: Partial<VoiceRuntimeStatusPayload>
    ) => {
      setVoiceState(nextState);
      onStatusBroadcastRef.current?.({
        state: nextState,
        paused: settingsRef.current.voice.listeningPaused,
        micMuted: settingsRef.current.voice.micMuted,
        backgroundEnabled: settingsRef.current.voice.backgroundListeningEnabled,
        wakePhrase: settingsRef.current.wakeWord.phrase,
        interimText: extra?.interimText ?? '',
        error: extra?.error ?? null,
        lastMatchedPhrase: extra?.lastMatchedPhrase,
        wakeDetectedAt: extra?.wakeDetectedAt,
      });
    },
    []
  );

  const clearTimers = useCallback(() => {
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (interimWakeTimerRef.current) {
      window.clearTimeout(interimWakeTimerRef.current);
      interimWakeTimerRef.current = null;
    }
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const stopRecognitionNow = useCallback(() => {
    clearTimers();
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    isRecognizingRef.current = false;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort ? rec.abort() : rec.stop();
      } catch {
        // Ignore stop errors
      }
    }
  }, [clearTimers]);

  const shouldListen = useCallback(() => {
    if (!enabled) return false;
    if (suspendedForTestRef.current) return false;
    const s = settingsRef.current;
    if (s.voice.micMuted || s.voice.listeningPaused) return false;
    if (isSpeakingGuardRef.current || isProcessingAiRef.current) return false;
    return (
      conversationActiveRef.current ||
      (s.voice.backgroundListeningEnabled && s.wakeWord.enabled)
    );
  }, [enabled]);

  const resolveRestingState = useCallback((): VoiceState => {
    const s = settingsRef.current;
    if (s.voice.micMuted) return 'muted';
    if (s.voice.listeningPaused) return 'paused';
    if (conversationActiveRef.current) return 'listening';
    if (s.voice.backgroundListeningEnabled && s.wakeWord.enabled) return 'standby';
    return 'idle';
  }, []);

  const scheduleRecognitionRestart = useCallback(
    (delayMs = 250) => {
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        startRecognitionRef.current();
      }, delayMs);
    },
    []
  );

  const resetInactivityTimeout = useCallback(() => {
    clearInactivityTimer();
    if (!conversationActiveRef.current) return;
    inactivityTimerRef.current = window.setTimeout(() => {
      conversationActiveRef.current = false;
      setInterimText('');
      broadcastState(resolveRestingState(), { interimText: '' });
    }, 22000);
  }, [broadcastState, clearInactivityTimer, resolveRestingState]);

  const speakWithEchoGuard = useCallback(
    (text: string, stateWhileSpeaking: VoiceState = 'speaking'): Promise<void> => {
      return new Promise((resolve) => {
        const cleaned = cleanTextForSpeech(text);
        if (
          !cleaned ||
          typeof window === 'undefined' ||
          !('speechSynthesis' in window)
        ) {
          resolve();
          return;
        }

        if (echoCooldownTimerRef.current) {
          window.clearTimeout(echoCooldownTimerRef.current);
          echoCooldownTimerRef.current = null;
        }

        // Mute & stop microphone recognition while JARVIS speaks so it cannot hear itself
        isSpeakingGuardRef.current = true;
        stopRecognitionNow();
        broadcastState(stateWhileSpeaking);

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleaned);
        const s = settingsRef.current;
        utterance.lang = getSynthesisLangCode(s.voice.language);
        utterance.rate = s.voice.speechRate || 1.0;

        const voices = window.speechSynthesis.getVoices();
        if (s.voice.selectedVoiceUri) {
          const chosen = voices.find((v) => v.voiceURI === s.voice.selectedVoiceUri);
          if (chosen) utterance.voice = chosen;
        }

        let finished = false;
        const finishSpeech = () => {
          if (finished) return;
          finished = true;
          // Acoustic cooldown (480ms) prevents trailing room echo from triggering recognition
          echoCooldownTimerRef.current = window.setTimeout(() => {
            echoCooldownTimerRef.current = null;
            isSpeakingGuardRef.current = false;
            resolve();
          }, 480);
        };

        utterance.onend = finishSpeech;
        utterance.onerror = finishSpeech;

        // Safety fallback timeout in case browser speechSynthesis stalls silently
        const maxDurationMs = Math.min(45000, Math.max(6000, cleaned.length * 140));
        window.setTimeout(finishSpeech, maxDurationMs);

        window.speechSynthesis.speak(utterance);
      });
    },
    [broadcastState, stopRecognitionNow]
  );

  const createEntry = (
    speaker: 'user' | 'jarvis',
    text: string
  ): VoiceTranscriptEntry => ({
    id: `vt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    speaker,
    text,
    language: settingsRef.current.voice.language,
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  });

  const processUserCommand = useCallback(
    async (commandText: string) => {
      const trimmed = commandText.trim();
      if (!trimmed || isProcessingAiRef.current) return;

      clearInactivityTimer();
      isProcessingAiRef.current = true;
      stopRecognitionNow();
      setInterimText('');
      setVoiceError(null);

      const userEntry = createEntry('user', trimmed);
      onTranscriptEntryRef.current(userEntry);

      if (isConversationEndPhrase(trimmed)) {
        conversationActiveRef.current = false;
        const byeText = getGoodbyeSpeech(settingsRef.current.voice.language);
        const byeEntry = createEntry('jarvis', byeText);
        onTranscriptEntryRef.current(byeEntry);
        isProcessingAiRef.current = false;
        if (settingsRef.current.voice.autoSpeakResponses) {
          await speakWithEchoGuard(byeText, 'speaking');
        }
        const nextState = resolveRestingState();
        broadcastState(nextState);
        if (shouldListen()) scheduleRecognitionRestart(200);
        return;
      }

      broadcastState('thinking', { interimText: '' });

      const history = transcriptRef.current.slice(-8).map((item) => ({
        role: item.speaker,
        content: item.text,
      }));

      const result = await jarvisBridge.streamChatPrompt(
        { prompt: trimmed, history },
        settingsRef.current,
        () => {}
      );

      isProcessingAiRef.current = false;

      if (result.ok && result.fullText.trim()) {
        const reply = result.fullText.trim();
        onTranscriptEntryRef.current(createEntry('jarvis', reply));

        if (settingsRef.current.voice.autoSpeakResponses) {
          await speakWithEchoGuard(reply, 'speaking');
        }
      } else {
        const errMsg =
          result.error || 'AI backend is currently unreachable for voice replies.';
        setVoiceError(errMsg);
        const spokenErr = getBackendErrorSpeech(settingsRef.current.voice.language);
        onTranscriptEntryRef.current(createEntry('jarvis', spokenErr));
        if (settingsRef.current.voice.autoSpeakResponses) {
          await speakWithEchoGuard(spokenErr, 'speaking');
        }
      }

      // Keep active follow-up window open for smooth multi-turn conversation
      if (!settingsRef.current.voice.micMuted && !settingsRef.current.voice.listeningPaused) {
        conversationActiveRef.current = true;
        resetInactivityTimeout();
      }
      broadcastState(resolveRestingState(), { error: result.ok ? null : result.error });
      if (shouldListen()) {
        scheduleRecognitionRestart(220);
      }
    },
    [
      broadcastState,
      clearInactivityTimer,
      resetInactivityTimeout,
      resolveRestingState,
      scheduleRecognitionRestart,
      shouldListen,
      speakWithEchoGuard,
      stopRecognitionNow,
    ]
  );

  const handleWakeWordDetected = useCallback(
    async (remainderCommand: string, matchedText: string) => {
      const now = Date.now();
      if (now - lastWakeTriggerAtRef.current < 2200) return;
      lastWakeTriggerAtRef.current = now;

      if (interimWakeTimerRef.current) {
        window.clearTimeout(interimWakeTimerRef.current);
        interimWakeTimerRef.current = null;
      }

      setInterimText('');
      setLastMatchedPhrase(matchedText);
      setWakeDetectedAt(now);
      conversationActiveRef.current = true;

      const ack = pickNextAcknowledgement(settingsRef.current.voice.language);
      onTranscriptEntryRef.current(createEntry('jarvis', ack));

      broadcastState('acknowledged', {
        lastMatchedPhrase: matchedText,
        wakeDetectedAt: now,
      });

      await speakWithEchoGuard(ack, 'acknowledged');

      if (settingsRef.current.voice.micMuted || settingsRef.current.voice.listeningPaused) {
        conversationActiveRef.current = false;
        broadcastState(resolveRestingState());
        return;
      }

      if (remainderCommand && remainderCommand.trim().length > 1) {
        await processUserCommand(remainderCommand.trim());
        return;
      }

      conversationActiveRef.current = true;
      resetInactivityTimeout();
      broadcastState('listening');
      if (shouldListen()) {
        scheduleRecognitionRestart(180);
      }
    },
    [
      broadcastState,
      processUserCommand,
      resetInactivityTimeout,
      resolveRestingState,
      scheduleRecognitionRestart,
      shouldListen,
      speakWithEchoGuard,
    ]
  );

  const startRecognitionRef = useRef<() => void>(() => {});

  const startRecognition = useCallback(() => {
    if (!shouldListen() || isRecognizingRef.current) return;

    const SpeechRec = getSpeechConstructor();
    if (!SpeechRec) {
      setVoiceError(
        'Speech recognition is unavailable in this runtime. Use Chromium/Edge or Electron.'
      );
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = getRecognitionLangCode(settingsRef.current.voice.language);
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (event) => {
        if (
          isSpeakingGuardRef.current ||
          suspendedForTestRef.current ||
          isProcessingAiRef.current ||
          settingsRef.current.voice.micMuted ||
          settingsRef.current.voice.listeningPaused
        ) {
          return;
        }

        consecutiveErrorsRef.current = 0;

        let combined = '';
        let hasFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const item = event.results[i];
          combined += item[0].transcript;
          if (item.isFinal) hasFinal = true;
        }

        const text = combined.trim();
        if (!text) return;

        // Mode 1: Active conversation window -> capture full user query
        if (conversationActiveRef.current) {
          resetInactivityTimeout();
          if (!hasFinal) {
            setInterimText(text);
            onStatusBroadcastRef.current?.({ interimText: text });
            return;
          }

          setInterimText('');
          const wakeCheck = settingsRef.current.wakeWord.enabled
            ? matchCustomWakeWord(
                text,
                settingsRef.current.wakeWord.phrase,
                settingsRef.current.wakeWord.sensitivity
              )
            : { matched: false, remainderCommand: '', score: 0, matchedPhrase: '' };

          if (wakeCheck.matched) {
            if (wakeCheck.remainderCommand.trim().length > 1) {
              void processUserCommand(wakeCheck.remainderCommand.trim());
            } else {
              void handleWakeWordDetected('', text);
            }
            return;
          }

          void processUserCommand(text);
          return;
        }

        // Mode 2: Background Standby -> ONLY watch locally for custom wake word
        const match = matchCustomWakeWord(
          text,
          settingsRef.current.wakeWord.phrase,
          settingsRef.current.wakeWord.sensitivity
        );

        if (match.matched) {
          if (hasFinal) {
            void handleWakeWordDetected(match.remainderCommand, text);
          } else {
            // Short debounce lets trailing words complete if user speaks wake word + command together
            if (interimWakeTimerRef.current) {
              window.clearTimeout(interimWakeTimerRef.current);
            }
            interimWakeTimerRef.current = window.setTimeout(() => {
              interimWakeTimerRef.current = null;
              if (!conversationActiveRef.current && !isSpeakingGuardRef.current) {
                void handleWakeWordDetected(match.remainderCommand, text);
              }
            }, 420);
          }
        }
      };

      rec.onerror = (evt) => {
        isRecognizingRef.current = false;
        recognitionRef.current = null;
        if (evt.error === 'no-speech' || evt.error === 'aborted') {
          return;
        }
        consecutiveErrorsRef.current += 1;
        if (evt.error === 'not-allowed' || evt.error === 'service-not-allowed') {
          setVoiceError('Microphone permission denied. Allow mic access in OS/browser settings.');
          broadcastState(resolveRestingState(), {
            error: 'Microphone permission denied.',
          });
          return;
        }
        if (evt.error === 'audio-capture') {
          setVoiceError('No working microphone detected.');
        } else {
          setVoiceError(`Voice recognition warning: ${evt.error}`);
        }
      };

      rec.onend = () => {
        isRecognizingRef.current = false;
        recognitionRef.current = null;
        if (shouldListen()) {
          const backoffMs = Math.min(3500, 260 + consecutiveErrorsRef.current * 600);
          scheduleRecognitionRestart(backoffMs);
        }
      };

      recognitionRef.current = rec;
      isRecognizingRef.current = true;
      rec.start();
    } catch {
      isRecognizingRef.current = false;
      recognitionRef.current = null;
      if (shouldListen()) {
        scheduleRecognitionRestart(1200);
      }
    }
  }, [
    broadcastState,
    handleWakeWordDetected,
    processUserCommand,
    resetInactivityTimeout,
    resolveRestingState,
    scheduleRecognitionRestart,
    shouldListen,
  ]);

  startRecognitionRef.current = startRecognition;

  // React to settings changes (pause, mute, background toggle, language, wake word)
  useEffect(() => {
    if (!enabled) {
      stopRecognitionNow();
      clearInactivityTimer();
      return;
    }

    if (settings.voice.micMuted) {
      conversationActiveRef.current = false;
      clearInactivityTimer();
      stopRecognitionNow();
      window.speechSynthesis?.cancel();
      isSpeakingGuardRef.current = false;
      broadcastState('muted');
      return;
    }

    if (settings.voice.listeningPaused) {
      conversationActiveRef.current = false;
      clearInactivityTimer();
      stopRecognitionNow();
      broadcastState('paused');
      return;
    }

    // Restart recognizer cleanly when language or background mode changes
    stopRecognitionNow();
    const nextState = resolveRestingState();
    broadcastState(nextState);
    if (shouldListen()) {
      scheduleRecognitionRestart(180);
    }
  }, [
    enabled,
    settings.voice.backgroundListeningEnabled,
    settings.voice.language,
    settings.voice.listeningPaused,
    settings.voice.micMuted,
    settings.wakeWord.enabled,
    settings.wakeWord.phrase,
    settings.wakeWord.sensitivity,
    broadcastState,
    clearInactivityTimer,
    resolveRestingState,
    scheduleRecognitionRestart,
    shouldListen,
    stopRecognitionNow,
  ]);

  useEffect(() => {
    return () => {
      stopRecognitionNow();
      clearInactivityTimer();
      if (echoCooldownTimerRef.current) {
        window.clearTimeout(echoCooldownTimerRef.current);
      }
      window.speechSynthesis?.cancel();
    };
  }, [clearInactivityTimer, stopRecognitionNow]);

  const startActiveListening = useCallback(() => {
    if (settingsRef.current.voice.micMuted) {
      onUpdateVoiceSettingsRef.current?.({ micMuted: false, listeningPaused: false });
    } else if (settingsRef.current.voice.listeningPaused) {
      onUpdateVoiceSettingsRef.current?.({ listeningPaused: false });
    }
    setVoiceError(null);
    conversationActiveRef.current = true;
    resetInactivityTimeout();
    broadcastState('listening');
    stopRecognitionNow();
    scheduleRecognitionRestart(120);
  }, [
    broadcastState,
    resetInactivityTimeout,
    scheduleRecognitionRestart,
    stopRecognitionNow,
  ]);

  const stopListening = useCallback(() => {
    conversationActiveRef.current = false;
    clearInactivityTimer();
    setInterimText('');
    stopRecognitionNow();
    window.speechSynthesis?.cancel();
    isSpeakingGuardRef.current = false;
    const next = resolveRestingState();
    broadcastState(next);
    if (shouldListen()) {
      scheduleRecognitionRestart(250);
    }
  }, [
    broadcastState,
    clearInactivityTimer,
    resolveRestingState,
    scheduleRecognitionRestart,
    shouldListen,
    stopRecognitionNow,
  ]);

  const pauseListening = useCallback(() => {
    conversationActiveRef.current = false;
    clearInactivityTimer();
    stopRecognitionNow();
    onUpdateVoiceSettingsRef.current?.({ listeningPaused: true });
    broadcastState('paused');
  }, [broadcastState, clearInactivityTimer, stopRecognitionNow]);

  const resumeListening = useCallback(() => {
    onUpdateVoiceSettingsRef.current?.({ listeningPaused: false, micMuted: false });
    const next =
      settingsRef.current.voice.backgroundListeningEnabled &&
      settingsRef.current.wakeWord.enabled
        ? 'standby'
        : 'idle';
    broadcastState(next);
    scheduleRecognitionRestart(160);
  }, [broadcastState, scheduleRecognitionRestart]);

  const toggleMicMute = useCallback(
    (forceMuted?: boolean) => {
      const nextMuted =
        typeof forceMuted === 'boolean'
          ? forceMuted
          : !settingsRef.current.voice.micMuted;
      onUpdateVoiceSettingsRef.current?.({ micMuted: nextMuted });
      if (nextMuted) {
        conversationActiveRef.current = false;
        clearInactivityTimer();
        stopRecognitionNow();
        window.speechSynthesis?.cancel();
        isSpeakingGuardRef.current = false;
        broadcastState('muted');
      } else {
        const next = settingsRef.current.voice.listeningPaused
          ? 'paused'
          : settingsRef.current.voice.backgroundListeningEnabled &&
              settingsRef.current.wakeWord.enabled
            ? 'standby'
            : 'idle';
        broadcastState(next);
        scheduleRecognitionRestart(200);
      }
    },
    [
      broadcastState,
      clearInactivityTimer,
      scheduleRecognitionRestart,
      stopRecognitionNow,
    ]
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    isSpeakingGuardRef.current = false;
    broadcastState(resolveRestingState());
    if (shouldListen()) {
      scheduleRecognitionRestart(200);
    }
  }, [broadcastState, resolveRestingState, scheduleRecognitionRestart, shouldListen]);

  const speakText = useCallback(
    async (text: string) => {
      await speakWithEchoGuard(text, 'speaking');
      broadcastState(resolveRestingState());
      if (shouldListen()) {
        scheduleRecognitionRestart(200);
      }
    },
    [
      broadcastState,
      resolveRestingState,
      scheduleRecognitionRestart,
      shouldListen,
      speakWithEchoGuard,
    ]
  );

  const suspendForTest = useCallback(() => {
    suspendedForTestRef.current = true;
    stopRecognitionNow();
  }, [stopRecognitionNow]);

  const resumeAfterTest = useCallback(() => {
    suspendedForTestRef.current = false;
    if (shouldListen()) {
      scheduleRecognitionRestart(220);
    }
  }, [scheduleRecognitionRestart, shouldListen]);

  const handleExternalCommand = useCallback(
    (cmd: VoiceCommandPayload) => {
      if (cmd.type === 'pause') pauseListening();
      else if (cmd.type === 'resume') resumeListening();
      else if (cmd.type === 'mute') toggleMicMute(cmd.muted);
      else if (cmd.type === 'start-active') startActiveListening();
      else if (cmd.type === 'stop-listening') stopListening();
      else if (cmd.type === 'stop-speaking') stopSpeaking();
      else if (cmd.type === 'speak-text') void speakText(cmd.text);
      else if (cmd.type === 'suspend-for-test') suspendForTest();
      else if (cmd.type === 'resume-after-test') resumeAfterTest();
    },
    [
      pauseListening,
      resumeAfterTest,
      resumeListening,
      speakText,
      startActiveListening,
      stopListening,
      stopSpeaking,
      suspendForTest,
      toggleMicMute,
    ]
  );

  return {
    voiceState,
    interimText,
    voiceError,
    lastMatchedPhrase,
    wakeDetectedAt,
    startActiveListening,
    stopListening,
    pauseListening,
    resumeListening,
    toggleMicMute,
    stopSpeaking,
    speakText,
    suspendForTest,
    resumeAfterTest,
    handleExternalCommand,
  };
}
