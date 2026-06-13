/**
 * 離線指南範本（GuideInfo）涵蓋範圍與下載機制。
 *
 * - COVERED_GUIDE_COUNTRIES：已內建於 App 的離線指南範本（getFallbackGuideInfo）。
 * - DOWNLOADABLE_GUIDE_COUNTRIES：可由使用者於目的地指南頁主動下載的額外國家範本，
 *   下載後會快取於本機（AsyncStorage/localStorage），離線狀態下可直接使用。
 */

export interface GuideCountryOption {
  key: string;
  label: string;
}

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

/** 下載指定國家的離線指南範本（呼叫端負責快取與錯誤提示） */
export async function fetchGuidePack(key: string): Promise<any> {
  const res = await fetch(`${GUIDE_PACK_BASE_URL}/${key}.json`);
  if (!res.ok) {
    throw new Error('GUIDE_PACK_NOT_FOUND');
  }
  const data = await res.json();
  if (!data || !data.currencyCode || !Array.isArray(data.emergencyContacts) || !Array.isArray(data.usefulPhrases)) {
    throw new Error('GUIDE_PACK_INVALID');
  }
  return data;
}
