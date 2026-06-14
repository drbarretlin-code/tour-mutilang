import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from './logger';
import { resolveLocalCityCoords } from '../constants/destinations';

/**
 * 全球地理編碼服務（地名 → 座標）。
 *
 * 設計原則：本 App 須適用於「任意語系使用者前往任意國家城市」，因此城市座標解析
 * 不能依賴單一英文端點或有限的內建清單，而需具備全球、多語的地理編碼能力。
 *
 * 來源優先序：
 *   1. 內建座標字典（resolveLocalCityCoords）—— 熱門城市免打網路，最快且最準。
 *   2. Geoapify（商用、需金鑰 EXPO_PUBLIC_GEOAPIFY_KEY）—— 正式環境的主要全球地理編碼器。
 *   3. OSM Nominatim 公用端點（免金鑰）—— 開發/無金鑰時的後援；正式上架大量使用時，
 *      應改用 Geoapify/LocationIQ 或自架（公用 Nominatim 有使用政策限制）。
 *
 * 結果快取於 AsyncStorage（座標長期穩定，TTL 180 天），避免重複地理編碼。
 */

const logger = createLogger('geocoder');

const GEOCODE_CACHE_PREFIX = '@geocode_';
const GEOCODE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180 天

export interface GeoCoords { lat: number; lon: number }

/** App 語系 → 地理編碼 API 的語言代碼（影響回傳的偏好語言與比對） */
function localeToGeoLang(locale: string): string {
  const l = (locale || 'en').toLowerCase();
  if (l.startsWith('zh')) return 'zh';
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('ko')) return 'ko';
  if (l.startsWith('th')) return 'th';
  if (l.startsWith('vi')) return 'vi';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('pt')) return 'pt';
  if (l.startsWith('ms')) return 'ms';
  return 'en';
}

const USER_GEOAPIFY_KEY = '@user_geoapify_key';
let _userKeyCache: string | null | undefined = undefined; // undefined = not loaded yet

/** Load user's custom Geoapify key from AsyncStorage into memory cache. Call once at app startup. */
export async function loadUserGeoapifyKey(): Promise<void> {
  try {
    _userKeyCache = await AsyncStorage.getItem(USER_GEOAPIFY_KEY);
  } catch {
    _userKeyCache = null;
  }
}

/** Save a user-provided Geoapify key (persists to AsyncStorage + updates in-memory cache). */
export async function setUserGeoapifyKey(key: string): Promise<void> {
  const trimmed = (key || '').trim();
  if (!trimmed) return clearUserGeoapifyKey();
  _userKeyCache = trimmed;
  try {
    await AsyncStorage.setItem(USER_GEOAPIFY_KEY, trimmed);
  } catch { /* ignore */ }
}

/** Clear user-provided Geoapify key. */
export async function clearUserGeoapifyKey(): Promise<void> {
  _userKeyCache = null;
  try {
    await AsyncStorage.removeItem(USER_GEOAPIFY_KEY);
  } catch { /* ignore */ }
}

/** Get the currently active user key (from cache, synchronous). Returns null if none set. */
export function getUserGeoapifyKey(): string | null {
  return _userKeyCache || null;
}

function geoapifyKey(): string | null {
  // 1) 使用者自訂金鑰（運行時覆寫）優先
  if (_userKeyCache) return _userKeyCache;
  // 2) 環境變數內建金鑰
  return (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_GEOAPIFY_KEY) || null;
}

async function fetchWithTimeout(url: string, ms: number, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, headers });
  } finally {
    clearTimeout(id);
  }
}

let _quotaExceeded = false;

export function isGeoapifyQuotaExceeded(): boolean {
  return _quotaExceeded;
}

export function resetQuotaExceededFlag(): void {
  _quotaExceeded = false;
}

