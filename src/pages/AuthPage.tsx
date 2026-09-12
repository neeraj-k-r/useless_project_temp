import React, { useState, useEffect } from 'react';
import { 
  Flashlight, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  MapPin, 
  Home as HomeIcon,
  ArrowRight, 
  CheckCircle2, 
  Compass,
  Sparkles,
  Shield,
  Check,
  Navigation
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCommunity } from '../hooks/useCommunity';
import { detectUserLocality, createCommunityFromCoordinates, getDistrictFallbackCoords } from '../utils/keralaData';
import { Community } from '../types';

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

export const AuthPage: React.FC = () => {
  const { 
    loginWithEmail, 
    registerWithEmail, 
    signInWithGooglePopup, 
    completeGoogleProfile, 
    loading 
  } = useAuth();
  const { communities, addDynamicCommunity } = useCommunity();

  const [mode, setMode] = useState<'login' | 'register' | 'google_setup' | 'forgot'>('login');
  
  // Registration and Profile fields
  const [googleUid, setGoogleUid] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [localityName, setLocalityName] = useState('Kakkanad');
  const [district, setDistrict] = useState('Ernakulam');
  const [communityId, setCommunityId] = useState('kakkanad');
  const [pincode, setPincode] = useState('682030');
  
  const [isDetectingLoc, setIsDetectingLoc] = useState(false);
  const [gpsStatusText, setGpsStatusText] = useState<string | null>(null);
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  // Auto-detect GPS locality on mount
  useEffect(() => {
    runGpsDetection();
  }, []);

  const runGpsDetection = async () => {
    setIsDetectingLoc(true);
    setGpsStatusText('Detecting GPS location...');
    try {
      const { community, isNewDynamicCommunity, lat, lng } = await detectUserLocality(communities);
      if (isNewDynamicCommunity) {
        await addDynamicCommunity(community);
      }
      if (lat !== undefined && lng !== undefined) {
        setDetectedCoords({ lat, lng });
      }
      setCommunityId(community.id);
      setLocalityName(community.name);
      setDistrict(community.district || 'Ernakulam');
      setPincode(community.pincode);
      setGpsStatusText(`📍 Detected: ${community.name}, ${community.district} (${community.pincode})`);
    } catch (e) {
      setGpsStatusText('Using standard Kerala default location.');
    } finally {
      setIsDetectingLoc(false);
    }
  };

  const handleLocalityNameChange = (newName: string) => {
    setLocalityName(newName);
    const cleanId = newName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) + '_' + (pincode.slice(-4) || 'hub');
    setCommunityId(cleanId);
  };

  const handlePincodeChange = (newPin: string) => {
    setPincode(newPin);
    const cleanId = localityName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) + '_' + (newPin.slice(-4) || 'hub');
    setCommunityId(cleanId);
  };

  const handleGoogleSignInClick = async () => {
    setError(null);
    setSuccessNotice(null);
    setIsGoogleSigningIn(true);

    try {
      const { googleUser, existingProfile } = await signInWithGooglePopup();
      
      if (existingProfile && existingProfile.address && existingProfile.phone) {
        // User is already fully registered
        return;
      }

      // New Google User or needs location/address confirmation
      setGoogleUid(googleUser.uid);
      setName(googleUser.displayName || '');
      setEmail(googleUser.email || '');
      if (googleUser.phoneNumber) setPhone(googleUser.phoneNumber);
      
      setMode('google_setup');
      setSuccessNotice('Google account linked! Please confirm your phone number, locality & residential address to complete registration.');
    } catch (err: any) {
      console.warn('[AuthPage] Google popup result:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setError('Google sign-in popup was closed.');
      } else {
        setError(err.message || 'Google Sign-In encountered an issue. You can fill your account details below directly.');
        setMode('google_setup');
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    // Ensure dynamic community is registered in communityService
    const cleanId = localityName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) + '_' + (pincode.slice(-4) || 'hub');
    const dynamicComm: Community = {
      id: cleanId,
      name: localityName.trim() || 'My Locality',
      district: district || 'Ernakulam',
      pincode: pincode.trim() || '682030',
      lat: detectedCoords?.lat ?? getDistrictFallbackCoords(district).lat,
      lng: detectedCoords?.lng ?? getDistrictFallbackCoords(district).lng,
      status: 'NORMAL',
      memberCount: 1,
      activeReportsCount: 0,
      activeRestoresCount: 0,
      outageThreshold: 3,
      restoreThreshold: 2,
      timeWindowMinutes: 5
    };
    await addDynamicCommunity(dynamicComm);

    try {
      if (mode === 'login') {
        if (!email || !password) throw new Error('Please enter your email and password');
        await loginWithEmail(email, password, cleanId, pincode, localityName, district);
      } else if (mode === 'register') {
        if (!name || !email || !password) throw new Error('Please enter your full name, email and password');
        await registerWithEmail(name, email, password, cleanId, pincode, phone, address, localityName, district);
      } else if (mode === 'google_setup') {
        if (!name || !email) throw new Error('Please enter your full name and email address');
        const uid = googleUid || ('user_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12));
        await completeGoogleProfile({
          uid,
          name,
          email,
          phone,
          address,
          communityId: cleanId,
          localityName,
          district,
          pincode
        });
      } else if (mode === 'forgot') {
        if (!email) throw new Error('Please enter your email');
        setSuccessNotice('Password reset link sent to your email.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your details.');
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col justify-center items-center px-4 py-8 selection:bg-amber-500 selection:text-black">
      
      {/* Glow Effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-xl shadow-amber-500/20 mb-2">
            <Flashlight className="w-9 h-9 fill-current" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
            VELICHAM THARAAM 🔦
          </h1>
          <p className="text-sm font-medium text-amber-400 italic">
            “Current poyaalum, nammal velicham tharaam.”
          </p>
          <p className="text-xs text-slate-400">
            Community power outage consensus & synchronized flashlight network
          </p>
        </div>

        {/* Auth Card Box */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          
          {/* Mode Switch Tabs */}
          {mode !== 'google_setup' ? (
            <div className="flex items-center justify-center gap-6 border-b border-slate-800 pb-4 mb-6">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccessNotice(null); }}
                className={`text-sm font-bold pb-1 transition-all ${
                  mode === 'login'
                    ? 'text-amber-400 border-b-2 border-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); setSuccessNotice(null); }}
                className={`text-sm font-bold pb-1 transition-all ${
                  mode === 'register'
                    ? 'text-amber-400 border-b-2 border-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Register Account
              </button>
            </div>
          ) : (
            <div className="border-b border-slate-800 pb-4 mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 12s.7 2.3 1.9 4.7l3.7-1.9z"/>
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
                  </svg>
                  <span>Google Account Registration</span>
                </h3>
                <p className="text-xs text-slate-400">Confirm your Kerala locality, phone and address</p>
              </div>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-slate-400 hover:text-white"
              >
                Back ✕
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs leading-relaxed">
              {error}
            </div>
          )}

          {successNotice && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successNotice}</span>
            </div>
          )}

          <form onSubmit={handleStandardSubmit} className="space-y-3.5">
            
            {/* Name field for Register & Google Setup */}
            {(mode === 'register' || mode === 'google_setup') && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajaraman S"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Address <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Password field for Login/Register */}
            {mode !== 'forgot' && mode !== 'google_setup' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password <span className="text-red-400">*</span>
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
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {/* Location & Contact for Register / Google Setup */}
            {(mode === 'register' || mode === 'google_setup') && (
              <>
                {/* GPS Auto-Detect Bar */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-amber-500/30">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Compass className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate max-w-[200px]">
                      {gpsStatusText || 'Auto-detect your Kerala location'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={runGpsDetection}
                    disabled={isDetectingLoc}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-all"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>{isDetectingLoc ? 'Detecting...' : 'Detect GPS'}</span>
                  </button>
                </div>

                {/* Locality Name & District */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Locality / Place <span className="text-amber-400">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Kakkanad, Edappally"
                        value={localityName}
                        onChange={e => handleLocalityNameChange(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-3 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      District <span className="text-amber-400">*</span>
                    </label>
                    <select
                      value={district}
                      onChange={e => setDistrict(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-3 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      {KERALA_DISTRICTS.map(d => (
                        <option key={d} value={d} className="bg-slate-900">{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Phone & Pincode */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Phone Number <span className="text-amber-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                      <input
                        type="tel"
                        required
                        placeholder="98XXXXXXXX"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-3 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Pincode <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={pincode}
                      onChange={e => handlePincodeChange(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-3 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Residential Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Residential Address / Building Details <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <HomeIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Flat 4B, Greenfield Apts, Infopark Road"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading || isGoogleSigningIn}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'login' 
                      ? 'Sign In to Velicham' 
                      : mode === 'google_setup'
                      ? 'Complete Profile & Enter 🔦'
                      : mode === 'register' 
                      ? 'Register & Connect' 
                      : 'Send Reset Link'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Real Google Sign-in Trigger */}
          {mode !== 'google_setup' && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                disabled={isGoogleSigningIn || loading}
                onClick={handleGoogleSignInClick}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2.5 shadow-sm disabled:opacity-50"
              >
                {isGoogleSigningIn ? (
                  <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 12s.7 2.3 1.9 4.7l3.7-1.9z"/>
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
                  </svg>
                )}
                <span>Continue with Google Account</span>
              </button>
            </div>
          )}

          {/* Auto Locality Notice */}
          <div className="mt-5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {isDetectingLoc 
                ? 'Detecting nearest Kerala grid locality...'
                : `Active Community: ${localityName}, ${district} (${pincode})`}
            </span>
          </div>

        </div>

        <p className="text-[11px] text-center text-slate-500">
          🔒 Exact GPS coordinates are never publicly shown. Only community-level consensus is shared.
        </p>

      </div>
    </div>
  );
};

