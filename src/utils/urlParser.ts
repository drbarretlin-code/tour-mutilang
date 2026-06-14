/**
 * URL Parser Utilities
 * Extracts coordinates and names from Google Maps URLs.
 */

export interface ParsedLocation {
  lat?: number;
  lng?: number;
  name?: string;
}

export function parseGoogleMapsUrl(url: string): ParsedLocation | null {
  try {
    // Check if it's a valid URL
    const urlObj = new URL(url);
    
    // Pattern 1: https://www.google.com/maps/place/NAME/@LAT,LNG,ZOOMz
    const placeMatch = url.match(/\/place\/([^\/]+)\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (placeMatch) {
      return {
        name: decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')),
        lat: parseFloat(placeMatch[2]),
        lng: parseFloat(placeMatch[3])
      };
    }

    // Pattern 2: https://www.google.com/maps/@LAT,LNG,ZOOMz
    const atMatch = url.match(/\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return {
        lat: parseFloat(atMatch[1]),
        lng: parseFloat(atMatch[2])
      };
    }

    // Pattern 3: URL contains q=LAT,LNG
    const qParam = urlObj.searchParams.get('q');
    if (qParam) {
      const coords = qParam.split(',');
      if (coords.length === 2) {
        const lat = parseFloat(coords[0]);
        const lng = parseFloat(coords[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }
    }

    // For short links (https://maps.app.goo.gl/...), we cannot easily decode them synchronously
    // without fetching the redirect. The AI pre-processor will handle those.
    
    return null;
  } catch (e) {
    // Invalid URL format
    return null;
  }
}
