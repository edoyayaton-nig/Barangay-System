/**
 * Distance Matrix AI Geocoding Service
 * Uses Distance Matrix Geocoding API for direct and reverse address geocoding.
 */

export interface GeocodeLocation {
  lat: number;
  lng: number;
}

export interface GeocodeAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GeocodeResult {
  formatted_address: string;
  location: GeocodeLocation;
  barangay?: string;
  city?: string;
  province?: string;
  country?: string;
  purokOrStreet?: string;
  place_id?: string;
  raw?: any;
}

const DISTANCE_MATRIX_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DISTANCE_MATRIX_API_KEY) ||
  'CWRu7dBhi0Jjj0A5LCQKE04lIXSyqTZWVUxsybi87I0BBEs7iGly7AGkViOvwC43';

const BASE_URL = 'https://api.distancematrix.ai/maps/api/geocode/json';

function toTitleCase(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parse structured components from DistanceMatrix API response
 */
function parseComponents(
  item: any,
  originalQuery: string = ''
): { barangay?: string; city?: string; province?: string; country?: string; purokOrStreet?: string } {
  const components: GeocodeAddressComponent[] = item.address_components || [];
  let city = '';
  let province = '';
  let country = '';
  let barangay = '';
  let purokOrStreet = '';

  for (const c of components) {
    const types = c.types || [];
    const name = toTitleCase(c.long_name || c.short_name || '');

    if (types.includes('locality') || types.includes('postal_town') || types.includes('administrative_area_level_2')) {
      if (!city) city = name;
    } else if (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('neighborhood') || types.includes('administrative_area_level_4') || types.includes('administrative_area_level_5')) {
      if (!barangay) barangay = name;
    } else if (types.includes('state') || types.includes('administrative_area_level_1') || types.includes('country_region')) {
      if (!province) province = name;
    } else if (types.includes('country')) {
      if (!country) country = name;
    } else if (types.includes('route') || types.includes('street_address') || types.includes('premise')) {
      if (!purokOrStreet) purokOrStreet = name;
    }
  }

  // Fallback extraction from originalQuery if components didn't separate barangay or street
  if (originalQuery) {
    const parts = originalQuery.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      if (!barangay && parts.length >= 2) {
        // e.g. "Pianing, Butuan City" -> barangay = "Pianing"
        const candidate = parts[0].replace(/^purok\s*\d+\s*,?/i, '').replace(/^barangay\s+/i, '').replace(/^brgy\.?\s+/i, '').trim();
        if (candidate && candidate.toLowerCase() !== (city || '').toLowerCase()) {
          barangay = toTitleCase(candidate);
        }
      }
      if (!city && parts.length >= 2) {
        city = toTitleCase(parts[parts.length - 1].replace(/philippines/i, '').trim());
      }
    } else if (parts.length === 1 && !barangay && !city) {
      barangay = toTitleCase(parts[0]);
    }
  }

  // Clean prefixes from barangay
  if (barangay) {
    barangay = barangay.replace(/^barangay\s+/i, '').replace(/^brgy\.?\s+/i, '').trim();
  }

  return { barangay, city, province, country, purokOrStreet };
}

/**
 * Direct geocoding: Convert address string into coordinates and structured address
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const url = `${BASE_URL}?address=${encodeURIComponent(cleanQuery)}&key=${DISTANCE_MATRIX_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Distance Matrix Geocoding failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data || data.status !== 'OK' || !Array.isArray(data.result) || data.result.length === 0) {
    return [];
  }

  return data.result.map((item: any) => {
    const location: GeocodeLocation = {
      lat: item.geometry?.location?.lat ?? 0,
      lng: item.geometry?.location?.lng ?? 0
    };
    const parsed = parseComponents(item, cleanQuery);

    return {
      formatted_address: item.formatted_address || cleanQuery,
      location,
      barangay: parsed.barangay,
      city: parsed.city,
      province: parsed.province,
      country: parsed.country,
      purokOrStreet: parsed.purokOrStreet,
      place_id: item.place_id,
      raw: item
    };
  });
}

/**
 * Reverse geocoding: Convert coordinates (lat, lng) into human-readable address & components
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult[]> {
  const url = `${BASE_URL}?latlng=${lat},${lng}&key=${DISTANCE_MATRIX_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Distance Matrix Reverse Geocoding failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data || data.status !== 'OK' || !Array.isArray(data.result) || data.result.length === 0) {
    return [];
  }

  return data.result.map((item: any) => {
    const location: GeocodeLocation = {
      lat: item.geometry?.location?.lat ?? lat,
      lng: item.geometry?.location?.lng ?? lng
    };
    const parsed = parseComponents(item);

    return {
      formatted_address: item.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      location,
      barangay: parsed.barangay,
      city: parsed.city,
      province: parsed.province,
      country: parsed.country,
      purokOrStreet: parsed.purokOrStreet,
      place_id: item.place_id,
      raw: item
    };
  });
}

/**
 * Helper to obtain user's current GPS position using browser Geolocation,
 * then reverse geocodes it via Distance Matrix.
 */
export async function geocodeCurrentPosition(): Promise<GeocodeResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser.');
  }

  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    });
  });

  const { latitude, longitude } = pos.coords;
  const results = await reverseGeocode(latitude, longitude);
  if (results.length > 0) {
    return results[0];
  }

  return {
    formatted_address: `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`,
    location: { lat: latitude, lng: longitude }
  };
}
