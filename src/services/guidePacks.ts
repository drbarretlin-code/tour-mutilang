/**
 * 離線指南範本（GuideInfo）涵蓋範圍與下載機制。
 *
 * - COVERED_GUIDE_COUNTRIES：已內建於 App 的離線指南範本（getFallbackGuideInfo）。
 * - DOWNLOADABLE_GUIDE_COUNTRIES：可由使用者於目的地指南頁主動下載的額外國家範本，
 *   下載後會快取於本機（AsyncStorage/localStorage），離線狀態下可直接使用。
 *
 * 下載機制採用超時與快取策略：
 * - 超時：5 秒（防止網路無限等待）
 * - 快取：7 天 TTL（AsyncStorage/@guide_pack_cache_{key}）
 * - 重試：由呼叫端使用 PAC 的 executeWithHealing 提供指數退避重試
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from './logger';

const logger = createLogger('guidePack');

export interface GuideCountryOption {
  key: string;
  label: string;
}

const GUIDE_PACK_CACHE_PREFIX = '@guide_pack_cache_';
const GUIDE_PACK_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天

export const COVERED_GUIDE_COUNTRIES: GuideCountryOption[] = [
  { key: 'japan', label: '日本' },
  { key: 'korea', label: '韓國' },
  { key: 'vietnam', label: '越南' },
  { key: 'taiwan', label: '台灣' },
  { key: 'singapore', label: '新加坡' },
  { key: 'thailand', label: '泰國' },
];

export const DOWNLOADABLE_GUIDE_COUNTRIES: GuideCountryOption[] = [
  { key: 'usa', label: '美國' },
  { key: 'uk', label: '英國' },
  { key: 'france', label: '法國' },
  { key: 'italy', label: '義大利' },
  { key: 'australia', label: '澳洲' },
  { key: 'china', label: '中國' },
  { key: 'hongkong', label: '香港' },
  { key: 'malaysia', label: '馬來西亞' },
];

/** 各國關鍵字（含中英文與常見城市名），用於由目的地名稱判斷對應的指南範本 key */
const COUNTRY_KEYWORDS: Record<string, string[]> = {
  japan: ['日', 'japan', 'tokyo', '東京', '大阪', '京都', '北海道', '沖繩'],
  korea: ['韓', 'korea', 'seoul', '首爾', '釜山'],
  vietnam: ['越', 'viet', 'hanoi', '河內', '胡志明'],
  taiwan: ['台', '臺', 'taiwan', 'taipei', '台北'],
  singapore: ['新加坡', 'singapore'],
  thailand: ['泰', 'thai', 'bangkok', '曼谷', '清邁', '芭達雅'],
  usa: ['美國', '美国', 'usa', 'united states', 'america', '紐約', 'new york', '洛杉磯', 'los angeles', '舊金山', 'san francisco'],
  uk: ['英國', '英国', 'uk', 'united kingdom', 'england', '倫敦', 'london'],
  france: ['法國', '法国', 'france', '巴黎', 'paris'],
  italy: ['義大利', '意大利', 'italy', '羅馬', 'rome', '威尼斯', 'venice', '米蘭', 'milan'],
  australia: ['澳洲', '澳大利亞', 'australia', '雪梨', 'sydney', '墨爾本', 'melbourne'],
  china: ['中國', '中国', 'china', '北京', 'beijing', '上海', 'shanghai', '廣州', '广州'],
  hongkong: ['香港', 'hong kong'],
  malaysia: ['馬來西亞', '马来西亚', 'malaysia', '吉隆坡', 'kuala lumpur'],
};

/** 由目的地名稱（任意語系）判斷對應的指南範本 key；找不到時回傳 null */
export function detectGuideCountryKey(country: string): string | null {
  const normalized = (country || '').toLowerCase();
  for (const [key, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
    if (keywords.some(kw => normalized.includes(kw.toLowerCase()))) {
      return key;
    }
  }
  return null;
}

export function isCoveredGuideCountry(key: string | null): boolean {
  return !!key && COVERED_GUIDE_COUNTRIES.some(c => c.key === key);
}

export function getDownloadableGuideCountry(key: string | null): GuideCountryOption | undefined {
  return DOWNLOADABLE_GUIDE_COUNTRIES.find(c => c.key === key);
}

/**
 * 額外指南範本的下載來源。可透過環境變數覆寫，預設指向本專案的靜態資源託管位置。
 * 範本格式需與 getFallbackGuideInfo 回傳值相同：
 * { currencyCode, currencyName, emergencyContacts[], usefulPhrases[], guideItems[] }
 */
export const GUIDE_PACK_BASE_URL =
  process.env.EXPO_PUBLIC_GUIDE_PACK_BASE_URL || 'https://raw.githubusercontent.com/tour-mutilang/guide-packs/main';

/**
 * 超時機制：5 秒
 * 快取：AsyncStorage，7 天 TTL
 * 重試：由呼叫端使用 PAC 的 executeWithHealing 提供
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

interface FetchGuidePackOptions {
  timeoutMs?: number;
  useCache?: boolean;
}

/** 下載指定國家的離線指南範本（支援超時與快取）。重試由呼叫端透過 PAC 的 executeWithHealing 提供 */
export async function fetchGuidePack(key: string, options: FetchGuidePackOptions = {}): Promise<any> {
  const { timeoutMs = 5000, useCache = true } = options;
  const cacheKey = `${GUIDE_PACK_CACHE_PREFIX}${key}`;

  // 嘗試讀取快取
  if (useCache) {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.ts && Date.now() - parsed.ts < GUIDE_PACK_CACHE_TTL_MS) {
          return parsed.data;
        }
      }
    } catch { /* 忽略快取讀取錯誤 */ }
  }

  // 從線上資源下載
  const res = await fetchWithTimeout(`${GUIDE_PACK_BASE_URL}/${key}.json`, timeoutMs);
  if (!res.ok) {
    throw new Error('GUIDE_PACK_NOT_FOUND');
  }
  const data = await res.json();
  if (!data || !data.currencyCode || !Array.isArray(data.emergencyContacts) || !Array.isArray(data.usefulPhrases)) {
    throw new Error('GUIDE_PACK_INVALID');
  }

  // 寫入快取
  if (useCache) {
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
    } catch { /* 忽略快取寫入錯誤 */ }
  }

  return data;
}

