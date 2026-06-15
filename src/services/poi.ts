import AsyncStorage from '@react-native-async-storage/async-storage';
import { InterestTag } from '../types/survey';
import { createLogger } from './logger';
import { recordAPIMetric } from './metrics';
import { PACEngine } from './pac';
import { fetchWikipediaGeoSearch } from './enrich';
import { geocodeDestination } from './geocoder';

const logger = createLogger('poi');

/**
 * 自適應超時：網路正常時給足裕度（避免「正常但偏慢」的 API 被誤殺，
 * 例如實測 geoname 可能需 ~2s），偵測為弱網時再放寬。重試由 PAC 提供。
 */
function adaptiveTimeout(baseMs: number): number {
  const net = PACEngine.getState().network;
  if (net === 'weak') return Math.round(baseMs * 1.5);
  return baseMs;
}

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
export const INTEREST_TO_KINDS: Record<InterestTag, string[]> = {
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
export function deriveCategory(kinds: string): PoiCategory {
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

export type OtmKeyStatus =
  | 'ok'            // 金鑰存在且通過 API 驗證
  | 'missing'       // 完全找不到金鑰（環境變數與本機皆無）
  | 'invalid'       // 有金鑰但 API 回傳 401/403（金鑰錯誤或未啟用）
  | 'network';      // 網路/逾時等暫時性問題，無法判定

export interface OtmKeyDiagnostic {
  status: OtmKeyStatus;
  source: 'env' | 'storage' | 'none';
  message: string;
  hint: string;
}

/**
 * 驗證 OpenTripMap 金鑰是否「真的會生效」：實際打一個輕量 API（geoname）來檢查。
 * 供設定畫面或行程畫面呼叫，以明確告知使用者金鑰狀態並給出對應的解決指引。
 */
export async function verifyOpenTripMapKey(): Promise<OtmKeyDiagnostic> {
  const envKey = (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_OPENTRIPMAP_KEY) || null;
  let source: 'env' | 'storage' | 'none' = 'none';
  let key: string | null = envKey || null;
  if (key) {
    source = 'env';
  } else {
    try {
      const stored = await AsyncStorage.getItem(OTM_KEY_STORAGE);
      if (stored) { key = stored; source = 'storage'; }
    } catch { /* ignore */ }
  }

  if (!key) {
    return {
      status: 'missing',
      source: 'none',
      message: '尚未設定 OpenTripMap 金鑰，行程將改用內建範本（景點不會即時更新）。',
      hint: 'Web 部署請於 Vercel 環境變數設定 EXPO_PUBLIC_OPENTRIPMAP_KEY 後重新部署；桌面/行動版請於設定畫面填入金鑰。注意：EXPO_PUBLIC_ 變數是「建置時」注入，設定後務必重新建置。',
    };
  }

  try {
    const url = `${OTM_BASE}/geoname?name=Bangkok&apikey=${encodeURIComponent(key)}`;
    const res = await fetchWithTimeout(url, adaptiveTimeout(6000));
    if (res.status === 401 || res.status === 403) {
      return {
        status: 'invalid',
        source,
        message: '偵測到 OpenTripMap 金鑰，但 API 回報金鑰無效或未獲授權。',
        hint: '請至 opentripmap.io 確認金鑰是否正確、是否已啟用，並檢查是否有複製到多餘空白字元。',
      };
    }
    if (!res.ok) {
      return {
        status: 'network',
        source,
        message: `OpenTripMap 回應狀態 ${res.status}，暫時無法確認金鑰是否生效。`,
        hint: '可能為服務暫時不穩或達到頻率限制，請稍後再試。',
      };
    }
    return {
      status: 'ok',
      source,
      message: `OpenTripMap 金鑰生效中（來源：${source === 'env' ? '環境變數' : '本機設定'}）。`,
      hint: '行程將以即時 POI 資料生成。',
    };
  } catch {
    return {
      status: 'network',
      source,
      message: '無法連線至 OpenTripMap 以驗證金鑰（網路或逾時）。',
      hint: '請確認網路連線後再試；若問題持續，行程將自動退回內建範本。',
    };
  }
}

/**
 * 超時機制：搭配 adaptiveTimeout 使用，網路正常時給足裕度、弱網再放寬，
 * 並由 PAC 的指數退避重試（1s → 2s → 4s）補強，盡量讓即時資料成功取得。
 */
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * 解析城市中心座標，優先序（全球化）：
 *   1. survey 已帶的座標（最準）
 *   2. 全球地理編碼器 geocodeDestination（內建字典 → Geoapify → Nominatim，多語、全球）
 *   3. OTM geoname（英文端點，最後退路）
 * 帶入 country 以消除同名城市歧義（如「芭達雅」vs 台中「大雅」）。
 */
async function resolveCenter(
  destName: string,
  lat: number | undefined,
  lon: number | undefined,
  apiKey: string | null,
  country?: string,
  locale?: string
): Promise<{ lat: number; lon: number } | null> {
  if (typeof lat === 'number' && typeof lon === 'number' && lat !== 0 && lon !== 0) {
    return { lat, lon };
  }
  // 全球地理編碼（內建字典優先，再 Geoapify/Nominatim）：適用任意國家城市與任意語系名稱。
  const geo = await geocodeDestination(destName, country, locale || 'en');
  if (geo) return geo;

  // 最後退路：OTM geoname（英文端點，對次級城市常 NOT_FOUND）。無 OTM 金鑰則略過。
  if (!apiKey) return null;
  try {
    const url = `${OTM_BASE}/geoname?name=${encodeURIComponent(destName)}&apikey=${apiKey}`;
    const res = await fetchWithTimeout(url, adaptiveTimeout(6000));
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.lat === 'number' && typeof data?.lon === 'number') {
      return { lat: data.lat, lon: data.lon };
    }
    logger.warn(`geoname 無法解析「${destName}」（${data?.status || 'NO_COORDS'}）。`);
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
  /** App 語系，供地理編碼與 Wikipedia GeoSearch 後援選擇語言（預設 en）。 */
  locale?: string;
  /** 國家名稱（使用者語系），供地理編碼消除同名城市歧義。 */
  country?: string;
}

/**
 * 將 Wikipedia GeoSearch 結果轉為 POI[]（P1 後援來源）。
 * 當主來源 OpenTripMap 失敗或查無景點時呼叫，確保網路存在即有即時景點可用。
 */
async function fetchPOIsViaWikipedia(
  center: { lat: number; lon: number },
  locale: string,
  radiusMeters: number,
  limit: number
): Promise<POI[]> {
  const places = await fetchWikipediaGeoSearch(center.lat, center.lon, locale, radiusMeters, limit);
  if (!places.length) return [];
  logger.info(`改用 Wikipedia GeoSearch 後援取得 ${places.length} 個鄰近條目作為即時 POI。`);
  return places
    .sort((a, b) => a.dist - b.dist)
    .map((p): POI => ({
      xid: `wiki_${p.pageid}`,
      name: p.title,
      localName: p.title,
      lat: p.lat,
      lon: p.lon,
      kinds: '',
      rate: 1,
      category: 'other',
    }));
}

/**
 * 取得指定目的地的 POI 清單（依興趣過濾、依熱門度排序）。
 *
 * 來源優先序（P0/P1）：
 *   1. 14 天快取
 *   2. OpenTripMap radius（需金鑰）
 *   3. Wikipedia GeoSearch 後援（免金鑰）—— 當 OTM 硬失敗或查無景點時自動改用，
 *      只要有中心座標（本地字典或 geoname）即可取得即時鄰近地標。
 *   4. 皆無 → 由呼叫端退回內建靜態範本
 *
 * 重要語意（供呼叫端區分「連線降級」與「該地真的沒景點」）：
 * - **硬失敗**（座標解析失敗 GEOCODE_FAILED／無金鑰 OTM_NO_KEY／金鑰無效 OTM_INVALID_KEY／
 *   HTTP OTM_HTTP_xxx／限流 OTM_RATE_LIMITED／網路逾時 OTM_NETWORK_FAILED）且
 *   **Wikipedia 後援也拿不到** 時才 **throw**，讓 PAC 重試、呼叫端據此標記降級。
 * - **任一來源成功但查無景點**（真實的空結果）才回傳空陣列 `[]`，此情況使用內建範本
 *   屬合理，不應視為降級。
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
        recordAPIMetric('fetchDestinationPOIs', 0, true, 1, true);
        return cached.pois as POI[];
      }
    }
  } catch { /* ignore cache errors */ }

  const apiKey = await resolveApiKey();
  const wikiLocale = opts.locale || 'en';
  const persist = async (pois: POI[]) => {
    try { await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), pois })); } catch { /* ignore */ }
  };

  // 中心座標：以全球地理編碼解析（不依賴 OTM 金鑰），帶 country 消歧義。
  const center = await resolveCenter(destName, lat, lon, apiKey, opts.country, opts.locale);
  if (!center) {
    // 連座標都解析不到（地理編碼全失敗，多為網路問題）：拋錯讓 PAC 重試/標記降級。
    logger.warn(`無法解析「${destName}」的中心座標。`);
    throw new Error('GEOCODE_FAILED');
  }

  // 無 OTM 金鑰時不直接放棄：改走免金鑰的 Wikipedia GeoSearch，仍能取得即時 POI。
  // 唯有連 Wikipedia 也拿不到才拋 OTM_NO_KEY（不可重試），由呼叫端標記降級並引導設定。
  if (!apiKey) {
    logger.warn('無 OpenTripMap 金鑰，改用 Wikipedia GeoSearch 取得即時 POI。');
    try {
      const wikiPois = await fetchPOIsViaWikipedia(center, wikiLocale, radiusMeters, limit);
      if (wikiPois.length > 0) {
        await persist(wikiPois);
      }
      return wikiPois; // 返回結果（即使是空陣列也不拋錯，代表查無景點）
    } catch (wikiErr) {
      logger.warn('Wikipedia 後援亦失敗。', wikiErr);
      throw new Error('OTM_NO_KEY');
    }
  }

  const apiStart = Date.now();
  try {
    const url = `${OTM_BASE}/radius?radius=${radiusMeters}&lon=${center.lon}&lat=${center.lat}`
      + `&kinds=${encodeURIComponent(kindsParam)}&rate=2&format=json&limit=${limit}&apikey=${apiKey}`;
    const res = await fetchWithTimeout(url, adaptiveTimeout(8000));
    if (!res.ok) {
      logger.warn(`OpenTripMap radius 回傳 ${res.status}。`);
      recordAPIMetric('fetchDestinationPOIs', Date.now() - apiStart, false, 1, false);
      // P3：金鑰無效/未授權屬不可重試；限流與其他狀態歸類為可重試的 HTTP 失敗。
      if (res.status === 401 || res.status === 403) throw new Error('OTM_INVALID_KEY');
      if (res.status === 429) throw new Error('OTM_RATE_LIMITED');
      throw new Error(`OTM_HTTP_${res.status}`);
    }
    const raw = await res.json();

    const seen = new Set<string>();
    const pois: POI[] = (Array.isArray(raw) ? raw : [])
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

    recordAPIMetric('fetchDestinationPOIs', Date.now() - apiStart, true, 1, false);

    if (pois.length > 0) {
      await persist(pois);
      return pois;
    }

    // OTM 成功但查無景點：先試 Wikipedia 後援（可能有 OTM 分類外的鄰近地標），仍無才視為真空結果。
    const wikiPois = await fetchPOIsViaWikipedia(center, wikiLocale, radiusMeters, limit);
    if (wikiPois.length > 0) {
      await persist(wikiPois);
      return wikiPois;
    }
    return [];
  } catch (e: any) {
    logger.warn('OpenTripMap 查詢失敗，嘗試 Wikipedia 後援。', e);
    recordAPIMetric('fetchDestinationPOIs', Date.now() - apiStart, false, 1, false);

    // P1：主來源硬失敗時，只要有中心座標就改用免金鑰的 Wikipedia GeoSearch，盡量保住即時資料。
    try {
      const wikiPois = await fetchPOIsViaWikipedia(center, wikiLocale, radiusMeters, limit);
      if (wikiPois.length > 0) {
        await persist(wikiPois);
        return wikiPois;
      }
    } catch (wikiErr) {
      logger.warn('Wikipedia 後援亦失敗。', wikiErr);
    }

    // 後援也拿不到 —— 拋出具語意的失敗碼，呼叫端據此標記降級。
    if (typeof e?.message === 'string' && e.message.startsWith('OTM_')) throw e;
    throw new Error('OTM_NETWORK_FAILED');
  }
}
