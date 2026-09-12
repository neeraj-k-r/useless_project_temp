import React from 'react';
import { Flashlight, Shield, User, MapPin, Zap, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCommunity } from '../hooks/useCommunity';
import { useTorch } from '../hooks/useTorch';
import { BackgroundTorchToggle } from './BackgroundTorchToggle';

interface HeaderProps {
  currentTab: 'home' | 'controller' | 'map';
  setCurrentTab: (tab: 'home' | 'controller' | 'map') => void;
  onOpenAuth: () => void;
  onOpenCommunityModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  onOpenAuth,
  onOpenCommunityModal
}) => {
  const { user, isController, logout } = useAuth();
  const { currentCommunity } = useCommunity();
  const { isOn, isBlinking, turnOff, setPermissionModalOpen } = useTorch();

  return (
    <header className="border-b border-slate-800/80 bg-[#0c1220]/95 backdrop-blur sticky top-0 z-40">
      {/* Top emergency / Torch active bar */}
      {(isOn || isBlinking) && (
        <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-bold px-4 py-2 flex items-center justify-between text-xs sm:text-sm animate-pulse shadow-lg shadow-amber-500/20">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
            <Flashlight className="w-4 h-4 animate-bounce" />
            <span>🔦 {isBlinking ? 'SIGNALING: 3 BLINKS ACTIVATED' : 'VELICHAM TORCH IS ACTIVE (SOLID ON)'}</span>
          </div>
          <button
            onClick={() => turnOff()}
            className="bg-slate-950 text-amber-300 hover:bg-slate-900 px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition-all border border-amber-400/40 shadow-sm"
          >
            Turn Off My Torch ✕
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        {/* Brand */}
        <div 
          onClick={() => setCurrentTab('home')}
          className="cursor-pointer flex items-center gap-2.5 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Flashlight className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white font-display">
                VELICHAM THARAAM
              </h1>
              <span className="text-base">🔦</span>
            </div>
            <p className="text-[10px] sm:text-xs text-amber-400/90 font-medium italic hidden xs:block">
              “Current poyaalum, nammal velicham tharaam.”
            </p>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Background torch service (native Android only) */}
          <BackgroundTorchToggle communityId={currentCommunity.id} />

          {/* Community Pill */}
          <button
            onClick={onOpenCommunityModal}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs text-slate-200 transition-colors"
            title="Change locality"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-white max-w-[80px] sm:max-w-none truncate">
              {currentCommunity.name}
            </span>
          </button>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setCurrentTab('home')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                currentTab === 'home'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setCurrentTab('map')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                currentTab === 'map'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setCurrentTab('controller')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                currentTab === 'controller'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span className="hidden sm:inline">Controller</span>
              <span className="sm:hidden">Ctrl</span>
            </button>
          </div>

          {/* User Profile */}
          {user ? (
            <div className="relative group">
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs text-slate-300"
              >
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-amber-400 font-bold text-xs">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="hidden md:inline text-xs font-medium max-w-[100px] truncate">
                  {user.name}
                </span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-colors"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
