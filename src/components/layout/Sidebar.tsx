import React, { useState } from 'react';
import { Bot, History, Sparkles, X } from 'lucide-react';
import { useJarvis } from '../../context/JarvisContext';
import { PRIMARY_NAV_ITEMS } from './navigationConfig';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { activePage, navigateTo, systemHealth, settings } = useJarvis();
  const [mascotFailed, setMascotFailed] = useState(false);

  const handleSelect = (page: typeof activePage) => {
    navigateTo(page);
    onCloseMobile();
  };

  const isBackendConnected =
    systemHealth.jarvisBackendStatus === 'connected' ||
    systemHealth.ollamaStatus === 'connected' ||
    systemHealth.geminiStatus === 'connected';

  const sidebarContent = (
    <aside
      aria-label="Primary Sidebar Navigation"
      className={[
        'flex flex-col h-full w-64 shrink-0 border-r backdrop-blur-xl transition-colors',
        'bg-[#FBF9F4]/95 border-amber-900/12',
        'dark:bg-[#0A090B]/95 dark:border-amber-500/15',
      ].join(' ')}
    >
      {/* Brand header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <button
          type="button"
          onClick={() => handleSelect('home')}
          className="flex items-center gap-3 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-500 rounded-xl"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-[0_0_20px_-4px_rgba(245,158,11,0.7)] text-[#090807]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="block font-display text-lg font-bold tracking-tight text-[#171411] dark:text-[#FAF6EE]">
              JARVIS
            </span>
            <span className="block text-[11px] text-amber-700 dark:text-amber-400/80">
              AI Companion
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main 8 Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={[
                'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer whitespace-nowrap',
                isActive
                  ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/12 to-transparent text-amber-900 dark:text-amber-300 border border-amber-500/35 shadow-[0_0_24px_-10px_rgba(245,158,11,0.5)]'
                  : 'text-stone-700 dark:text-stone-300 border border-transparent hover:bg-amber-950/5 dark:hover:bg-white/[0.04] hover:text-[#171411] dark:hover:text-[#FAF6EE]',
              ].join(' ')}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500 dark:text-stone-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="pt-3 mt-3 border-t border-amber-900/10 dark:border-amber-500/12">
          <button
            type="button"
            onClick={() => handleSelect('activity')}
            className={[
              'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer whitespace-nowrap',
              activePage === 'activity'
                ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/12 to-transparent text-amber-900 dark:text-amber-300 border border-amber-500/35'
                : 'text-stone-700 dark:text-stone-300 border border-transparent hover:bg-amber-950/5 dark:hover:bg-white/[0.04] hover:text-[#171411] dark:hover:text-[#FAF6EE]',
            ].join(' ')}
          >
            <History
              className={`w-4 h-4 shrink-0 ${
                activePage === 'activity'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            />
            <span className="truncate">Activity History</span>
          </button>
        </div>
      </nav>

      {/* Bottom Friendly Robot Mascot Card */}
      <div className="p-3.5 border-t border-amber-900/10 dark:border-amber-500/12">
        <div className="rounded-2xl border border-amber-900/12 dark:border-amber-500/20 bg-white/80 dark:bg-[#141214]/90 p-3 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl overflow-hidden border border-amber-500/30 bg-[#141210] flex items-center justify-center shrink-0">
            {!mascotFailed ? (
              <img
                src="/src/assets/images/jarvis_robot_mascot_1794841431703.jpg"
                alt="JARVIS companion robot mascot"
                referrerPolicy="no-referrer"
                onError={() => setMascotFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <Bot className="w-6 h-6 text-amber-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#171411] dark:text-[#FAF6EE] truncate">
              I'm here to help!
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-stone-600 dark:text-stone-400">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  systemHealth.jarvisBackendStatus === 'connected'
                    ? 'bg-emerald-500'
                    : systemHealth.network.online
                      ? 'bg-amber-500'
                      : 'bg-stone-500'
                }`}
              />
              <span className="truncate">
                {isBackendConnected
                  ? 'Connected · Ready'
                  : systemHealth.network.online
                    ? 'Backend Offline'
                    : 'Offline Mode'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <div className="hidden lg:block h-full">{sidebarContent}</div>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
