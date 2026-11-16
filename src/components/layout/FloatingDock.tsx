import React, { useEffect, useState } from 'react';
import {
  ChevronUp,
  EyeOff,
  Minimize2,
  Pin,
  PinOff,
  Sparkles,
} from 'lucide-react';
import { useJarvis } from '../../context/JarvisContext';
import type { PageId } from '../../types/jarvis';
import { PRIMARY_NAV_ITEMS } from './navigationConfig';

interface FloatingDockProps {
  standaloneDock?: boolean;
}

export function FloatingDock({ standaloneDock = false }: FloatingDockProps) {
  const {
    activePage,
    navigateTo,
    dockMode,
    setDockMode,
    dockPinned,
    setDockPinned,
  } = useJarvis();

  const [syncedPage, setSyncedPage] = useState<PageId>(activePage);

  useEffect(() => {
    if (!standaloneDock) {
      setSyncedPage(activePage);
      return;
    }
    if (window.jarvisDesktop?.onActivePageUpdated) {
      return window.jarvisDesktop.onActivePageUpdated((pageId) => {
        setSyncedPage(pageId);
      });
    }
  }, [activePage, standaloneDock]);

  const handleSelectPage = (pageId: PageId) => {
    setSyncedPage(pageId);
    if (standaloneDock && window.jarvisDesktop?.navigateFromDock) {
      window.jarvisDesktop.navigateFromDock(pageId);
    } else {
      navigateTo(pageId);
    }
  };

  const handlePinToggle = () => {
    const next = !dockPinned;
    setDockPinned(next);
    window.jarvisDesktop?.controlDock?.('pin', next);
  };

  const handleMinimize = () => {
    setDockMode('minimized');
    window.jarvisDesktop?.controlDock?.('minimize');
  };

  const handleExpand = () => {
    setDockMode('expanded');
    window.jarvisDesktop?.controlDock?.('expand');
  };

  const handleHide = () => {
    setDockMode('hidden');
    if (standaloneDock) {
      window.jarvisDesktop?.controlDock?.('hide');
    }
  };

  if (!standaloneDock && dockMode === 'hidden') {
    return (
      <button
        type="button"
        onClick={handleExpand}
        title="Show JARVIS Floating Dock"
        className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-amber-500/35 bg-[#0E0D0F]/90 text-amber-300 text-xs font-medium shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-xl hover:border-amber-400/60 transition-all cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Show Dock</span>
      </button>
    );
  }

  if (dockMode === 'minimized') {
    return (
      <div
        className={
          standaloneDock
            ? 'w-full h-full flex items-center justify-center'
            : 'fixed bottom-4 left-1/2 -translate-x-1/2 z-30'
        }
      >
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-amber-500/35 bg-white/90 dark:bg-[#0D0C0E]/90 backdrop-blur-xl shadow-[0_12px_36px_-10px_rgba(245,158,11,0.35)]">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-medium text-[#171411] dark:text-[#FAF6EE] whitespace-nowrap">
            JARVIS Dock
          </span>
          <button
            type="button"
            onClick={handleExpand}
            title="Expand Dock"
            aria-label="Expand Dock"
            className="p-1 rounded-lg hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 cursor-pointer"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleHide}
            title="Hide Dock"
            aria-label="Hide Dock"
            className="p-1 rounded-lg hover:bg-amber-500/15 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        standaloneDock
          ? 'w-full h-full flex items-center justify-center'
          : 'fixed z-30 bottom-4 hidden md:flex',
        !standaloneDock &&
          (dockPinned
            ? 'left-1/2 -translate-x-1/2'
            : 'right-5 translate-x-0 opacity-85 hover:opacity-100'),
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'flex items-center gap-1.5 px-2.5 py-2 rounded-2xl border backdrop-blur-2xl transition-all duration-200',
          'bg-white/85 border-amber-900/15 shadow-[0_12px_40px_-10px_rgba(120,75,15,0.22)]',
          'dark:bg-[#0B0A0C]/85 dark:border-amber-500/30 dark:shadow-[0_14px_45px_-12px_rgba(0,0,0,0.85),0_0_28px_-12px_rgba(245,158,11,0.3)]',
        ].join(' ')}
        role="navigation"
        aria-label="JARVIS Floating Navigation Dock"
      >
        <div className="flex items-center gap-1">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = syncedPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPage(item.id)}
                aria-label={item.label}
                className={[
                  'group relative p-2.5 rounded-xl transition-all duration-150 cursor-pointer',
                  isActive
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-[#0A0908] shadow-[0_0_18px_rgba(245,158,11,0.65)] scale-105'
                    : 'text-stone-600 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-500/12 hover:-translate-y-0.5',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-[#121012] text-[#FAF6EE] border border-amber-500/30 text-[11px] font-medium whitespace-nowrap shadow-lg">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        <span
          aria-hidden="true"
          className="w-px h-6 bg-amber-900/15 dark:bg-amber-500/20 mx-1"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePinToggle}
            title={dockPinned ? 'Unpin always-on-top dock' : 'Pin always-on-top dock'}
            aria-label={dockPinned ? 'Unpin dock' : 'Pin dock'}
            className={[
              'p-2 rounded-xl transition-colors cursor-pointer',
              dockPinned
                ? 'text-amber-700 dark:text-amber-300 bg-amber-500/15'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200',
            ].join(' ')}
          >
            {dockPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleMinimize}
            title="Minimize dock"
            aria-label="Minimize dock"
            className="p-2 rounded-xl text-stone-500 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleHide}
            title="Hide dock"
            aria-label="Hide dock"
            className="p-2 rounded-xl text-stone-500 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
