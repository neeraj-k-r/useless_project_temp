import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db, isLiveFirebaseConfigured } from '../firebase/config';
import { UserProfile, UserRole } from '../types';
import { detectUserLocality } from '../utils/keralaData';
import { communityService } from './communityService';

const USER_STORAGE_KEY = 'vt_active_user_profile';

class AuthService {
  private currentUserProfile: UserProfile | null = null;
  private listeners: Set<(user: UserProfile | null) => void> = new Set();

  constructor() {
    const cached = localStorage.getItem(USER_STORAGE_KEY);
    if (cached) {
      try {
        this.currentUserProfile = JSON.parse(cached);
      } catch (e) {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }

    if (isLiveFirebaseConfigured) {
      onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const profile = await this.fetchUserProfile(fbUser.uid);
          if (profile) {
            this.setCurrentUser(profile);
          }
        }
      });
    }
  }

  private allUsersListeners: Set<(users: UserProfile[]) => void> = new Set();
  private allRegisteredUsers: UserProfile[] = [];

  public subscribe(fn: (user: UserProfile | null) => void): () => void {
    this.listeners.add(fn);
    fn(this.currentUserProfile);
    return () => this.listeners.delete(fn);
  }

  public subscribeAllUsers(fn: (users: UserProfile[]) => void): () => void {
    this.allUsersListeners.add(fn);
    fn(this.allRegisteredUsers);
    return () => this.allUsersListeners.delete(fn);
  }

  private setCurrentUser(profile: UserProfile | null) {
    this.currentUserProfile = profile;
    if (profile) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
    this.listeners.forEach(fn => fn(profile));
  }

  public getCurrentUser(): UserProfile | null {
    return this.currentUserProfile;
  }

  public async fetchUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      if (isLiveFirebaseConfigured) {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          return userDoc.data() as UserProfile;
        }
      }
    } catch (e) {
      console.warn('[AuthService] fetchUserProfile error:', e);
    }
    return null;
  }

  public async fetchAllRegisteredUsers(): Promise<UserProfile[]> {
    try {
      if (isLiveFirebaseConfigured) {
        const querySnap = await getDocs(collection(db, 'users'));
        const users: UserProfile[] = [];
        querySnap.forEach(d => {
          users.push(d.data() as UserProfile);
        });
        this.allRegisteredUsers = users;
        this.allUsersListeners.forEach(fn => fn(users));
        communityService.syncFromRegisteredUsers(users, this.currentUserProfile);
        return users;
      }
    } catch (e) {
      console.warn('[AuthService] fetchAllRegisteredUsers error:', e);
    }
    if (this.currentUserProfile) {
      communityService.syncFromRegisteredUsers([this.currentUserProfile], this.currentUserProfile);
      return [this.currentUserProfile];
    }
    return [];
  }

  public async saveUserProfile(profile: UserProfile): Promise<void> {
    this.setCurrentUser(profile);
    
    // Add to all registered users list
    const idx = this.allRegisteredUsers.findIndex(u => u.uid === profile.uid);
    if (idx >= 0) {
      this.allRegisteredUsers[idx] = profile;
    } else {
      this.allRegisteredUsers.push(profile);
    }
    this.allUsersListeners.forEach(fn => fn(this.allRegisteredUsers));
    communityService.syncFromRegisteredUsers(this.allRegisteredUsers, profile);

    try {
      if (isLiveFirebaseConfigured) {
        await setDoc(doc(db, 'users', profile.uid), profile, { merge: true });
      }
    } catch (e) {
      console.warn('[AuthService] Firestore save notice (local state preserved):', e);
    }
  }

  public async loginWithEmail(
    email: string, 
    pass: string, 
    detectedCommunityId?: string, 
    detectedPincode?: string,
    localityName?: string,
    district?: string
  ): Promise<UserProfile> {
    let localityId = detectedCommunityId || 'kakkanad';
    let pin = detectedPincode || '682030';
    let locName = localityName || 'Kakkanad';
    let dist = district || 'Ernakulam';

    try {
      const loc = await detectUserLocality();
      localityId = detectedCommunityId || loc.community.id;
      pin = detectedPincode || loc.community.pincode;
      locName = localityName || loc.community.name;
      dist = district || loc.community.district;
    } catch (e) {}

    let uid = 'user_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);

    if (isLiveFirebaseConfigured) {
      try {
        const res = await signInWithEmailAndPassword(auth, email, pass);
        uid = res.user.uid;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          // Attempt auto registration
          try {
            const newRes = await createUserWithEmailAndPassword(auth, email, pass);
            uid = newRes.user.uid;
          } catch (createErr: any) {
            console.warn('[AuthService] Email create notice:', createErr);
          }
        }
      }
    }

    const existingProfile = await this.fetchUserProfile(uid);
    if (existingProfile) {
      this.setCurrentUser(existingProfile);
      return existingProfile;
    }

    const role: UserRole = email.toLowerCase().includes('controller') || email.toLowerCase().includes('admin') ? 'CONTROLLER' : 'USER';
    const profile: UserProfile = {
      uid,
      name: email.split('@')[0],
      email,
      communityId: localityId,
      localityName: locName,
      district: dist,
      pincode: pin,
      role,
      createdAt: Date.now(),
      lastSeen: Date.now()
    };

    await this.saveUserProfile(profile);
    return profile;
  }

  public async registerWithEmail(
    name: string,
    email: string,
    pass: string,
    communityId: string,
    pincode: string,
    phone?: string,
    address?: string,
    localityName?: string,
    district?: string
  ): Promise<UserProfile> {
    let uid = 'user_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);

    if (isLiveFirebaseConfigured) {
      try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        uid = res.user.uid;
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          try {
            const loginRes = await signInWithEmailAndPassword(auth, email, pass);
            uid = loginRes.user.uid;
          } catch (e) {}
        }
      }
    }

    const role: UserRole = email.toLowerCase().includes('controller') ? 'CONTROLLER' : 'USER';
    const profile: UserProfile = {
      uid,
      name: name || email.split('@')[0],
      email,
      phone,
      address,
      communityId: communityId || 'kakkanad',
      localityName: localityName || communityId || 'Kakkanad',
      district: district || 'Ernakulam',
      pincode: pincode || '682030',
      role,
      createdAt: Date.now(),
      lastSeen: Date.now()
    };

    await this.saveUserProfile(profile);
    return profile;
  }

  /**
   * Triggers the real Google Sign-In popup with Firebase Auth.
   * Returns the Firebase Google user and any existing profile.
   */
  public async signInWithGooglePopup(): Promise<{ googleUser: FirebaseUser; existingProfile: UserProfile | null }> {
    if (!isLiveFirebaseConfigured) {
      throw new Error('Firebase is not configured.');
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });

    const res = await signInWithPopup(auth, provider);
    if (!res || !res.user) {
      throw new Error('Google Sign-In failed to return user data.');
    }

    const existingProfile = await this.fetchUserProfile(res.user.uid);
    return { googleUser: res.user, existingProfile };
  }

  /**
   * Saves the complete profile from Google sign-in (Name, Phone, Address, Locality, Pincode).
   */
  public async completeGoogleProfile(details: {
    uid: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    communityId: string;
    localityName?: string;
    district?: string;
    pincode: string;
  }): Promise<UserProfile> {
    const role: UserRole = (details.email || '').toLowerCase().includes('controller') ? 'CONTROLLER' : 'USER';
    const profile: UserProfile = {
      uid: details.uid,
      name: details.name || details.email.split('@')[0] || 'Community Member',
      email: details.email,
      phone: details.phone,
      address: details.address,
      communityId: details.communityId || 'kakkanad',
      localityName: details.localityName || details.communityId || 'Kakkanad',
      district: details.district || 'Ernakulam',
      pincode: details.pincode || '682030',
      role,
      createdAt: Date.now(),
      lastSeen: Date.now()
    };

    await this.saveUserProfile(profile);
    return profile;
  }

  /**
   * Unified Google login flow
   */
  public async loginWithGoogle(details?: {
    uid?: string;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    communityId?: string;
    localityName?: string;
    district?: string;
    pincode?: string;
  }): Promise<UserProfile> {
    let commId = details?.communityId || 'kakkanad';
    let pin = details?.pincode || '682030';
    let locName = details?.localityName || 'Kakkanad';
    let dist = details?.district || 'Ernakulam';
    try {
      const loc = await detectUserLocality();
      commId = details?.communityId || loc.community.id;
      pin = details?.pincode || loc.community.pincode;
      locName = details?.localityName || loc.community.name;
      dist = details?.district || loc.community.district;
    } catch (e) {}

    // If details are already provided (manual registration / completed setup form)
    if (details?.name && details?.email) {
      const uid = details.uid || ('user_' + btoa(details.email).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12));
      return this.completeGoogleProfile({
        uid,
        name: details.name,
        email: details.email,
        phone: details.phone,
        address: details.address,
        communityId: commId,
        localityName: locName,
        district: dist,
        pincode: pin
      });
    }

    // Otherwise launch the Google Popup
    const { googleUser, existingProfile } = await this.signInWithGooglePopup();
    
    if (existingProfile) {
      this.setCurrentUser(existingProfile);
      return existingProfile;
    }

    // New Google user: return profile with real Google name & email
    const newProfile: UserProfile = {
      uid: googleUser.uid,
      name: googleUser.displayName || googleUser.email?.split('@')[0] || 'Community Member',
      email: googleUser.email || '',
      phone: googleUser.phoneNumber || details?.phone,
      address: details?.address,
      communityId: commId,
      localityName: locName,
      district: dist,
      pincode: pin,
      role: (googleUser.email || '').toLowerCase().includes('controller') ? 'CONTROLLER' : 'USER',
      createdAt: Date.now(),
      lastSeen: Date.now()
    };

    await this.saveUserProfile(newProfile);
    return newProfile;
  }

  /**
   * Controller authentication with email and password
   */
  public async verifyAndLoginController(email: string, pass: string): Promise<UserProfile> {
    const isControllerEmail = email.toLowerCase().includes('controller') || 
                              email.toLowerCase().includes('kseb') || 
                              email.toLowerCase().includes('admin');
    
    if (!isControllerEmail && pass !== 'kseb123' && pass !== 'controller123') {
      throw new Error('Invalid Controller credentials. Controller email must contain "controller", "kseb", or use authorized password.');
    }

    if (!pass || pass.length < 4) {
      throw new Error('Please enter the Controller authorization password.');
    }

    let uid = 'ctrl_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);

    if (isLiveFirebaseConfigured) {
      try {
        const res = await signInWithEmailAndPassword(auth, email, pass);
        uid = res.user.uid;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          try {
            const newRes = await createUserWithEmailAndPassword(auth, email, pass);
            uid = newRes.user.uid;
          } catch (e) {}
        }
      }
    }

    const profile: UserProfile = {
      uid,
      name: email.includes('@') ? `${email.split('@')[0].toUpperCase()} (KSEB Controller)` : 'KSEB Controller',
      email,
      communityId: 'kakkanad',
      pincode: '682030',
      role: 'CONTROLLER',
      createdAt: Date.now(),
      lastSeen: Date.now()
    };

    await this.saveUserProfile(profile);
    return profile;
  }

  public async resetPassword(email: string): Promise<void> {
    if (isLiveFirebaseConfigured) {
      await sendPasswordResetEmail(auth, email);
    }
  }

  public async updateCommunity(communityId: string, pincode: string, localityName?: string, district?: string): Promise<void> {
    if (!this.currentUserProfile) return;
    const updated = {
      ...this.currentUserProfile,
      communityId,
      pincode,
      localityName: localityName || this.currentUserProfile.localityName,
      district: district || this.currentUserProfile.district,
      lastSeen: Date.now()
    };
    await this.saveUserProfile(updated);
  }

  public async setRole(role: UserRole): Promise<void> {
    if (!this.currentUserProfile) return;
    const updated = { ...this.currentUserProfile, role };
    await this.saveUserProfile(updated);
  }

  public async signOut(): Promise<void> {
    if (isLiveFirebaseConfigured) {
      await fbSignOut(auth).catch(() => {});
    }
    this.setCurrentUser(null);
  }
}

export const authService = new AuthService();

