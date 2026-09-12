import React, { useEffect, useState, useCallback } from 'react';
import { Rss, AlertTriangle } from 'lucide-react';
import {
  enableBackgroundTorch,
  disableBackgroundTorch,
  isBackgroundTorchRunning,
  getBackgroundTorchStatus,
} from '../services/backgroundTorch';
import { isNativePlatform } from '../capacitor/backgroundTorch';

interface BackgroundTorchToggleProps {
  communityId: string;
}

const STORAGE_KEY = 'bg_torch_service';

export const BackgroundTorchToggle: React.FC<BackgroundTorchToggleProps> = ({ communityId }) => {
  const [enabled, setEnabled] = useState(false);
  const [working, setWorking] = useState(true);
  const [status, setStatus] = useState<{ lastAction: string; lastError: string; torchOn: boolean }>({
    lastAction: '',
    lastError: '',
    torchOn: false,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const running = await isBackgroundTorchRunning();
      if (!alive) return;
      setEnabled(running || localStorage.getItem(STORAGE_KEY) === 'on');
      setWorking(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Health check + status feed while enabled.
  useEffect(() => {
    if (!isNativePlatform()) return;
    let alive = true;
    const tick = async () => {
      const st = await getBackgroundTorchStatus();
      if (!alive) return;
      setStatus({ lastAction: st.lastAction, lastError: st.lastError, torchOn: st.torchOn });
      if (!st.running && localStorage.getItem(STORAGE_KEY) === 'on') {
        // Service died (e.g. process killed) — restart it.
        await enableBackgroundTorch(communityId);
      }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [communityId]);

  // Community changes update the service filter live (native start() is idempotent).
  useEffect(() => {
    if (!enabled) return;
    enableBackgroundTorch(communityId);
  }, [communityId, enabled]);

  const toggle = useCallback(async () => {
    setWorking(true);
    if (enabled) {
      await disableBackgroundTorch();
      localStorage.removeItem(STORAGE_KEY);
      setEnabled(false);
    } else {
      const ok = await enableBackgroundTorch(communityId);
      if (ok) {
        localStorage.setItem(STORAGE_KEY, 'on');
        setEnabled(true);
      }
    }
    setWorking(false);
  }, [enabled, communityId]);

  if (!isNativePlatform()) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={working}
        title="Background torch service — keeps listening even when the app is closed or the screen is off"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
          enabled
            ? 'bg-emerald-900/60 border-emerald-500/50 text-emerald-300'
            : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-700/80'
        }`}
      >
        <Rss className={`w-3.5 h-3.5 ${enabled ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
        <span className="hidden sm:inline">BG Torch</span>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      </button>
      {enabled && (status.lastAction || status.lastError) && (
        <span className="max-w-[160px] text-[9px] leading-tight text-slate-400 text-right truncate">
          {status.lastAction && <span className="text-emerald-400/80">{status.lastAction}</span>}
          {status.lastError && (
            <span className="flex items-center gap-1 text-amber-400/90">
              <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> {status.lastError}
            </span>
          )}
        </span>
      )}
    </div>
  );
};