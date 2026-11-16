import React, { useEffect } from 'react';
import { useJarvis } from '../../context/JarvisContext';
import { useBackgroundVoiceEngine } from '../../hooks/useBackgroundVoiceEngine';

/**
 * Headless Electron voice daemon rendered inside the hidden always-alive
 * BrowserWindow (`/?mode=voice-daemon`). Owns the single desktop microphone
 * recognizer so JARVIS keeps listening when minimized or closed to system tray.
 */
export function BackgroundVoiceDaemon() {
  const { settings, updateSettings, voiceTranscript, appendRemoteTranscript } =
    useJarvis();

  const engine = useBackgroundVoiceEngine({
    enabled: true,
    settings,
    transcript: voiceTranscript,
    onTranscriptEntry: (entry) => {
      appendRemoteTranscript(entry);
      window.jarvisDesktop?.reportVoiceTranscript?.(entry);
    },
    onUpdateVoiceSettings: (patch) => {
      updateSettings('voice', patch);
    },
    onStatusBroadcast: (status) => {
      window.jarvisDesktop?.reportVoiceStatus?.(status);
    },
  });

  useEffect(() => {
    document.documentElement.style.background = '#070708';
    document.body.style.background = '#070708';
  }, []);

  useEffect(() => {
    if (!window.jarvisDesktop?.onVoiceCommand) return;
    return window.jarvisDesktop.onVoiceCommand((command) => {
      engine.handleExternalCommand(command);
    });
  }, [engine.handleExternalCommand]);

  return (
    <div className="min-h-screen bg-[#070708] text-amber-200 p-4 font-mono text-xs flex flex-col justify-center gap-2">
      <p className="font-semibold text-amber-400">JARVIS Background Voice Daemon</p>
      <p>State: {engine.voiceState}</p>
      <p>Wake Phrase: {settings.wakeWord.phrase}</p>
      <p>Language: {settings.voice.language}</p>
      {engine.voiceError && <p className="text-red-400">{engine.voiceError}</p>}
    </div>
  );
}
