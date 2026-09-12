import { doc, getDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { db, isLiveFirebaseConfigured } from '../firebase/config';
import { Community, OutageStatus, UserProfile } from '../types';
import { getDistrictFallbackCoords, getDistanceKm } from '../utils/keralaData';

function normalizeLocalityName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 4) return 5;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

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
          const initFb = getDistrictFallbackCoords(user.district);
          const initHub: Community = {
            id: user.communityId,
            name: user.localityName || 'My Locality',
            district: user.district || 'Kerala',
            pincode: user.pincode || '682030',
            lat: initFb.lat,
            lng: initFb.lng,
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

    // Firestore live snapshot listener if configured.
    // Server records carry the authoritative runtime status; local records
    // (derived from registered users) carry memberCount & coordinates.
    if (isLiveFirebaseConfigured) {
      try {
        const colRef = collection(db, 'communities');
        onSnapshot(colRef, (snapshot) => {
          let changed = false;
          snapshot.forEach(docSnap => {
            const data = docSnap.data() as Community;
            const local = this.communities.get(data.id);
            if (!local) {
              this.communities.set(data.id, data);
            } else {
              const merged: Community = {
                ...local,
                status: data.status ?? local.status,
                activeReportsCount: data.activeReportsCount ?? local.activeReportsCount,
                activeRestoresCount: data.activeRestoresCount ?? local.activeRestoresCount,
                lastOutageVerifiedAt: data.lastOutageVerifiedAt ?? local.lastOutageVerifiedAt,
                lastRestoredAt: data.lastRestoredAt ?? local.lastRestoredAt
              };
              this.communities.set(data.id, merged);
            }
            changed = true;
          });
          if (changed) this.notify();
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
   * Return all community IDs belonging to the same locality cluster as the
   * given community (including itself). Two records merge when they are within
   * `radiusKm` OR their (district + locality name) strongly match — the second
   * rule is coordinate-independent so fragmented records with differing or
   * missing coordinates still count together.
   */
  public getNearbyCommunityIds(communityId: string, radiusKm: number = 3.5): string[] {
    const all = this.getAllCommunities();
    const target = this.communities.get(communityId);
    if (!target) return [communityId];

    const tName = normalizeLocalityName(target.name);
    const tDistrict = (target.district || '').trim().toLowerCase();
    const ids: string[] = [communityId];
    const idSet = new Set(ids);

    const maybeAdd = (id: string) => {
      if (!idSet.has(id)) {
        idSet.add(id);
        ids.push(id);
      }
    };

    all.forEach(comm => {
      if (comm.id === communityId) return;

      // Rule 1: geographic proximity (only when both have usable coordinates)
      if (target.lat && target.lng && comm.lat && comm.lng) {
        if (getDistanceKm(target.lat, target.lng, comm.lat, comm.lng) <= radiusKm) {
          maybeAdd(comm.id);
          return;
        }
      }

      // Rule 2: same district + near-identical locality name (fragmented records)
      const cName = normalizeLocalityName(comm.name);
      const cDistrict = (comm.district || '').trim().toLowerCase();
      if (
        cDistrict === tDistrict &&
        tName.length > 2 &&
        cName.length > 2 &&
        editDistance(cName, tName) <= 2
      ) {
        maybeAdd(comm.id);
      }
    });

    return ids;
  }

  /**
   * Total registered members across the nearby cluster of a community.
   * Prevents an undercounted / duplicated community from skewing the threshold.
   */
  public getClusterMemberCount(communityId: string): number {
    const ids = this.getNearbyCommunityIds(communityId);
    let total = 0;
    ids.forEach(id => {
      total += Math.max(this.communities.get(id)?.memberCount || 0, 0);
    });
    return Math.max(total, 1);
  }

  /**
   * Synchronize active communities strictly from real registered users
   */
  public syncFromRegisteredUsers(users: UserProfile[], activeUser?: UserProfile | null) {
    if (!users || users.length === 0) {
      if (activeUser && activeUser.communityId) {
        const fb = getDistrictFallbackCoords(activeUser.district);
        const hub: Community = {
          id: activeUser.communityId,
          name: activeUser.localityName || 'My Locality',
          district: activeUser.district || 'Kerala',
          pincode: activeUser.pincode || '682030',
          lat: fb.lat,
          lng: fb.lng,
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
        const fb = getDistrictFallbackCoords(district);
        const lat = existing?.lat || fb.lat;
        const lng = existing?.lng || fb.lng;

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
    const cleanName = (name || '').trim();
    const cleanPin = (pincode || '').trim();
    const cleanId = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) + '_' + (cleanPin.slice(-4) || 'hub');
    
    const fallback = getDistrictFallbackCoords(district);
    const finalLat = lat ?? fallback.lat;
    const finalLng = lng ?? fallback.lng;

    const newCommunity: Community = {
      id: cleanId,
      name: cleanName || 'My Locality',
      district: district || 'Kerala',
      pincode: cleanPin || '682030',
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

    // Persist so every device sees the reset grid
    if (isLiveFirebaseConfigured) {
      this.communities.forEach(comm => {
        setDoc(doc(db, 'communities', comm.id), {
          id: comm.id,
          name: comm.name,
          district: comm.district,
          pincode: comm.pincode,
          lat: comm.lat,
          lng: comm.lng,
          status: 'NORMAL',
          memberCount: comm.memberCount,
          activeReportsCount: 0,
          activeRestoresCount: 0,
          outageThreshold: comm.outageThreshold,
          restoreThreshold: comm.restoreThreshold,
          timeWindowMinutes: comm.timeWindowMinutes
        }).catch(e => console.warn('Reset persist notice:', e));
      });
    }
  }
}

export const communityService = new CommunityService();

