import React, { useState } from 'react';
import { Mail, Lock, User, Phone, MapPin, X, ArrowRight, Shield, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCommunity } from '../hooks/useCommunity';
import { detectUserLocality } from '../utils/keralaData';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KERALA_DISTRICTS = [
  'Ernakulam',
  'Thiruvananthapuram',
  'Kozhikode',
  'Thrissur',
  'Palakkad',
  'Malappuram',
  'Kannur',
  'Kottayam',
  'Kollam',
  'Alappuzha',
  'Idukki',
  'Pathanamthitta',
  'Kasaragod',
  'Wayanad'
];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, loginWithEmail, registerWithEmail, loginWithGoogle, logout } = useAuth();
  const { communities, addDynamicCommunity } = useCommunity();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [localityName, setLocalityName] = useState('Kakkanad');
  const [district, setDistrict] = useState('Ernakulam');
  const [communityId, setCommunityId] = useState('kakkanad');
  const [pincode, setPincode] = useState('682030');
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const [address, setAddress] = useState('');

  if (!isOpen) return null;

  const handleLocalityChange = (newName: string) => {
    setLocalityName(newName);
    const clean = newName.trim();
    const cleanId = clean.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) + '_' + (pincode.slice(-4) || 'hub');
    setCommunityId(cleanId);
  };

  const handlePincodeChange = (newPin: string) => {
    setPincode(newPin);
    const cleanId = localityName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) + '_' + (newPin.slice(-4) || 'hub');
    setCommunityId(cleanId);
  };

  const handleDetectGPSInModal = async () => {
    setIsDetectingGps(true);
    try {
      const { community, isNewDynamicCommunity } = await detectUserLocality(communities);
      if (isNewDynamicCommunity) {
        await addDynamicCommunity(community);
      }
      setLocalityName(community.name);
      setDistrict(community.district || 'Ernakulam');
      setPincode(community.pincode);
      setCommunityId(community.id);
      setSuccessNotice(`📍 GPS Location: ${community.name}, ${community.district} (${community.pincode})`);
    } catch (e) {
      setError('Could not detect GPS location. You can enter manually.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setLoading(true);

    const cleanId = localityName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) + '_' + (pincode.slice(-4) || 'hub');

    try {
      if (mode === 'login') {
        if (!email || !password) throw new Error('Please fill in all fields');
        await loginWithEmail(email, password, cleanId, pincode, localityName, district);
        onClose();
      } else if (mode === 'register') {
        if (!name || !email || !password) throw new Error('Please fill in required fields');
        await registerWithEmail(name, email, password, cleanId, pincode, phone, address, localityName, district);
        onClose();
      } else if (mode === 'forgot') {
        if (!email) throw new Error('Please enter your email address');
        setSuccessNotice('Password reset link sent to your email.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-slate-100">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {user ? (
          /* Profile Summary if already logged in */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-lg">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{user.name}</h3>
                <p className="text-xs text-slate-400">{user.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Role: {user.role}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Locality / Community:</span>
                <span className="font-semibold text-white capitalize">{user.communityId}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Pincode:</span>
                <span className="font-mono text-white">{user.pincode}</span>
              </div>
              {user.phone && (
                <div className="flex justify-between text-slate-400">
                  <span>Phone:</span>
                  <span className="font-mono text-white">{user.phone}</span>
                </div>
              )}
              {user.address && (
                <div className="flex justify-between text-slate-400">
                  <span>Address:</span>
                  <span className="text-white text-right max-w-[180px] truncate">{user.address}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* Login / Register Forms */
          <div>
            <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode('login')}
                  className={`text-sm font-bold pb-1 transition-all ${
                    mode === 'login'
                      ? 'text-amber-400 border-b-2 border-amber-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setMode('register')}
                  className={`text-sm font-bold pb-1 transition-all ml-4 ${
                    mode === 'register'
                      ? 'text-amber-400 border-b-2 border-amber-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
                {error}
              </div>
            )}

            {successNotice && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{successNotice}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Nair"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-[11px] text-amber-400/80 hover:text-amber-300"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <>
                  {/* GPS Auto-Detect Button */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-amber-500/30 mb-2">
                    <span className="text-[11px] text-slate-300 truncate">
                      📍 {localityName}, {district} ({pincode})
                    </span>
                    <button
                      type="button"
                      onClick={handleDetectGPSInModal}
                      disabled={isDetectingGps}
                      className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] shrink-0"
                    >
                      {isDetectingGps ? 'Detecting...' : 'Auto-Detect GPS'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Locality / Place
                      </label>
                      <input
                        type="text"
                        required
                        value={localityName}
                        onChange={e => handleLocalityChange(e.target.value)}
                        placeholder="e.g. Kakkanad"
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        District
                      </label>
                      <select
                        value={district}
                        onChange={e => setDistrict(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        {KERALA_DISTRICTS.map(d => (
                          <option key={d} value={d} className="bg-slate-900">{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Pincode
                      </label>
                      <input
                        type="text"
                        value={pincode}
                        onChange={e => handlePincodeChange(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        placeholder="98XXXXXXXX"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Residential Address / Building Details
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Flat 4B, Infopark Road"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 mt-4"
              >
                <span>{mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Google Sign in */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <button
                onClick={async () => {
                  await loginWithGoogle();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                  <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 12s.7 2.3 1.9 4.7l3.7-1.9z"/>
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
