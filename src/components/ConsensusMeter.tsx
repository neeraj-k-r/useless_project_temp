import React from 'react';
import { CheckCircle, AlertTriangle, Users, Clock } from 'lucide-react';
import { Community } from '../types';

interface ConsensusMeterProps {
  community: Community;
  activeReportsCount: number;
  isVerified: boolean;
}

export const ConsensusMeter: React.FC<ConsensusMeterProps> = ({
  community,
  activeReportsCount,
  isVerified
}) => {
  const threshold = community.outageThreshold || 3;
  const currentCount = Math.min(activeReportsCount, threshold);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span>OUTAGE CONFIRMATION</span>
        </span>
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{community.timeWindowMinutes || 5} min window</span>
        </span>
      </div>

      {isVerified ? (
        <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-3.5 flex items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-emerald-300">
              ✓ OUTAGE VERIFIED
            </h4>
            <p className="text-xs text-emerald-200/80">
              {activeReportsCount || threshold} residents confirmed the power cut in {community.name}.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Dot Indicators */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {Array.from({ length: threshold }).map((_, index) => {
                const isFilled = index < currentCount;
                return (
                  <div
                    key={index}
                    className={`w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center text-[10px] font-bold ${
                      isFilled
                        ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/30 scale-110'
                        : 'bg-slate-800 text-slate-600 border border-slate-700'
                    }`}
                  >
                    {isFilled ? '●' : '○'}
                  </div>
                );
              })}
            </div>

            <div className="text-right">
              <span className="text-sm font-extrabold text-white">
                {currentCount} / {threshold}
              </span>
              <span className="text-xs text-slate-400 ml-1.5">residents reported</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(currentCount / threshold) * 100}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-400 italic">
            {currentCount === 0
              ? 'No active power cuts reported right now.'
              : currentCount === 1
              ? '1 resident reported. Waiting for neighbors to confirm.'
              : `${threshold - currentCount} more confirmation needed to verify outage & trigger torch.`}
          </p>
        </div>
      )}
    </div>
  );
};
