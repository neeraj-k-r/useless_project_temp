import React, { useState } from 'react';
import { 
  Zap, 
  ZapOff, 
  Flashlight, 
  MapPin, 
  ShieldCheck, 
  Users, 
  CheckCircle2, 
  AlertOctagon, 
  Info, 
  Sparkles,
  RefreshCw,
  Power
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCommunity } from '../hooks/useCommunity';
import { useRealtimeOutage } from '../hooks/useRealtimeOutage';
import { useTorch } from '../hooks/useTorch';
import { ConsensusMeter } from '../components/ConsensusMeter';
import { ActivityFeed } from '../components/ActivityFeed';
import { KeralaMap } from '../components/KeralaMap';
import { MANGLISH_QUOTES } from '../utils/keralaData';

interface HomeProps {
  onOpenCommunityModal: () => void;
  onOpenAuth: () => void;
}

export const Home: React.FC<HomeProps> = ({ onOpenCommunityModal, onOpenAuth }) => {
  const { user } = useAuth();
  const { currentCommunity, communities } = useCommunity();
  const { 
    activeOutageReports, 
    activeRestoreReports, 
    hasReportedOutage, 
    hasReportedRestore, 
    userReportStatus,
    isSubmitting, 
    lastNotice, 
    reportCurrentPoyi, 
    reportCurrentVannu,
    activities 
  } = useRealtimeOutage(currentCommunity.id);

  const { 
    isOn, 
    isBlinking, 
    isSupported, 
    turnOff, 
    setPermissionModalOpen, 
    triggerBlinkSignal 
  } = useTorch();

  const [testFlashSuccess, setTestFlashSuccess] = useState(false);

  const isVerifiedOutage = currentCommunity.status === 'VERIFIED_OUTAGE';
  const isReporting = currentCommunity.status === 'REPORTING';

  const handleTestFlash = async () => {
    setTestFlashSuccess(true);
    await triggerBlinkSignal();
    setTimeout(() => setTestFlashSuccess(false), 3000);
  };

  const handleReportPoyiClick = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    await reportCurrentPoyi();
  };

  const handleReportVannuClick = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    await reportCurrentVannu();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Hero Community Header */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold uppercase tracking-wider mb-1">
              <span>Community Grid</span>
              <span>•</span>
              <span>Live Power Consensus</span>
            </div>
            
            <button
              onClick={onOpenCommunityModal}
              className="flex items-center gap-2 group text-left"
            >
              <h2 className="text-2xl sm:text-3xl font-black text-white font-display group-hover:text-amber-400 transition-colors flex items-center gap-2">
                <MapPin className="w-6 h-6 text-amber-500 shrink-0" />
                <span>📍 {currentCommunity.name}</span>
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {currentCommunity.pincode}
              </span>
            </button>
            
            <p className="text-xs text-slate-400 mt-1">
              Ernakulam District • KSEB Circle
            </p>
          </div>

          {/* Flashlight Hardware Readiness Badge */}
          <div className="flex flex-col sm:items-end gap-2">
            <button
              onClick={() => setPermissionModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-xs font-semibold text-slate-200 transition-all shadow-sm"
            >
              <div className={`w-2.5 h-2.5 rounded-full ${isSupported !== false ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <Flashlight className="w-4 h-4 text-amber-400" />
              <span>{isSupported !== false ? 'Torch Ready (Android Chrome)' : 'Enable Flashlight'}</span>
            </button>

            <button
              onClick={handleTestFlash}
              className="text-[11px] text-amber-400/90 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>Test 3-Blink Signal on this device</span>
            </button>
          </div>
        </div>

        {/* Big Emergency Power Status Card */}
        <div className="mt-6 pt-6 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            <span>⚡ POWER STATUS</span>
            <span className="font-mono text-[11px]">LIVE GRID TELEMETRY</span>
          </div>

          {isVerifiedOutage ? (
            /* VERIFIED POWER OUTAGE STATE */
            <div className="bg-red-950/60 border-2 border-red-500/80 rounded-2xl p-5 sm:p-6 shadow-xl shadow-red-950/50 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-600/40">
                  <ZapOff className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500 animate-ping" />
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
                      🔴 POWER OUTAGE CONFIRMED
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-red-200 mt-1 leading-relaxed">
                    Power outage verified in <strong>{currentCommunity.name}</strong> by{' '}
                    <strong>{activeOutageReports.length || currentCommunity.outageThreshold} residents</strong>.
                  </p>
                  
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center gap-1">
                      <Flashlight className="w-3.5 h-3.5 fill-current" />
                      🔦 Velicham Tharaam Activated
                    </span>
                    <span className="text-xs text-red-300 italic">
                      “{MANGLISH_QUOTES.allSafePrompt}”
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : isReporting ? (
            /* REPORTING / PENDING CONSENSUS STATE */
            <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-5 shadow-lg">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold">
                  <ZapOff className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-amber-300 font-display">
                    🟡 OUTAGE REPORTED (PENDING CONSENSUS)
                  </h3>
                  <p className="text-xs text-amber-200/90 mt-0.5">
                    {activeOutageReports.length} resident(s) reported power cut in {currentCommunity.name}. Waiting for consensus.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* NORMAL POWER AVAILABLE STATE */
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-emerald-300 font-display">
                      ⚡ POWER AVAILABLE
                    </h3>
                    <p className="text-xs text-emerald-200/80">
                      Grid voltage steady in {currentCommunity.name}. No power cuts confirmed.
                    </p>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                    Grid Normal 🟢
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Local Torch Dismiss Banner (Allows citizen to turn off their flashlight anytime) */}
      {(isOn || isBlinking) && (
        <div className="p-4 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl animate-fade-in">
          <div className="flex items-center gap-2.5">
            <Flashlight className="w-6 h-6 text-amber-400 fill-current animate-bounce" />
            <div>
              <div className="font-extrabold text-sm text-white">🔦 Your Flashlight Beacon is Active!</div>
              <div className="text-xs text-amber-300">Illuminating {currentCommunity.name} during power outage consensus</div>
            </div>
          </div>
          <button
            onClick={() => turnOff()}
            className="py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-black text-amber-300 border border-amber-400 font-bold text-xs shadow-md transition-transform active:scale-95"
          >
            Turn Off My Flashlight
          </button>
        </div>
      )}

      {/* Tactical Report Buttons Grid (Switch Mode: Allows toggling between Outage & Restored anytime) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* PRIMARY BUTTON 1: CURRENT POYI (Red Switch) */}
        <div className={`border rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all ${
          userReportStatus === 'CURRENT_POYI'
            ? 'bg-red-950/70 border-red-500 shadow-red-950/60 ring-2 ring-red-500/50'
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <ZapOff className="w-4 h-4" />
                <span>OUTAGE REPORTING SWITCH</span>
              </span>
              {userReportStatus === 'CURRENT_POYI' && (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-extrabold uppercase animate-pulse">
                  Active (Power Cut)
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              Report Power Cut
            </h3>
            <p className="text-xs text-amber-400/90 font-medium italic mt-0.5">
              “{MANGLISH_QUOTES.reportingPrompt}” (Did power go in your area?)
            </p>
          </div>

          <button
            onClick={handleReportPoyiClick}
            disabled={isSubmitting}
            className={`w-full py-5 px-6 rounded-2xl font-black text-base sm:text-lg uppercase tracking-wide transition-all duration-200 flex items-center justify-center gap-3 shadow-xl ${
              userReportStatus === 'CURRENT_POYI'
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/40 border-2 border-white/60 ring-2 ring-red-400'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20 hover:scale-[1.02] active:scale-95 border border-red-400/40'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <ZapOff className="w-4 h-4" />
            </div>
            <span>
              {isSubmitting ? 'Updating...' : userReportStatus === 'CURRENT_POYI' ? '🔴 CURRENT POYI (ACTIVE)' : '🔴 CURRENT POYI'}
            </span>
          </button>

          <p className="text-[11px] text-slate-400 mt-3 text-center">
            {userReportStatus === 'CURRENT_POYI'
              ? '✓ Your power outage vote is ACTIVE. Click "CURRENT VANNU" whenever power returns.'
              : 'Click to switch status to Power Cut (requires 3 nearby residents).'}
          </p>
        </div>

        {/* PRIMARY BUTTON 2: CURRENT VANNU (Green Switch) */}
        <div className={`border rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all ${
          userReportStatus === 'CURRENT_VANNU'
            ? 'bg-emerald-950/70 border-emerald-500 shadow-emerald-950/60 ring-2 ring-emerald-500/50'
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>RESTORATION REPORTING SWITCH</span>
              </span>
              {userReportStatus === 'CURRENT_VANNU' && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase">
                  Active (Power Normal)
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              Report Power Restored
            </h3>
            <p className="text-xs text-emerald-400/90 font-medium italic mt-0.5">
              “{MANGLISH_QUOTES.restorePrompt}” (Did power come back?)
            </p>
          </div>

          <button
            onClick={handleReportVannuClick}
            disabled={isSubmitting}
            className={`w-full py-5 px-6 rounded-2xl font-black text-base sm:text-lg uppercase tracking-wide transition-all duration-200 flex items-center justify-center gap-3 shadow-xl ${
              userReportStatus === 'CURRENT_VANNU'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/40 border-2 border-white/60 ring-2 ring-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 hover:scale-[1.02] active:scale-95 border border-emerald-400/40'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span>
              {isSubmitting ? 'Updating...' : userReportStatus === 'CURRENT_VANNU' ? '🟢 CURRENT VANNU (ACTIVE)' : '🟢 CURRENT VANNU'}
            </span>
          </button>

          <p className="text-[11px] text-slate-400 mt-3 text-center">
            {userReportStatus === 'CURRENT_VANNU'
              ? '✓ Your restoration vote is ACTIVE. Click "CURRENT POYI" whenever power goes off.'
              : 'Click to switch status to Power Restored (turns off emergency beacons).'}
          </p>
        </div>
      </div>

      {/* Notification Toast if any */}
      {lastNotice && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center justify-between shadow-lg">
          <span>{lastNotice}</span>
          <button 
            onClick={() => {}} 
            className="text-amber-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Consensus Meter */}
      <ConsensusMeter
        community={currentCommunity}
        activeReportsCount={activeOutageReports.length}
        isVerified={isVerifiedOutage}
      />

      {/* Grid for Feed and Map Snippet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Activity Feed */}
        <ActivityFeed activities={activities} />

        {/* Interactive Map Preview */}
        <div className="space-y-2">
          <KeralaMap
            communities={communities}
            selectedCommunityId={currentCommunity.id}
            onSelectCommunity={onOpenCommunityModal}
            height="260px"
          />
          <p className="text-[10px] text-slate-500 italic text-center">
            {MANGLISH_QUOTES.privacyNotice}
          </p>
        </div>
      </div>

      {/* Safety & Privacy Notice Footer */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>No video, photos, or exact GPS coordinates are ever stored or shared.</span>
        </div>
        <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">
          KERALA CIVIC TECH
        </span>
      </div>

    </div>
  );
};
