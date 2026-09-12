import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { ControllerDashboard } from './pages/ControllerDashboard';
import { AuthPage } from './pages/AuthPage';
import { KeralaMap } from './components/KeralaMap';
import { VisualTorchOverlay } from './components/VisualTorchOverlay';
import { TorchPermissionModal } from './components/TorchPermissionModal';
import { AuthModal } from './components/AuthModal';
import { CommunitySelector } from './components/CommunitySelector';
import { useAuth } from './hooks/useAuth';
import { useCommunity } from './hooks/useCommunity';
import { useTorch } from './hooks/useTorch';
import { App as CapApp } from '@capacitor/app';
import { torchService } from './torch/torchService';
import { syncForegroundState } from './services/backgroundTorch';
import { Home as HomeIcon, Map as MapIcon, Shield } from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<'home' | 'controller' | 'map'>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [communityModalOpen, setCommunityModalOpen] = useState(false);

  const { user } = useAuth();
  const { communities, currentCommunity, changeUserCommunity } = useCommunity();
  const { permissionModalOpen, setPermissionModalOpen } = useTorch();

  useEffect(() => {
    (window as any).__CURRENT_TAB__ = currentTab;
  }, [currentTab]);

  useEffect(() => {
    // Tell the native background service whether the app is foregrounded.
    // visibilitychange alone is unreliable in an Android WebView, so also
    // subscribe to Capacitor's appStateChange.
    const setFg = (fg: boolean) => syncForegroundState(fg);
    setFg(true);
    const onVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setFg(visible);
      if (!visible) {
        // The web layer cannot flash while hidden; it must also hand the
        // camera back, otherwise the native service gets CAMERA_IN_USE.
        try { torchService.releaseTorch(); } catch {}
      }
    };
    const onHide = () => {
      setFg(false);
      try { torchService.releaseTorch(); } catch {}
    };
    const sub = CapApp.addListener('appStateChange', (state) => {
      setFg(state.isActive);
      if (!state.isActive) {
        try { torchService.releaseTorch(); } catch {}
      }
    });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', () => setFg(true));
    window.addEventListener('blur', () => setFg(false));
    window.addEventListener('pagehide', onHide);
    return () => {
      sub?.then((s) => s.remove());
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', () => setFg(true));
      window.removeEventListener('blur', () => setFg(false));
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  useEffect(() => {
    const onFirstUserAction = () => {
      torchService.requestTorchAccess().catch(() => {});
    };
    window.addEventListener('click', onFirstUserAction, { once: true });
    window.addEventListener('touchstart', onFirstUserAction, { once: true });
    return () => {
      window.removeEventListener('click', onFirstUserAction);
      window.removeEventListener('touchstart', onFirstUserAction);
    };
  }, []);

  // If user is not logged in, show the Login/Register window first!
  if (!user) {
    return (
      <>
        <AuthPage />
        <VisualTorchOverlay isControllerTab={false} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 pb-20 sm:pb-8">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenCommunityModal={() => setCommunityModalOpen(true)}
      />

      {/* Main Page Content */}
      <main className="flex-1">
        {currentTab === 'home' && (
          <Home
            onOpenCommunityModal={() => setCommunityModalOpen(true)}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {currentTab === 'controller' && (
          <ControllerDashboard />
        )}

        {currentTab === 'map' && (
          <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-display text-white">
                  Kerala Community Power Grid
                </h2>
                <p className="text-xs text-slate-400">
                  Realtime Outage Status across Ernakulam & Central Kerala
                </p>
              </div>
            </div>
            <KeralaMap
              communities={communities}
              selectedCommunityId={currentCommunity.id}
              onSelectCommunity={(id) => {
                changeUserCommunity(id);
                setCurrentTab('home');
              }}
              height="550px"
            />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c1220]/95 border-t border-slate-800/80 backdrop-blur px-6 py-2 flex items-center justify-around">
        <button
          onClick={() => setCurrentTab('home')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            currentTab === 'home' ? 'text-amber-400 font-bold' : 'text-slate-400'
          }`}
        >
          <HomeIcon className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={() => setCurrentTab('map')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            currentTab === 'map' ? 'text-amber-400 font-bold' : 'text-slate-400'
          }`}
        >
          <MapIcon className="w-5 h-5" />
          <span className="text-[10px]">Map</span>
        </button>

        <button
          onClick={() => setCurrentTab('controller')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            currentTab === 'controller' ? 'text-amber-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Shield className="w-5 h-5" />
          <span className="text-[10px]">Controller</span>
        </button>
      </nav>

      {/* Fullscreen High-Candela Visual Torch Overlay (for blinking & physical fallback) */}
      <VisualTorchOverlay isControllerTab={currentTab === 'controller'} />

      {/* Flashlight Permission Educational Modal */}
      <TorchPermissionModal
        isOpen={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Community Selector Modal */}
      <CommunitySelector
        isOpen={communityModalOpen}
        onClose={() => setCommunityModalOpen(false)}
        communities={communities}
        selectedCommunityId={currentCommunity.id}
        onSelect={(id) => changeUserCommunity(id)}
      />
    </div>
  );
}

export default App;
