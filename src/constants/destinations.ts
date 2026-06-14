export interface SuggestedDestination {
  name: string;
  country: string;
  name_en: string;
  name_zh_tw: string;
  name_zh_cn: string;
  country_en: string;
  country_zh_tw: string;
  country_zh_cn: string;
  latitude: number;
  longitude: number;
}

export const SUGGESTED_DESTINATIONS: SuggestedDestination[] = [
  // Taiwan
  {
    name: '台北',
    country: '台灣',
    name_en: 'Taipei',
    name_zh_tw: '台北',
    name_zh_cn: '台北',
    country_en: 'Taiwan',
    country_zh_tw: '台灣',
    country_zh_cn: '台湾',
    latitude: 25.0330,
    longitude: 121.5654
  },
  {
    name: '高雄',
    country: '台灣',
    name_en: 'Kaohsiung',
    name_zh_tw: '高雄',
    name_zh_cn: '高雄',
    country_en: 'Taiwan',
    country_zh_tw: '台灣',
    country_zh_cn: '台湾',
    latitude: 22.6273,
    longitude: 120.3014
  },
  // Japan
  {
    name: '東京',
    country: '日本',
    name_en: 'Tokyo',
    name_zh_tw: '東京',
    name_zh_cn: '东京',
    country_en: 'Japan',
    country_zh_tw: '日本',
    country_zh_cn: '日本',
    latitude: 35.6762,
    longitude: 139.6503
  },
  {
    name: '京都',
    country: '日本',
    name_en: 'Kyoto',
    name_zh_tw: '京都',
    name_zh_cn: '京都',
    country_en: 'Japan',
    country_zh_tw: '日本',
    country_zh_cn: '日本',
    latitude: 35.0116,
    longitude: 135.7681
  },
  {
    name: '大阪',
    country: '日本',
    name_en: 'Osaka',
    name_zh_tw: '大阪',
    name_zh_cn: '大阪',
    country_en: 'Japan',
    country_zh_tw: '日本',
    country_zh_cn: '日本',
    latitude: 34.6937,
    longitude: 135.5023
  },
  {
    name: '北海道',
    country: '日本',
    name_en: 'Hokkaido',
    name_zh_tw: '北海道',
    name_zh_cn: '北海道',
    country_en: 'Japan',
    country_zh_tw: '日本',
    country_zh_cn: '日本',
    latitude: 43.0641,
    longitude: 141.3469
  },
  {
    name: '沖繩',
    country: '日本',
    name_en: 'Okinawa',
    name_zh_tw: '沖繩',
    name_zh_cn: '冲绳',
    country_en: 'Japan',
    country_zh_tw: '日本',
    country_zh_cn: '日本',
    latitude: 26.2124,
    longitude: 127.6809
  },
  // South Korea
  {
    name: '首爾',
    country: '韓國',
    name_en: 'Seoul',
    name_zh_tw: '首爾',
    name_zh_cn: '首尔',
    country_en: 'South Korea',
    country_zh_tw: '韓國',
    country_zh_cn: '韩国',
    latitude: 37.5665,
    longitude: 126.9780
  },
  {
    name: '釜山',
    country: '韓國',
    name_en: 'Busan',
    name_zh_tw: '釜山',
    name_zh_cn: '釜山',
    country_en: 'South Korea',
    country_zh_tw: '韓國',
    country_zh_cn: '韩国',
    latitude: 35.1796,
    longitude: 129.0756
  },
  {
    name: '濟州島',
    country: '韓國',
    name_en: 'Jeju Island',
    name_zh_tw: '濟州島',
    name_zh_cn: '济州岛',
    country_en: 'South Korea',
    country_zh_tw: '韓國',
    country_zh_cn: '韩国',
    latitude: 33.4996,
    longitude: 126.5312
  },
  // Thailand
  {
    name: '曼谷',
    country: '泰國',
    name_en: 'Bangkok',
    name_zh_tw: '曼谷',
    name_zh_cn: '曼谷',
    country_en: 'Thailand',
    country_zh_tw: '泰國',
    country_zh_cn: '泰国',
    latitude: 13.7563,
    longitude: 100.5018
  },
  {
    name: '清邁',
    country: '泰國',
    name_en: 'Chiang Mai',
    name_zh_tw: '清邁',
    name_zh_cn: '清迈',
    country_en: 'Thailand',
    country_zh_tw: '泰國',
    country_zh_cn: '泰国',
    latitude: 18.7883,
    longitude: 98.9853
  },
  {
    name: '普吉島',
    country: '泰國',
    name_en: 'Phuket',
    name_zh_tw: '普吉島',
    name_zh_cn: '普吉岛',
    country_en: 'Thailand',
    country_zh_tw: '泰國',
    country_zh_cn: '泰国',
    latitude: 7.8804,
    longitude: 98.3923
  },
  {
    name: '芭達雅',
    country: '泰國',
    name_en: 'Pattaya',
    name_zh_tw: '芭達雅',
    name_zh_cn: '芭提雅',
    country_en: 'Thailand',
    country_zh_tw: '泰國',
    country_zh_cn: '泰国',
    latitude: 12.9236,
    longitude: 100.8824
  },
  {
    name: '羅勇',
    country: '泰國',
    name_en: 'Rayong',
    name_zh_tw: '羅勇',
    name_zh_cn: '罗勇',
    country_en: 'Thailand',
    country_zh_tw: '泰國',
    country_zh_cn: '泰国',
    latitude: 12.6817,
    longitude: 101.2813
  },
  // Vietnam
  {
    name: '胡志明市',
    country: '越南',
    name_en: 'Ho Chi Minh City',
    name_zh_tw: '胡志明市',
    name_zh_cn: '胡志明市',
    country_en: 'Vietnam',
    country_zh_tw: '越南',
    country_zh_cn: '越南',
    latitude: 10.8231,
    longitude: 106.6297
  },
  {
    name: '河內',
    country: '越南',
    name_en: 'Hanoi',
    name_zh_tw: '河內',
    name_zh_cn: '河内',
    country_en: 'Vietnam',
    country_zh_tw: '越南',
    country_zh_cn: '越南',
    latitude: 21.0285,
    longitude: 105.8542
  },
  {
    name: '峴港',
    country: '越南',
    name_en: 'Da Nang',
    name_zh_tw: '峴港',
    name_zh_cn: '岘港',
    country_en: 'Vietnam',
    country_zh_tw: '越南',
    country_zh_cn: '越南',
    latitude: 16.0544,
    longitude: 108.2022
  },
  // Singapore
  {
    name: '新加坡',
    country: '新加坡',
    name_en: 'Singapore',
    name_zh_tw: '新加坡',
    name_zh_cn: '新加坡',
    country_en: 'Singapore',
    country_zh_tw: '新加坡',
    country_zh_cn: '新加坡',
    latitude: 1.3521,
    longitude: 103.8198
  },
  // Malaysia
  {
    name: '吉隆坡',
    country: '馬來西亞',
    name_en: 'Kuala Lumpur',
    name_zh_tw: '吉隆坡',
    name_zh_cn: '吉隆坡',
    country_en: 'Malaysia',
    country_zh_tw: '馬來西亞',
    country_zh_cn: '马来西亚',
    latitude: 3.1390,
    longitude: 101.6869
  },
  {
    name: '檳城',
    country: '馬來西亞',
    name_en: 'Penang',
    name_zh_tw: '檳城',
    name_zh_cn: '槟城',
    country_en: 'Malaysia',
    country_zh_tw: '馬來西亞',
    country_zh_cn: '马来西亚',
    latitude: 5.4141,
    longitude: 100.3288
  },
  // Hong Kong / Macau
  {
    name: '香港',
    country: '香港',
    name_en: 'Hong Kong',
    name_zh_tw: '香港',
    name_zh_cn: '香港',
    country_en: 'Hong Kong',
    country_zh_tw: '香港',
    country_zh_cn: '香港',
    latitude: 22.3193,
    longitude: 114.1694
  },
  {
    name: '澳門',
    country: '澳門',
    name_en: 'Macau',
    name_zh_tw: '澳門',
    name_zh_cn: '澳门',
    country_en: 'Macau',
    country_zh_tw: '澳門',
    country_zh_cn: '澳门',
    latitude: 22.1987,
    longitude: 113.5439
  },
  // Australia
  {
    name: '雪梨',
    country: '澳洲',
    name_en: 'Sydney',
    name_zh_tw: '雪梨',
    name_zh_cn: '悉尼',
    country_en: 'Australia',
    country_zh_tw: '澳洲',
    country_zh_cn: '澳大利亚',
    latitude: -33.8688,
    longitude: 151.2093
  },
  {
    name: '墨爾本',
    country: '澳洲',
    name_en: 'Melbourne',
    name_zh_tw: '墨爾本',
    name_zh_cn: '墨尔本',
    country_en: 'Australia',
    country_zh_tw: '澳洲',
    country_zh_cn: '澳大利亚',
    latitude: -37.8136,
    longitude: 144.9631
  },
  // Europe
  {
    name: '巴黎',
    country: '法國',
    name_en: 'Paris',
    name_zh_tw: '巴黎',
    name_zh_cn: '巴黎',
    country_en: 'France',
    country_zh_tw: '法國',
    country_zh_cn: '法国',
    latitude: 48.8566,
    longitude: 2.3522
  },
  {
    name: '倫敦',
    country: '英國',
    name_en: 'London',
    name_zh_tw: '倫敦',
    name_zh_cn: '伦敦',
    country_en: 'United Kingdom',
    country_zh_tw: '英國',
    country_zh_cn: '英国',
    latitude: 51.5074,
    longitude: -0.1278
  },
  {
    name: '羅馬',
    country: '義大利',
    name_en: 'Rome',
    name_zh_tw: '羅馬',
    name_zh_cn: '罗马',
    country_en: 'Italy',
    country_zh_tw: '義大利',
    country_zh_cn: '意大利',
    latitude: 41.9028,
    longitude: 12.4964
  },
  {
    name: '巴塞隆納',
    country: '西班牙',
    name_en: 'Barcelona',
    name_zh_tw: '巴塞隆納',
    name_zh_cn: '巴塞罗那',
    country_en: 'Spain',
    country_zh_tw: '西班牙',
    country_zh_cn: '西班牙',
    latitude: 41.3851,
    longitude: 2.1734
  },
  // North America
  {
    name: '紐約',
    country: '美國',
    name_en: 'New York',
    name_zh_tw: '紐約',
    name_zh_cn: '纽约',
    country_en: 'United States',
    country_zh_tw: '美國',
    country_zh_cn: '美国',
    latitude: 40.7128,
    longitude: -74.0060
  },
  {
    name: '洛杉磯',
    country: '美國',
    name_en: 'Los Angeles',
    name_zh_tw: '洛杉磯',
    name_zh_cn: '洛杉矶',
    country_en: 'United States',
    country_zh_tw: '美國',
    country_zh_cn: '美国',
    latitude: 34.0522,
    longitude: -118.2437
  }
];

