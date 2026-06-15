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
  const imgs = d.images.slice();
  // 圖片陣列與景點數對齊：景點多於圖片時循環取用，避免索引越界導致活動缺圖。
  const images = d.attractions.length > 0
    ? d.attractions.map((_, i) => (imgs.length ? imgs[i % imgs.length] : ''))
    : imgs;
  return {
    images,
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
      if (latDiff < 0.0005 && lonDiff < 0.0005) {
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
      if (latDiff < 0.0005 && lonDiff < 0.0005) {
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

/** 依座標及名稱比對，尋找內建資料庫中的景點特色描述 */
export function findLocalizedDescription(poiName: string, lat: number, lon: number, locale: string): string | null {
  const lowerName = (poiName || '').toLowerCase();
  
  // 1. 優先透過座標比對 (經緯度差值小於 0.0005，約 50 公尺)
  for (const d of DATA.destinations) {
    for (const a of d.attractions) {
      const latDiff = Math.abs(a.lat - lat);
      const lonDiff = Math.abs(a.lon - lon);
      if (latDiff < 0.0005 && lonDiff < 0.0005) {
        const desc = pickText(a.desc, locale);
        if (desc && desc.length > 0) return desc;
      }
    }
    for (const r of d.restaurants) {
      const latDiff = Math.abs(r.lat - lat);
      const lonDiff = Math.abs(r.lon - lon);
      if (latDiff < 0.0005 && lonDiff < 0.0005) {
        const desc = pickText(r.desc, locale);
        if (desc && desc.length > 0) return desc;
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
        const desc = pickText(a.desc, locale);
        if (desc && desc.length > 0) return desc;
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
        const desc = pickText(r.desc, locale);
        if (desc && desc.length > 0) return desc;
      }
    }
  }

  return null;
}

/** 針對無離線備援資料的景點，動態產生符合該 UI 語系之旅遊部落客/觀光指南風格的接地氣名稱 */
function translateAndEnhancePoiName(poiName: string, targetLocale: string): { title?: string; localTitle?: string } {
  const nameLower = (poiName || '').toLowerCase().trim();

  // 1. 全球知名熱門景點的對照表 (Blogger 接地氣風格名稱)
  const famousMap: Record<string, Record<string, string>> = {
    'shinjuku niagara falls': {
      'zh-TW': '新宿尼亞加拉大飛瀑 (都市綠洲芬多精)',
      'zh-CN': '新宿尼亚加拉大飞瀑 (都市绿洲芬多精)',
      'en': 'Shinjuku Niagara Falls (Urban Oasis & Phytoncide)',
      'ja': '新宿ナイアガラの滝 (都会のオアシス・マイナスイオン)',
      'ko': '신주쿠 나이아가라 폭포 (도심 속 오아시스 피톤치드)',
      'es': 'Cataratas del Niágara de Shinjuku (Oasis Urbano y Fitoncida)',
      'ms': 'Air Terjun Niagara Shinjuku (Oasis Bandar & Fitonsida)',
      'pt': 'Cataratas do Niágara de Shinjuku (Oásis Urbano e Fitoncida)',
      'th': 'น้ำตกไนแองการาชินจูกุ (โอเอซิสกลางกรุง & ไฟตอนไซด์)',
      'vi': 'Thác nước Shinjuku Niagara (Ốc đảo đô thị & Phytoncide)'
    },
    'kyubei sushi at keio plaza hotel': {
      'zh-TW': '東京京王廣場飯店久兵衛壽司 (極致江戶前旬味)',
      'zh-CN': '东京京王广场饭店久兵卫寿司 (极致江户前旬味)',
      'en': 'Kyubei Sushi at Keio Plaza Hotel (Ultimate Edomae Seasonal Flavors)',
      'ja': '京王プラザホテル銀座久兵衛 (至高の江戸前旬味)',
      'ko': '게이오 플라자 호텔 큐베이 스시 (지극히 높은 에도마에 제철 맛)',
      'es': 'Kyubei Sushi en Keio Plaza Hotel (El Último Sabor de Temporada Edomae)',
      'ms': 'Kyubei Sushi di Hotel Keio Plaza (Keenakan Musiman Edomae Terunggul)',
      'pt': 'Kyubei Sushi no Keio Plaza Hotel (O Último Sabor de Temporada Edomae)',
      'th': 'คิวเบย์ ซูชิ ณ โรงแรมเคโอ พลาซ่า (สุดยอดรสชาติเอโดะมาเอะตามฤดูกาล)',
      'vi': 'Sushi Kyubei tại Khách sạn Keio Plaza (Hương vị Edomae mùa cực phẩm)'
    },
    'kyubei sushi': {
      'zh-TW': '久兵衛壽司名店 (極致江戶前旬味)',
      'zh-CN': '久兵卫寿司名店 (极致江户前旬味)',
      'en': 'Kyubei Sushi (Ultimate Edomae Seasonal Flavors)',
      'ja': '銀座久兵衛 (至高の江戸前旬味)',
      'ko': '큐베이 스시 (지극히 높은 에도마에 제철 맛)',
      'es': 'Kyubei Sushi (El Último Sabor de Temporada Edomae)',
      'ms': 'Kyubei Sushi (Keenakan Musiman Edomae Terunggul)',
      'pt': 'Kyubei Sushi (O Último Sabor de Temporada Edomae)',
      'th': 'คิวเบย์ ซูชิ (สุดยอดรสชาติเอโดะมาเอะตามฤดูกาล)',
      'vi': 'Sushi Kyubei (Hương vị Edomae mùa cực phẩm)'
    },
    'keio plaza hotel': {
      'zh-TW': '東京京王廣場大飯店 (精選特色住宿)',
      'zh-CN': '东京京王广场大饭店 (精选特色住宿)',
      'en': 'Keio Plaza Hotel Tokyo (Premium Recommended Stay)',
      'ja': '京王プラザホテル東京 (厳選おすすめ宿)',
      'ko': '게이오 플라자 호텔 도쿄 (엄선된 특별 숙소)',
      'es': 'Keio Plaza Hotel Tokyo (Alojamiento Premium Recomendado)',
      'ms': 'Hotel Keio Plaza Tokyo (Penginapan Terpilih Premium)',
      'pt': 'Keio Plaza Hotel Tokyo (Alojamento Premium Recomendado)',
      'th': 'โรงแรมเคโอ พลาซ่า โตเกียว (ที่พักแนะนำระดับพรีเมียม)',
      'vi': 'Khách sạn Keio Plaza Tokyo (Lựa chọn lưu trú cao cấp)'
    },
    'tokyo tower': {
      'zh-TW': '東京鐵塔地標展望',
      'zh-CN': '东京铁塔地标展望',
      'en': 'Tokyo Tower Landmark Observatory',
      'ja': '東京タワー地標展望',
      'ko': '도쿄 타워 전망대',
      'es': 'Observatorio de la Torre de Tokio',
      'ms': 'Menara Tokyo Landmark',
      'pt': 'Observatório da Torre de Tóquio',
      'th': 'โตเกียวทาวเวอร์จุดชมวิวแลนด์มาร์ก',
      'vi': 'Tháp Tokyo Đài quan sát'
    },
    'tokyo skytree': {
      'zh-TW': '東京晴空塔俯瞰市景',
      'zh-CN': '东京晴空塔俯瞰市景',
      'en': 'Tokyo Skytree City View',
      'ja': '東京スカイツリー展望',
      'ko': '도쿄 스카이트리 전망대',
      'es': 'Mirador de Tokyo Skytree',
      'ms': 'Pemandangan Bandar Tokyo Skytree',
      'pt': 'Mirante do Tokyo Skytree',
      'th': 'โตเกียวสกายทรีชมวิวเมือง',
      'vi': 'Tháp Tokyo Skytree ngắm cảnh'
    },
    'sensoji': {
      'zh-TW': '淺草寺與雷門江戶風情',
      'zh-CN': '浅草寺与雷门江户风情',
      'en': 'Senso-ji Temple & Kaminarimon',
      'ja': '浅草寺と雷門江戸風情',
      'ko': '센소지와 가미나리몬 에도 풍경',
      'es': 'Templo Senso-ji y Kaminarimon',
      'ms': 'Kuil Senso-ji & Kaminarimon',
      'pt': 'Templo Senso-ji e Kaminarimon',
      'th': 'วัดเซนโซจิและประตูสายฟ้าคามินาริมง',
      'vi': 'Chùa Senso-ji và cổng Kaminarimon'
    },
    'senso-ji': {
      'zh-TW': '淺草寺與雷門江戶風情',
      'zh-CN': '浅草寺与雷门江户风情',
      'en': 'Senso-ji Temple & Kaminarimon',
      'ja': '浅草寺と雷門江戸風情',
      'ko': '센소지와 가미나리몬 에도 풍경',
      'es': 'Templo Senso-ji y Kaminarimon',
      'ms': 'Kuil Senso-ji & Kaminarimon',
      'pt': 'Templo Senso-ji e Kaminarimon',
      'th': 'วัดเซนโซจิและประตูสายฟ้าคามินาริมง',
      'vi': 'Chùa Senso-ji và cổng Kaminarimon'
    },
    'ueno park': {
      'zh-TW': '上野恩賜公園文藝散策',
      'zh-CN': '上野恩赐公园文艺散策',
      'en': 'Ueno Park Cultural Walk',
      'ja': '上野恩賜公園散策',
      'ko': '우어야 공원 문화 산책',
      'es': 'Paseo Cultural del Parque Ueno',
      'ms': 'Jalan-jalan Budaya Taman Ueno',
      'pt': 'Passeio Cultural no Parque Ueno',
      'th': 'สวนอุเอโนะเดินชมวัฒนธรรม',
      'vi': 'Công viên Ueno dạo bước văn hóa'
    },
    'kinkakuji': {
      'zh-TW': '金閣寺璀璨鏡湖',
      'zh-CN': '金阁寺璀璨镜湖',
      'en': 'Kinkaku-ji Temple Golden Pavilion',
      'ja': '金閣寺舎利殿',
      'ko': '킨카쿠지 금빛 누각',
      'es': 'Templo Kinkaku-ji Pabellón Dorado',
      'ms': 'Kuil Kinkaku-ji Pavilion Emas',
      'pt': 'Templo Kinkaku-ji Pavilhão Dourado',
      'th': 'วัดคินคาคุจิพลับพลาทอง',
      'vi': 'Chùa Vàng Kinkaku-ji'
    },
    'fushimi inari': {
      'zh-TW': '伏見稻荷大社千本鳥居',
      'zh-CN': '伏见稻荷大社千本鸟居',
      'en': 'Fushimi Inari Shrine Thousand Torii Gates',
      'ja': '伏見稲荷大社千本鳥居',
      'ko': '후시미 이나리 대사 천본 도리이',
      'es': 'Santuario Fushimi Inari Mil Puertas Torii',
      'ms': 'Kuil Fushimi Inari Seribu Pintu Torii',
      'pt': 'Santuário Fushimi Inari Mil Portões Torii',
      'th': 'ศาลเจ้าฟูชิมิอินาริเสาโทริอิพันต้น',
      'vi': 'Đền thờ Fushimi Inari ngàn cổng Torii'
    },
    'kiyomizudera': {
      'zh-TW': '清水寺清水舞台眺望',
      'zh-CN': '清水寺清水舞台眺望',
      'en': 'Kiyomizu-dera Temple Stage View',
      'ja': '清水寺清水の舞台',
      'ko': '기요미즈데라 무대 조망',
      'es': 'Mirador del Templo Kiyomizu-dera',
      'ms': 'Pemandangan Pentas Kuil Kiyomizu-dera',
      'pt': 'Mirante do Templo Kiyomizu-dera',
      'th': 'วัดคิโยมิซุเดระชมวิวเวทีคิโยมิซุ',
      'vi': 'Chùa Thanh Thủy Kiyomizu-dera'
    },
    'kiyomizu-dera': {
      'zh-TW': '清水寺清水舞台眺望',
      'zh-CN': '清水寺清水舞台眺望',
      'en': 'Kiyomizu-dera Temple Stage View',
      'ja': '清水寺清水の舞台',
      'ko': '기요미즈데라 무대 조망',
      'es': 'Mirador del Templo Kiyomizu-dera',
      'ms': 'Pemandangan Pentas Kuil Kiyomizu-dera',
      'pt': 'Mirante do Templo Kiyomizu-dera',
      'th': 'วัดคิโยมิซุเดระชมวิวเวทีคิโยมิซุ',
      'vi': 'Chùa Thanh Thủy Kiyomizu-dera'
    },
    'eiffel tower': {
      'zh-TW': '艾菲爾鐵塔浪漫巴黎',
      'zh-CN': '艾菲尔铁塔浪漫巴黎',
      'en': 'Eiffel Tower Romantic Paris',
      'ja': 'エッフェル塔浪漫パリ',
      'ko': '에펠탑 낭만의 파리',
      'es': 'Torre Eiffel París Romántico',
      'ms': 'Menara Eiffel Paris Romantik',
      'pt': 'Torre Eiffel Paris Romântico',
      'th': 'หอไอเฟลปารีสสุดโรแมนติก',
      'vi': 'Tháp Eiffel Paris lãng mạn'
    },
    'louvre': {
      'zh-TW': '羅浮宮藝術殿堂',
      'zh-CN': '罗浮宫艺术殿堂',
      'en': 'Louvre Museum Art Palace',
      'ja': 'ルーヴル美術館芸術殿堂',
      'ko': '루브르 박물관 예술의 전당',
      'es': 'Museo del Louvre Palacio de Arte',
      'ms': 'Muzium Louvre Istana Seni',
      'pt': 'Museu do Louvre Palácio de Arte',
      'th': 'พิ密ธภัณฑ์ลูฟร์พระราชวังศิลปะ',
      'vi': 'Bảo tàng Louvre Cung điện nghệ thuật'
    },
    'versailles': {
      'zh-TW': '凡爾賽宮奢華宮廷',
      'zh-CN': '凡尔赛宫奢华宫廷',
      'en': 'Palace of Versailles Luxury Court',
      'ja': 'ヴェルサイユ宮殿豪華宮廷',
      'ko': '베르사유 궁전 호화 궁정',
      'es': 'Palacio de Versalles Corte de Lujo',
      'ms': 'Istana Versailles Mahkamah Mewah',
      'pt': 'Palácio de Versalhes Corte de Luxo',
      'th': 'พระราชวังแวร์ซายส์ราชสำนักสุดหรู',
      'vi': 'Cung điện Versailles Hoàng gia tráng lệ'
    },
    'colosseum': {
      'zh-TW': '羅馬競技場歷史見證',
      'zh-CN': '罗马竞技场历史见证',
      'en': 'Colosseum Historic Witness',
      'ja': 'コロッセオ歴史の証人',
      'ko': '콜로세움 역사적 증인',
      'es': 'Coliseo Testigo Histórico',
      'ms': 'Colosseum Saksi Sejarah',
      'pt': 'Coliseu Testemunha Histórica',
      'th': 'โคลอสเซียมพยานแห่งประวัติศาสตร์',
      'vi': 'Đấu trường La Mã Chứng nhân lịch sử'
    },
    'trevi fountain': {
      'zh-TW': '特萊維噴泉許願朝聖',
      'zh-CN': '特莱维喷泉许愿朝圣',
      'en': 'Trevi Fountain Wish Pilgrimage',
      'ja': 'トレビの泉願いの巡礼',
      'ko': '트레비 분수 소원의 순례',
      'es': 'Fontana de Trevi Peregrinación de Deseos',
      'ms': 'Air Pancut Trevi Ziarah Impian',
      'pt': 'Fontana de Trevi Peregrinação de Desejos',
      'th': 'น้ำพุเทรวีอธิษฐานขอพร',
      'vi': 'Đài phun nước Trevi Nguyện ước tâm linh'
    },
    'british museum': {
      'zh-TW': '大英博物館世界寶藏',
      'zh-CN': '大英博物馆世界宝藏',
      'en': 'British Museum World Treasures',
      'ja': '大英博物館世界の至宝',
      'ko': '대영박물관 세계의 보물',
      'es': 'Museo Británico Tesoros del Mundo',
      'ms': 'Muzium British Khazanah Dunia',
      'pt': 'Museu Britânico Tesouros do Mundo',
      'th': 'พิพิธภัณฑ์บริติชขุมทรัพย์ระดับโลก',
      'vi': 'Bảo tàng Anh Báu vật thế giới'
    },
    'tower bridge': {
      'zh-TW': '倫敦塔橋泰晤士河畔',
      'zh-CN': '伦敦塔桥泰晤士河畔',
      'en': 'Tower Bridge Thames Riverside',
      'ja': 'タワーブリッジテムズ河畔',
      'ko': '타워 브리지 템스 강변',
      'es': 'Tower Bridge Ribera del Támesis',
      'ms': 'Tower Bridge Tebing Sungai Thames',
      'pt': 'Tower Bridge Margem do Tâmisa',
      'th': 'ทาวเวอร์บริดจ์ริมแม่น้ำเทมส์',
      'vi': 'Cầu Tháp Luân Đôn Bên bờ sông Thames'
    },
    'statue of liberty': {
      'zh-TW': '自由女神像美國地標',
      'zh-CN': '自由女神像美国地标',
      'en': 'Statue of Liberty US Landmark',
      'ja': '自由の女神像アメリカの地標',
      'ko': '자유의 여신상 미국 랜드마크',
      'es': 'Estatua de la Libertad Hito de EE. UU.',
      'ms': 'Patung Liberty Landmark AS',
      'pt': 'Estátua da Liberdade Marco dos EUA',
      'th': 'เทพีเสรีภาพแลนด์มาร์กสหรัฐอเมริกา',
      'vi': 'Tượng Nữ Thần Tự Do Biểu tượng nước Mỹ'
    },
    'central park': {
      'zh-TW': '中央公園紐約綠洲',
      'zh-CN': '中央公园纽约绿洲',
      'en': 'Central Park New York Oasis',
      'ja': 'セントラルパークニューヨークオアシス',
      'ko': '센트럴 파크 뉴욕 오아시스',
      'es': 'Central Park Oasis de Nueva York',
      'ms': 'Central Park Oasis New York',
      'pt': 'Central Park Oásis de Nova York',
      'th': 'เซ็นทรัลพาร์กโอเอซิสนิวยอร์ก',
      'vi': 'Công viên Trung tâm Ốc đảo New York'
    },
    'times square': {
      'zh-TW': '時報廣場繁華霓虹',
      'zh-CN': '时报广场繁华霓虹',
      'en': 'Times Square Bustling Neon',
      'ja': 'タイムズスクエア繁華なネオン',
      'ko': '타임스 스퀘어 번화한 네온',
      'es': 'Times Square Neón Bullicioso',
      'ms': 'Times Square Neon yang Sibuk',
      'pt': 'Times Square Neon Movimentado',
      'th': 'ไทม์สแควร์แสงสีนีออนคึกคัก',
      'vi': 'Quảng trường Thời đại Ánh đèn Neon rực rỡ'
    },
    'marina bay sands': {
      'zh-TW': '濱海灣金沙絕美夜景',
      'zh-CN': '滨海湾金沙绝美夜景',
      'en': 'Marina Bay Sands Stunning Night View',
      'ja': 'マリーナベイサンズ絶景夜景',
      'ko': '마리나 베이 샌즈 절경 야경',
      'es': 'Marina Bay Sands Impresionantes Vistas Nocturnas',
      'ms': 'Marina Bay Sands Pemandangan Malam Indah',
      'pt': 'Marina Bay Sands Incrível Vista Noturna',
      'th': 'มารีน่าเบย์แซนด์สวิวทิวทัศน์ยามค่ำคืนอันงดงาม',
      'vi': 'Marina Bay Sands Cảnh đêm tuyệt mỹ'
    },
    'gardens by the bay': {
      'zh-TW': '濱海灣花園未來森林',
      'zh-CN': '滨海湾花园未来森林',
      'en': 'Gardens by the Bay Futuristic Forest',
      'ja': 'ガーデンズバイザベイ未来の森',
      'ko': '가든스 바이 더 베이 미래의 숲',
      'es': 'Gardens by the Bay Bosque Futurista',
      'ms': 'Gardens by the Bay Hutan Futuristik',
      'pt': 'Gardens by the Bay Floresta Futurista',
      'th': 'การ์เดนส์บายเดอะเบย์ป่าแห่งอนาคต',
      'vi': 'Gardens by the Bay Khu vườn tương lai'
    },
    'merlion': {
      'zh-TW': '魚尾獅公園新加坡地標',
      'zh-CN': '鱼尾狮公园新加坡地标',
      'en': 'Merlion Park Singapore Landmark',
      'ja': 'マーライオン公園シンガポール地標',
      'ko': '머라이언 파크 싱가포르 랜드마크',
      'es': 'Parque del Merlion Hito de Singapur',
      'ms': 'Taman Merlion Landmark Singapura',
      'pt': 'Parque do Merlion Marco de Singapura',
      'th': 'สวนสิงโตพ่นน้ำเมอร์ไลออนแลนด์มาร์กสิงคโปร์',
      'vi': 'Công viên Sư tử biển Biểu tượng Singapore'
    },
    'gyeongbokgung': {
      'zh-TW': '景福宮韓服體驗',
      'zh-CN': '景福宫韩服体验',
      'en': 'Gyeongbokgung Palace Hanbok Experience',
      'ja': '景福宮韓服体験',
      'ko': '경복궁 한복 체험',
      'es': 'Palacio Gyeongbokgung Experiencia de Hanbok',
      'ms': 'Istana Gyeongbokgung Pengalaman Hanbok',
      'pt': 'Palácio Gyeongbokgung Experiência Hanbok',
      'th': 'พระราชวังเคียงบกเช่าชุดฮันบก',
      'vi': 'Cung điện Gyeongbokgung Trải nghiệm Hanbok'
    },
    'myeongdong': {
      'zh-TW': '明洞商圈潮流美妝',
      'zh-CN': '明洞商圈潮流美妆',
      'en': 'Myeongdong Trendy Shopping & K-Beauty',
      'ja': '明洞トレンドコスメ',
      'ko': '명동 상권 트렌디한 쇼핑',
      'es': 'Myeongdong Compras de Moda y K-Beauty',
      'ms': 'Kawasan Myeongdong Membeli-belah Trendi',
      'pt': 'Myeongdong Compras de Moda e K-Beauty',
      'th': 'ย่านเมียงดงช้อปปิ้งเครื่องสำอางสุดฮิต',
      'vi': 'Khu Myeongdong Mua sắm & K-Beauty thịnh hành'
    },
    'nami island': {
      'zh-TW': '南怡島浪漫杉林',
      'zh-CN': '南怡岛浪漫杉林',
      'en': 'Nami Island Romantic Tree Paths',
      'ja': '南怡島ロマンチック杉林',
      'ko': '남이섬 낭만적인 메타세쿼이아 길',
      'es': 'Isla Nami Senderos Románticos de Árboles',
      'ms': 'Pulau Nami Laluan Pokok Romantik',
      'pt': 'Ilha Nami Caminhos Românticos de Árvores',
      'th': 'เกาะนามิทางเดินทิวสนสุดโรแมนติก',
      'vi': 'Đảo Nami Con đường hàng cây lãng mạn'
    },
    'haebangchon': {
      'zh-TW': '解放村文青散策',
      'zh-CN': '解放村文青散策',
      'en': 'Haebangchon Artsy District',
      'ja': '解放村文青散策',
      'ko': '해방촌 감성 문청 산책',
      'es': 'Distrito Artístico de Haebangchon',
      'ms': 'Kawasan Seni Haebangchon',
      'pt': 'Distrito Artístico de Haebangchon',
      'th': 'แฮบังชนย่านคาเฟ่สุดชิค',
      'vi': 'Khu Haebangchon Phố nghệ thuật hoài cổ'
    },
    'jiufen': {
      'zh-TW': '九份老街山城懷舊',
      'zh-CN': '九份老街山城怀旧',
      'en': 'Jiufen Old Street Nostalgic Hillside Town',
      'ja': '九份老街山城ノスタルジー',
      'ko': '지우펀 옛거리 레트로 산골마을',
      'es': 'Calle Vieja de Jiufen Pueblo de Colina Nostálgico',
      'ms': 'Bandar Bukit Nostalgik Jalan Lama Jiufen',
      'pt': 'Vila de Colina Nostálgica da Rua Antiga de Jiufen',
      'th': 'ถนนคนเดินจิ่วเฟิ่นเมืองบนเขาโคมแดงสุดวินเทจ',
      'vi': 'Phố cổ Cửu Phần Ngôi làng cổ kính trên sườn đồi'
    },
    'jiufen old street': {
      'zh-TW': '九份老街山城懷舊',
      'zh-CN': '九份老街山城怀旧',
      'en': 'Jiufen Old Street Nostalgic Hillside Town',
      'ja': '九份老街山城ノスタルジー',
      'ko': '지우펀 옛거리 레트로 산골마을',
      'es': 'Calle Vieja de Jiufen Pueblo de Colina Nostálgico',
      'ms': 'Bandar Bukit Nostalgik Jalan Lama Jiufen',
      'pt': 'Vila de Colina Nostálgica da Rua Antiga de Jiufen',
      'th': 'ถนนคนเดินจิ่วเฟิ่นเมืองบนเขาโคมแดงสุดวินเทจ',
      'vi': 'Phố cổ Cửu Phần Ngôi làng cổ kính trên sườn đồi'
    },
    'taipei 101': {
      'zh-TW': '台北101俯瞰高空',
      'zh-CN': '台北101俯瞰高空',
      'en': 'Taipei 101 Observatory View',
      'ja': '台北101展望展望',
      'ko': '타이베이 101展望台',
      'es': 'Mirador de Taipei 101',
      'ms': 'Pemandangan Balai Cerap Taipei 101',
      'pt': 'Mirante do Taipei 101',
      'th': 'ตึกไทเป 101 จุดชมวิวบนดาดฟ้า',
      'vi': 'Đài quan sát tháp Taipei 101'
    },
    'taroko': {
      'zh-TW': '太魯閣國家公園壯麗峽谷',
      'zh-CN': '太鲁阁国家公园壮丽峡谷',
      'en': 'Taroko National Park Breathtaking Gorge',
      'ja': '太魯閣国家公園壮大な峡谷',
      'ko': '타이루거 국립공원 웅장한 협곡',
      'es': 'Parque Nacional de Taroko Impresionante Garganta',
      'ms': 'Taman Negara Taroko Gaung yang Hebat',
      'pt': 'Parque Nacional de Taroko Garganta Impressionante',
      'th': 'อุทยานแห่งชาติไท่หลู่เก๋อหุบเขาหินอ่อนอันงดงาม',
      'vi': 'Công viên Quốc gia Thái Lỗ Các Hẻm núi hùng vĩ'
    },
    'sun moon lake': {
      'zh-TW': '日月潭環湖騎行',
      'zh-CN': '日月潭环湖骑行',
      'en': 'Sun Moon Lake Scenic Cycling',
      'ja': '日月潭サイクリング',
      'ko': '일월담 환호 사이클링',
      'es': 'Ciclismo Escénico del Lago del Sol y la Luna',
      'ms': 'Berbasikal Indah Tasik Sun Moon',
      'pt': 'Ciclismo Cénico no Lago do Sol e da Lua',
      'th': 'ทะเลสาบสุริยันจันทราปั่นจักรยานชมวิวรอบทะเลสาบ',
      'vi': 'Hồ Nhật Nguyệt Đạp xe quanh hồ ngắm cảnh'
    },
    'alishan': {
      'zh-TW': '阿里山森林鐵路與日出',
      'zh-CN': '阿里山森林铁路与日出',
      'en': 'Alishan Forest Railway & Sunrise',
      'ja': '阿里山森林鉄道と日の出',
      'ko': '아리산 삼림 철도와 일출',
      'es': 'Ferrocarril Forestal de Alishan y Amanecer',
      'ms': 'Kereta Api Hutan Alishan & Matahari Terbit',
      'pt': 'Caminho de Ferro da Floresta de Alishan e Nascer do Sol',
      'th': 'อุทยานแห่งชาติอาลีซานรถไฟสายไม้และชมพระอาทิตย์ขึ้น',
      'vi': 'Đường sắt rừng A Lý Sơn & ngắm bình minh'
    },
    'angkor wat': {
      'zh-TW': '吳哥窟神祕高棉微笑',
      'zh-CN': '吴哥窟神秘高棉微笑',
      'en': 'Angkor Wat Mysterious Khmer Smile',
      'ja': 'アンコールワット神秘の微笑み',
      'ko': '앙코르와트 신비로운 크메르의 미소',
      'es': 'Angkor Wat Misteriosa Sonrisa Jemer',
      'ms': 'Angkor Wat Senyuman Khmer yang Misteri',
      'pt': 'Angkor Wat Sorriso Khmer Misterioso',
      'th': 'นครวัดรอยยิ้มบายนอันลึกลับ',
      'vi': 'Đền Angkor Wat Nụ cười Khmer bí ẩn'
    },
    'halong bay': {
      'zh-TW': '下龍灣海上石林',
      'zh-CN': '下龙湾海上石林',
      'en': 'Ha Long Bay Limestone Islands',
      'ja': 'ハロン湾奇岩絶景',
      'ko': '하롱베이 바다 위 석림',
      'es': 'Bahía de Ha Long Islas de Piedra Caliza',
      'ms': 'Teluk Ha Long Pulau Batu Kapur',
      'pt': 'Baía de Ha Long Ilhas Calcárias',
      'th': 'อ่าวฮาลองกุ้ยหลินเมืองนนท์บนท้องทะเล',
      'vi': 'Vịnh Hạ Long Đảo đá vôi kỳ vĩ'
    },
    'shilin night market': {
      'zh-TW': '士林夜市美食吃透透',
      'zh-CN': '士林夜市美食吃透透',
      'en': 'Shilin Night Market Food Feast',
      'ja': '士林夜市食べ歩き',
      'ko': '스린 야시장 먹거리 대잔치',
      'es': 'Festín de Comida en el Mercado Nocturno de Shilin',
      'ms': 'Pesta Makanan Pasar Malam Shilin',
      'pt': 'Banquete de Comida no Mercado Noturno de Shilin',
      'th': 'ตลาดกลางคืนซื่อหลินสวรรค์นักชิม',
      'vi': 'Chợ đêm Sĩ Lâm Khám phá ẩm thực phong phú'
    },
    'raohe night market': {
      'zh-TW': '饒河街夜市胡椒餅朝聖',
      'zh-CN': '饶河街夜市胡椒饼朝圣',
      'en': 'Raohe Night Market Black Pepper Bun Tour',
      'ja': '饒河街夜市胡椒餅',
      'ko': '라오허제 야시장 후추빵 성지순례',
      'es': 'Tour de Panes de Pimienta Negra en el Mercado Nocturno de Raohe',
      'ms': 'Jelajah Bun Lada Hitam Pasar Malam Raohe',
      'pt': 'Tour de Pão de Pimenta no Mercado Noturno de Raohe',
      'th': 'ตลาดกลางคืนเหราเหอตามรอยซาลาเปาอบโอ่งเลื่องชื่อ',
      'vi': 'Chợ đêm Nhiêu Hà Khám phá bánh mì tiêu đen'
    },
    'ningxia night market': {
      'zh-TW': '寧夏夜市在地風味',
      'zh-CN': '宁夏夜市在地风味',
      'en': 'Ningxia Night Market Authentic Food',
      'ja': '寧夏夜市地元の味',
      'ko': '닝샤 야시장 로컬 맛집 투어',
      'es': 'Comida Auténtica en el Mercado Nocturno de Ningxia',
      'ms': 'Makanan Autentik Pasar Malam Ningxia',
      'pt': 'Comida Auténtica no Mercado Noturno de Ningxia',
      'th': 'ตลาดกลางคืนหนิงเซี่ยลิ้มรสอาหารamp;เครื่องดื่มพื้นเมืองดั้งเดิม',
      'vi': 'Chợ đêm Ninh Hạ Thưởng thức ẩm thực truyền thống'
    },
    'shibuya': {
      'zh-TW': '澀谷十字路口潮流探索',
      'zh-CN': '涩谷十字路口潮流探索',
      'en': 'Shibuya Crossing Trend Exploration',
      'ja': '渋谷スクランブル交差点トレンド',
      'ko': '시부야 스크램블 교차로 트렌드 탐색',
      'es': 'Cruce de Shibuya Exploración de Tendencias',
      'ms': 'Lintasan Shibuya Eksplorasi Trend',
      'pt': 'Cruzamento de Shibuya Exploração de Tendências',
      'th': 'ห้าแยกชิบูย่าย่านแฟชั่นสุดฮิป',
      'vi': 'Ngã tư Shibuya Trải nghiệm văn hóa thời trang'
    },
    'harajuku': {
      'zh-TW': '原宿竹下通潮流發源地',
      'zh-CN': '原宿竹下通潮流发源地',
      'en': 'Harajuku Takeshita Street Fashion Birthplace',
      'ja': '原宿竹下通りポップカルチャー',
      'ko': '하랴주쿠 다케시타 거리 패션 발원지',
      'es': 'Calle Takeshita de Harajuku Cuna de la Moda',
      'ms': 'Jalan Takeshita Harajuku Tempat Lahir Fesyen',
      'pt': 'Rua Takeshita de Harajuku Berço da Moda',
      'th': 'ถนนทาเคชิตะฮาราจูกุแหล่งกำเนิดแฟชั่นสุดเก๋',
      'vi': 'Phố Takeshita Harajuku Thánh địa thời trang'
    },
    'shinjuku': {
      'zh-TW': '新宿歌舞伎町不夜城',
      'zh-CN': '新宿歌舞伎町不夜城',
      'en': 'Shinjuku Kabukicho Sleepless City',
      'ja': '新宿歌舞伎町眠らない街',
      'ko': '신주쿠 가부키초 잠들지 않는 도시',
      'es': 'Kabukicho de Shinjuku Ciudad Sin Sueño',
      'ms': 'Kabukicho Shinjuku Bandar Tanpa Tidur',
      'pt': 'Kabukicho de Shinjuku Cidade que Nunca Dorme',
      'th': 'คาบูกิโจชินจูกุย่านท่องราตรีที่ไม่เคยหลับใหล',
      'vi': 'Kabukicho Shinjuku Thành phố không ngủ'
    },
    'odaiba': {
      'zh-TW': '台場鋼彈與絕美夕陽',
      'zh-CN': '台场高达与绝美夕阳',
      'en': 'Odaiba Gundam & Stunning Sunset',
      'ja': 'お台場ガンダムと夕日の絶景',
      'ko': '오다이바 건담과 일몰 전망',
      'es': 'Odaiba Gundam y Hermosa Puesta de Sol',
      'ms': 'Odaiba Gundam & Matahari Terbenam Indah',
      'pt': 'Odaiba Gundam e Pôr do Sol Incrível',
      'th': 'โอไดบะชมหุ่นยนต์กันดั้มยักษ์และวิวพระอาทิตย์ตกดิน',
      'vi': 'Odaiba Ngắm tượng Gundam và hoàng hôn tuyệt đẹp'
    },
    'tsukiji': {
      'zh-TW': '築地場外市場海鮮美食',
      'zh-CN': '筑地场外市场海鲜美食',
      'en': 'Tsukiji Outer Market Seafood Feast',
      'ja': '築地場外市場海鮮グルメ',
      'ko': '츠키지 장외시장 신선한 해산물',
      'es': 'Festín de Mariscos en el Mercado Exterior de Tsukiji',
      'ms': 'Pesta Makanan Laut Pasar Luar Tsukiji',
      'pt': 'Banquete de Frutos do Mar no Mercado Externo de Tsukiji',
      'th': 'ตลาดปลาซึคิจิสวรรค์คนรักปลาดิบและอาหารทะเล',
      'vi': 'Chợ ngoài Tsukiji Thưởng thức hải sản tươi ngon'
    },
    'don quijote': {
      'zh-TW': '驚安殿堂唐吉訶德購物',
      'zh-CN': '惊安殿堂唐吉诃德购物',
      'en': 'Don Quijote Discount Store Shopping',
      'ja': 'ドン・キホーテお買い物',
      'ko': '돈키호테 쇼핑 천국',
      'es': 'Compras en la Tienda de Descuentos Don Quijote',
      'ms': 'Membeli-belah Kedai Diskaun Don Quijote',
      'pt': 'Compras na Loja de Descontos Don Quijote',
      'th': 'ดองกิโฮเต้แหล่งช้อปปิ้งสินค้าราคาประหยัด',
      'vi': 'Cửa hàng miễn thuế Don Quijote mua sắm'
    },
    'bic camera': {
      'zh-TW': 'Bic Camera 電器狂購',
      'zh-CN': 'Bic Camera 电器狂购',
      'en': 'Bic Camera Electronics Shopping',
      'ja': 'ビックカメラ家電量販店',
      'ko': '빅카메라 가전제품 쇼핑',
      'es': 'Compras de Electrónica en Bic Camera',
      'ms': 'Membeli-belah Elektronik Bic Camera',
      'pt': 'Compras de Eletrônicos na Bic Camera',
      'th': 'บิ๊กคาเมร่าช้อปปิ้งเครื่องใช้ไฟฟ้าและกล้องถ่ายรูป',
      'vi': 'Siêu thị điện máy Bic Camera mua sắm'
    },
    'yodobashi': {
      'zh-TW': '友都八喜電器量販',
      'zh-CN': '友都八喜电器量贩',
      'en': 'Yodobashi Camera Electronics Megastore',
      'ja': 'ヨドバシカメラお買い物',
      'ko': '요도바시 카메라 가전 쇼핑몰',
      'es': 'Megatienda de Electrónica Yodobashi Camera',
      'ms': 'Gedung Elektronik Yodobashi Camera',
      'pt': 'Megaloja de Eletrônicos Yodobashi Camera',
      'th': 'โยโดบาชิคาเมร่าห้างสรรพสินค้าเครื่องใช้ไฟฟ้าครบวงจร',
      'vi': 'Siêu thị điện máy Yodobashi Camera'
    }
  };

  // 模糊匹配著名景點
  for (const [key, value] of Object.entries(famousMap)) {
    if (nameLower.includes(key)) {
      return {
        title: value[targetLocale] || value['en'] || poiName,
        localTitle: poiName
      };
    }
  }

  // 2. 針對字根進行翻譯美化 (Blogger 旅遊指南風格)
  const suffixMap: { key: string; [locale: string]: string }[] = [
    {
      key: 'falls',
      'zh-TW': '大飛瀑 (壯麗自然景致)',
      'zh-CN': '大飞瀑 (壮丽自然景致)',
      'en': 'Falls (Majestic Natural Scenery)',
      'ja': '大飛瀑 (壮大な自然の絶景)',
      'ko': '대폭포 (웅장한 자연 경관)',
      'es': 'Cataratas (Majestuoso Paisaje Natural)',
      'ms': 'Air Terjun (Pemandangan Alam Semulajadi)',
      'pt': 'Cataratas (Paisagem Natural Majestosa)',
      'th': 'น้ำตกใหญ่ (ทิวทัศน์ธรรมชาติอันตระการตา)',
      'vi': 'Thác nước lớn (Cảnh quan thiên nhiên hùng vĩ)'
    },
    {
      key: 'waterfall',
      'zh-TW': '大飛瀑 (壯麗自然景致)',
      'zh-CN': '大飞瀑 (壮丽自然景致)',
      'en': 'Falls (Majestic Natural Scenery)',
      'ja': '大飛瀑 (壮大な自然の絶景)',
      'ko': '대폭포 (웅장한 자연 경관)',
      'es': 'Cataratas (Majestuoso Paisaje Natural)',
      'ms': 'Air Terjun (Pemandangan Alam Semulajadi)',
      'pt': 'Cataratas (Paisagem Natural Majestosa)',
      'th': 'น้ำตกใหญ่ (ทิวทัศน์ธรรมชาติอันตระการตา)',
      'vi': 'Thác nước lớn (Cảnh quan thiên nhiên hùng vĩ)'
    },
    {
      key: 'sushi',
      'zh-TW': '壽司料理名店 (品味在地旬鮮)',
      'zh-CN': '寿司料理名店 (品味当地旬鲜)',
      'en': 'Sushi (Savor Local Seasonal Freshness)',
      'ja': '鮨処 (地元の旬の美味を堪能)',
      'ko': '스시 전문점 (현지 제철의 신선함)',
      'es': 'Restaurante de Sushi (Saborea la Frescura Local de Temporada)',
      'ms': 'Kedai Sushi (Nikmati Kesegaran Musiman Tempatan)',
      'pt': 'Restaurante de Sushi (Saboreie a Frescura Local da Época)',
      'th': 'ร้านซูชิเลื่องชื่อ (ลิ้มรสความสดใหม่ตามฤดูกาล)',
      'vi': 'Nhà hàng Sushi (Thưởng thức hải sản tươi ngon mùa vụ)'
    },
    {
      key: 'museum of art',
      'zh-TW': '市立美術館 (藝術美學巡禮)',
      'zh-CN': '市立美术馆 (艺术美学礼)',
      'en': 'Museum of Art (Art & Aesthetics Tour)',
      'ja': '美術館 (アートと美の探訪)',
      'ko': '미술관 (예술과 미학 순례)',
      'es': 'Museo de Arte (Recorrido de Arte y Estética)',
      'ms': 'Muzium Seni (Jelajah Seni & Estetika)',
      'pt': 'Museu de Arte (Tour de Arte e Estética)',
      'th': 'พิพิธภัณฑ์ศิลปะ (ทัวร์ศิลปะและสุนทรียศาสตร์)',
      'vi': 'Bảo tàng Nghệ thuật (Hành trình nghệ thuật & thẩm mỹ)'
    },
    {
      key: 'national museum',
      'zh-TW': '國家博物館 (文化珍寶探索)',
      'zh-CN': '国家博物馆 (文化珍宝探索)',
      'en': 'National Museum (Cultural Treasures Exploration)',
      'ja': '国立博物館 (文化遺産の探索)',
      'ko': '국립박물관 (문화 보물 탐색)',
      'es': 'Museo Nacional (Exploración de Tesoros Culturales)',
      'ms': 'Muzium Negara (Eksplorasi Khazanah Budaya)',
      'pt': 'Museu Nacional (Exploração de Tesouros Culturais)',
      'th': 'พิพิธภัณฑสถานแห่งชาติ (สำรวจขุมทรัพย์ทางวัฒนธรรม)',
      'vi': 'Bảo tàng Quốc gia (Khám phá báu vật văn hóa)'
    },
    {
      key: 'botanical garden',
      'zh-TW': '植物園 (城市綠色芬多精)',
      'zh-CN': '植物园 (城市绿色芬多精)',
      'en': 'Botanical Garden (Urban Green Oasis)',
      'ja': '植物園 (都会のグリーンプラザ)',
      'ko': '식물원 (도심 속 초록빛 피톤치드)',
      'es': 'Jardín Botánico (Oasis Verde Urbano)',
      'ms': 'Taman Botani (Oasis Hijau Bandar)',
      'pt': 'Jardim Botânico (Oásis Verde Urbano)',
      'th': 'สวนพฤกษศาสตร์ (โอเอซิสสีเขียวในเมือง)',
      'vi': 'Vườn bách thảo (Ốc đảo xanh giữa lòng đô thị)'
    },
    {
      key: 'night market',
      'zh-TW': '在地人氣夜市 (小吃尋禮)',
      'zh-CN': '当地人气夜市 (小吃寻礼)',
      'en': 'Night Market (Local Street Food Adventure)',
      'ja': '夜市 (地元人気屋台グルメ)',
      'ko': '야시장 (로컬 길거리 음식 체험)',
      'es': 'Mercado Nocturno (Aventura de Comida Callejera Local)',
      'ms': 'Pasar Malam (Pengembaraan Makanan Jalanan Tempatan)',
      'pt': 'Mercado Noturno (Aventura de Comida de Rua Local)',
      'th': 'ตลาดโต้รุ่ง (ผจญภัยสตรีทฟู้ดท้องถิ่น)',
      'vi': 'Chợ đêm (Khám phá ẩm thực đường phố địa phương)'
    },
    {
      key: 'shopping mall',
      'zh-TW': '購物中心 (時尚潮流天堂)',
      'zh-CN': '购物中心 (时尚潮流天堂)',
      'en': 'Shopping Mall (Fashion & Trend Paradise)',
      'ja': 'ショッピングモール (トレンドファッションの殿堂)',
      'ko': '쇼핑몰 (패션과 트렌드의 천국)',
      'es': 'Centro Comercial (Paraíso de Moda y Tendencias)',
      'ms': 'Pusat Beli-belah (Syurga Fesyen & Trend)',
      'pt': 'Shopping Center (Paraíso de Moda e Tendências)',
      'th': 'ห้างสรรพสินค้า (สวรรค์แห่งแฟชั่นและเทรนด์)',
      'vi': 'Trung tâm mua sắm (Thiên đường thời trang & xu hướng)'
    },
    {
      key: 'shopping street',
      'zh-TW': '購物步行街 (特色商圈)',
      'zh-CN': '購物步行街 (特色商圈)',
      'en': 'Shopping Street (Charming Local District)',
      'ja': 'ショッピング街 (賑やかな商店街散策)',
      'ko': '쇼핑 거리 (매력적인 로컬 상권)',
      'es': 'Calle Comercial (Distrito Local con Encanto)',
      'ms': 'Jalan Membeli-belah (Daerah Tempatan Menarik)',
      'pt': 'Rua Comercial (Distrito Encantador)',
      'th': 'ถนนคนเดิน (ย่านช้อปปิ้งท้องถิ่นมีเสน่ห์)',
      'vi': 'Phố mua sắm (Khu thương mại địa phương sầm uất)'
    },
    {
      key: 'department store',
      'zh-TW': '百貨商場 (購物天堂)',
      'zh-CN': '百货商场 (购物天堂)',
      'en': 'Department Store (Shopping Paradise)',
      'ja': 'デパート (お買い物パラダイス)',
      'ko': '백화점 (쇼핑의 천국)',
      'es': 'Grandes Almacenes (Paraíso de las Compras)',
      'ms': 'Gedung Serbaneka (Syurga Beli-belah)',
      'pt': 'Loja de Departamentos (Paraíso das Compras)',
      'th': 'ห้างสรรพสินค้า (สวรรค์ของนักช้อป)',
      'vi': 'Cửa hàng bách hóa (Thiên đường mua sắm)'
    },
    {
      key: 'floating market',
      'zh-TW': '水上市場 (在地風情體驗)',
      'zh-CN': '水上市场 (当地风情体验)',
      'en': 'Floating Market (Authentic Local Culture)',
      'ja': '水上マーケット (現地文化の体験)',
      'ko': '수상 시장 (이색적인 현지 문화 체험)',
      'es': 'Mercado Flotante (Experiencia Cultural Auténtica)',
      'ms': 'Pasar Terapung (Pengalaman Budaya Tempatan Sebenar)',
      'pt': 'Mercado Flutuante (Experiência Cultural Autêntica)',
      'th': 'ตลาดน้ำ (สัมผัสวิถีชีวิตและวัฒนธรรมท้องถิ่น)',
      'vi': 'Chợ nổi (Trải nghiệm văn hóa địa phương độc đáo)'
    },
    {
      key: 'theme park',
      'zh-TW': '主題樂園 (歡樂冒險世界)',
      'zh-CN': '主题乐园 (欢乐冒险世界)',
      'en': 'Theme Park (World of Fun & Adventure)',
      'ja': 'テーマパーク (夢と冒険の世界)',
      'ko': '테마파크 (환상과 모험의 세계)',
      'es': 'Parque Temático (Mundo de Diversión y Aventura)',
      'ms': 'Taman Tema (Dunia Keriangan & Pengembaraan)',
      'pt': 'Parque Temático (Mundo de Diversão e Aventura)',
      'th': 'สวนสนุกธีมปาร์ค (ดินแดนแห่งความสนุกและการผจญภัย)',
      'vi': 'Công viên chủ đề (Thế giới vui chơi & phiêu lưu)'
    },
    {
      key: 'amusement park',
      'zh-TW': '遊樂園 (歡笑不間斷)',
      'zh-CN': '游乐园 (欢笑不间断)',
      'en': 'Amusement Park (Nonstop Fun & Laughs)',
      'ja': '遊園地 (笑顔が溢れる場所)',
      'ko': '놀이공원 (끊임없는 웃음과 즐거움)',
      'es': 'Parque de Atracciones (Diversión Sin Parar)',
      'ms': 'Taman Hiburan (Keriangan Tanpa Henti)',
      'pt': 'Parque de Diversões (Diversão Sem Parar)',
      'th': 'สวนสนุก (เสียงหัวเราะและความสนุกไม่รู้จบ)',
      'vi': 'Công viên giải trí (Vui chơi bất tận)'
    },
    {
      key: 'national park',
      'zh-TW': '國家公園 (大自然壯麗景致)',
      'zh-CN': '国家公园 (大自然壮丽景致)',
      'en': 'National Park (Breathtaking Natural Wonder)',
      'ja': '国立公園 (大自然の息吹を感じる)',
      'ko': '국립공원 (대자연의 웅장한 신비)',
      'es': 'Parque Nacional (Impresionante Maravilla Natural)',
      'ms': 'Taman Negara (Keajaiban Alam Semulajadi)',
      'pt': 'Parque Nacional (Maravilha Natural Impressionante)',
      'th': 'อุทยานแห่งชาติ (ความมหัศจรรย์ของธรรมชาติอันน่าทึ่ง)',
      'vi': 'Công viên quốc gia (Kỳ quan thiên nhiên kỳ vĩ)'
    },
    {
      key: 'aquarium',
      'zh-TW': '海洋水族館 (奇幻藍色世界)',
      'zh-CN': '海洋水族馆 (奇幻蓝色世界)',
      'en': 'Aquarium (Magical Underwater Journey)',
      'ja': '水族館 (青い海のファンタジー)',
      'ko': '아쿠아리움 (환상적인 푸른 바다 여행)',
      'es': 'Acuario (Mágico Viaje Submarino)',
      'ms': 'Akuarium (Perjalanan Bawah Air yang Ajaib)',
      'pt': 'Aquário (Viagem Subaquática Mágica)',
      'th': 'สถานแสดงพันธุ์สัตว์น้ำ (ท่องโลกใต้ทะเลอันน่ามหัศจรรย์)',
      'vi': 'Thủy cung (Hành trình dưới đại dương kỳ ảo)'
    },
    {
      key: 'museum',
      'zh-TW': '博物館 (知性文藝之旅)',
      'zh-CN': '博物馆 (知性文艺之旅)',
      'en': 'Museum (Intellectual & Cultural Journey)',
      'ja': '博物館 (知性と歴史の旅)',
      'ko': '박물관 (지성과 문화의 여정)',
      'es': 'Museo (Viaje Intelectual y Cultural)',
      'ms': 'Muzium (Perjalanan Intelektual & Budaya)',
      'pt': 'Museu (Viagem Intelectual e Cultural)',
      'th': 'พิพิธภัณฑ์ (การเดินทางแห่งความรู้และวัฒนธรรม)',
      'vi': 'Bảo tàng (Hành trình tri thức & văn hóa)'
    },
    {
      key: 'palace',
      'zh-TW': '古典宮殿 (皇家歷史漫步)',
      'zh-CN': '古典宫殿 (皇家历史漫步)',
      'en': 'Palace (Royal History & Grandeur)',
      'ja': '宮殿 (王室 of 歴史を感じる宮廷)',
      'ko': '궁전 (왕실의 역사와 웅장함)',
      'es': 'Palacio (Historia Real y Grandeza)',
      'ms': 'Istana (Sejarah Diraja & Kemegahan)',
      'pt': 'Palácio (História Real e Grandeza)',
      'th': 'พระราชวัง (ตามรอยประวัติศาสตร์ราชวงศ์อันยิ่งใหญ่)',
      'vi': 'Cung điện (Lịch sử hoàng gia & sự huy hoàng)'
    },
    {
      key: 'castle',
      'zh-TW': '歷史古城 (壯麗城堡遺跡)',
      'zh-CN': '历史古城 (壮丽城堡遗迹)',
      'en': 'Castle (Magnificent Historic Fortress)',
      'ja': '名城 (歴史を紡ぐ壮大な城跡)',
      'ko': '성 (웅장한 역사적 성곽)',
      'es': 'Castillo (Magnífica Fortaleza Histórica)',
      'ms': 'Istana/Kubu (Kubu Bersejarah yang Hebat)',
      'pt': 'Castelo (Fortaleza Histórica Magnífica)',
      'th': 'ปราสาท (ป้อมปราการประวัติศาสตร์อันสง่างาม)',
      'vi': 'Lâu đài (Pháo đài lịch sử tráng lệ)'
    },
    {
      key: 'shrine',
      'zh-TW': '神社參拜 (日式傳統文化)',
      'zh-CN': '神社参拜 (日式传统文化)',
      'en': 'Shrine (Traditional Spiritual Place)',
      'ja': '神社 (歴史と伝統の参拝)',
      'ko': '신사 (일본 전통 영적 문화 체험)',
      'es': 'Santuario (Sitio Espiritual Tradicional)',
      'ms': 'Kuil/Santuari (Tempat Kerohanian Tradisional)',
      'pt': 'Santuário (Local Espiritual Tradicional)',
      'th': 'ศาลเจ้า (สถานที่สักการะทางจิตวิญญาณแบบดั้งเดิม)',
      'vi': 'Đền thờ (Trải nghiệm văn hóa tâm linh truyền thống)'
    },
    {
      key: 'temple',
      'zh-TW': '古寺祈福 (莊嚴心靈洗滌)',
      'zh-CN': '古寺祈福 (庄严心灵洗涤)',
      'en': 'Temple (Serene Spiritual Sanctuary)',
      'ja': '寺院 (厳かな静寂と祈り)',
      'ko': '사찰 (고요한 마음의 세례)',
      'es': 'Templo (Sereno Santuario Espiritual)',
      'ms': 'Kuil (Sanctuari Kerohanian yang Tenang)',
      'pt': 'Templo (Sereno Santuário Espiritual)',
      'th': 'วัด (ศาสนสถานอันเงียบสงบและศักดิ์สิทธิ์)',
      'vi': 'Chùa (Nơi thanh tịnh và cầu nguyện thanh bình)'
    },
    {
      key: 'market',
      'zh-TW': '傳統市集 (品嚐在地風味)',
      'zh-CN': '传统市集 (品尝当地风味)',
      'en': 'Market (Taste Authentic Local Flavors)',
      'ja': '市場 (活気あふれる地元の味)',
      'ko': '시장 (전통과 현지의 맛 탐방)',
      'es': 'Mercado (Prueba los Auténticos Sabores Locales)',
      'ms': 'Pasar (Rasa Keenakan Autentik Tempatan)',
      'pt': 'Mercado (Prove os Sabores Locais Autênticos)',
      'th': 'ตลาด (ลิ้มลองรสชาติท้องถิ่นแท้ๆ)',
      'vi': 'Chợ (Thưởng thức hương vị địa phương mộc mạc)'
    },
    { key: 'beach', 'zh-TW': '純淨沙灘 (浪漫海天一色)', 'zh-CN': '纯净沙滩 (浪漫海天一色)', 'en': 'Beach (Romantic Sandy Shore)', 'ja': 'ビーチ (青い海と白い砂のロマンス)', 'ko': '해변 (낭만적인 푸른 바다와 모래사장)', 'es': 'Playa (Romántica Orilla de Arena)', 'ms': 'Pantai (Pemandangan Laut Biru yang Romantik)', 'pt': 'Praia (Orla de Areia Romântica)', 'th': 'ชายหาด (หาดทรายขาวและทะเลสีครามสุดโรแมนติก)', 'vi': 'Bãi biển (Bờ cát lãng mạn hòa cùng sắc biển)' },
    { key: 'tower', 'zh-TW': '地標展望塔 (俯瞰壯麗市景)', 'zh-CN': '地标展望塔 (俯瞰壮丽市景)', 'en': 'Tower (Panoramic City Views)', 'ja': 'タワー (美しい街並みを一望)', 'ko': '타워 (아름다운 전망과 도시 전망)', 'es': 'Torre (Vistas Panorámicas de la Ciudad)', 'ms': 'Menara (Pemandangan Panoramik Bandar)', 'pt': 'Torre (Vistas Panorâmicas da Cidade)', 'th': 'หอคอย (จุดชมวิวทิวทัศน์เมืองแบบพาโนรามา)', 'vi': 'Tháp (Ngắm toàn cảnh thành phố tráng lệ)' },
    { key: 'bridge', 'zh-TW': '景觀大橋 (浪漫河畔散步)', 'zh-CN': '景观大桥 (浪漫河畔散步)', 'en': 'Bridge (Scenic Riverside Walk)', 'ja': 'ブリッジ (美しい河畔をのんびり散策)', 'ko': '다리 (경치 좋은 강변 산책)', 'es': 'Puente (Paseo Escénico Junto al Río)', 'ms': 'Jambatan (Jalan-jalan Tepi Sungai yang Indah)', 'pt': 'Ponte (Passeio Cénico Junto ao Rio)', 'th': 'สะพาน (เดินเล่นชมวิวริมแม่น้ำสุดโรแมนติก)', 'vi': 'Cầu (Đi dạo ngắm cảnh ven sông lãng mạn)' },
    { key: 'park', 'zh-TW': '休閒綠意公園 (散步漫遊)', 'zh-CN': '休闲绿意公园 (散步漫游)', 'en': 'Park (Relaxing Green Getaway)', 'ja': '公園 (緑豊かな憩いの広場)', 'ko': '공원 (푸른 녹음 속 여유로운 산책)', 'es': 'Parque (Relajante Escapada Verde)', 'ms': 'Taman (Santai di Kawasan Hijau)', 'pt': 'Parque (Refúgio Verde Descontraído)', 'th': 'สวนสาธารณะ (พักผ่อนหย่อนใจท่ามกลางธรรมชาติสีเขียว)', 'vi': 'Công viên (Thư giãn giữa không gian xanh mát)' },
    { key: 'zoo', 'zh-TW': '生態動物園 (親近可愛動物)', 'zh-CN': '生态动物园 (亲近可爱动物)', 'en': 'Zoo (Up-Close Animal Encounters)', 'ja': '動物園 (可愛い動物たちとの出会い)', 'ko': '동물원 (귀여운 동물들과의 생태 체험)', 'es': 'Zoológico (Encuentros Cercanos con Animales)', 'ms': 'Zoo (Pertemuan Dekat dengan Haiwan Comel)', 'pt': 'Jardim Zoológico (Encontros Próximos com Animais)', 'th': 'สวนสัตว์ (ใกล้ชิดกับสัตว์โลกผู้น่ารัก)', 'vi': 'Vườn thú (Gặp gỡ các loài động vật đáng yêu)' },
    { key: 'lake', 'zh-TW': '絕美湖畔 (湖光山色散策)', 'zh-CN': '绝美湖畔 (湖光山色散策)', 'en': 'Lake (Serene Lakeside Retreat)', 'ja': '湖 (穏やかな湖畔でのんびり)', 'ko': '호수 (고요한 호숫가의 낭만)', 'es': 'Lago (Sereno Retiro Junto al Lago)', 'ms': 'Tasik (Keindahan Tasik yang Tenang)', 'pt': 'Lago (Retiro Sereno Junto ao Lago)', 'th': 'ทะเลสาบ (พักผ่อนริมทะเลสาบอันเงียบสงบ)', 'vi': 'Hồ (Thư thái bên bờ hồ tĩnh lặng)' },
    { key: 'mall', 'zh-TW': '購物中心 (時尚潮流天堂)', 'zh-CN': '购物中心 (时尚潮流天堂)', 'en': 'Shopping Mall (Fashion & Trend Paradise)', 'ja': 'ショッピングモール (トレンドファッションの殿堂)', 'ko': '쇼핑몰 (패션과 트렌드의 천국)', 'es': 'Centro Comercial (Paraíso de Moda y Tendencias)', 'ms': 'Pusat Beli-belah (Syurga Fesyen & Trend)', 'pt': 'Shopping Center (Paraíso de Moda e Tendências)', 'th': 'ห้างสรรพสินค้า (สวรรค์แห่งแฟชั่นและเทรนด์)', 'vi': 'Trung tâm mua sắm (Thiên đường thời trang & xu hướng)' },
    { key: 'street', 'zh-TW': '購物步行街 (特色商圈)', 'zh-CN': '購物步行街 (特色商圈)', 'en': 'Shopping Street (Charming Local District)', 'ja': 'ショッピング街 (賑やかな商店街散策)', 'ko': '쇼핑 거리 (매력적인 로컬 상권)', 'es': 'Calle Comercial (Distrito Local con Encanto)', 'ms': 'Jalan Membeli-belah (Daerah Tempatan Menarik)', 'pt': 'Rua Comercial (Distrito Encantador)', 'th': 'ถนนคนเดิน (ย่านช้อปปิ้งท้องถิ่นมีเสน่ห์)', 'vi': 'Phố mua sắm (Khu thương mại địa phương sầm uất)' },
    { key: 'restaurant', 'zh-TW': '推薦老字號餐廳', 'zh-CN': '推荐老字号餐厅', 'en': 'Restaurant (Recommended Dining)', 'ja': 'お食事処 (厳選グルメ)', 'ko': '식당 (추천 맛집)', 'es': 'Restaurante (Cena Recomendada)', 'ms': 'Restoran (Makan Terpilih)', 'pt': 'Restaurante (Refeição Recomendada)', 'th': 'ร้านอาหาร (เมนูแนะนำเลิศรส)', 'vi': 'Nhà hàng (Gợi ý ẩm thực đặc sắc)' },
    { key: 'cafe', 'zh-TW': '質感精品咖啡廳', 'zh-CN': '質感精品咖啡厅', 'en': 'Cafe (Premium Boutique Coffee)', 'ja': 'カフェ (こだわり珈琲空間)', 'ko': '카페 (감성 충만精品 커피)', 'es': 'Cafetería (Café Boutique Premium)', 'ms': 'Kafe (Kopi Butik Premium)', 'pt': 'Cafetaria (Café Boutique Premium)', 'th': 'คาเฟ่ (ร้านกาแฟดีไซน์สวยรสชาติละมุน)', 'vi': 'Quán cà phê (Không gian cà phê tinh tế)' },
    { key: 'station', 'zh-TW': '車站', 'zh-CN': '车站', 'en': 'Station', 'ja': '駅', 'ko': '역', 'es': 'Estación', 'ms': 'Stesen', 'pt': 'Estação', 'th': 'สถานี', 'vi': 'Nhà ga' },
    { key: 'airport', 'zh-TW': '國際機場 (開啟旅程)', 'zh-CN': '国际机场 (开启旅程)', 'en': 'Airport (Journey Begins)', 'ja': '国際空港 (旅の始まり)', 'ko': '국제공항 (여행의 시작)', 'es': 'Aeropuerto (Comienza el Viaje)', 'ms': 'Lapangan Terbang (Permulaan Perjalanan)', 'pt': 'Aeroporto (Início da Viagem)', 'th': 'ท่าอากาศยาน (เริ่มต้นการเดินทาง)', 'vi': 'Sân bay quốc tế (Hành trình bắt đầu)' }
  ];

  for (const item of suffixMap) {
    if (nameLower.includes(item.key)) {
      // 提取字根前的名稱做音譯或直接保留，然後附加好聽的後綴
      const rawPrefix = poiName.substring(0, poiName.toLowerCase().indexOf(item.key)).trim();
      const prefix = rawPrefix || (targetLocale.startsWith('zh') ? (targetLocale === 'zh-CN' ? '热门' : '熱門') : 'Popular');
      const suffix = item[targetLocale] || item['en'] || item.key;
      
      const translatedPrefix = translatePrefix(prefix, targetLocale);
      
      return {
        title: `${translatedPrefix} ${suffix}`,
        localTitle: poiName
      };
    }
  }

  // 3. Fallback: 如果完全沒有匹配字根，直接返回原名，不強制附加累贅後綴
  return {
    title: poiName,
    localTitle: poiName
  };
}

function translatePrefix(prefix: string, locale: string): string {
  const lower = prefix.toLowerCase().trim();
  const dict: Record<string, Record<string, string>> = {
    'ueno': { 'zh-TW': '上野', 'zh-CN': '上野', 'en': 'Ueno', 'ja': '上野', 'ko': '우에노', 'es': 'Ueno', 'ms': 'Ueno', 'pt': 'Ueno', 'th': 'อุเอโนะ', 'vi': 'Ueno' },
    'asakusa': { 'zh-TW': '淺草', 'zh-CN': '浅草', 'en': 'Asakusa', 'ja': '浅草', 'ko': '아사쿠사', 'es': 'Asakusa', 'ms': 'Asakusa', 'pt': 'Asakusa', 'th': 'อาซากุสะ', 'vi': 'Asakusa' },
    'shibuya': { 'zh-TW': '澀谷', 'zh-CN': '涩谷', 'en': 'Shibuya', 'ja': '渋谷', 'ko': '시부야', 'es': 'Shibuya', 'ms': 'Shibuya', 'pt': 'Shibuya', 'th': 'ชิบูย่า', 'vi': 'Shibuya' },
    'shinjuku': { 'zh-TW': '新宿', 'zh-CN': '新宿', 'en': 'Shinjuku', 'ja': '新宿', 'ko': '신주쿠', 'es': 'Shinjuku', 'ms': 'Shinjuku', 'pt': 'Shinjuku', 'th': 'ชินจูกุ', 'vi': 'Shinjuku' },
    'harajuku': { 'zh-TW': '原宿', 'zh-CN': '原宿', 'en': 'Harajuku', 'ja': '原宿', 'ko': '하랴주쿠', 'es': 'Harajuku', 'ms': 'Harajuku', 'pt': 'Harajuku', 'th': 'ฮาราจูกุ', 'vi': 'Harajuku' },
    'ginza': { 'zh-TW': '銀座', 'zh-CN': '银座', 'en': 'Ginza', 'ja': '銀座', 'ko': '긴자', 'es': 'Ginza', 'ms': 'Ginza', 'pt': 'Ginza', 'th': 'กินซ่า', 'vi': 'Ginza' },
    'roppongi': { 'zh-TW': '六本木', 'zh-CN': '六本木', 'en': 'Roppongi', 'ja': '六本木', 'ko': '롯폰기', 'es': 'Roppongi', 'ms': 'Roppongi', 'pt': 'Roppongi', 'th': 'รปปงงิ', 'vi': 'Roppongi' },
    'kyoto': { 'zh-TW': '京都', 'zh-CN': '京都', 'en': 'Kyoto', 'ja': '京都', 'ko': '교토', 'es': 'Kioto', 'ms': 'Kyoto', 'pt': 'Quioto', 'th': 'เกียวโต', 'vi': 'Kyoto' },
    'osaka': { 'zh-TW': '大阪', 'zh-CN': '大阪', 'en': 'Osaka', 'ja': '大阪', 'ko': '오사카', 'es': 'Osaka', 'ms': 'Osaka', 'pt': 'Osaka', 'th': 'โอซาก้า', 'vi': 'Osaka' },
    'nara': { 'zh-TW': '奈良', 'zh-CN': '奈良', 'en': 'Nara', 'ja': '奈良', 'ko': '나라', 'es': 'Nara', 'ms': 'Nara', 'pt': 'Nara', 'th': 'นารา', 'vi': 'Nara' },
    'kobe': { 'zh-TW': '神戶', 'zh-CN': '神户', 'en': 'Kobe', 'ja': '神戸', 'ko': '고베', 'es': 'Kobe', 'ms': 'Kobe', 'pt': 'Kobe', 'th': 'โกเบ', 'vi': 'Kobe' },
    'hokkaido': { 'zh-TW': '北海道', 'zh-CN': '北海道', 'en': 'Hokkaido', 'ja': '北海道', 'ko': '홋카이도', 'es': 'Hokkaido', 'ms': 'Hokkaido', 'pt': 'Hokkaido', 'th': 'ฮอกไกโด', 'vi': 'Hokkaido' },
    'okinawa': { 'zh-TW': '沖繩', 'zh-CN': '冲绳', 'en': 'Okinawa', 'ja': '沖縄', 'ko': '오키나와', 'es': 'Okinawa', 'ms': 'Okinawa', 'pt': 'Okinawa', 'th': 'โอกินาว่า', 'vi': 'Okinawa' },
    'fuji': { 'zh-TW': '富士山', 'zh-CN': '富士山', 'en': 'Fuji', 'ja': '富士', 'ko': '후지', 'es': 'Fuji', 'ms': 'Fuji', 'pt': 'Fuji', 'th': 'ฟูจิ', 'vi': 'Fuji' },
    'taipei': { 'zh-TW': '台北', 'zh-CN': '台北', 'en': 'Taipei', 'ja': '台北', 'ko': '타이베이', 'es': 'Taipéi', 'ms': 'Taipei', 'pt': 'Taipé', 'th': 'ไทเป', 'vi': 'Taipei' },
    'kaohsiung': { 'zh-TW': '高雄', 'zh-CN': '高雄', 'en': 'Kaohsiung', 'ja': '高雄', 'ko': '가오슝', 'es': 'Kaohsiung', 'ms': 'Kaohsiung', 'pt': 'Kaohsiung', 'th': 'เกาสง', 'vi': 'Cao Hùng' },
    'taichung': { 'zh-TW': '台中', 'zh-CN': '台中', 'en': 'Taichung', 'ja': '台中', 'ko': '타이중', 'es': 'Taichung', 'ms': 'Taichung', 'pt': 'Taichung', 'th': 'ไทจง', 'vi': 'Đài Trung' },
    'tainan': { 'zh-TW': '台南', 'zh-CN': '台南', 'en': 'Tainan', 'ja': '台南', 'ko': '타이난', 'es': 'Tainan', 'ms': 'Tainan', 'pt': 'Tainan', 'th': 'ไทหนาน', 'vi': 'Đài Nam' },
    'hualien': { 'zh-TW': '花蓮', 'zh-CN': '花莲', 'en': 'Hualien', 'ja': '花蓮', 'ko': '화롄', 'es': 'Hualien', 'ms': 'Hualien', 'pt': 'Hualien', 'th': 'ฮัวเหลียน', 'vi': 'Hoa Liên' },
    'kenting': { 'zh-TW': '墾丁', 'zh-CN': '墾丁', 'en': 'Kenting', 'ja': '墾丁', 'ko': '켄팅', 'es': 'Kenting', 'ms': 'Kenting', 'pt': 'Kenting', 'th': 'เขิ่นติง', 'vi': 'Khẩn Đinh' },
    'bangkok': { 'zh-TW': '曼谷', 'zh-CN': '曼谷', 'en': 'Bangkok', 'ja': 'バンコク', 'ko': '방콕', 'es': 'Bangkok', 'ms': 'Bangkok', 'pt': 'Bangkok', 'th': 'กรุงเทพฯ', 'vi': 'Bangkok' },
    'pattaya': { 'zh-TW': '芭達雅', 'zh-CN': '芭达雅', 'en': 'Pattaya', 'ja': 'パタヤ', 'ko': '파타야', 'es': 'Pattaya', 'ms': 'Pattaya', 'pt': 'Pattaya', 'th': 'พัทยา', 'vi': 'Pattaya' },
    'phuket': { 'zh-TW': '普吉島', 'zh-CN': '普吉岛', 'en': 'Phuket', 'ja': 'プーケット', 'ko': '푸켓', 'es': 'Phuket', 'ms': 'Phuket', 'pt': 'Phuket', 'th': 'ภูเก็ต', 'vi': 'Phuket' },
    'chiang mai': { 'zh-TW': '清邁', 'zh-CN': '清迈', 'en': 'Chiang Mai', 'ja': 'チェンマイ', 'ko': '치앙마이', 'es': 'Chiang Mai', 'ms': 'Chiang Mai', 'pt': 'Chiang Mai', 'th': 'เชียงใหม่', 'vi': 'Chiang Mai' },
    'seoul': { 'zh-TW': '首爾', 'zh-CN': '首尔', 'en': 'Seoul', 'ja': 'ソウル', 'ko': '서울', 'es': 'Seúl', 'ms': 'Seoul', 'pt': 'Seul', 'th': 'โซล', 'vi': 'Seoul' },
    'incheon': { 'zh-TW': '仁川', 'zh-CN': '仁川', 'en': 'Incheon', 'ja': '仁川', 'ko': '인천', 'es': 'Incheon', 'ms': 'Incheon', 'pt': 'Incheon', 'th': '인천', 'vi': 'Incheon' },
    'busan': { 'zh-TW': '釜山', 'zh-CN': '釜山', 'en': 'Busan', 'ja': 'プサン', 'ko': '부산', 'es': 'Busán', 'ms': 'Busan', 'pt': 'Busan', 'th': 'ปูซาน', 'vi': 'Busan' },
    'jeju': { 'zh-TW': '濟州島', 'zh-CN': '济州岛', 'en': 'Jeju', 'ja': '済州島', 'ko': '제주도', 'es': 'Jeju', 'ms': 'Jeju', 'pt': 'Jeju', 'th': 'เจจู', 'vi': 'Jeju' },
    'paris': { 'zh-TW': '巴黎', 'zh-CN': '巴黎', 'en': 'Paris', 'ja': 'パリ', 'ko': '파리', 'es': 'París', 'ms': 'Paris', 'pt': 'Paris', 'th': 'ปารีส', 'vi': 'Paris' },
    'london': { 'zh-TW': '倫敦', 'zh-CN': '伦敦', 'en': 'London', 'ja': 'ロンドン', 'ko': '런던', 'es': 'Londres', 'ms': 'London', 'pt': 'Londres', 'th': 'ลอนดอน', 'vi': 'Luân Đôn' },
    'new york': { 'zh-TW': '紐約', 'zh-CN': '纽约', 'en': 'New York', 'ja': 'ニューヨーク', 'ko': '뉴욕', 'es': 'Nueva York', 'ms': 'New York', 'pt': 'Nova Iorque', 'th': 'นิวยอร์ก', 'vi': 'New York' },
    'rome': { 'zh-TW': '羅馬', 'zh-CN': '羅馬', 'en': 'Rome', 'ja': 'ローマ', 'ko': '로마', 'es': 'Roma', 'ms': 'Rome', 'pt': 'Roma', 'th': 'โรม', 'vi': 'Rome' },
    'sydney': { 'zh-TW': '雪梨', 'zh-CN': '雪梨', 'en': 'Sydney', 'ja': 'シドニー', 'ko': '시드니', 'es': 'Sídney', 'ms': 'Sydney', 'pt': 'Sydney', 'th': 'ซิดนีย์', 'vi': 'Sydney' },
    'melbourne': { 'zh-TW': '墨爾本', 'zh-CN': '墨尔本', 'en': 'Melbourne', 'ja': 'メルボルン', 'ko': '멜버른', 'es': 'Melbourne', 'ms': 'Melbourne', 'pt': 'Melbourne', 'th': 'เมลเบิร์น', 'vi': 'Melbourne' },
    'singapore': { 'zh-TW': '新加坡', 'zh-CN': '新加坡', 'en': 'Singapore', 'ja': 'シンガポール', 'ko': '싱가포르', 'es': 'Singapur', 'ms': 'Singapura', 'pt': 'Singapura', 'th': 'สิงคโปร์', 'vi': 'Singapore' },
    'hong kong': { 'zh-TW': '香港', 'zh-CN': '香港', 'en': 'Hong Kong', 'ja': '香港', 'ko': '홍콩', 'es': 'Hong Kong', 'ms': 'Hong Kong', 'pt': 'Hong Kong', 'th': 'ฮ่องกง', 'vi': 'Hồng Kông' },
    'macau': { 'zh-TW': '澳門', 'zh-CN': '澳门', 'en': 'Macau', 'ja': 'マカオ', 'ko': '마카오', 'es': 'Macao', 'ms': 'Macau', 'pt': 'Macau', 'th': 'มาเก๊า', 'vi': 'Macao' }
  };

  const val = dict[lower];
  if (val) {
    return val[locale] || val['en'] || prefix;
  }
  // If not found in dict, capitalize first letter of each word as a nice fallback for English/other
  return prefix.replace(/\b\w/g, c => c.toUpperCase());
}