const COUNTRY_NAME_TO_KEY: Record<string, string> = {
  '印度': 'india', 'india': 'india', 'インド': 'india', '인도': 'india',
  '印尼': 'indonesia', '印度尼西亞': 'indonesia', 'indonesia': 'indonesia',
  '土耳其': 'turkey', 'turkey': 'turkey', 'türkiye': 'turkey',
  '埃及': 'egypt', 'egypt': 'egypt',
  '希臘': 'greece', '希腊': 'greece', 'greece': 'greece',
  '西班牙': 'spain', 'spain': 'spain', 'españa': 'spain',
  '葡萄牙': 'portugal', 'portugal': 'portugal',
  '德國': 'germany', '德国': 'germany', 'germany': 'germany',
  '荷蘭': 'netherlands', '荷兰': 'netherlands', 'netherlands': 'netherlands',
  '瑞士': 'switzerland', 'switzerland': 'switzerland',
  '奧地利': 'austria', '奥地利': 'austria', 'austria': 'austria',
  '加拿大': 'canada', 'canada': 'canada',
  '墨西哥': 'mexico', 'mexico': 'mexico', 'méxico': 'mexico',
  '巴西': 'brazil', 'brazil': 'brazil', 'brasil': 'brazil',
  '紐西蘭': 'newzealand', '新西蘭': 'newzealand', 'new zealand': 'newzealand',
  '菲律賓': 'philippines', '菲律宾': 'philippines', 'philippines': 'philippines',
  '柬埔寨': 'cambodia', 'cambodia': 'cambodia',
  '緬甸': 'myanmar', 'myanmar': 'myanmar',
  '寮國': 'laos', '老挝': 'laos', 'laos': 'laos',
  '斯里蘭卡': 'srilanka', 'sri lanka': 'srilanka',
  '尼泊爾': 'nepal', 'nepal': 'nepal',
  '摩洛哥': 'morocco', 'morocco': 'morocco',
  '南非': 'southafrica', 'south africa': 'southafrica',
  '俄羅斯': 'russia', 'rossiya': 'russia', 'russia': 'russia', '俄罗斯': 'russia',
  '克羅埃西亞': 'croatia', 'croatia': 'croatia',
  '捷克': 'czechia', 'czech': 'czechia', 'czechia': 'czechia',
  '匈牙利': 'hungary', 'hungary': 'hungary',
  '波蘭': 'poland', '波兰': 'poland', 'poland': 'poland',
  '瑞典': 'sweden', 'sweden': 'sweden',
  '挪威': 'norway', 'norway': 'norway',
  '芬蘭': 'finland', '芬兰': 'finland', 'finland': 'finland',
  '丹麥': 'denmark', '丹麦': 'denmark', 'denmark': 'denmark',
  '冰島': 'iceland', 'iceland': 'iceland',
  '阿聯酋': 'uae', '阿联酋': 'uae', 'uae': 'uae', 'united arab emirates': 'uae',
  '杜拜': 'uae', 'dubai': 'uae',
  '以色列': 'israel', 'israel': 'israel',
  '約旦': 'jordan', 'jordan': 'jordan',
  '秘魯': 'peru', 'peru': 'peru', 'perú': 'peru',
  '阿根廷': 'argentina', 'argentina': 'argentina',
  '智利': 'chile', 'chile': 'chile',
  '哥倫比亞': 'colombia', 'colombia': 'colombia',
  '古巴': 'cuba', 'cuba': 'cuba',
};

/** Converts arbitrary country names to lowercase key suitable for guide packs. */
export function normalizeCountryKey(country: string): string | null {
  if (!country) return null;
  
  // 1) Try existing detectGuideCountryKey
  const detected = detectGuideCountryKey(country);
  if (detected) return detected;

  const normalized = country.toLowerCase().trim();

  // 2) Try direct mapping lookup
  if (COUNTRY_NAME_TO_KEY[normalized]) {
    return COUNTRY_NAME_TO_KEY[normalized];
  }

  // 3) Try extracting words (for multi-word inputs like "Republic of India")
  const words = normalized.replace(/[^a-z\s]/g, '').split(/\s+/);
  for (const w of words) {
    if (w && COUNTRY_NAME_TO_KEY[w]) {
      return COUNTRY_NAME_TO_KEY[w];
    }
    if (w && Object.values(COUNTRY_NAME_TO_KEY).includes(w)) {
      return w;
    }
  }

  return null;
}

/** Try to download unlisted guide pack directly from base URL */
export async function tryFetchUnlistedGuidePack(key: string, options: FetchGuidePackOptions = {}): Promise<any> {
  return fetchGuidePack(key, options);
}