/**
 * 城市名稱正規化（P2）：去空白、轉小寫、去除常見行政後綴，
 * 以利跨語系與「市/縣/都/府」等寫法的比對。
 */
function normalizeCityName(s: string): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(市|縣|县|区|區|都|府|県|省|州|city)$/u, '');
}

/**
 * 由任意語系城市名查本地座標字典（P0/P2）。
 * 命中回 { lat, lon }，否則回 null。供 resolveCenter 在呼叫 geoname 前優先使用，
 * 讓常見目的地（含 geoname 解析不到的次級城市，如芭達雅/羅勇）免依賴線上地理編碼。
 */
export function resolveLocalCityCoords(name: string): { lat: number; lon: number } | null {
  if (!name) return null;
  const n = normalizeCityName(name);
  if (!n) return null;
  // 第一輪：正規化後完全相等
  for (const d of SUGGESTED_DESTINATIONS) {
    const variants = [d.name, d.name_en, d.name_zh_tw, d.name_zh_cn].map(normalizeCityName);
    if (variants.some(v => v && v === n)) {
      return { lat: d.latitude, lon: d.longitude };
    }
  }
  // 第二輪：包含關係（如「東京都」⊇「東京」），限長度 ≥ 2 以避免短字誤判
  if (n.length >= 2) {
    for (const d of SUGGESTED_DESTINATIONS) {
      const variants = [d.name, d.name_en, d.name_zh_tw, d.name_zh_cn].map(normalizeCityName);
      if (variants.some(v => v && v.length >= 2 && (v.includes(n) || n.includes(v)))) {
        return { lat: d.latitude, lon: d.longitude };
      }
    }
  }
  return null;
}
