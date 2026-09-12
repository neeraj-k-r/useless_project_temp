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
 * Approximate centroids of Kerala districts — used as a sane fallback when
 * GPS/IP geolocation is unavailable, instead of assuming Kakkanad for everyone.
 */
const KERALA_DISTRICT_CENTERS: { [district: string]: { lat: number; lng: number } } = {
  'Thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
  'Kollam': { lat: 8.8932, lng: 76.6141 },
  'Pathanamthitta': { lat: 9.2648, lng: 76.7870 },
  'Alappuzha': { lat: 9.4981, lng: 76.3388 },
  'Kottayam': { lat: 9.5916, lng: 76.5222 },
  'Idukki': { lat: 9.8499, lng: 76.9600 },
  'Ernakulam': { lat: 9.9816, lng: 76.2995 },
  'Thrissur': { lat: 10.5276, lng: 76.2144 },
  'Palakkad': { lat: 10.7867, lng: 76.6548 },
  'Malappuram': { lat: 11.0510, lng: 76.0711 },
  'Kozhikode': { lat: 11.2588, lng: 75.7804 },
  'Wayanad': { lat: 11.6854, lng: 76.1320 },
  'Kannur': { lat: 11.8745, lng: 75.3704 },
  'Kasaragod': { lat: 12.4996, lng: 74.9869 }
};

export function getDistrictFallbackCoords(district?: string): { lat: number; lng: number } {
  const center = KERALA_DISTRICT_CENTERS[(district || '').trim()];
  if (center) return center;
  return { lat: 9.9816, lng: 76.2995 };
}

const KERALA_BBOX = { minLat: 8.05, maxLat: 12.8, minLng: 74.5, maxLng: 77.9 };

export function isWithinKerala(lat: number, lng: number): boolean {
  return (
    lat >= KERALA_BBOX.minLat &&
    lat <= KERALA_BBOX.maxLat &&
    lng >= KERALA_BBOX.minLng &&
    lng <= KERALA_BBOX.maxLng
  );
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

    // Single GPS attempt helper
    const tryGps = (highAccuracy: boolean, timeoutMs: number) =>
      new Promise<{ lat: number; lng: number } | null>((r) => {
        if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
          r(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => r({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => r(null),
          { timeout: timeoutMs, enableHighAccuracy: highAccuracy, maximumAge: 2000 }
        );
      });

    // 1) Accurate GPS lock first (phones often need a few seconds of locking)
    const precise = await tryGps(true, 6000);
    if (precise) {
      await resolveWithCoords(precise.lat, precise.lng);
      return;
    }

    // 2) Coarse but quick GPS retry (WiFi/cell-based)
    const coarse = await tryGps(false, 10000);
    if (coarse) {
      await resolveWithCoords(coarse.lat, coarse.lng);
      return;
    }

    // 3) IP-geolocation only if it resolves INSIDE Kerala.
    //    ISP coordinates are often city/state-level — never trust them blindly.
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude && isWithinKerala(data.latitude, data.longitude)) {
          await resolveWithCoords(data.latitude, data.longitude);
          return;
        }
      }
    } catch (e) {}

    if (resolved) return;
    resolved = true;

    // 4) Last resort: nearest known hub, else a generic Kerala default.
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
  });
}


