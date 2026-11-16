import React, { useEffect, useState } from 'react';
import { JarvisProvider, useJarvis } from './context/JarvisContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { FloatingDock } from './components/layout/FloatingDock';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { BackgroundVoiceDaemon } from './components/voice/BackgroundVoiceDaemon';
import { HomeDashboardPage } from './pages/HomeDashboardPage';
import { AiChatPage } from './pages/AiChatPage';
import { VoiceAssistantPage } from './pages/VoiceAssistantPage';
import { MyFilesPage } from './pages/MyFilesPage';
import { VisionPage } from './pages/VisionPage';
import { WebSearchPage } from './pages/WebSearchPage';
import { SystemMonitorPage } from './pages/SystemMonitorPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ActivityHistoryPage } from './pages/ActivityHistoryPage';

function JarvisWorkspaceShell() {
  const { activePage, confirmDialog, closeConfirmDialog } = useJarvis();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <HomeDashboardPage />;
      case 'chat':
        return <AiChatPage />;
      case 'voice':
        return <VoiceAssistantPage />;
      case 'files':
        return <MyFilesPage />;
      case 'vision':
        return <VisionPage />;
      case 'search':
        return <WebSearchPage />;
      case 'monitor':
        return <SystemMonitorPage />;
      case 'settings':
        return <SettingsPage />;
      case 'profile':
        return <ProfilePage />;
      case 'activity':
        return <ActivityHistoryPage />;
      default:
        return <HomeDashboardPage />;
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden flex bg-[#F6F4EE] text-[#171411] dark:bg-[#070708] dark:text-[#FAF6EE]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-40 right-0 w-[520px] h-[520px] rounded-full bg-amber-500/[0.06] dark:bg-amber-500/[0.07] blur-[120px]"
      />

      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <Topbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          {renderPage()}
        </main>
      </div>

      {/* In-browser compact dock (hidden when Electron runs its own native alwaysOnTop dock window) */}
      {!window.jarvisDesktop?.isElectron && <FloatingDock />}

      <ConfirmDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title || ''}
        description={confirmDialog?.description || ''}
        confirmLabel={confirmDialog?.confirmLabel}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={closeConfirmDialog}
      />
    </div>
  );
}

function StandaloneElectronDock() {
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

  return (
    <div className="w-screen h-screen bg-transparent overflow-hidden flex items-center justify-center">
      <FloatingDock standaloneDock />
    </div>
  );
}

export default function App() {
  const mode =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('mode')
      : null;

  return (
    <JarvisProvider>
      {mode === 'dock' ? (
        <StandaloneElectronDock />
      ) : mode === 'voice-daemon' ? (
        <BackgroundVoiceDaemon />
      ) : (
        <JarvisWorkspaceShell />
      )}
    </JarvisProvider>
  );
}
