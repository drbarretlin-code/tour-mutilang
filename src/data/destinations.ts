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

  // 3. 如果資料庫無相符景點，動態套用規則產生部落客風格的接地氣翻譯
  const fallback = translateAndEnhancePoiName(poiName, locale);
  if (fallback.title) {
    return fallback;
  }

  return {};
}

/** 針對無離線備援資料的景點，動態產生符合旅遊部落客/觀光指南風格的接地氣中文名稱 */
function translateAndEnhancePoiName(poiName: string, locale: string): { title?: string; localTitle?: string } {
  const isZh = locale.startsWith('zh');
  const isCn = locale === 'zh-CN';
  if (!isZh) {
    return { title: poiName, localTitle: poiName };
  }

  const nameLower = (poiName || '').toLowerCase().trim();

  // 1. 全球知名熱門景點的對照表 (Blogger 接地氣風格名稱)
  const famousMap: Record<string, { tw: string; cn: string }> = {
    'shinjuku niagara falls': { tw: '新宿尼亞加拉大飛瀑 (都市綠洲芬多精)', cn: '新宿尼亚加拉大飞瀑 (都市绿洲芬多精)' },
    'kyubei sushi at keio plaza hotel': { tw: '東京京王廣場飯店久兵衛壽司 (極致江戶前旬味)', cn: '东京京王广场饭店久兵卫寿司 (极致江户前旬味)' },
    'kyubei sushi': { tw: '久兵衛壽司名店 (極致江戶前旬味)', cn: '久兵卫寿司名店 (极致江户前旬味)' },
    'keio plaza hotel': { tw: '東京京王廣場大飯店 (精選特色住宿)', cn: '东京京王广场大饭店 (精选特色住宿)' },
    'tokyo tower': { tw: '東京鐵塔地標展望', cn: '东京铁塔地标展望' },
    'tokyo skytree': { tw: '東京晴空塔俯瞰市景', cn: '东京晴空塔俯瞰市景' },
    'sensoji': { tw: '淺草寺與雷門江戶風情', cn: '浅草寺与雷门江户风情' },
    'senso-ji': { tw: '淺草寺與雷門江戶風情', cn: '浅草寺与雷门江户风情' },
    'ueno park': { tw: '上野恩賜公園文藝散策', cn: '上野恩赐公园文艺散策' },
    'kinkakuji': { tw: '金閣寺璀璨鏡湖', cn: '金阁寺璀璨镜湖' },
    'fushimi inari': { tw: '伏見稻荷大社千本鳥居', cn: '伏见稻荷大社千本鸟居' },
    'kiyomizudera': { tw: '清水寺清水舞台眺望', cn: '清水寺清水舞台眺望' },
    'kiyomizu-dera': { tw: '清水寺清水舞台眺望', cn: '清水寺清水舞台眺望' },
    'eiffel tower': { tw: '艾菲爾鐵塔浪漫巴黎', cn: '艾菲尔铁塔浪漫巴黎' },
    'louvre': { tw: '羅浮宮藝術殿堂', cn: '罗浮宫艺术殿堂' },
    'versailles': { tw: '凡爾賽宮奢華宮廷', cn: '凡尔赛宫奢华宫廷' },
    'colosseum': { tw: '羅馬競技場歷史見證', cn: '罗马竞技场历史见证' },
    'trevi fountain': { tw: '特萊維噴泉許願朝聖', cn: '特莱维喷泉许愿朝圣' },
    'british museum': { tw: '大英博物館世界寶藏', cn: '大英博物馆世界宝藏' },
    'tower bridge': { tw: '倫敦塔橋泰晤士河畔', cn: '伦敦塔桥泰晤士河畔' },
    'statue of liberty': { tw: '自由女神像美國地標', cn: '自由女神像美国地标' },
    'central park': { tw: '中央公園紐約綠洲', cn: '中央公园纽约绿洲' },
    'times square': { tw: '時報廣場繁華霓虹', cn: '时报广场繁华霓虹' },
    'marina bay sands': { tw: '濱海灣金沙絕美夜景', cn: '滨海湾金沙绝美夜景' },
    'gardens by the bay': { tw: '濱海灣花園未來森林', cn: '滨海湾花园未来森林' },
    'merlion': { tw: '魚尾獅公園新加坡地標', cn: '鱼尾狮公园新加坡地标' },
    'gyeongbokgung': { tw: '景福宮韓服體驗', cn: '景福宫韩服体验' },
    'myeongdong': { tw: '明洞商圈潮流美妝', cn: '明洞商圈潮流美妆' },
    'nami island': { tw: '南怡島浪漫杉林', cn: '南怡岛浪漫杉林' },
    'haebangchon': { tw: '解放村文青散策', cn: '解放村文青散策' },
    'jiufen': { tw: '九份老街山城懷舊', cn: '九份老街山城怀旧' },
    'taipei 101': { tw: '台北101俯瞰高空', cn: '台北101俯瞰高空' },
    'taroko': { tw: '太魯閣國家公園壯麗峽谷', cn: '太鲁阁国家公园壮丽峡谷' },
    'sun moon lake': { tw: '日月潭環湖騎行', cn: '日月潭环湖骑行' },
    'alishan': { tw: '阿里山森林鐵路與日出', cn: '阿里山森林铁路与日出' },
    'angkor wat': { tw: '吳哥窟神祕高棉微笑', cn: '吴哥窟神秘高棉微笑' },
    'halong bay': { tw: '下龍灣海上石林', cn: '下龙湾海上石林' },
    'shilin night market': { tw: '士林夜市美食吃透透', cn: '士林夜市美食吃透透' },
    'raohe night market': { tw: '饒河街夜市胡椒餅朝聖', cn: '饶河街夜市胡椒饼朝圣' },
    'ningxia night market': { tw: '寧夏夜市在地風味', cn: '宁夏夜市在地风味' },
    'shibuya': { tw: '澀谷十字路口潮流探索', cn: '涩谷十字路口潮流探索' },
    'harajuku': { tw: '原宿竹下通潮流發源地', cn: '原宿竹下通潮流发源地' },
    'shinjuku': { tw: '新宿歌舞伎町不夜城', cn: '新宿歌舞伎町不夜城' },
    'odaiba': { tw: '台場鋼彈與絕美夕陽', cn: '台场高达与绝美夕阳' },
    'tsukiji': { tw: '築地場外市場海鮮美食', cn: '筑地场外市场海鲜美食' },
    'don quijote': { tw: '驚安殿堂唐吉訶德購物', cn: '惊安殿堂唐吉诃德购物' },
    'bic camera': { tw: 'Bic Camera 電器狂購', cn: 'Bic Camera 电器狂购' },
    'yodobashi': { tw: '友都八喜電器量販', cn: '友都八喜电器量贩' },
    'jiufen old street': { tw: '九份老街阿妹茶樓懷舊', cn: '九份老街阿妹茶楼怀旧' },
    'shifen': { tw: '十分老街放天燈祈福', cn: '十分老街放天灯祈福' },
    'yehliu': { tw: '野柳地質公園女王頭', cn: '野柳地质公园女王头' },
    'suvarnabhumi': { tw: '蘇凡納布機場', cn: '苏凡纳布机场' },
    'don mueang': { tw: '廊曼國際機場', cn: '廊曼国际机场' },
    'changi airport': { tw: '新加坡樟宜機場', cn: '新加坡樟宜机场' },
    'narita': { tw: '成田國際機場', cn: '成田国际机场' },
    'haneda': { tw: '羽田國際機場', cn: '羽田国际机场' },
    'kansai': { tw: '關西國際機場', cn: '关西国际机场' },
    'incheon': { tw: '仁川國際機場', cn: '仁川国际机场' },
    'gimpo': { tw: '金浦國際機場', cn: '金浦国际机场' },
    'heathrow': { tw: '希斯洛國際機場', cn: '希斯洛国际机场' },
    'john f. kennedy': { tw: '甘迺迪國際機場', cn: '甘迺迪国际机场' },
    'jfk airport': { tw: '甘迺迪國際機場', cn: '甘迺迪国际机场' },
    'charles de gaulle': { tw: '戴高樂國際機場', cn: '戴高乐国际机场' },
    'cdg airport': { tw: '戴高樂國際機場', cn: '戴高乐国际机场' },
    'sydney airport': { tw: '雪梨機場', cn: '雪梨机场' },
    'hong kong airport': { tw: '香港國際機場', cn: '香港国际机场' }
  };

  // 模糊匹配著名景點
  for (const [key, value] of Object.entries(famousMap)) {
    if (nameLower.includes(key)) {
      return {
        title: isCn ? value.cn : value.tw,
        localTitle: poiName
      };
    }
  }

  // 2. 針對字根進行翻譯美化 (Blogger 旅遊指南風格)
  const suffixMap: { en: string; tw: string; cn: string }[] = [
    { en: 'falls', tw: '大飛瀑 (壯麗自然景致)', cn: '大飞瀑 (壮丽自然景致)' },
    { en: 'waterfall', tw: '大飛瀑 (壯麗自然景致)', cn: '大飞瀑 (壮丽自然景致)' },
    { en: 'sushi', tw: '壽司料理名店 (品味在地旬鮮)', cn: '寿司料理名店 (品味当地旬鲜)' },
    { en: 'museum of art', tw: '市立美術館 (藝術美學巡禮)', cn: '市立美术馆 (艺术美学巡礼)' },
    { en: 'national museum', tw: '國家博物館 (文化珍寶探索)', cn: '国家博物馆 (文化珍宝探索)' },
    { en: 'botanical garden', tw: '植物園 (城市綠色芬多精)', cn: '植物园 (城市绿色芬多精)' },
    { en: 'night market', tw: '在地人氣夜市 (小吃尋禮)', cn: '当地人气夜市 (小吃寻礼)' },
    { en: 'shopping mall', tw: '購物中心 (時尚潮流天堂)', cn: '购物中心 (时尚潮流天堂)' },
    { en: 'shopping street', tw: '購物步行街 (特色商圈)', cn: '购物步行街 (特色商圈)' },
    { en: 'department store', tw: '百貨商場 (購物天堂)', cn: '百货商场 (购物天堂)' },
    { en: 'floating market', tw: '水上市場 (在地風情體驗)', cn: '水上市场 (当地风情体验)' },
    { en: 'theme park', tw: '主題樂園 (歡樂冒險世界)', cn: '主题乐园 (欢乐冒险世界)' },
    { en: 'amusement park', tw: '遊樂園 (歡笑不間斷)', cn: '游乐园 (欢笑不间断)' },
    { en: 'national park', tw: '國家公園 (大自然壯麗景致)', cn: '国家公园 (大自然壮丽景致)' },
    { en: 'aquarium', tw: '海洋水族館 (奇幻藍色世界)', cn: '海洋水族馆 (奇幻蓝色世界)' },
    { en: 'museum', tw: '博物館 (知性文藝之旅)', cn: '博物馆 (知性文艺之旅)' },
    { en: 'palace', tw: '古典宮殿 (皇家歷史漫步)', cn: '古典宫殿 (皇家历史漫步)' },
    { en: 'castle', tw: '歷史古城 (壯麗城堡遺跡)', cn: '历史古城 (壮丽城堡遗迹)' },
    { en: 'shrine', tw: '神社參拜 (日式傳統文化)', cn: '神社参拜 (日式传统文化)' },
    { en: 'temple', tw: '古寺祈福 (莊嚴心靈洗滌)', cn: '古寺祈福 (庄严心灵洗涤)' },
    { en: 'market', tw: '傳統市集 (品嚐在地風味)', cn: '传统市集 (品尝当地风味)' },
    { en: 'beach', tw: '純淨沙灘 (浪漫海天一色)', cn: '纯净沙滩 (浪漫海天一色)' },
    { en: 'tower', tw: '地標展望塔 (俯瞰壯麗市景)', cn: '地标展望塔 (俯瞰壮丽市景)' },
    { en: 'bridge', tw: '景觀大橋 (浪漫河畔散步)', cn: '景观大桥 (浪漫河畔散步)' },
    { en: 'park', tw: '休閒綠意公園 (散步漫遊)', cn: '休闲绿意公园 (散步漫游)' },
    { en: 'zoo', tw: '生態動物園 (親近可愛動物)', cn: '生态动物园 (亲近可爱动物)' },
    { en: 'lake', tw: '絕美湖畔 (湖光山色散策)', cn: '绝美湖畔 (湖光山色散策)' },
    { en: 'mall', tw: '流行商場 (血拼聖地)', cn: '流行商场 (血拼圣地)' },
    { en: 'street', tw: '特色老街 (懷舊漫步)', cn: '特色老街 (怀旧漫步)' },
    { en: 'restaurant', tw: '推薦老字號餐廳', cn: '推荐老字号餐厅' },
    { en: 'cafe', tw: '質感精品咖啡廳', cn: '質感精品咖啡厅' },
    { en: 'station', tw: '車站', cn: '车站' },
    { en: 'airport', tw: '國際機場 (開啟旅程)', cn: '国际机场 (开启旅程)' }
  ];

  for (const item of suffixMap) {
    if (nameLower.includes(item.en)) {
      // 提取字根前的名稱做音譯或直接保留，然後附加好聽的後綴
      const rawPrefix = poiName.substring(0, poiName.toLowerCase().indexOf(item.en)).trim();
      const prefix = rawPrefix || (isCn ? '热门' : '熱門');
      const suffix = isCn ? item.cn : item.tw;
      
      const translatedPrefix = translatePrefix(prefix, isCn);
      
      return {
        title: `${translatedPrefix} ${suffix}`,
        localTitle: poiName
      };
    }
  }

  // 3. Fallback: 如果完全沒有匹配字根，至少不要硬音譯，我們附加上 UI 語系的類型與提示，例如：
  // "XXX 探索體驗 [XXX]"
  const suffix = isCn ? '探访体验' : '探索體驗';
  return {
    title: `${poiName} ${suffix}`,
    localTitle: poiName
  };
}

