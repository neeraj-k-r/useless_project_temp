import React from 'react';
import { Flashlight, XCircle } from 'lucide-react';
import { useTorch } from '../hooks/useTorch';
import { useCommunity } from '../hooks/useCommunity';
import { useAuth } from '../hooks/useAuth';

interface VisualTorchOverlayProps {
  isControllerTab?: boolean;
}

export const VisualTorchOverlay: React.FC<VisualTorchOverlayProps> = ({ isControllerTab }) => {
  const { isOn, isBlinking, turnOff } = useTorch();
  const { currentCommunity } = useCommunity();
  const isController = isControllerTab || 
    (typeof window !== 'undefined' && 
      ((window as any).__CURRENT_TAB__ === 'controller' || 
       (window as any).__IS_CONTROLLER_PAGE__ === true || 
       window.location.pathname.includes('/controller') || 
       window.location.hash.includes('controller')));

  if (isController || (!isOn && !isBlinking)) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 pointer-events-auto transition-all duration-150 ${
        isBlinking 
          ? 'bg-amber-300 text-slate-950 animate-strobe' 
          : 'bg-[#fffde7] text-slate-950 shadow-[inset_0_0_120px_rgba(255,235,59,0.9)]'
      }`}
    >
      {/* Top Banner */}
      <div className="w-full max-w-md bg-black/90 text-white rounded-2xl p-4 flex items-center justify-between shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold animate-pulse">
            <Flashlight className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm tracking-tight text-white font-display">
              {isBlinking ? '⚡ OUTAGE SIGNAL: 3 BLINKS' : '🔦 COMMUNITY FLASHLIGHT ACTIVE'}
            </h4>
            <p className="text-xs text-amber-400 font-medium">
              Physical torch & high-candela screen beacon
            </p>
          </div>
        </div>
      </div>

      {/* Center Giant Torch Glow */}
      <div className="flex flex-col items-center justify-center text-center my-auto">
        <div className="relative">
          <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-full bg-amber-400/50 blur-3xl animate-beacon absolute inset-0 -m-4" />
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-amber-300 relative z-10 animate-pulse">
            <Flashlight className="w-16 h-16 sm:w-20 sm:h-20 text-slate-950 fill-amber-400 stroke-slate-950 stroke-[1.5]" />
          </div>
        </div>

        <div className="mt-8 bg-black/85 backdrop-blur-md px-6 py-3.5 rounded-2xl max-w-xs shadow-xl border border-white/20">
          <p className="font-black text-base text-amber-400 tracking-wide font-display">
            VELICHAM THARAAM
          </p>
          <p className="text-xs text-slate-200 mt-0.5">
            Illuminating {currentCommunity.name} during power cut
          </p>
        </div>
      </div>

      {/* Bottom Dismiss Button */}
      <div className="w-full max-w-xs pb-4">
        <button
          onClick={() => turnOff()}
          className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-black text-amber-300 border-2 border-amber-400 font-extrabold text-base shadow-2xl flex items-center justify-center gap-2.5 transition-transform active:scale-95"
        >
          <XCircle className="w-5 h-5 text-amber-400" />
          <span>Turn Off My Flashlight</span>
        </button>
      </div>
    </div>
  );
};