/** 以 Geoapify 進行地理編碼（需金鑰）。失敗回 null。 */
async function geocodeViaGeoapify(query: string, lang: string): Promise<GeoCoords | null> {
  const key = geoapifyKey();
  if (!key) return null;
  try {
    const url = `https://api.geoapify.com/v1/geocode/search`
      + `?text=${encodeURIComponent(query)}&type=city&format=json&limit=1&lang=${lang}&apiKey=${encodeURIComponent(key)}`;
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) {
      if (res.status === 402 || res.status === 429) {
        _quotaExceeded = true;
      }
      logger.warn(`Geoapify 回傳 ${res.status}。`);
      return null;
    }
    const data = await res.json();
    const r = Array.isArray(data?.results) ? data.results[0] : null;
    if (r && typeof r.lat === 'number' && typeof r.lon === 'number') {
      return { lat: r.lat, lon: r.lon };
    }
  } catch (e) {
    logger.warn('Geoapify 地理編碼失敗。', e);
  }
  return null;
}

/** 以 OSM Nominatim 公用端點進行地理編碼（免金鑰，開發/後援用）。失敗回 null。 */
async function geocodeViaNominatim(query: string, lang: string): Promise<GeoCoords | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search`
      + `?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=${lang}`;
    // Nominatim 使用政策要求帶可識別的 User-Agent。
    const res = await fetchWithTimeout(url, 6000, { 'User-Agent': 'tour-mutilang/1.0 (itinerary planner)' });
    if (!res.ok) {
      logger.warn(`Nominatim 回傳 ${res.status}。`);
      return null;
    }
    const arr = await res.json();
    const r = Array.isArray(arr) ? arr[0] : null;
    if (r && r.lat && r.lon) {
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
    }
  } catch (e) {
    logger.warn('Nominatim 地理編碼失敗。', e);
  }
  return null;
}

/**
 * 解析任意語系城市名（可附國家以消歧義）為座標。
 * @param name 城市名稱（使用者語系）
 * @param country 國家名稱（使用者語系，選填，用於消除同名城市歧義）
 * @param locale App 語系，決定地理編碼偏好語言
 */
export async function geocodeDestination(
  name: string,
  country?: string,
  locale = 'en'
): Promise<GeoCoords | null> {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();

  // 1) 內建座標字典：熱門城市免打網路。
  const local = resolveLocalCityCoords(trimmed);
  if (local) return local;

  const lang = localeToGeoLang(locale);
  // 附上國家以消歧義（如「芭達雅」vs 台中「大雅」）。
  const query = country && country.trim() ? `${trimmed}, ${country.trim()}` : trimmed;
  const cacheKey = `${GEOCODE_CACHE_PREFIX}${lang}__${query}`.toLowerCase();

  // 2) 讀取快取
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached?.ts && Date.now() - cached.ts < GEOCODE_CACHE_TTL_MS && cached.coords) {
        return cached.coords as GeoCoords;
      }
    }
  } catch { /* ignore cache errors */ }

  // 3) 供應商（Geoapify）→ 4) Nominatim 後援
  let coords = await geocodeViaGeoapify(query, lang);
  if (!coords) coords = await geocodeViaNominatim(query, lang);

  if (coords) {
    logger.info(`地理編碼成功：「${query}」→ ${coords.lat},${coords.lon}`);
    try { await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), coords })); } catch { /* ignore */ }
    return coords;
  }

  logger.warn(`地理編碼失敗，無法解析「${query}」的座標。`);
  return null;
}

/** 診斷目前地理編碼器設定（供啟動自檢顯示）。 */
export function getGeocoderStatus(): { provider: 'geoapify' | 'nominatim'; hasKey: boolean; isUserKey: boolean } {
  const userKey = getUserGeoapifyKey();
  const hasKey = !!userKey || !!((typeof process !== 'undefined' && process.env.EXPO_PUBLIC_GEOAPIFY_KEY));
  return { provider: hasKey ? 'geoapify' : 'nominatim', hasKey, isUserKey: !!userKey };
}
