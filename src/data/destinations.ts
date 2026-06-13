import destinationsJson from './destinations.json';

/**
 * 內建目的地範本載入器。
 *
 * 資料來源為 [destinations.json](./destinations.json)，與行程引擎邏輯解耦：
 * 新增/維護離線備援目的地只需編輯該 JSON，無需改動程式碼。
 */

interface LocalizedText {
  'zh-TW'?: string;
  'zh-CN'?: string;
  en: string;
  [key: string]: string | undefined;
}

interface RawAttraction {
  localTitle: string;
  lat: number;
  lon: number;
  title: LocalizedText;
  desc: LocalizedText;
}

interface RawRestaurant {
  localTitle: string;
  lat: number;
  lon: number;
  cost: number;
  title: LocalizedText;
  desc: LocalizedText;
}

interface RawDestination {
  keywords: string[];
  isDefault?: boolean;
  images: string[];
  attractions: RawAttraction[];
  restaurants: RawRestaurant[];
}

const DATA = destinationsJson as unknown as { destinations: RawDestination[] };

/** 依語系挑選文字，缺值時退回英文。 */
function pickText(text: LocalizedText, locale: string): string {
  return text[locale] || text['en'] || '';
}

/** 依目的地名稱比對關鍵字，找出對應的內建目的地；無匹配時回傳標記為 isDefault 的目的地。 */
function matchDestination(destName: string): RawDestination {
  const lower = (destName || '').toLowerCase();
  for (const d of DATA.destinations) {
    if (d.keywords.some(k => lower.includes(k.toLowerCase()))) return d;
  }
  return DATA.destinations.find(d => d.isDefault) || DATA.destinations[DATA.destinations.length - 1];
}

export interface BuiltInTemplate {
  images: string[];
  titles: string[];
  localTitles: string[];
  descs: string[];
  coords: { lat: number; lon: number }[];
}

/** 取得指定目的地、指定語系的內建景點範本（對齊 getDestTemplates 既有形狀）。 */
export function getBuiltInTemplate(destName: string, locale: string): BuiltInTemplate {
  const d = matchDestination(destName);
  return {
    images: d.images.slice(),
    titles: d.attractions.map(a => pickText(a.title, locale)),
    localTitles: d.attractions.map(a => a.localTitle),
    descs: d.attractions.map(a => pickText(a.desc, locale)),
    coords: d.attractions.map(a => ({ lat: a.lat, lon: a.lon })),
  };
}

export interface BuiltInRestaurant {
  title: string;
  localTitle: string;
  desc: string;
  lat: number;
  lon: number;
  cost: number;
}

/** 取得指定目的地、指定語系的內建餐廳清單。 */
export function getBuiltInRestaurants(destName: string, locale: string): BuiltInRestaurant[] {
  const d = matchDestination(destName);
  return d.restaurants.map(r => ({
    title: pickText(r.title, locale),
    localTitle: r.localTitle,
    desc: pickText(r.desc, locale),
    lat: r.lat,
    lon: r.lon,
    cost: r.cost,
  }));
}
