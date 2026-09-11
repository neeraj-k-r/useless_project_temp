import React from 'react';
import { ActivityItem } from '../types';
import { Radio, AlertCircle, CheckCircle2, Flashlight, ZapOff, Sparkles } from 'lucide-react';

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'REPORT_POYI':
        return <ZapOff className="w-4 h-4 text-red-400" />;
      case 'REPORT_VANNU':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'OUTAGE_VERIFIED':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'TORCH_ACTIVATED':
        return <Flashlight className="w-4 h-4 text-amber-300" />;
      case 'POWER_RESTORED':
        return <Sparkles className="w-4 h-4 text-emerald-300" />;
      default:
        return <Radio className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>LIVE COMMUNITY FEED</span>
        </h3>
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
      </div>

      <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 select-none">
        {activities.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No community activity yet.</p>
        ) : (
          activities.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60 hover:border-slate-700/80 transition-colors"
            >
              <div className="p-2 rounded-lg bg-slate-900 shrink-0 mt-0.5">
                {getIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {item.userName}
                  </p>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {formatTime(item.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                  {item.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
