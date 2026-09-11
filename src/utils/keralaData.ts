import { Community } from '../types';

/**
 * Empty default - all communities are generated dynamically from real registered user locations.
 */
export const SAMPLE_COMMUNITIES: Community[] = [];

export const MANGLISH_QUOTES = {
  reportingPrompt: 'Ninte area ilum poyo?',
  confirmPrompt: 'Onnu confirm cheyyamo?',
  restorePrompt: 'Current thirichu vannittundo?',
  allSafePrompt: 'Ellarum safe alle?',
  restoredBanner: 'Current thirichu vannu! 🟢',
  tagline: 'Current poyaalum, nammal velicham tharaam. 🔦',
  privacyNotice: 'Your exact location is never publicly displayed. Only community-level consensus is shared.'
};

/**
 * Calculate distance between two coordinates using the Haversine formula
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Match coordinates to the nearest existing Community (if any exist)
 */
export function findClosestCommunity(lat: number, lng: number, communitiesList: Community[]): Community | null {
  if (!communitiesList || communitiesList.length === 0) return null;

  let closest = communitiesList[0];
  let minDistance = Infinity;

  communitiesList.forEach((comm) => {
    const dist = getDistanceKm(lat, lng, comm.lat, comm.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = comm;
    }
  });

  return closest;
}

/**
 * Create a dynamic community from user location and reverse geocoding
 */
export async function createCommunityFromCoordinates(
  lat: number,
  lng: number,
  fallbackName?: string
): Promise<Community> {
  // 1. Try BigDataCloud reverse geocode (Free, CORS enabled, no API key needed, high reliability)
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (res.ok) {
      const data = await res.json();
      const localityName = data.locality || 
                           data.city || 
                           data.principalSubdivisionDescription || 
                           fallbackName || 
                           'My Locality';

      const districtName = data.principalSubdivisionDescription || 
                           data.principalSubdivision || 
                           'Kerala';

      const pincode = data.postcode || '682030';
      const cleanId = localityName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) + '_' + (pincode.slice(-4) || 'hub');

      return {
        id: cleanId,
        name: localityName,
        district: districtName,
        pincode,
        lat,
        lng,
        status: 'NORMAL',
        memberCount: 1,
        activeReportsCount: 0,
        activeRestoresCount: 0,
        outageThreshold: 3,
        restoreThreshold: 2,
        timeWindowMinutes: 5
      };
    }
  } catch (e) {
    console.warn('[keralaData] BigDataCloud geocoding notice:', e);
  }

  // 2. Fallback to OpenStreetMap Nominatim
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};

      const localityName = addr.suburb || 
                           addr.neighbourhood || 
                           addr.residential || 
                           addr.village || 
                           addr.town || 
                           addr.city_district || 
                           addr.city || 
                           fallbackName || 
                           'My Locality';

      const districtName = addr.state_district || 
                           addr.county || 
                           addr.city || 
                           addr.state || 
                           'Kerala';

      const pincode = addr.postcode || '682030';
      const cleanId = localityName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) + '_' + (pincode.slice(-4) || 'hub');

      return {
        id: cleanId,
        name: localityName,
        district: districtName,
        pincode,
        lat,
        lng,
        status: 'NORMAL',
        memberCount: 1,
        activeReportsCount: 0,
        activeRestoresCount: 0,
        outageThreshold: 3,
        restoreThreshold: 2,
        timeWindowMinutes: 5
      };
    }
  } catch (e) {
    console.warn('[keralaData] Nominatim reverse geocoding fallback:', e);
  }

  const id = 'loc_' + Math.floor(lat * 100) + '_' + Math.floor(lng * 100);
  return {
    id,
    name: fallbackName || `Locality (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
    district: 'Kerala',
    pincode: '682030',
    lat,
    lng,
    status: 'NORMAL',
    memberCount: 1,
    activeReportsCount: 0,
    activeRestoresCount: 0,
    outageThreshold: 3,
    restoreThreshold: 2,
    timeWindowMinutes: 5
  };
}

/**
 * Auto detect user's locality via browser GPS with IP-geolocation fallback
 */
export async function detectUserLocality(existingCommunities: Community[] = []): Promise<{ 
  community: Community; 
  lat?: number; 
  lng?: number; 
  isNewDynamicCommunity?: boolean; 
}> {
  return new Promise(async (resolve) => {
    let resolved = false;

    // Helper to resolve via coordinates
    const resolveWithCoords = async (lat: number, lng: number) => {
      if (resolved) return;
      resolved = true;

      const matched = findClosestCommunity(lat, lng, existingCommunities);
      if (matched) {
        const dist = getDistanceKm(lat, lng, matched.lat, matched.lng);
        if (dist <= 3.5) {
          resolve({ community: matched, lat, lng, isNewDynamicCommunity: false });
          return;
        }
      }

      const dynamicComm = await createCommunityFromCoordinates(lat, lng);
      resolve({ community: dynamicComm, lat, lng, isNewDynamicCommunity: true });
    };

    // Helper for IP-based geolocation fallback
    const fallbackToIP = async () => {
      if (resolved) return;
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          if (data.latitude && data.longitude) {
            await resolveWithCoords(data.latitude, data.longitude);
            return;
          }
        }
      } catch (e) {}

      if (resolved) return;
      resolved = true;

      if (existingCommunities.length > 0) {
        resolve({ community: existingCommunities[0], isNewDynamicCommunity: false });
      } else {
        const defaultComm: Community = {
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
        resolve({ community: defaultComm, isNewDynamicCommunity: true });
      }
    };

    // 1. Try Browser Geolocation
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await resolveWithCoords(pos.coords.latitude, pos.coords.longitude);
        },
        async () => {
          await fallbackToIP();
        },
        { timeout: 8000, enableHighAccuracy: false, maximumAge: 60000 }
      );
    } else {
      await fallbackToIP();
    }
  });
}


