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

/** 依座標及名稱比對，尋找內建資料庫中的中文化/在地化名稱 */
export function findLocalizedName(poiName: string, lat: number, lon: number, locale: string): { title?: string; localTitle?: string } {
  const lowerName = (poiName || '').toLowerCase();
  
  // 1. 優先透過座標比對 (經緯度差值小於 0.005，約 500 公尺)
  for (const d of DATA.destinations) {
    // 檢查景點
    for (const a of d.attractions) {
      const latDiff = Math.abs(a.lat - lat);
      const lonDiff = Math.abs(a.lon - lon);
      if (latDiff < 0.005 && lonDiff < 0.005) {
        return {
          title: pickText(a.title, locale),
          localTitle: a.localTitle
        };
      }
    }
    // 檢查餐廳
    for (const r of d.restaurants) {
      const latDiff = Math.abs(r.lat - lat);
      const lonDiff = Math.abs(r.lon - lon);
      if (latDiff < 0.005 && lonDiff < 0.005) {
        return {
          title: pickText(r.title, locale),
          localTitle: r.localTitle
        };
      }
    }
  }

  // 2. 次要透過文字名稱比對
  for (const d of DATA.destinations) {
    for (const a of d.attractions) {
      const enTitle = (a.title.en || '').toLowerCase();
      const twTitle = (a.title['zh-TW'] || '').toLowerCase();
      const cnTitle = (a.title['zh-CN'] || '').toLowerCase();
      const locTitle = (a.localTitle || '').toLowerCase();
      
      if (
        (enTitle && (lowerName.includes(enTitle) || enTitle.includes(lowerName))) ||
        (twTitle && (lowerName.includes(twTitle) || twTitle.includes(lowerName))) ||
        (cnTitle && (lowerName.includes(cnTitle) || cnTitle.includes(lowerName))) ||
        (locTitle && (lowerName.includes(locTitle) || locTitle.includes(lowerName)))
      ) {
        return {
          title: pickText(a.title, locale),
          localTitle: a.localTitle
        };
      }
    }
    for (const r of d.restaurants) {
      const enTitle = (r.title.en || '').toLowerCase();
      const twTitle = (r.title['zh-TW'] || '').toLowerCase();
      const cnTitle = (r.title['zh-CN'] || '').toLowerCase();
      const locTitle = (r.localTitle || '').toLowerCase();
      
      if (
        (enTitle && (lowerName.includes(enTitle) || enTitle.includes(lowerName))) ||
        (twTitle && (lowerName.includes(twTitle) || twTitle.includes(lowerName))) ||
        (cnTitle && (lowerName.includes(cnTitle) || cnTitle.includes(lowerName))) ||
        (locTitle && (lowerName.includes(locTitle) || locTitle.includes(lowerName)))
      ) {
        return {
          title: pickText(r.title, locale),
          localTitle: r.localTitle
        };
      }
    }
  }

  return {};
}

