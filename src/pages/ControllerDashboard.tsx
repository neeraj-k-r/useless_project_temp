import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Flashlight, 
  RotateCcw, 
  Users, 
  Lock, 
  Mail, 
  ArrowRight, 
  Zap, 
  ZapOff, 
  MapPin, 
  Phone, 
  Search, 
  RefreshCw,
  LogOut,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCommunity } from '../hooks/useCommunity';
import { useRealtimeOutage } from '../hooks/useRealtimeOutage';
import { outageService } from '../services/outageService';
import { authService } from '../services/authService';
import { UserProfile } from '../types';
import { KeralaMap } from '../components/KeralaMap';

export const ControllerDashboard: React.FC = () => {
  const { user, isController, loginAsController, switchToUserRole } = useAuth();
  const { communities, resetAllToNormal } = useCommunity();
  const [selectedCommId, setSelectedCommId] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Registered users state
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Controller login state
  const [ctrlEmail, setCtrlEmail] = useState('');
  const [ctrlPassword, setCtrlPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Subscribe to all registered users in realtime
  useEffect(() => {
    const unsub = authService.subscribeAllUsers((users) => {
      setRegisteredUsers(users);
    });

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const users = await authService.fetchAllRegisteredUsers();
        setRegisteredUsers(users);
      } catch (e) {
        console.warn('Failed to load registered users:', e);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    loadUsers();

    return () => unsub();
  }, []);

  // Update default selected community when communities list changes
  useEffect(() => {
    if (communities.length > 0 && (!selectedCommId || !communities.find(c => c.id === selectedCommId))) {
      setSelectedCommId(communities[0].id);
    }
  }, [communities, selectedCommId]);

  const { reports } = useRealtimeOutage(selectedCommId || undefined);

  const showFeedback = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // 1. Statewide Flashlight Controls
  const handleTriggerAllFlashlights = async () => {
    await outageService.controllerTriggerAllFlashlights();
    showFeedback('🚨 Broadcasted 3-Blink & ON signal to ALL users statewide');
  };

  const handleDeactivateAllFlashlights = async () => {
    await outageService.controllerDeactivateAllFlashlights();
    showFeedback('🛑 Turned OFF flashlights for ALL users statewide');
  };

  // 2. Location-wise Controls
  const handleTriggerTorch = async (targetId: string = selectedCommId) => {
    if (!targetId) return;
    await outageService.controllerTriggerTorch(targetId);
    const commName = communities.find(c => c.id === targetId)?.name || targetId;
    showFeedback(`🔦 Triggered flashlight for: ${commName}`);
  };

  const handleDeactivateTorch = async (targetId: string = selectedCommId) => {
    if (!targetId) return;
    const now = Date.now();
    await outageService.handleIncomingTorchEvent({
      id: 'torch_off_ctrl_' + now,
      communityId: targetId,
      action: 'TORCH_OFF',
      pattern: '3_BLINKS',
      createdAt: now,
      createdBy: 'CONTROLLER'
    }, true);
    const commName = communities.find(c => c.id === targetId)?.name || targetId;
    showFeedback(`🛑 Turned OFF flashlight for: ${commName}`);
  };

  const handleRestorePower = async (targetId: string = selectedCommId) => {
    if (!targetId) return;
    await outageService.restorePower(targetId, 'CONTROLLER');
    const commName = communities.find(c => c.id === targetId)?.name || targetId;
    showFeedback(`🟢 Power Restored (Current Vannu) for: ${commName}`);
  };

  const handleResetEverything = () => {
    resetAllToNormal();
    showFeedback('Reset all locations to NORMAL power');
  };

  const handleRefreshUsers = async () => {
    setIsLoadingUsers(true);
    const users = await authService.fetchAllRegisteredUsers();
    setRegisteredUsers(users);
    setIsLoadingUsers(false);
    showFeedback(`Refreshed users (${users.length} registered)`);
  };

  const handleControllerLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoggingIn(true);

    try {
      if (!ctrlEmail || !ctrlPassword) {
        throw new Error('Please enter Controller credentials.');
      }
      await loginAsController(ctrlEmail, ctrlPassword);
    } catch (err: any) {
      setAuthError(err.message || 'Controller authentication failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const filteredUsers = registeredUsers.filter(u => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.toLowerCase().includes(q)) ||
      (u.address && u.address.toLowerCase().includes(q)) ||
      (u.localityName && u.localityName.toLowerCase().includes(q)) ||
      (u.district && u.district.toLowerCase().includes(q)) ||
      (u.pincode && u.pincode.toLowerCase().includes(q))
    );
  });

  // Controller Login Gate
  if (!isController) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-white font-display">
              Controller Portal
            </h2>
            <p className="text-xs text-slate-400">
              Sign in with Controller credentials
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
              {authError}
            </div>
          )}

          <form onSubmit={handleControllerLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Controller Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="controller@kseb.gov.in"
                  value={ctrlEmail}
                  onChange={e => setCtrlEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-3 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={ctrlPassword}
                  onChange={e => setCtrlPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-3 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isLoggingIn ? 'Verifying...' : 'Access Controller Dashboard'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => {
                setCtrlEmail('controller@kseb.gov.in');
                setCtrlPassword('kseb123');
              }}
              className="text-[11px] text-amber-400/80 hover:text-amber-300"
            >
              Fill Demo Credentials
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white font-display">
                VELICHAM THARAAM CONTROLLER
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {user?.email || 'controller@kseb.gov.in'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetEverything}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Grid</span>
          </button>
          <button
            onClick={switchToUserRole}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Controller</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {actionNotice && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center justify-between">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-amber-400 hover:text-white">✕</button>
        </div>
      )}

      {/* SECTION 1: STATEWIDE FLASHLIGHT CONTROL (ALL USERS) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>🚨 STATEWIDE FLASHLIGHT CONTROL (ALL USERS)</span>
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
            ENTIRE STATE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleTriggerAllFlashlights}
            className="py-4 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <Flashlight className="w-5 h-5 fill-current" />
            <span>TURN ON ALL USERS' FLASHLIGHTS</span>
          </button>

          <button
            onClick={handleDeactivateAllFlashlights}
            className="py-4 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 shadow flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <span>🛑 TURN OFF ALL FLASHLIGHTS</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: LOCATION-WISE FLASHLIGHT & POWER CONTROL */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>📍 LOCATION-WISE CONTROL</span>
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Target Locality:</span>
            <select
              value={selectedCommId}
              onChange={e => setSelectedCommId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-semibold"
            >
              {communities.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900">
                  {c.name} ({c.district}) - {c.status === 'VERIFIED_OUTAGE' ? '🔴 OUTAGE' : '🟢 NORMAL'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleTriggerTorch(selectedCommId)}
            className="py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <Flashlight className="w-4 h-4 fill-current" />
            <span>TURN ON LIGHT</span>
          </button>

          <button
            onClick={() => handleDeactivateTorch(selectedCommId)}
            className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 shadow flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <span>🛑 TURN OFF LIGHT</span>
          </button>

          <button
            onClick={() => handleRestorePower(selectedCommId)}
            className="py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>🟢 CURRENT VANNU (RESTORE)</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: ACTIVE CURRENT & REGISTERED LOCATIONS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            ⚡ REGISTERED LOCATIONS & ACTIVE CURRENT STATUS
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {communities.length} Registered Hubs
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {communities.map(comm => {
            const isOutage = comm.status === 'VERIFIED_OUTAGE';
            const isRep = comm.status === 'REPORTING';

            return (
              <div 
                key={comm.id} 
                className={`p-4 rounded-xl border transition-all ${
                  isOutage 
                    ? 'bg-red-950/40 border-red-500/60 shadow-lg shadow-red-950/30' 
                    : isRep
                    ? 'bg-amber-950/30 border-amber-500/40'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>{comm.name}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {comm.district} • PIN: {comm.pincode}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isOutage 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : isRep 
                      ? 'bg-amber-500 text-slate-950' 
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {isOutage ? '🔴 CURRENT POYI' : isRep ? '🟡 REPORTING' : '🟢 POWER ON'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80 mb-3">
                  <span>Outage Reports: <strong className="text-white">{comm.activeReportsCount || 0}</strong></span>
                  <span>Citizens: <strong className="text-white">{comm.memberCount || 1}</strong></span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTriggerTorch(comm.id)}
                    className="py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-[11px] border border-amber-500/30 transition-colors text-center"
                  >
                    Flashlight
                  </button>
                  <button
                    onClick={() => handleRestorePower(comm.id)}
                    className="py-1.5 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-bold text-[11px] border border-emerald-500/30 transition-colors text-center"
                  >
                    Restore
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: KERALA MAP */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            🗺️ KERALA POWER GRID MAP
          </h2>
          <span className="text-[11px] text-slate-400">Live Telemetry</span>
        </div>
        <KeralaMap
          communities={communities}
          selectedCommunityId={selectedCommId}
          onSelectCommunity={(cId) => setSelectedCommId(cId)}
          height="320px"
        />
      </div>

      {/* SECTION 5: REGISTERED CITIZENS DIRECTORY */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              👥 REGISTERED CITIZENS DIRECTORY
            </h2>
            <p className="text-xs text-slate-400">
              {registeredUsers.length} total registered users
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search name, place, PIN..."
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
            <button
              onClick={handleRefreshUsers}
              disabled={isLoadingUsers}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Citizen Name</th>
                <th className="p-3">Registered Locality</th>
                <th className="p-3">District & PIN</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/30">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    No registered citizens found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, i) => (
                  <tr key={u.uid || i} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-semibold text-white">
                      <div>{u.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{u.email}</div>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-amber-300">
                        {u.localityName || u.communityId}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400">
                      {u.district || 'Ernakulam'} • {u.pincode}
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      {u.phone || '—'}
                    </td>
                    <td className="p-3 max-w-[200px] truncate text-slate-400">
                      {u.address || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
