import AsyncStorage from '@react-native-async-storage/async-storage';
import { InterestTag } from '../types/survey';

/**
 * POI（景點）資料服務 — 使用免費的 OpenTripMap API。
 *
 * 設計目標：讓「規則式行程引擎」能取得真實景點（名稱、座標、分類、熱門度），
 * 完全不依賴 LLM、無每位使用者配額問題。金鑰由營運者提供（單一免費金鑰），
 * 透過環境變數 EXPO_PUBLIC_OPENTRIPMAP_KEY 或本機儲存設定，而非每位使用者自填。
 */

export interface POI {
  xid: string;
  name: string;
  localName?: string;
  lat: number;
  lon: number;
  kinds: string;
  rate: number;
  category: PoiCategory;
}

export type PoiCategory =
  | 'cultural' | 'historic' | 'architecture' | 'museum' | 'nature'
  | 'beach' | 'park' | 'religion' | 'shopping' | 'market'
  | 'food' | 'amusement' | 'viewpoint' | 'entertainment' | 'other';

const OTM_BASE = 'https://api.opentripmap.com/0.1/en/places';
const OTM_KEY_STORAGE = 'user_opentripmap_api_key';
const POI_CACHE_PREFIX = '@poi_cache_';
const POI_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 天

/** 將 App 的興趣標籤對應到 OpenTripMap 的 kinds 分類 */
const INTEREST_TO_KINDS: Record<InterestTag, string[]> = {
  culture: ['cultural', 'historic', 'architecture'],
  nature: ['natural', 'gardens_and_parks', 'view_points'],
  food: ['foods'],
  shopping: ['shops', 'malls'],
  nightlife: ['theatres_and_entertainments'],
  water: ['beaches', 'water'],
  family: ['amusements', 'gardens_and_parks'],
  photo: ['view_points', 'architecture'],
  temple: ['religion'],
  spa: ['resorts'],
  themepark: ['amusements'],
  art: ['museums', 'theatres_and_entertainments'],
  market: ['marketplaces', 'foods'],
};

/** 由 OpenTripMap 的 kinds 字串推導出一個主要分類，供後續描述與圖片使用 */
function deriveCategory(kinds: string): PoiCategory {
  const k = kinds || '';
  if (k.includes('religion')) return 'religion';
  if (k.includes('beaches')) return 'beach';
  if (k.includes('gardens_and_parks')) return 'park';
  if (k.includes('view_points')) return 'viewpoint';
  if (k.includes('museums')) return 'museum';
  if (k.includes('marketplaces')) return 'market';
  if (k.includes('malls') || k.includes('shops')) return 'shopping';
  if (k.includes('foods')) return 'food';
  if (k.includes('amusements')) return 'amusement';
  if (k.includes('theatres_and_entertainments')) return 'entertainment';
  if (k.includes('architecture')) return 'architecture';
  if (k.includes('historic')) return 'historic';
  if (k.includes('natural')) return 'nature';
  if (k.includes('cultural')) return 'cultural';
  return 'other';
}

async function resolveApiKey(): Promise<string | null> {
  // 1) 環境變數（營運者於部署環境設定，Expo 會將 EXPO_PUBLIC_* 注入前端）
  const envKey = (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_OPENTRIPMAP_KEY) || null;
  if (envKey) return envKey as string;
  // 2) 本機儲存（可由設定畫面填入）
  try {
    const stored = await AsyncStorage.getItem(OTM_KEY_STORAGE);
    return stored || null;
  } catch {
    return null;
  }
}

/** 供設定畫面寫入金鑰 */
export async function setOpenTripMapKey(key: string): Promise<void> {
  await AsyncStorage.setItem(OTM_KEY_STORAGE, key);
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** 解析城市中心座標：優先用 survey 已帶的座標，否則向 geoname 查詢 */
async function resolveCenter(
  destName: string,
  lat: number | undefined,
  lon: number | undefined,
  apiKey: string
): Promise<{ lat: number; lon: number } | null> {
  if (typeof lat === 'number' && typeof lon === 'number' && lat !== 0 && lon !== 0) {
    return { lat, lon };
  }
  try {
    const url = `${OTM_BASE}/geoname?name=${encodeURIComponent(destName)}&apikey=${apiKey}`;
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.lat === 'number' && typeof data?.lon === 'number') {
      return { lat: data.lat, lon: data.lon };
    }
  } catch {
    /* ignore */
  }
  return null;
}

interface FetchPOIOptions {
  destName: string;
  lat?: number;
  lon?: number;
  interests: InterestTag[];
  limit?: number;
  radiusMeters?: number;
}

/**
 * 取得指定目的地的 POI 清單（依興趣過濾、依熱門度排序）。
 * 失敗（無金鑰／網路／無資料）時回傳空陣列，呼叫端應自行退回內建範本。
 */
export async function fetchDestinationPOIs(opts: FetchPOIOptions): Promise<POI[]> {
  const { destName, lat, lon, interests, limit = 40, radiusMeters = 20000 } = opts;

  const kinds = Array.from(
    new Set((interests || []).flatMap(i => INTEREST_TO_KINDS[i] || []))
  );
  // 未選興趣時，採用通用的觀光分類
  const kindsParam = kinds.length > 0
    ? kinds.join(',')
    : 'cultural,historic,architecture,natural,view_points';

  const cacheKey = `${POI_CACHE_PREFIX}${destName}__${kindsParam}__${limit}`;

  // 讀取快取
  try {
    const cachedRaw = await AsyncStorage.getItem(cacheKey);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached?.ts && Date.now() - cached.ts < POI_CACHE_TTL_MS && Array.isArray(cached.pois)) {
        return cached.pois as POI[];
      }
    }
  } catch { /* ignore cache errors */ }

  const apiKey = await resolveApiKey();
  if (!apiKey) {
    console.warn('[poi] 找不到 OpenTripMap API 金鑰（EXPO_PUBLIC_OPENTRIPMAP_KEY 或本機設定），改用內建範本。');
    return [];
  }

  const center = await resolveCenter(destName, lat, lon, apiKey);
  if (!center) {
    console.warn(`[poi] 無法解析「${destName}」的中心座標，改用內建範本。`);
    return [];
  }

  try {
    const url = `${OTM_BASE}/radius?radius=${radiusMeters}&lon=${center.lon}&lat=${center.lat}`
      + `&kinds=${encodeURIComponent(kindsParam)}&rate=2&format=json&limit=${limit}&apikey=${apiKey}`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) {
      console.warn(`[poi] OpenTripMap radius 回傳 ${res.status}，改用內建範本。`);
      return [];
    }
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];

    const seen = new Set<string>();
    const pois: POI[] = raw
      .filter((p: any) => p?.name && typeof p?.point?.lat === 'number' && typeof p?.point?.lon === 'number')
      .map((p: any): POI => ({
        xid: p.xid,
        name: p.name,
        lat: p.point.lat,
        lon: p.point.lon,
        kinds: p.kinds || '',
        rate: typeof p.rate === 'number' ? p.rate : 0,
        category: deriveCategory(p.kinds || ''),
      }))
      .filter((p: POI) => {
        const key = p.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a: POI, b: POI) => b.rate - a.rate);

    // 寫入快取
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), pois }));
    } catch { /* ignore */ }

    return pois;
  } catch (e) {
    console.warn('[poi] OpenTripMap 查詢失敗，改用內建範本。', e);
    return [];
  }
}
