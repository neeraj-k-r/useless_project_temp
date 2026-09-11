import React, { useState } from 'react';
import { Flashlight, ShieldCheck, VideoOff, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useTorch } from '../hooks/useTorch';

interface TorchPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGranted?: () => void;
}

export const TorchPermissionModal: React.FC<TorchPermissionModalProps> = ({
  isOpen,
  onClose,
  onGranted
}) => {
  const { requestTorch, isSupported, errorMessage } = useTorch();
  const [loading, setLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<'success' | 'unsupported' | 'denied' | null>(null);

  if (!isOpen) return null;

  const handleEnable = async () => {
    setLoading(true);
    setStatusResult(null);
    try {
      const supported = await requestTorch();
      if (supported) {
        setStatusResult('success');
        setTimeout(() => {
          onGranted?.();
          onClose();
        }, 1200);
      } else {
        setStatusResult('unsupported');
      }
    } catch (e) {
      setStatusResult('denied');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-slate-100 overflow-hidden">
        
        {/* Glow backdrop */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Flashlight className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-display text-white tracking-tight">
              🔦 FLASHLIGHT ACCESS
            </h3>
            <p className="text-xs text-amber-400 font-medium">
              Community Physical Signaling
            </p>
          </div>
        </div>

        {/* Informative Body */}
        <div className="space-y-3.5 text-sm text-slate-300 leading-relaxed mb-6">
          <p className="font-medium text-slate-100">
            Velicham Tharaam uses your phone&apos;s camera hardware <strong>only to control the built-in flashlight</strong>.
          </p>

          <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-xs">
            <div className="flex items-start gap-2.5 text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>We <strong>do not</strong> take photos or record video.</span>
            </div>
            <div className="flex items-start gap-2.5 text-emerald-400">
              <VideoOff className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Camera preview is permanently disabled and never stored.</span>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Camera access is required by your browser to enable the physical torch hardware during verified outages.
          </p>
        </div>

        {/* Status Alerts */}
        {statusResult === 'success' && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Flashlight hardware verified & ready for signals!</span>
          </div>
        )}

        {statusResult === 'unsupported' && (
          <div className="mb-4 p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">⚠️ FLASHLIGHT NOT SUPPORTED</p>
              <p className="text-[11px] mt-0.5 text-amber-200/80">
                Your browser or device does not support direct web flashlight control. Visual screen flashlight fallback will be used instead.
              </p>
            </div>
          </div>
        )}

        {statusResult === 'denied' && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage || 'Camera permission was not granted.'}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleEnable}
            disabled={loading || statusResult === 'success'}
            className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Flashlight className="w-4 h-4" />
            )}
            <span>Enable Flashlight</span>
          </button>
          
          <button
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
          >
            Not Now
          </button>
        </div>

        <p className="text-[10px] text-center text-slate-500 mt-4">
          Optimized for Android Chrome • No video or photo data is ever captured.
        </p>
      </div>
    </div>
  );
};
