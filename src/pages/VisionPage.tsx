import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Monitor,
  MonitorOff,
  Send,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useJarvis } from '../context/JarvisContext';
import { jarvisBridge } from '../services/jarvisBridge';
import type { ElectronScreenSource } from '../types/jarvis';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { SearchBar } from '../components/ui/SearchBar';
import { StatusIndicator } from '../components/ui/StatusIndicator';

export function VisionPage() {
  const {
    visionCaptures,
    activeVisionId,
    setActiveVisionId,
    addVisionCapture,
    openChatWithPrompt,
    settings,
    systemHealth,
  } = useJarvis();

  const [cameraActive, setCameraActive] = useState(false);
  const [screenSharingActive, setScreenSharingActive] = useState(false);
  const [electronSources, setElectronSources] = useState<ElectronScreenSource[] | null>(
    null
  );
  const [selectedSourceName, setSelectedSourceName] = useState<string>('');
  const [visionError, setVisionError] = useState<string | null>(null);
  const [visionPrompt, setVisionPrompt] = useState(
    'Describe visible application windows, text, and interface elements on this screen.'
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [analysisProvider, setAnalysisProvider] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const activeCapture =
    visionCaptures.find((v) => v.id === activeVisionId) || visionCaptures[0] || null;

  const stopAllStreams = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setScreenSharingActive(false);
    setSelectedSourceName('');
  };

  useEffect(() => {
    return () => stopAllStreams();
  }, []);

  // User-initiated Screen Sharing (Electron desktopCapturer picker OR Browser getDisplayMedia)
  const handleStartScreenSharing = async () => {
    setVisionError(null);
    stopAllStreams();

    if (window.jarvisDesktop?.getScreenSources) {
      try {
        const sources = await window.jarvisDesktop.getScreenSources();
        setElectronSources(sources);
      } catch (err) {
        setVisionError(
          err instanceof Error
            ? err.message
            : 'Unable to list screens/windows from Electron.'
        );
      }
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setVisionError('Screen sharing is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      setSelectedSourceName(track?.label || 'Shared Screen');
      setScreenSharingActive(true);

      track.onended = () => {
        stopAllStreams();
      };

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch {
      setVisionError('Screen sharing was cancelled or denied by browser permissions.');
    }
  };

  const handleCaptureElectronSource = async (source: ElectronScreenSource) => {
    if (!window.jarvisDesktop?.captureScreenSource) return;
    setVisionError(null);
    try {
      const captured = await window.jarvisDesktop.captureScreenSource(source.id);
      addVisionCapture({
        label: captured.name,
        source: 'electron_screen',
        dataUrl: captured.dataUrl,
        note: `Captured from ${source.kind}: ${source.name}`,
      });
      setElectronSources(null);
      setAnalysisText(null);
    } catch (err) {
      setVisionError(
        err instanceof Error ? err.message : 'Failed to capture selected screen.'
      );
    }
  };

  const handleStartCamera = async () => {
    setVisionError(null);
    stopAllStreams();
    if (!navigator.mediaDevices?.getUserMedia) {
      setVisionError('Camera access is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch {
      setVisionError('Unable to access webcam. Check camera permissions.');
    }
  };

  const handleCaptureScreenshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    const sourceType = screenSharingActive ? 'screen' : 'camera';
    addVisionCapture({
      label: screenSharingActive
        ? `${selectedSourceName || 'Screen'} (${canvas.width}x${canvas.height})`
        : `Camera Frame (${canvas.width}x${canvas.height})`,
      source: sourceType,
      dataUrl,
    });
    setAnalysisText(null);
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopAllStreams();
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        addVisionCapture({
          label: file.name,
          source: 'upload',
          dataUrl: reader.result,
        });
        setAnalysisText(null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAnalyzeScreen = async () => {
    let targetDataUrl = activeCapture?.dataUrl;

    // If screen sharing or camera is currently streaming live, snap current frame automatically on explicit Ask click
    if ((screenSharingActive || cameraActive) && videoRef.current?.videoWidth) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      targetDataUrl = canvas.toDataURL('image/png');
      addVisionCapture({
        label: screenSharingActive
          ? `${selectedSourceName || 'Screen'} Snapshot`
          : 'Camera Snapshot',
        source: screenSharingActive ? 'screen' : 'camera',
        dataUrl: targetDataUrl,
      });
    }

    if (!targetDataUrl) {
      setVisionError('Capture a screenshot, start screen sharing, or upload an image first.');
      return;
    }

    setVisionError(null);
    setAnalyzing(true);
    setAnalysisText(null);

    try {
      const result = await jarvisBridge.analyzeVisionImage(
        {
          prompt:
            visionPrompt.trim() ||
            'Describe visible application windows, text, and interface elements.',
          imageDataUrl: targetDataUrl,
        },
        settings
      );

      if (result.connected && result.analysisText) {
        setAnalysisText(result.analysisText);
        setAnalysisProvider(result.providerLabel || 'AI Vision');
      } else {
        setVisionError(result.error || 'Vision analysis failed.');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleOpenInChat = () => {
    if (!activeCapture) return;
    openChatWithPrompt(
      visionPrompt.trim() || `Analyze this screen capture: ${activeCapture.label}`,
      [
        {
          id: `vis-att-${activeCapture.id}`,
          name: activeCapture.label,
          type: 'image/png',
          size: activeCapture.dataUrl.length,
          previewUrl: activeCapture.dataUrl,
        },
      ]
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-page-enter pb-20">
      {/* Explicit Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadImage}
          />

          {!screenSharingActive ? (
            <Button
              variant="primary"
              icon={<Monitor className="w-4 h-4" />}
              onClick={handleStartScreenSharing}
            >
              Start Screen Sharing
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                icon={<Camera className="w-4 h-4" />}
                onClick={handleCaptureScreenshot}
              >
                Capture Screenshot
              </Button>
              <Button
                variant="danger"
                icon={<MonitorOff className="w-4 h-4" />}
                onClick={stopAllStreams}
              >
                Stop Sharing
              </Button>
            </>
          )}

          <Button
            variant="secondary"
            icon={<Upload className="w-4 h-4" />}
            onClick={() => uploadInputRef.current?.click()}
          >
            Upload Image
          </Button>

          {!cameraActive ? (
            <Button
              variant="secondary"
              icon={<Camera className="w-4 h-4" />}
              onClick={handleStartCamera}
            >
              Start Camera
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                icon={<Camera className="w-4 h-4" />}
                onClick={handleCaptureScreenshot}
              >
                Capture Frame
              </Button>
              <Button
                variant="danger"
                icon={<CameraOff className="w-4 h-4" />}
                onClick={stopAllStreams}
              >
                Stop Camera
              </Button>
            </>
          )}
        </div>

        <StatusIndicator
          label="Screen Vision"
          state={
            screenSharingActive || cameraActive
              ? 'active'
              : systemHealth.screenVisionStatus
          }
          detail={
            screenSharingActive
              ? `Sharing: ${selectedSourceName || 'Active'}`
              : cameraActive
                ? 'Webcam Active'
                : systemHealth.isElectronDesktop
                  ? 'Electron Desktop Capturer Ready'
                  : 'Browser Capture Ready'
          }
        />
      </div>

      {/* Explicit Screen Sharing Active Indicator */}
      {screenSharingActive && (
        <GlassCard
          padding="sm"
          className="border-amber-500/50 bg-amber-500/12 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs font-medium text-amber-900 dark:text-amber-200">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            <span>
              Screen Sharing Active ({selectedSourceName}). Screenshots are captured only when you click Capture Screenshot or Ask JARVIS.
            </span>
          </div>
          <Button variant="danger" size="sm" onClick={stopAllStreams}>
            Stop Sharing
          </Button>
        </GlassCard>
      )}

      {visionError && (
        <GlassCard padding="sm" className="border-red-500/35 text-xs text-red-700 dark:text-red-300">
          {visionError}
        </GlassCard>
      )}

      {/* Electron Screen & Window Selector Modal */}
      {electronSources && (
        <GlassCard glow padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
                Select Screen or Application Window
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Choose the display or window you want JARVIS to capture and inspect.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setElectronSources(null)}
              aria-label="Close source picker"
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
            {electronSources.map((src) => (
              <button
                key={src.id}
                type="button"
                onClick={() => handleCaptureElectronSource(src)}
                className="rounded-xl border border-amber-900/15 dark:border-amber-500/20 hover:border-amber-500 p-2 text-left bg-white/60 dark:bg-black/30 transition-all cursor-pointer"
              >
                <img
                  src={src.thumbnailDataUrl}
                  alt={src.name}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-video object-cover rounded-lg bg-black mb-2"
                />
                <p className="text-xs font-medium text-[#171411] dark:text-[#FAF6EE] truncate">
                  {src.name}
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 capitalize">
                  {src.kind}
                </p>
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Preview Viewport + Ask JARVIS */}
        <GlassCard glow padding="md" className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative rounded-xl overflow-hidden border border-amber-500/20 bg-[#0A090B] aspect-video flex items-center justify-center">
            {cameraActive || screenSharingActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            ) : activeCapture ? (
              <img
                src={activeCapture.dataUrl}
                alt={activeCapture.label}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center px-6">
                <Monitor className="w-12 h-12 text-amber-500/45 mx-auto mb-3" />
                <p className="text-sm font-medium text-[#FAF6EE]">
                  No Screen or Image Selected
                </p>
                <p className="mt-1 text-xs text-stone-400 max-w-md">
                  Click "Start Screen Sharing" to pick a screen or window, or upload an image for JARVIS to analyze.
                </p>
              </div>
            )}
          </div>

          {/* Ask JARVIS about this Screen */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <SearchBar
                value={visionPrompt}
                onChange={setVisionPrompt}
                onSubmit={handleAnalyzeScreen}
                placeholder="Ask JARVIS about this Screen (windows, text, errors, UI)..."
                submitLabel={analyzing ? 'Analyzing...' : 'Analyze Screen'}
                disabled={analyzing}
                className="flex-1"
              />
              {activeCapture && (
                <Button
                  variant="secondary"
                  icon={<Send className="w-4 h-4" />}
                  onClick={handleOpenInChat}
                >
                  Open in Chat
                </Button>
              )}
            </div>

            {analysisText && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{analysisProvider || 'Vision Analysis'}</span>
                </div>
                <div className="text-sm leading-relaxed text-[#171411] dark:text-[#FAF6EE] whitespace-pre-wrap">
                  {analysisText}
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Right: Screen Captures List */}
        <GlassCard padding="md" className="lg:col-span-4 flex flex-col gap-3">
          <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
            Captured Screenshots
          </h2>
          {visionCaptures.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-8 text-center">
              Captured screenshots and uploaded images will appear here for inspection.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {visionCaptures.map((cap) => {
                const isSelected = cap.id === activeCapture?.id;
                return (
                  <button
                    key={cap.id}
                    type="button"
                    onClick={() => {
                      stopAllStreams();
                      setActiveVisionId(cap.id);
                    }}
                    className={[
                      'w-full flex items-center gap-3 p-2 rounded-xl border text-left transition-colors cursor-pointer',
                      isSelected
                        ? 'border-amber-500/55 bg-amber-500/12'
                        : 'border-amber-900/10 dark:border-white/[0.08] hover:border-amber-500/40',
                    ].join(' ')}
                  >
                    <img
                      src={cap.dataUrl}
                      alt={cap.label}
                      referrerPolicy="no-referrer"
                      className="w-16 h-11 rounded-lg object-cover shrink-0 bg-black"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#171411] dark:text-[#FAF6EE] truncate">
                        {cap.label}
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 capitalize">
                        {cap.source.replace('_', ' ')} · {cap.capturedAt}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
