import { doc, getDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { db, isLiveFirebaseConfigured } from '../firebase/config';
import { Community, OutageStatus, UserProfile } from '../types';
import { getDistrictFallbackCoords } from '../utils/keralaData';

const COMMUNITIES_STORAGE_KEY = 'vt_communities_data_v2';

class CommunityService {
  private communities: Map<string, Community> = new Map();
  private listeners: Set<(communities: Community[]) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    // Clear old legacy dummy communities from localStorage
    try {
      localStorage.removeItem('vt_communities_data');
    } catch (e) {}

    // Load persisted local data if any
    const local = localStorage.getItem(COMMUNITIES_STORAGE_KEY);
    if (local) {
      try {
        const parsed: Community[] = JSON.parse(local);
        parsed.forEach(c => this.communities.set(c.id, c));
      } catch (e) {}
    }

    // If still empty, check if active user is logged in
    const activeUserRaw = localStorage.getItem('vt_active_user_profile');
    if (this.communities.size === 0 && activeUserRaw) {
      try {
        const user: UserProfile = JSON.parse(activeUserRaw);
        if (user.communityId) {
          const initHub: Community = {
            id: user.communityId,
            name: user.localityName || 'My Locality',
            district: user.district || 'Kerala',
            pincode: user.pincode || '682030',
            lat: 10.0159,
            lng: 76.3419,
            status: 'NORMAL',
            memberCount: 1,
            activeReportsCount: 0,
            activeRestoresCount: 0,
            outageThreshold: 3,
            restoreThreshold: 2,
            timeWindowMinutes: 5
          };
          this.communities.set(initHub.id, initHub);
        }
      } catch (e) {}
    }

    // Default fallback hub ONLY if absolutely no users registered yet
    if (this.communities.size === 0) {
      const defaultHub: Community = {
        id: 'kakkanad',
        name: 'Kakkanad',
        district: 'Ernakulam',
        pincode: '682030',
        lat: 10.0159,
        lng: 76.3419,
        status: 'NORMAL',
        memberCount: 1,
        activeReportsCount: 0,
        activeRestoresCount: 0,
        outageThreshold: 3,
        restoreThreshold: 2,
        timeWindowMinutes: 5
      };
      this.communities.set(defaultHub.id, defaultHub);
    }

    // Multi-tab BroadcastChannel for realtime sync across browser windows
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('velicham_community_sync');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'COMMUNITIES_UPDATE') {
          const list: Community[] = event.data.payload;
          this.communities.clear();
          list.forEach(c => this.communities.set(c.id, c));
          this.notify();
        }
      };
    }

    // Firestore live snapshot listener if configured
    if (isLiveFirebaseConfigured) {
      try {
        const colRef = collection(db, 'communities');
        onSnapshot(colRef, (snapshot) => {
          if (!snapshot.empty) {
            this.communities.clear();
            snapshot.forEach(docSnap => {
              const data = docSnap.data() as Community;
              this.communities.set(data.id, data);
            });
            this.notify();
          }
        }, (err) => {
          console.warn('Community live listener notice:', err);
        });
      } catch (e) {
        console.warn('Firestore community init warning:', e);
      }
    }
  }

  public subscribe(fn: (communities: Community[]) => void): () => void {
    this.listeners.add(fn);
    fn(this.getAllCommunities());
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const list = this.getAllCommunities();
    localStorage.setItem(COMMUNITIES_STORAGE_KEY, JSON.stringify(list));
    this.listeners.forEach(fn => fn(list));
  }

  public getAllCommunities(): Community[] {
    return Array.from(this.communities.values());
  }

  public getCommunity(id: string): Community | undefined {
    return this.communities.get(id);
  }

  /**
   * Synchronize active communities strictly from real registered users
   */
  public syncFromRegisteredUsers(users: UserProfile[], activeUser?: UserProfile | null) {
    if (!users || users.length === 0) {
      if (activeUser && activeUser.communityId) {
        const hub: Community = {
          id: activeUser.communityId,
          name: activeUser.localityName || 'My Locality',
          district: activeUser.district || 'Kerala',
          pincode: activeUser.pincode || '682030',
          lat: 10.0159,
          lng: 76.3419,
          status: 'NORMAL',
          memberCount: 1,
          activeReportsCount: 0,
          activeRestoresCount: 0,
          outageThreshold: 3,
          restoreThreshold: 2,
          timeWindowMinutes: 5
        };
        this.communities.clear();
        this.communities.set(hub.id, hub);
        this.notify();
      }
      return;
    }

    const newMap = new Map<string, Community>();

    users.forEach(u => {
      const commId = u.communityId || 'kakkanad';
      const existing = this.communities.get(commId);

      if (newMap.has(commId)) {
        const comm = newMap.get(commId)!;
        comm.memberCount += 1;
      } else {
        const name = u.localityName || existing?.name || (commId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
        const district = u.district || existing?.district || 'Ernakulam';
        const pincode = u.pincode || existing?.pincode || '682030';
        const lat = existing?.lat || 10.0159;
        const lng = existing?.lng || 76.3419;

        newMap.set(commId, {
          id: commId,
          name,
          district,
          pincode,
          lat,
          lng,
          status: existing?.status || 'NORMAL',
          memberCount: 1,
          activeReportsCount: existing?.activeReportsCount || 0,
          activeRestoresCount: existing?.activeRestoresCount || 0,
          outageThreshold: existing?.outageThreshold || 3,
          restoreThreshold: existing?.restoreThreshold || 2,
          timeWindowMinutes: existing?.timeWindowMinutes || 5
        });
      }
    });

    this.communities = newMap;
    this.notify();

    this.broadcastChannel?.postMessage({
      type: 'COMMUNITIES_UPDATE',
      payload: this.getAllCommunities()
    });
  }

  public async updateCommunityStatus(
    id: string, 
    status: OutageStatus, 
    extra?: { 
      activeReportsCount?: number; 
      activeRestoresCount?: number; 
      lastOutageVerifiedAt?: number; 
      lastRestoredAt?: number;
    }
  ): Promise<void> {
    const comm = this.communities.get(id);
    if (!comm) return;

    const updated: Community = {
      ...comm,
      status,
      ...extra
    };

    this.communities.set(id, updated);
    this.notify();

    // Broadcast to other open tabs
    this.broadcastChannel?.postMessage({
      type: 'COMMUNITIES_UPDATE',
      payload: this.getAllCommunities()
    });

    if (isLiveFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'communities', id), updated, { merge: true });
      } catch (e) {
        console.warn('Error saving community to firestore:', e);
      }
    }
  }

  public async addOrGetDynamicCommunity(comm: Community): Promise<Community> {
    if (this.communities.has(comm.id)) {
      return this.communities.get(comm.id)!;
    }

    this.communities.set(comm.id, comm);
    this.notify();

    // Broadcast to other open windows
    this.broadcastChannel?.postMessage({
      type: 'COMMUNITIES_UPDATE',
      payload: this.getAllCommunities()
    });

    if (isLiveFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'communities', comm.id), comm, { merge: true });
      } catch (e) {
        console.warn('Firestore community dynamic save notice:', e);
      }
    }

    return comm;
  }

  public async registerCustomUserCommunity(
    name: string,
    district: string,
    pincode: string,
    lat?: number,
    lng?: number
  ): Promise<Community> {
    const cleanId = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) + '_' + (pincode.slice(-4) || 'hub');
    
    const fallback = getDistrictFallbackCoords(district);
    const finalLat = lat ?? fallback.lat;
    const finalLng = lng ?? fallback.lng;

    const newCommunity: Community = {
      id: cleanId,
      name,
      district: district || 'Kerala',
      pincode: pincode || '682030',
      lat: finalLat,
      lng: finalLng,
      status: 'NORMAL',
      memberCount: 1,
      activeReportsCount: 0,
      activeRestoresCount: 0,
      outageThreshold: 3,
      restoreThreshold: 2,
      timeWindowMinutes: 5
    };

    return this.addOrGetDynamicCommunity(newCommunity);
  }

  public resetAllToNormal() {
    this.communities.forEach((comm, key) => {
      this.communities.set(key, {
        ...comm,
        status: 'NORMAL',
        activeReportsCount: 0,
        activeRestoresCount: 0
      });
    });
    this.notify();
    this.broadcastChannel?.postMessage({
      type: 'COMMUNITIES_UPDATE',
      payload: this.getAllCommunities()
    });
  }
}

export const communityService = new CommunityService();

