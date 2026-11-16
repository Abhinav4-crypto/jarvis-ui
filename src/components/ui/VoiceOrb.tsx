import React from 'react';
import type { VoiceState } from '../../types/jarvis';

interface VoiceOrbProps {
  state?: VoiceState;
  size?: 'md' | 'lg' | 'xl';
  audioLevel?: number;
  statusLabel?: string;
  onClick?: () => void;
}

export function VoiceOrb({
  state = 'idle',
  size = 'lg',
  audioLevel = 0.2,
  statusLabel,
  onClick,
}: VoiceOrbProps) {
  const dimensions =
    size === 'xl'
      ? 'w-56 h-56 sm:w-64 sm:h-64'
      : size === 'md'
        ? 'w-36 h-36'
        : 'w-44 h-44 sm:w-52 sm:h-52';

  const coreScale =
    state === 'listening'
      ? 1 + Math.min(0.18, audioLevel * 0.25)
      : state === 'speaking' || state === 'acknowledged'
        ? 1.07
        : state === 'thinking'
          ? 0.96
          : state === 'paused' || state === 'muted'
            ? 0.94
            : 1;

  const stateTitle =
    statusLabel ||
    (state === 'listening'
      ? 'Listening'
      : state === 'acknowledged'
        ? 'Acknowledged'
        : state === 'standby'
          ? 'Wake Standby'
          : state === 'thinking'
            ? 'Thinking'
            : state === 'speaking'
              ? 'Speaking'
              : state === 'paused'
                ? 'Paused'
                : state === 'muted'
                  ? 'Mic Muted'
                  : 'JARVIS Ready');

  const stateSubtitle =
    state === 'idle'
      ? 'Tap orb to engage voice'
      : state === 'standby'
        ? 'Listening for wake word'
        : state === 'acknowledged'
          ? 'Wake word heard · Ready'
          : state === 'listening'
            ? 'Microphone active'
            : state === 'thinking'
              ? 'Routing request'
              : state === 'paused'
                ? 'Background listening paused'
                : state === 'muted'
                  ? 'Microphone muted'
                  : 'Audio playback';

  const isMutedOrPaused = state === 'muted' || state === 'paused';

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <button
        type="button"
        onClick={onClick}
        aria-label={`JARVIS Voice Orb - ${stateTitle}`}
        className={[
          'relative flex items-center justify-center rounded-full cursor-pointer group',
          'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500',
          dimensions,
        ].join(' ')}
      >
        {/* Warm ambient golden halo */}
        <span
          aria-hidden="true"
          className={[
            'absolute inset-0 rounded-full blur-2xl transition-opacity duration-300',
            state === 'listening'
              ? 'bg-amber-500/40 dark:bg-amber-500/35 opacity-100'
              : state === 'speaking' || state === 'acknowledged'
                ? 'bg-orange-500/35 dark:bg-orange-400/30 opacity-95'
                : state === 'thinking'
                  ? 'bg-amber-400/25 opacity-85'
                  : isMutedOrPaused
                    ? 'bg-stone-500/15 opacity-45'
                    : 'bg-amber-500/20 dark:bg-amber-500/22 opacity-80 group-hover:opacity-100',
          ].join(' ')}
        />

        {/* Outer rotating precision ring */}
        <svg
          viewBox="0 0 220 220"
          className={[
            'absolute inset-0 w-full h-full',
            isMutedOrPaused ? 'opacity-45' : 'animate-jarvis-spin',
            state === 'thinking' ? 'duration-700' : '',
          ].join(' ')}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="jarvisOrbRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#F97316" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <circle
            cx="110"
            cy="110"
            r="102"
            fill="none"
            stroke="url(#jarvisOrbRing)"
            strokeWidth="1.25"
            strokeDasharray="36 14 8 14"
          />
          <circle
            cx="110"
            cy="110"
            r="92"
            fill="none"
            stroke="rgba(245, 158, 11, 0.25)"
            strokeWidth="1"
          />
        </svg>

        {/* Counter-rotating harmonic arc */}
        <svg
          viewBox="0 0 220 220"
          className={[
            'absolute inset-0 w-full h-full',
            isMutedOrPaused ? 'opacity-35' : 'animate-jarvis-spin-reverse',
          ].join(' ')}
          aria-hidden="true"
        >
          <circle
            cx="110"
            cy="110"
            r="80"
            fill="none"
            stroke="rgba(251, 191, 36, 0.45)"
            strokeWidth="1.75"
            strokeDasharray="48 92"
            strokeLinecap="round"
          />
        </svg>

        {/* Core glowing golden sphere */}
        <div
          style={{ transform: `scale(${coreScale})` }}
          className={[
            'relative w-[62%] h-[62%] rounded-full transition-transform duration-150 flex items-center justify-center',
            isMutedOrPaused
              ? 'bg-[radial-gradient(circle_at_35%_30%,#D6D3D1_0%,#78716C_45%,#292524_80%,#090807_100%)] shadow-[0_0_24px_rgba(120,113,108,0.25)]'
              : 'bg-[radial-gradient(circle_at_35%_30%,#FDE68A_0%,#F59E0B_38%,#B45309_74%,#18120B_100%)] shadow-[inset_0_0_24px_rgba(254,243,199,0.55),0_0_45px_rgba(245,158,11,0.5)]',
            state === 'idle' || state === 'standby' ? 'animate-jarvis-breathe' : '',
          ].join(' ')}
        >
          {/* Inner core specular highlight & waveform bars */}
          <div className="w-[74%] h-[74%] rounded-full bg-[#090807]/55 backdrop-blur-sm border border-amber-300/35 flex items-center justify-center gap-1.5">
            {[0.45, 0.85, 1, 0.75, 0.45].map((multiplier, idx) => {
              const barHeight =
                state === 'idle' || state === 'standby'
                  ? 12 + idx * 2
                  : isMutedOrPaused
                    ? 8
                    : state === 'listening'
                      ? Math.round(14 + multiplier * (16 + audioLevel * 28))
                      : state === 'speaking' || state === 'acknowledged'
                        ? Math.round(16 + multiplier * 26)
                        : 18;
              return (
                <span
                  key={idx}
                  style={{ height: `${Math.min(44, barHeight)}px` }}
                  className={[
                    'w-1 rounded-full transition-all duration-150',
                    isMutedOrPaused
                      ? 'bg-stone-400/70'
                      : 'bg-gradient-to-t from-orange-400 via-amber-300 to-amber-100',
                  ].join(' ')}
                />
              );
            })}
          </div>
        </div>
      </button>

      {/* Clean unboxed status label beneath the orb */}
      <div className="mt-4 flex items-center gap-2 text-xs font-medium tracking-wide text-amber-800 dark:text-amber-300">
        <span>{stateTitle}</span>
        <span aria-hidden="true" className="text-amber-500/50">
          ·
        </span>
        <span className="text-stone-600 dark:text-stone-400 font-normal">
          {stateSubtitle}
        </span>
      </div>
    </div>
  );
}
