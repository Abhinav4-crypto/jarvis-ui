import React, { useEffect, useState } from 'react';
import { History, Menu, Mic, MicOff, Moon, Sun, User } from 'lucide-react';
import { useJarvis } from '../../context/JarvisContext';
import { PAGE_TITLES } from './navigationConfig';

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export function Topbar({ onOpenMobileMenu }: TopbarProps) {
  const {
    activePage,
    navigateTo,
    settings,
    toggleTheme,
    profile,
    voiceState,
    toggleMicMute,
  } = useJarvis();
  const [now, setNow] = useState(() => new Date());
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateLabel = now.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeLabel = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const isDark = settings.appearance.theme === 'dark';

  const isMicActivelyListening =
    voiceState === 'standby' ||
    voiceState === 'listening' ||
    voiceState === 'acknowledged';

  const micLabel = settings.voice.micMuted
    ? 'Mic Muted'
    : settings.voice.listeningPaused
      ? 'Voice Paused'
      : voiceState === 'listening'
        ? 'Listening'
        : voiceState === 'standby'
          ? `Wake: "${settings.wakeWord.phrase}"`
          : voiceState === 'speaking'
            ? 'Speaking'
            : voiceState === 'thinking'
              ? 'Thinking'
              : 'Mic Idle';

  return (
    <header
      className={[
        'h-16 shrink-0 px-4 sm:px-6 border-b backdrop-blur-xl flex items-center justify-between gap-4',
        'bg-[#FBF9F4]/85 border-amber-900/12',
        'dark:bg-[#0B0A0C]/85 dark:border-amber-500/15',
      ].join(' ')}
    >
      {/* Left zone: Mobile drawer toggle + Current workspace section */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-xl border border-amber-900/12 dark:border-amber-500/20 text-stone-700 dark:text-stone-300 hover:bg-amber-500/10 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <p className="text-sm sm:text-base font-display font-semibold text-[#171411] dark:text-[#FAF6EE] truncate">
            {PAGE_TITLES[activePage]}
          </p>
        </div>
      </div>

      {/* Center / Right zone: Mic indicator, Date & Time, Theme toggle, Activity & Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={() => toggleMicMute()}
          title={
            settings.voice.micMuted
              ? 'Unmute JARVIS Microphone'
              : 'Mute JARVIS Microphone'
          }
          className={[
            'hidden md:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer',
            settings.voice.micMuted
              ? 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300'
              : isMicActivelyListening
                ? 'border-amber-500/45 bg-amber-500/12 text-amber-800 dark:text-amber-300'
                : 'border-amber-900/12 dark:border-amber-500/20 text-stone-600 dark:text-stone-300 hover:border-amber-500/40',
          ].join(' ')}
        >
          <span
            className={[
              'w-2 h-2 rounded-full',
              settings.voice.micMuted
                ? 'bg-red-500'
                : isMicActivelyListening
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-stone-400',
            ].join(' ')}
          />
          {settings.voice.micMuted ? (
            <MicOff className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
          <span className="max-w-[130px] truncate">{micLabel}</span>
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300 mr-1">
          <span>{dateLabel}</span>
          <span aria-hidden="true" className="text-amber-500/60">
            ·
          </span>
          <span className="font-mono tabular-nums text-amber-800 dark:text-amber-300 font-medium">
            {timeLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigateTo('activity')}
          title="Activity History"
          aria-label="Activity History"
          className={[
            'p-2.5 rounded-xl border transition-colors cursor-pointer',
            activePage === 'activity'
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
              : 'border-amber-900/12 dark:border-amber-500/20 text-stone-700 dark:text-stone-300 hover:border-amber-500/40 hover:text-amber-700 dark:hover:text-amber-300',
          ].join(' ')}
        >
          <History className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2.5 rounded-xl border border-amber-900/12 dark:border-amber-500/20 text-stone-700 dark:text-amber-300 hover:border-amber-500/45 hover:bg-amber-500/10 transition-colors cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => navigateTo('profile')}
          title="User Profile"
          aria-label="Open User Profile"
          className={[
            'flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-xl border transition-all cursor-pointer',
            activePage === 'profile'
              ? 'border-amber-500/55 bg-amber-500/15'
              : 'border-amber-900/12 dark:border-amber-500/20 hover:border-amber-500/45',
          ].join(' ')}
        >
          <div className="w-7 h-7 rounded-lg overflow-hidden bg-amber-500/15 flex items-center justify-center shrink-0">
            {!avatarFailed && profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <span className="hidden md:inline text-xs font-medium text-[#171411] dark:text-[#FAF6EE] whitespace-nowrap">
            {profile.name}
          </span>
        </button>
      </div>
    </header>
  );
}