function translatePrefix(prefix: string, isCn: boolean): string {
  const lower = prefix.toLowerCase();
  const dict: Record<string, { tw: string; cn: string }> = {
    'ueno': { tw: '上野', cn: '上野' },
    'asakusa': { tw: '淺草', cn: '浅草' },
    'shibuya': { tw: '澀谷', cn: '涩谷' },
    'shinjuku': { tw: '新宿', cn: '新宿' },
    'harajuku': { tw: '原宿', cn: '原宿' },
    'ginza': { tw: '銀座', cn: '银座' },
    'roppongi': { tw: '六本木', cn: '六本木' },
    'kyoto': { tw: '京都', cn: '京都' },
    'osaka': { tw: '大阪', cn: '大阪' },
    'nara': { tw: '奈良', cn: '奈良' },
    'kobe': { tw: '神戶', cn: '神户' },
    'hokkaido': { tw: '北海道', cn: '北海道' },
    'okinawa': { tw: '沖繩', cn: '冲绳' },
    'fuji': { tw: '富士山', cn: '富士山' },
    'taipei': { tw: '台北', cn: '台北' },
    'kaohsiung': { tw: '高雄', cn: '高雄' },
    'taichung': { tw: '台中', cn: '台中' },
    'tainan': { tw: '台南', cn: '台南' },
    'hualien': { tw: '花蓮', cn: '花莲' },
    'kenting': { tw: '墾丁', cn: '垦丁' },
    'bangkok': { tw: '曼谷', cn: '曼谷' },
    'pattaya': { tw: '芭達雅', cn: '芭达雅' },
    'phuket': { tw: '普吉島', cn: '普吉岛' },
    'chiang mai': { tw: '清邁', cn: '清迈' },
    'seoul': { tw: '首爾', cn: '首尔' },
    'incheon': { tw: '仁川', cn: '仁川' },
    'busan': { tw: '釜山', cn: '釜山' },
    'jeju': { tw: '濟州島', cn: '济州岛' },
    'paris': { tw: '巴黎', cn: '巴黎' },
    'london': { tw: '倫敦', cn: '伦敦' },
    'new york': { tw: '紐約', cn: '纽约' },
    'rome': { tw: '羅馬', cn: '罗马' },
    'sydney': { tw: '雪梨', cn: '雪梨' },
    'melbourne': { tw: '墨爾本', cn: '墨尔本' },
    'singapore': { tw: '新加坡', cn: '新加坡' },
    'hong kong': { tw: '香港', cn: '香港' },
    'macau': { tw: '澳門', cn: '澳门' }
  };

  return dict[lower] ? (isCn ? dict[lower].cn : dict[lower].tw) : prefix;
}

