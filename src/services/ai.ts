import { TripSurvey } from '../types/survey';
import { Itinerary, ItineraryDay, Activity, TransportInfo } from '../types/itinerary';
import i18n from '../i18n';
import { SUGGESTED_DESTINATIONS } from '../constants/destinations';
import { fetchDestinationPOIs, POI, PoiCategory } from './poi';
import { fetchWikipediaSummaries } from './enrich';
import { detectGuideCountryKey, isCoveredGuideCountry, getDownloadableGuideCountry } from './guidePacks';

// ─── POI → 行程範本 轉換（規則式引擎使用） ───

/** 範本物件形狀，與 getDestTemplates 相容，另含真實座標 coords 供直接定位 */
interface DestTemplate {
  images: string[];
  titles: string[];
  localTitles: string[];
  descs: string[];
  coords?: { lat: number; lon: number }[];
}

/** 各分類的代表性示意圖（OpenTripMap radius 不含圖片，以分類對應穩定的免費圖庫） */
const CATEGORY_IMAGE: Record<PoiCategory, string> = {
  cultural: 'https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=600',
  historic: 'https://images.unsplash.com/photo-1558117338-7b6a3b6b6b6b?w=600',
  architecture: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=600',
  museum: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
  nature: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600',
  beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600',
  park: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600',
  religion: 'https://images.unsplash.com/photo-1545126178-862cdb469409?w=600',
  shopping: 'https://images.unsplash.com/photo-1481437156560-3205f6a55735?w=600',
  market: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600',
  amusement: 'https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?w=600',
  viewpoint: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
  entertainment: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600',
  other: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600',
};

/** 各語系的分類標籤，用於組裝制式但真實的景點描述 */
const CATEGORY_LABEL: Record<string, Record<PoiCategory, string>> = {
  'zh-TW': {
    cultural: '文化景點', historic: '歷史古蹟', architecture: '特色建築', museum: '博物館',
    nature: '自然景觀', beach: '海灘', park: '公園綠地', religion: '宗教廟宇',
    shopping: '購物商圈', market: '在地市集', food: '美食餐廳', amusement: '遊樂景點',
    viewpoint: '觀景點', entertainment: '娛樂場所', other: '熱門景點',
  },
  'zh-CN': {
    cultural: '文化景点', historic: '历史古迹', architecture: '特色建筑', museum: '博物馆',
    nature: '自然景观', beach: '海滩', park: '公园绿地', religion: '宗教庙宇',
    shopping: '购物商圈', market: '在地市集', food: '美食餐厅', amusement: '游乐景点',
    viewpoint: '观景点', entertainment: '娱乐场所', other: '热门景点',
  },
  'en': {
    cultural: 'cultural site', historic: 'historic landmark', architecture: 'notable architecture', museum: 'museum',
    nature: 'natural attraction', beach: 'beach', park: 'park', religion: 'temple / shrine',
    shopping: 'shopping district', market: 'local market', food: 'restaurant', amusement: 'attraction',
    viewpoint: 'viewpoint', entertainment: 'entertainment venue', other: 'popular spot',
  },
};

/**
 * 為真實 POI 產生較豐富的引言介紹（約 300 字）。OpenTripMap 的 radius 端點不附帶長文，
 * 故依分類組合具實質內容的段落，並對齊使用者語系；若有 localName 一併提示官方當地名稱。
 */
function buildPoiDescription(p: POI, destName: string, label: string, locale: string): string {
  const zh = locale.startsWith('zh');
  const isCn = locale === 'zh-CN';
  const local = p.localName && p.localName !== p.name ? p.localName : '';

  // 各分類的特色描述（繁中／簡中／英文）
  const traitMap: Record<string, [string, string, string]> = {
    religion: ['是當地重要的宗教與信仰場所，建築與雕飾往往承載著深厚的歷史與藝術價值，氣氛莊嚴而靜謐', '是当地重要的宗教与信仰场所，建筑与雕饰往往承载着深厚的历史与艺术价值，气氛庄严而宁静', 'an important place of worship whose architecture and ornamentation often carry deep historical and artistic value, with a solemn, serene atmosphere'],
    historic: ['見證了當地數百年的歷史變遷，是認識這座城市文化脈絡與往昔風華的重要窗口', '见证了当地数百年的历史变迁，是认识这座城市文化脉络与往昔风华的重要窗口', 'a witness to centuries of local history and a key window into the city\\\'s cultural roots and bygone splendor'],
    museum: ['典藏與展示了豐富的文物與藝術作品，適合放慢腳步細細品味，深入理解在地的歷史與創作能量', '典藏与展示了丰富的文物与艺术作品，适合放慢脚步细细品味，深入理解在地的历史与创作能量', 'home to rich collections and exhibits, ideal for a slow, immersive visit into local history and creativity'],
    architecture: ['以獨特的建築設計與工藝細節聞名，是建築愛好者與攝影者捕捉光影與線條的絕佳題材', '以独特的建筑设计与工艺细节闻名，是建筑爱好者与摄影者捕捉光影与线条的绝佳题材', 'renowned for its distinctive design and craftsmanship, a favorite subject for architecture lovers and photographers'],
    nature: ['擁有怡人的自然景觀，是遠離城市喧囂、親近山水、放鬆身心的理想去處', '拥有怡人的自然景观，是远离城市喧嚣、亲近山水、放松身心的理想去处', 'blessed with pleasant natural scenery, an ideal place to escape the city and unwind in nature'],
    park: ['綠意盎然、空間開闊，是當地人散步、野餐與休憩的日常生活場景，四季各有風情', '绿意盎然、空间开阔，是当地人散步、野餐与休憩的日常生活场景，四季各有风情', 'lush and spacious, a part of everyday local life for strolling and picnics, with charm in every season'],
    viewpoint: ['擁有絕佳的眺望視野，可將周邊景致一覽無遺，尤以日出、日落與夜景時分最為迷人', '拥有绝佳的眺望视野，可将周边景致一览无遗，尤以日出、日落与夜景时分最为迷人', 'offering sweeping panoramic views, especially magical at sunrise, sunset and after dark'],
    beach: ['擁有迷人的海岸線與水域，適合戲水、漫步沙灘或欣賞海天一色的開闊景致', '拥有迷人的海岸线与水域，适合戏水、漫步沙滩或欣赏海天一色的开阔景致', 'graced with an alluring coastline and waters, perfect for swimming, beach walks and wide ocean views'],
    market: ['匯聚琳瑯滿目的在地商品與小吃，是感受常民生活、人情味與道地風味的最佳場所', '汇聚琳琅满目的在地商品与小吃，是感受常民生活、人情味与道地风味的最佳场所', 'packed with local goods and street food — the best place to feel everyday life and authentic flavors'],
    shopping: ['集結眾多店家與品牌，從在地特產到國際精品一應俱全，是購物與閒逛的熱門去處', '集结众多店家与品牌，从在地特产到国际精品一应俱全，是购物与闲逛的热门去处', 'gathering numerous shops and brands from local specialties to international labels, a popular spot to browse and shop'],
    food: ['以道地的在地美食聞名，是品嚐當地風味、滿足味蕾的必訪去處', '以道地的在地美食闻名，是品尝当地风味、满足味蕾的必访去处', 'famous for authentic local cuisine, a must-visit to taste the flavors of the region'],
    amusement: ['充滿歡樂與活力，無論親子同遊或好友結伴，都能在此盡情享受多采多姿的體驗', '充满欢乐与活力，无论亲子同游或好友结伴，都能在此尽情享受多采多姿的体验', 'full of fun and energy, offering colorful experiences for families and friends alike'],
    entertainment: ['是當地藝文與娛樂活動的重要舞台，常有精彩的表演與展演活動輪番上演', '是当地艺文与娱乐活动的重要舞台，常有精彩的表演与展演活动轮番上演', 'a key stage for local arts and entertainment, often hosting wonderful performances and events'],
  };
  const trait = traitMap[p.category] || (zh
    ? ['是當地頗具人氣的造訪地點，融合了在地特色與獨特氛圍，值得細細探索', '是当地颇具人气的造访地点，融合了在地特色与独特氛围，值得细细探索', '']
    : ['', '', 'a popular local attraction blending regional character with a distinctive atmosphere, well worth exploring']);
  const traitText = zh ? (isCn ? trait[1] : trait[0]) : trait[2];

  if (zh) {
    const localHint = local ? `當地多以「${local}」稱之，現場叫車或使用地圖導航時可直接使用此名稱。` : '';
    return `「${p.name}」是位於${destName}、名列${label}的人氣景點，${traitText}。${localHint}` +
      `此地深受國內外旅客喜愛，無論是初次造訪或重遊，都能從不同角度感受其魅力。建議您預留充裕的時間，放慢腳步細細品味周邊的環境與氛圍，並留意現場的指示牌與參觀禮儀；若逢假日或旅遊旺季，人潮可能較多，宜避開尖峰時段以獲得更從容的體驗。` +
      `周邊通常亦有值得順道走訪的店家、餐飲與景點，可一併規劃延伸行程。實際的開放時間、票價、公休日與最新參觀規定可能隨季節調整，出發前請務必透過官方管道再次確認，以免向隅。`;
  }
  const localHint = local ? ` Locally it is commonly known as "${local}", a name you can use directly when hailing a ride or searching on maps.` : '';
  return `${p.name} is a popular ${label} in ${destName}, ${traitText}.${localHint}` +
    ` Beloved by both local and international travelers, it rewards first-time visitors and returning guests alike with something new from every angle. Allow yourself ample time to slow down and take in the surroundings and atmosphere, and be mindful of on-site signage and visitor etiquette; during weekends and peak seasons it can get crowded, so consider avoiding peak hours for a more relaxed experience.` +
    ` The area usually offers nearby shops, dining and sights worth combining into an extended outing. Opening hours, ticket prices, closing days and the latest visiting rules may change with the season, so please re-confirm via official channels before you go.`;
}

/** 由真實 POI 清單組裝出與 getDestTemplates 相容的範本物件 */
function buildDestTemplateFromPOIs(pois: POI[], destName: string, locale: string): DestTemplate {
  const labels = CATEGORY_LABEL[locale] || CATEGORY_LABEL['en'];
  const tpl: DestTemplate = { images: [], titles: [], localTitles: [], descs: [], coords: [] };
  for (const p of pois) {
    const label = labels[p.category] || labels.other;
    tpl.titles.push(p.name);
    tpl.localTitles.push(p.localName || p.name);
    tpl.images.push(CATEGORY_IMAGE[p.category] || CATEGORY_IMAGE.other);
    tpl.coords!.push({ lat: p.lat, lon: p.lon });
    tpl.descs.push(buildPoiDescription(p, destName, label, locale));
  }
  return tpl;
}

/** 由貼入的單行文字（網址或景點名稱）推估出標題與原始網址，供批次分析使用 */
function extractTitleFromLine(line: string): { title: string; url: string } {
  const trimmed = line.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return { title: trimmed, url: '' };
  }
  try {
    const u = new URL(trimmed);
    const segments = u.pathname.split('/').filter(Boolean);

    // Google Maps: /maps/place/<NAME>/...
    const placeIdx = segments.indexOf('place');
    if (placeIdx !== -1 && segments[placeIdx + 1]) {
      const name = decodeURIComponent(segments[placeIdx + 1]).replace(/\+/g, ' ');
      return { title: name, url: trimmed };
    }

    // 一般網址：取最後一個有意義的路徑片段，去除前綴數字編號與分隔符號
    let last = segments[segments.length - 1] || u.hostname;
    last = decodeURIComponent(last).replace(/^\d+-/, '').replace(/[-_+]/g, ' ').trim();
    if (!last) last = u.hostname;
    return { title: last, url: trimmed };
  } catch {
    return { title: trimmed, url: trimmed };
  }
}

/** 依關鍵字規則推估景點分類，供批次分析使用 */
const BATCH_CATEGORY_KEYWORDS: { category: string; keywords: string[] }[] = [
  { category: 'hotel', keywords: ['hotel', 'resort', 'inn', '飯店', '酒店', '民宿', '旅館'] },
  { category: 'food', keywords: ['restaurant', 'food', 'noodle', 'cafe', 'coffee', 'bbq', 'buffet', '咖啡', '餐廳', '小吃', '美食', '料理', '燒肉'] },
  { category: 'shopping', keywords: ['mall', 'market', 'shopping', 'outlet', '市場', '商場', '夜市', '百貨'] },
  { category: 'transport', keywords: ['airport', 'station', 'transfer', 'taxi', '機場', '車站', '車程'] },
  { category: 'spa', keywords: ['spa', 'massage', 'onsen', '按摩', '溫泉', 'spa'] },
  { category: 'entertainment', keywords: ['museum', 'zoo', 'aquarium', 'theme park', '樂園', '博物館', '動物園', '水族館', '美術館'] },
];

function guessCategoryFromText(text: string): string {
  const lower = text.toLowerCase();
  for (const { category, keywords } of BATCH_CATEGORY_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  if (lower.includes('klook') || lower.includes('kkday')) return 'activity';
  return 'attraction';
}

function healItineraryCoordinates(itinerary: any, survey: TripSurvey) {
  if (!itinerary) return;

  let defaultDest = { name: '台北', latitude: 25.0330, longitude: 121.5654 };
  const firstSurveyDest = survey.destinations?.[0];
  if (firstSurveyDest) {
    const matched = SUGGESTED_DESTINATIONS.find(d => 
      d.name === firstSurveyDest.name || 
      d.name_en?.toLowerCase() === firstSurveyDest.name?.toLowerCase() ||
      d.name_zh_tw === firstSurveyDest.name ||
      d.name_zh_cn === firstSurveyDest.name
    );
    if (matched) {
      defaultDest = { name: matched.name, latitude: matched.latitude, longitude: matched.longitude };
    } else if (firstSurveyDest.latitude && firstSurveyDest.longitude) {
      defaultDest = { name: firstSurveyDest.name, latitude: firstSurveyDest.latitude, longitude: firstSurveyDest.longitude };
    }
  }

  const currency = survey.currency || 'TWD';
  
  // 1. 航班時間對齊自癒
  if (itinerary.days && itinerary.days.length > 0) {
    const days = itinerary.days;
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    const destName = firstDay.region || defaultDest.name || '當地';

    const outgoingFlight = survey.flights?.find(f => !f.isReturn);
    const returnFlight = survey.flights?.find(f => f.isReturn);

    // 去程對齊自癒
    if (firstDay.activities && firstDay.activities.length > 0) {
      const arrTime = (outgoingFlight && outgoingFlight.arrivalTime) ? outgoingFlight.arrivalTime : '08:30';
      const arrEndTime = addMinutesToTime(arrTime, 90);
      const firstAct = firstDay.activities[0];

      if (!firstAct.title.includes('機場') && !firstAct.title.toLowerCase().includes('airport')) {
        firstDay.activities.unshift({
          id: `act-day1-start-forced-heal`,
          order: 0,
          startTime: arrTime,
          endTime: arrEndTime,
          title: outgoingFlight ? `抵達當地機場 (${outgoingFlight.flightNumber})` : '抵達當地機場',
          type: 'transport',
          description: '順利抵達當地機場，完成通關手續並領取行李。建議您先在機場購買當地的網卡或兌換部分當地貨幣，為接下來的旅程做好準備。',
          location: { name: `${destName}國際機場`, address: `${destName}機場航廈`, latitude: defaultDest.latitude || 0, longitude: defaultDest.longitude || 0 },
          duration: 90,
          transport: { mode: 'charter', duration: 45, distance: 30000, description: '搭乘機場接送專車直達市區。' },
          links: [{ label: 'Klook 機場接送預訂', url: 'https://www.klook.com/', type: 'booking' }],
          notes: '請備妥入境文件與護照。',
          photoUrl: 'local-asset://airport_map',
          cost: { amount: 0, currency },
          openingHours: '24小時開放'
        });
      } else {
        firstAct.photoUrl = 'local-asset://airport_map';
        firstAct.startTime = arrTime;
        firstAct.endTime = arrEndTime;
        firstAct.duration = 90;
        if (outgoingFlight) {
          firstAct.title = `抵達當地機場 (${outgoingFlight.flightNumber})`;
        }
      }

      // 重新對齊第一天後續所有景點的時間順序
      firstDay.activities.forEach((a: any, idx: number) => a.order = idx);
      for (let idx = 1; idx < firstDay.activities.length; idx++) {
        const prev = firstDay.activities[idx - 1];
        const curr = firstDay.activities[idx];
        const transDuration = prev.transport?.duration || 15;
        const earliestStart = addMinutesToTime(prev.endTime, transDuration);
        if (curr.startTime < earliestStart) {
          const duration = curr.duration || 60;
          curr.startTime = earliestStart;
          curr.endTime = addMinutesToTime(earliestStart, duration);
        }
      }
    }

    // 回程對齊自癒
    if (lastDay.activities && lastDay.activities.length > 0) {
      const depTime = (returnFlight && returnFlight.departureTime) ? returnFlight.departureTime : '18:00';
      const airportStart = subMinutesFromTime(depTime, 150);
      let lastAct = lastDay.activities[lastDay.activities.length - 1];

      if (!lastAct.title.includes('機場') && !lastAct.title.toLowerCase().includes('airport')) {
        lastDay.activities.push({
          id: `act-day${days.length}-end-forced-heal`,
          order: lastDay.activities.length,
          startTime: airportStart,
          endTime: depTime,
          title: returnFlight ? `抵達機場準備返航 (${returnFlight.flightNumber})` : '抵達機場準備返國',
          type: 'transport',
          description: '帶著滿滿的美好回憶，抵達機場準備搭機返國。建議您預留足夠的時間辦理退稅手續，並在免稅店做最後的採購。',
          location: { name: `${destName}國際機場`, address: `${destName}機場航廈`, latitude: defaultDest.latitude || 0, longitude: defaultDest.longitude || 0 },
          duration: 150,
          transport: { mode: 'charter', duration: 45, distance: 30000, description: '搭乘包車前往機場。' },
          links: [{ label: '當地推薦安全叫車 App', url: 'https://www.grab.com/', type: 'info' }],
          notes: returnFlight ? `航班時間：${depTime}。請務必再三確認護照與隨身行李是否帶齊。` : '請提早2-3小時抵達機場。',
          photoUrl: 'local-asset://airport_map',
          cost: { amount: 0, currency },
          openingHours: '24小時開放'
        });
      } else {
        lastAct.photoUrl = 'local-asset://airport_map';
        lastAct.startTime = airportStart;
        lastAct.endTime = depTime;
        lastAct.duration = 150;
        if (returnFlight) {
          lastAct.title = `抵達機場準備返航 (${returnFlight.flightNumber})`;
          lastAct.notes = `航班時間：${depTime}。請務必再三確認護照與隨身行李是否帶齊。`;
        }
      }

      // 由後往前推算最後一天的活動時間，防止與返航機場時間衝突
      let targetEnd = airportStart;
      const remainingActivities = lastDay.activities.slice(0, -1);
      for (let idx = remainingActivities.length - 1; idx >= 0; idx--) {
        const act = remainingActivities[idx];
        const transDuration = act.transport?.duration || 15;
        const latestEnd = subMinutesFromTime(targetEnd, transDuration);
        if (act.endTime > latestEnd) {
          act.endTime = latestEnd;
          const duration = act.duration || 60;
          act.startTime = subMinutesFromTime(latestEnd, duration);
        }
        targetEnd = act.startTime;
      }

      // 重新排序並過濾掉時間太早的中間活動
      const validActs = lastDay.activities.filter((act: any, idx: number) => {
        if (idx === 0 || idx === lastDay.activities.length - 1) return true;
        return act.startTime >= '07:30';
      });
      validActs.forEach((a: any, idx: number) => a.order = idx);
      lastDay.activities = validActs;
    }
  }

  // 2. 經緯度座標自癒
  const cityCoords: Record<string, { lat: number; lng: number }> = {};
  if (Array.isArray(SUGGESTED_DESTINATIONS)) {
    SUGGESTED_DESTINATIONS.forEach(d => {
      if (d) {
        if (d.name) cityCoords[d.name.toLowerCase()] = { lat: d.latitude, lng: d.longitude };
        if (d.name_en) cityCoords[d.name_en.toLowerCase()] = { lat: d.latitude, lng: d.longitude };
        if (d.name_zh_tw) cityCoords[d.name_zh_tw.toLowerCase()] = { lat: d.latitude, lng: d.longitude };
        if (d.name_zh_cn) cityCoords[d.name_zh_cn.toLowerCase()] = { lat: d.latitude, lng: d.longitude };
      }
    });
  }

  if (Array.isArray(survey.destinations)) {
    survey.destinations.forEach(d => {
      if (d && d.name && d.latitude && d.longitude) {
        cityCoords[d.name.toLowerCase()] = { lat: d.latitude, lng: d.longitude };
        if (d.country) {
          cityCoords[d.country.toLowerCase()] = { lat: d.latitude, lng: d.longitude };
        }
      }
    });
  }

  itinerary.days?.forEach((day: any) => {
    const regionName = (day.region || defaultDest.name || '').toLowerCase();
    let baseLat = defaultDest.latitude || 25.0330;
    let baseLng = defaultDest.longitude || 121.5654;

    for (const key of Object.keys(cityCoords)) {
      if (regionName.includes(key) || key.includes(regionName)) {
        baseLat = cityCoords[key].lat;
        baseLng = cityCoords[key].lng;
        break;
      }
    }

    day.activities?.forEach((act: any, idx: number) => {
      if (!act.location) {
        act.location = { name: act.title, address: act.title };
      }
      
      const lat = parseFloat(act.location.latitude);
      const lng = parseFloat(act.location.longitude);
      
      if (isNaN(lat) || lat === 0 || isNaN(lng) || lng === 0) {
        const offsetLat = (Math.sin(idx + 1) * 0.008);
        const offsetLng = (Math.cos(idx + 1) * 0.008);
        act.location.latitude = baseLat + offsetLat;
        act.location.longitude = baseLng + offsetLng;
        console.log(`[Coordinate Healing] Healed coordinate for "${act.title}" to (${act.location.latitude.toFixed(4)}, ${act.location.longitude.toFixed(4)})`);
      } else {
        act.location.latitude = lat;
        act.location.longitude = lng;
      }
    });
  });
}

function getFallbackGuideInfo(country: string): any {
  const safeCountry = country || '泰國';
  const locale = i18n.locale || 'zh-TW';
  const isEn = !locale.startsWith('zh');

  const key = detectGuideCountryKey(safeCountry);
  const isJapan = key === 'japan';
  const isKorea = key === 'korea';
  const isVietnam = key === 'vietnam';
  const isTaiwan = key === 'taiwan';
  const isSingapore = key === 'singapore';

  if (isJapan) {
    return {
      currencyCode: "JPY",
      currencyName: isEn ? "Japanese Yen" : "日圓",
      emergencyContacts: [
        { title: isEn ? "Police" : "警察局 (報案)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "110" },
        { title: isEn ? "Ambulance/Fire" : "消防/救護車 (急救)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "119" },
        { title: isEn ? "Foreigner Hotline" : "外國人熱線 (諮詢)", subTitle: isEn ? "Tokyo English Help" : "東京都外籍諮詢", phone: "03-5320-7744" }
      ],
      usefulPhrases: [
        { local: "Konnichiwa", zh: isEn ? "Hello" : "你好", isHighlight: false },
        { local: "Arigatou gozaimasu", zh: isEn ? "Thank you" : "謝謝", isHighlight: false },
        { local: "Kore wa ikura desu ka?", zh: isEn ? "How much is this?" : "這多少錢？", isHighlight: true }
      ],
      guideItems: [
        { item: isEn ? "Ramen (1 Bowl)" : "拉麵一碗", priceRange: "800 - 1200 JPY" },
        { item: isEn ? "Convenience Store Rice Ball" : "便利商店飯糰", priceRange: "130 - 200 JPY" },
        { item: isEn ? "Subway 1-Day Pass" : "地鐵一日券", priceRange: "800 JPY" }
      ]
    };
  }

  if (isKorea) {
    return {
      currencyCode: "KRW",
      currencyName: isEn ? "South Korean Won" : "韓元",
      emergencyContacts: [
        { title: isEn ? "Police" : "警察局 (報案)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "112" },
        { title: isEn ? "Ambulance/Fire" : "消防/救護車 (急救)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "119" },
        { title: isEn ? "Tourist Guide" : "觀光諮詢熱線", subTitle: isEn ? "English/Chinese Support" : "多國語系觀光諮詢", phone: "1330" }
      ],
      usefulPhrases: [
        { local: "An-nyeong-ha-se-yo", zh: isEn ? "Hello" : "你好", isHighlight: false },
        { local: "Gam-sa-ham-ni-da", zh: isEn ? "Thank you" : "謝謝", isHighlight: false },
        { local: "I-geo-eol-ma-yeo-yo?", zh: isEn ? "How much is this?" : "這多少錢？", isHighlight: true }
      ],
      guideItems: [
        { item: isEn ? "Korean Fried Chicken" : "韓式炸雞", priceRange: "18000 - 22000 KRW" },
        { item: isEn ? "Street Food (Tteokbokki)" : "路邊攤辣炒年糕", priceRange: "3000 - 5000 KRW" },
        { item: isEn ? "Cafe Americano" : "咖啡店美式咖啡", priceRange: "4000 - 5000 KRW" }
      ]
    };
  }

  if (isVietnam) {
    return {
      currencyCode: "VND",
      currencyName: isEn ? "Vietnamese Dong" : "越南盾",
      emergencyContacts: [
        { title: isEn ? "Police" : "警察局 (報案)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "113" },
        { title: isEn ? "Ambulance" : "救護車 (急救)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "115" },
        { title: isEn ? "Tourist Support" : "觀光支援熱線", subTitle: isEn ? "English service" : "英文服務熱線", phone: "024-3926-1515" }
      ],
      usefulPhrases: [
        { local: "Xin chào", zh: isEn ? "Hello" : "你好", isHighlight: false },
        { local: "Cảm ơn", zh: isEn ? "Thank you" : "謝謝", isHighlight: false },
        { local: "Cái này bao nhiêu tiền?", zh: isEn ? "How much is this?" : "這多少錢？", isHighlight: true }
      ],
      guideItems: [
        { item: isEn ? "Pho (Vietnamese Noodle)" : "越式河粉一碗", priceRange: "40000 - 70000 VND" },
        { item: isEn ? "Vietnamese Coffee" : "越式滴濾咖啡", priceRange: "25000 - 45000 VND" },
        { item: isEn ? "Banh Mi (Baguette)" : "越式法國麵包", priceRange: "20000 - 35000 VND" }
      ]
    };
  }

  if (isTaiwan) {
    return {
      currencyCode: "TWD",
      currencyName: isEn ? "New Taiwan Dollar" : "新台幣",
      emergencyContacts: [
        { title: isEn ? "Police" : "警察局 (報案)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "110" },
        { title: isEn ? "Ambulance/Fire" : "消防/救護車 (急救)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "119" },
        { title: isEn ? "Tourist Hotline" : "觀光局旅遊熱線", subTitle: isEn ? "English/Chinese/Japanese" : "多國語系服務", phone: "0800-011-765" }
      ],
      usefulPhrases: [
        { local: "Ni hao", zh: isEn ? "Hello" : "你好", isHighlight: false },
        { local: "Xie xie", zh: isEn ? "Thank you" : "謝謝", isHighlight: false },
        { local: "Zhe ge duo shao qian?", zh: isEn ? "How much is this?" : "這多少錢？", isHighlight: true }
      ],
      guideItems: [
        { item: isEn ? "Bubble Milk Tea" : "珍珠奶茶", priceRange: "55 - 80 TWD" },
        { item: isEn ? "Beef Noodles" : "牛肉麵一碗", priceRange: "150 - 250 TWD" },
        { item: isEn ? "Taipei MRT 1-Day Pass" : "台北捷運一日票", priceRange: "150 TWD" }
      ]
    };
  }

  if (isSingapore) {
    return {
      currencyCode: "SGD",
      currencyName: isEn ? "Singapore Dollar" : "新加坡元",
      emergencyContacts: [
        { title: isEn ? "Police" : "警察局 (報案)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "999" },
        { title: isEn ? "Ambulance/Fire" : "消防/救護車 (急救)", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "995" },
        { title: isEn ? "Tourist Hotline" : "旅客諮詢熱線", subTitle: isEn ? "English Support" : "英文諮詢服務", phone: "1800-736-2000" }
      ],
      usefulPhrases: [
        { local: "Hello", zh: isEn ? "Hello" : "你好", isHighlight: false },
        { local: "Thank you", zh: isEn ? "Thank you" : "謝謝", isHighlight: false },
        { local: "How much is this?", zh: isEn ? "How much is this?" : "這多少錢？", isHighlight: true }
      ],
      guideItems: [
        { item: isEn ? "Hainan Chicken Rice" : "海南雞飯", priceRange: "5 - 8 SGD" },
        { item: isEn ? "Kaya Toast Set" : "咖椰吐司套餐", priceRange: "4 - 6 SGD" },
        { item: isEn ? "EZ-Link Card" : "交通易通卡", priceRange: "10 SGD" }
      ]
    };
  }

  // Default Fallback is Thailand
  return {
    currencyCode: "THB",
    currencyName: isEn ? "Thai Baht" : "泰銖",
    emergencyContacts: [
      { title: isEn ? "Tourist Police" : "觀光警察", subTitle: isEn ? "English Support" : "中英文與24小時服務", phone: "1155" },
      { title: isEn ? "Police" : "報警與緊急求助", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "191" },
      { title: isEn ? "Ambulance/Fire" : "救護車與火警", subTitle: isEn ? "24-hour service" : "24小時免費服務", phone: "199" }
    ],
    usefulPhrases: [
      { local: "Sawasdee krub/ka", zh: isEn ? "Hello" : "你好", isHighlight: false },
      { local: "Khob khun krub/ka", zh: isEn ? "Thank you" : "謝謝", isHighlight: false },
      { local: "Nee tao rai?", zh: isEn ? "How much is this?" : "這多少錢？", isHighlight: true }
    ],
    guideItems: [
      { item: isEn ? "Pad Thai" : "路邊攤泰式炒河粉", priceRange: "50 - 80 THB" },
      { item: isEn ? "Coconut (1 Pcs)" : "椰子水 (一粒)", priceRange: "40 - 60 THB" },
      { item: isEn ? "Thai Massage (1 Hour)" : "泰式古法按摩 (1小時)", priceRange: "250 - 400 THB" }
    ]
  };
}

export const aiService = {
  healItineraryCoordinates(itinerary: any, survey: TripSurvey) {
    healItineraryCoordinates(itinerary, survey);
  },

  /**
   * 主要行程生成入口：採「規則式引擎 + 免費 POI（OpenTripMap）」，完全不依賴 LLM／無配額問題。
   * 排程完全依 CLAUDE.md 規則（航班時間、飯店日期區間、每日起訖閉環、興趣、步調）由本程式控制。
   */
  async generateItinerary(survey: TripSurvey): Promise<Itinerary> {
    return this.generateRuleBasedItinerary(survey);
  },

  /**
   * 規則式行程引擎：逐目的地抓取真實 POI，套入確定性排程器產出行程。
   */
  async generateRuleBasedItinerary(survey: TripSurvey): Promise<Itinerary> {
    const appLocale = i18n.locale || survey.locale || 'zh-TW';
    const alignedSurvey = { ...survey, locale: appLocale };

    const start = new Date(alignedSurvey?.dates?.startDate || Date.now());
    const end = new Date(alignedSurvey?.dates?.endDate || Date.now() + 86400000 * 3);
    const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    const limitPerDest = Math.max(12, dayCount * 3);

    // 逐目的地抓取真實 POI（並行），組成範本；任何目的地失敗則該地退回內建範本。
    const poiByDest: Record<string, DestTemplate> = {};
    const dests = alignedSurvey?.destinations || [];
    await Promise.all(dests.map(async (d) => {
      if (!d?.name || poiByDest[d.name]) return;
      try {
        const pois = await fetchDestinationPOIs({
          destName: d.name,
          lat: d.latitude,
          lon: d.longitude,
          interests: alignedSurvey.interests || [],
          limit: limitPerDest,
        });
        if (pois.length > 0) {
          poiByDest[d.name] = buildDestTemplateFromPOIs(pois, d.name, appLocale);
        }
      } catch (e) {
        console.warn(`[generateRuleBasedItinerary] 取得 ${d.name} POI 失敗，改用內建範本`, e);
      }
    }));

    // 以維基百科摘要動態補強各景點介紹（免金鑰），命中則覆寫較豐富的權威描述；
    // 失敗者沿用 buildPoiDescription 既有內容。優先以官方當地名稱查詢以提高命中率。
    try {
      await Promise.all(Object.values(poiByDest).map(async (tpl) => {
        if (!tpl?.titles?.length) return;
        const queryTitles = tpl.titles.map((t, idx) => (tpl.localTitles?.[idx] || t));
        const summaries = await fetchWikipediaSummaries(queryTitles, appLocale);
        tpl.descs = tpl.descs.map((d, idx) => summaries[queryTitles[idx]] || d);
      }));
    } catch (e) {
      console.warn('[generateRuleBasedItinerary] 維基百科介紹補強失敗，沿用內建描述', e);
    }

    const itinerary = this.generateFallbackItinerary(alignedSurvey, poiByDest);
    // 此為正式生成方式（非 AI 失敗備援），故不標記 generatedByFallback。
    healItineraryCoordinates(itinerary, alignedSurvey);
    return itinerary;
  },

  /**
   * Generates a structural fallback itinerary matching survey inputs
   */
  generateFallbackItinerary(survey: TripSurvey, poiByDest?: Record<string, DestTemplate>): Itinerary {
    const start = new Date(survey?.dates?.startDate || Date.now());
    const end = new Date(survey?.dates?.endDate || Date.now() + 86400000 * 3);
    const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const days: ItineraryDay[] = [];
    const mainDest = survey?.destinations?.[0]?.name || '台北';
    const country = survey?.destinations?.[0]?.country || '台灣';
    const currency = survey?.currency || 'TWD';
    const locale = survey?.locale || 'zh-TW';

    const outgoingFlight = survey?.flights?.find(f => !f.isReturn);
    const returnFlight = survey?.flights?.find(f => f.isReturn);

    // 1. 本地多語系對照字典
    const LOCALIZED_STRINGS: Record<string, any> = {
      'zh-TW': {
        arriveAirport: '抵達當地機場',
        arriveAirportDesc: '順利抵達當地機場，完成通關手續並領取行李。建議您先在機場購買當地的網卡或兌換部分當地貨幣，為接下來的旅程做好準備。',
        arriveAirportLocName: '國際機場',
        arriveAirportLocAddress: '機場航廈',
        airportTransportDesc: '搭乘機場接送專車直達市區，省去搬運行李的麻煩。',
        airportLink: 'Klook 機場接送預訂',
        airportNotes: '請備妥入境文件與護照。',
        airportHours: '24小時開放',
        checkInHotel: '前往飯店辦理入住',
        checkInHotelDesc: '抵達機場後，先搭乘交通工具前往飯店辦理入住手續並寄放行李，安頓妥當後再展開當日行程，免去拖著行李到處走的不便。',
        departHotel: '從飯店出發',
        departHotelDesc: '在飯店享用完豐盛的早餐後，整理行囊準備出發。今日行程較為豐富，建議攜帶足夠的飲用水與防曬用品。',
        hotelName: '精選特色飯店',
        hotelAddress: '市中心街區',
        hotelTransportDesc: '搭乘包車前往第一站，當地包車服務安全有保障，司機皆具備良民證。',
        hotelLink: 'Klook 推薦交通與包車',
        lunchTitle: '午餐：',
        lunchDesc: '這家在地私房菜館不僅提供道地的傳統風味，更是當地老饕的首選。每一道菜品背後都有著深厚的家傳淵源，使用每日清晨從市集採購的最新鮮食材製作。AI 根據您的預算級別與飲食偏好為您精選，提供乾淨衛生的用餐環境與豐富的素食、過敏原標示選擇。',
        lunchLocName: '人氣在地風味館',
        lunchLocAddress: '美食街區',
        lunchTransportDesc: '自景點步行約 5 分鐘至捷運站，搭乘捷運至市中心站，出站後由 3 號出口步行即達。',
        lunchNotes: '午餐時間人潮較多，已為您將時間遷就並避開最擁擠時段。',
        returnHotel: '返回飯店休息',
        returnHotelDesc: '結束一整天豐富充實的行程，搭乘交通工具返回溫馨舒適的飯店。您可以先洗去一身的疲憊，或是在飯店周邊的便利商店採買宵夜，為明天的旅程充飽電。',
        returnHotelTransportDesc: '搭乘包車返回飯店，夜間搭車請隨時留意隨身物品。',
        grabLink: '當地推薦安全叫車 App',
        checklistTipTitle: '當地小費與消費習慣',
        checklistTipContent: '一般餐廳已包含服務費。路邊小吃與市場以現金支付為主，部分商店支援行動支付。',
        wifiTipTitle: '上網與通訊建議',
        wifiTipContent: '推薦於機場領取實體 SIM 卡或提前開通 eSIM，在市區內各景點連線訊號極佳。',
        dayTitle: 'Day {day} - {dest}探索之旅',
        daySummary: '深度探訪 {dest} 的核心觀光資源，感受當地的獨特氛圍。',
        itineraryTitle: '{dests} {days} 天智慧之旅',
        emergencyPolice: '當地觀光警察局',
        emergencyPoliceDesc: '24小時英文求助專線',
        emergencyGeneral: '緊急救援專線',
        mustVisitTitle: '必訪景點：{value}',
        mustVisitDesc: '這是您在問卷中指定安排的必去景點。這座景點蘊含了深厚的文化底蘊與獨特的歷史背景，是當地最具代表性的地標之一。我們為您安排在上午時段前往，避開了午後擁擠的人潮，讓您能有更充裕的時間細細品味這裡的建築之美與人文風情。建議您可以尋找當地的專業導覽，進一步了解其背後動人的故事與傳說。',
        refUrlDesc: '（參照您提供的參考網站進行深度遊覽）',
        refUrlLabel: '使用者參考網站',
        attractionNotes: '建議穿著舒適好走的鞋子，並攜帶水壺。',
        activityNotes: '適合拍照留念與挑選伴手禮，可使用行動支付。',
        classicAttraction: '經典名勝',
        commercialDistrict: '商圈地標'
      },
      'zh-CN': {
        arriveAirport: '抵达当地机场',
        arriveAirportDesc: '顺利抵达当地机场，完成通关手续并领取行李。建议您先在机场购买当地的网卡或兑换部分当地货币，为接下来的旅程做好准备。',
        arriveAirportLocName: '国际机场',
        arriveAirportLocAddress: '机场航站楼',
        airportTransportDesc: '搭乘机场接送专车直达市区，省去搬运大件行李的麻烦。',
        airportLink: 'Klook 机场接送预订',
        airportNotes: '请备妥入境文件与护照。',
        airportHours: '24小时开放',
        checkInHotel: '前往酒店办理入住',
        checkInHotelDesc: '抵达机场后，先搭乘交通工具前往酒店办理入住手续并寄存行李，安顿妥当后再展开当日行程，免去拖着行李到处走的不便。',
        departHotel: '从酒店出发',
        departHotelDesc: '在酒店享用完丰盛的早餐后，整理行囊准备出发。今日行程较为丰富，建议携带足够的饮用水与防晒用品。',
        hotelName: '精选特色酒店',
        hotelAddress: '市中心街区',
        hotelTransportDesc: '搭乘包车前往第一站，当地包车服务安全有保障，司机皆具备良民证。',
        hotelLink: 'Klook 推荐交通与包车',
        lunchTitle: '午餐：',
        lunchDesc: '这家在地私房菜馆不仅提供道地的传统风味，更是当地饕客的首选。每一道菜品背后都有着深厚的家传渊源，使用每日清晨从市集采购最新鲜食材制作。AI 根据您的预算级别与饮食偏好为您精选，提供干净卫生的用餐环境与丰富的素食、过敏原标示选择。',
        lunchLocName: '人气在地风味馆',
        lunchLocAddress: '美食街区',
        lunchTransportDesc: '自景点步行约 5 分钟至捷运站，搭乘捷运至市中心站，出站后由 3 号出口步行即达。',
        lunchNotes: '午餐时间人潮较多，已为您将时间迁就并避开最拥挤时段。',
        returnHotel: '返回酒店休息',
        returnHotelDesc: '结束一整天丰富充实的行程，搭乘交通工具返回温馨舒适的酒店。您可以先洗去一身的疲惫，或是在酒店周边的便利店采买夜宵，为明天的旅程充饱电。',
        returnHotelTransportDesc: '搭乘包车返回酒店，夜间搭车请随时留意随身物品。',
        grabLink: '当地推荐安全叫车 App',
        checklistTipTitle: '当地小费与消费习惯',
        checklistTipContent: '一般餐厅已包含服务费。路边小吃与市场以现金支付为主，部分商店支持移动支付。',
        wifiTipTitle: '上网与通讯建议',
        wifiTipContent: '推荐于机场领取实体 SIM 卡或提前开通 eSIM，在市区内各景点连线信号极佳。',
        dayTitle: 'Day {day} - {dest}探索之旅',
        daySummary: '深度探访 {dest} 的核心观光资源，感受当地的独特氛围。',
        itineraryTitle: '{dests} {days} 天智慧之旅',
        emergencyPolice: '当地观光警察局',
        emergencyPoliceDesc: '24小时英文求助专线',
        emergencyGeneral: '紧急救援专线',
        mustVisitTitle: '必访景点：{value}',
        mustVisitDesc: '这是您在问卷中指定安排 of 的必去景点。这座景点蕴含了深厚的文化底蕴与独特的历史背景，是当地最具代表性的地标之一。我们为您安排在上午时段前往，避开了午后拥挤的人潮，让您能有更充裕的时间细细品味这里的建筑之美与人文风情。建议您可以寻找当地的专业导览，进一步了解其背后动人的故事与传说。',
        refUrlDesc: '（参照您提供的参考网站进行深度游览）',
        refUrlLabel: '使用者参考网站',
        attractionNotes: '建议穿着舒适好走的鞋子，并携带水壶。',
        activityNotes: '适合拍照留念与挑选伴手礼，可使用移动支付。',
        classicAttraction: '经典名胜',
        commercialDistrict: '商圈地标'
      },
      'en': {
        arriveAirport: 'Arrive at Airport',
        arriveAirportDesc: 'Successfully arrived at the airport, completed customs clearance and retrieved baggage. It is recommended to purchase a local SIM card or exchange local currency at the airport to prepare for the trip.',
        arriveAirportLocName: 'International Airport',
        arriveAirportLocAddress: 'Airport Terminal',
        airportTransportDesc: 'Take airport private transfer directly to downtown, avoiding the hassle of carrying heavy luggage.',
        airportLink: 'Klook Airport Transfer Booking',
        airportNotes: 'Please prepare entry documents and passport.',
        airportHours: '24 Hours Open',
        checkInHotel: 'Check in at Hotel',
        checkInHotelDesc: 'After arriving at the airport, head straight to the hotel to check in and drop off your luggage before starting the day\\\'s itinerary, so you won\\\'t need to carry your bags around.',
        departHotel: 'Depart from Hotel',
        departHotelDesc: 'After enjoying a hearty breakfast at the hotel, organize your belongings and prepare to depart. Today\\\'s itinerary is rich, so carrying enough drinking water and sun protection is advised.',
        hotelName: 'Selected Premium Hotel',
        hotelAddress: 'Downtown District',
        hotelTransportDesc: 'Take charter car to the first destination. Local charter services are safe and reliable with background-checked drivers.',
        hotelLink: 'Klook Recommended Transportation & Charter',
        lunchTitle: 'Lunch: ',
        lunchDesc: 'This local hidden gem restaurant serves authentic traditional flavors and is highly favored by local foodies. Every dish has a deep family heritage, using the freshest ingredients sourced daily from local markets. Curated based on your budget level and dietary preferences, providing a clean, hygienic dining environment with vegetarian and allergen labels.',
        lunchLocName: 'Popular Local Flavor Restaurant',
        lunchLocAddress: 'Food Street District',
        lunchTransportDesc: 'Walk about 5 minutes to the metro station, take the transit line to Downtown Station, exit from Gate 3, and walk to the restaurant.',
        lunchNotes: 'Lunch time can be busy; the schedule is adjusted to avoid peak hours.',
        returnHotel: 'Return to Hotel',
        returnHotelDesc: 'After a rich and fulfilling day, return to the comfortable hotel by transport. You can wash away the fatigue or buy late-night snacks at nearby convenience stores to recharge for tomorrow.',
        returnHotelTransportDesc: 'Take a charter car back to the hotel. Please pay close attention to your belongings during night rides.',
        grabLink: 'Recommended Local Ride-Hailing App',
        checklistTipTitle: 'Tipping and Payment',
        checklistTipContent: 'Service charge is usually included in standard restaurants. Street food and local markets are cash-oriented. Mobile payment is accepted in major stores.',
        wifiTipTitle: 'Internet and Communication',
        wifiTipContent: 'Recommended to get a physical SIM card at the airport or pre-activate eSIM. Network signal is excellent at major tourist spots.',
        dayTitle: 'Day {day} - {dest} Exploration',
        daySummary: 'Explore the core tourism resources of {dest} and experience the local unique atmosphere.',
        itineraryTitle: '{dests} {days}-Day Smart Journey',
        emergencyPolice: 'Tourist Police Department',
        emergencyPoliceDesc: '24-Hour English Helpline',
        emergencyGeneral: 'Emergency Rescue Hotline',
        mustVisitTitle: 'Must-Visit: {value}',
        mustVisitDesc: 'This is the mandatory spot you specified in the survey. This attraction carries rich cultural heritage and unique history, making it a prominent landmark. Arranged in the morning to avoid afternoon crowds, allowing more time to appreciate its architectural beauty and local vibes. Guided tour is recommended to learn about its stories.',
        refUrlDesc: '(Explored based on your provided reference website)',
        refUrlLabel: 'User Reference Website',
        attractionNotes: 'Comfortable walking shoes and a water bottle are highly recommended.',
        activityNotes: 'Great for photography and souvenir shopping. Mobile payments are accepted.',
        classicAttraction: 'Classic Landmark',
        commercialDistrict: 'Shopping District'
      }
    };

    // 根據語系決定使用的資源包，未支援之語系自動 fallback 至 'en'
    const strings = LOCALIZED_STRINGS[locale] || LOCALIZED_STRINGS['en'];

    // 2. 景點範本語系與內容對照
    const getDestTemplates = (dest: string, lang: string) => {
      const lower = dest.toLowerCase();
      const isZhCn = lang === 'zh-CN';
      const isEn = lang !== 'zh-TW' && lang !== 'zh-CN';
      
      const isJapan = lower.includes('東京') || lower.includes('tokyo') || lower.includes('日本') || lower.includes('japan');
      const isThailand = lower.includes('曼谷') || lower.includes('bangkok') || lower.includes('泰國') || lower.includes('thai') || lower.includes('芭達雅') || lower.includes('pattaya');

      if (isJapan) {
        if (isZhCn) {
          return {
            images: [
              'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600',
              'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600',
              'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600',
            ],
            titles: ['浅草寺与雷门江户风情', '涩谷十字路口与潮流探索', '明治神宫森呼吸'],
            localTitles: ['浅草寺 (雷門)', '渋谷スクランブル交差点', '明治神宮'],
            descs: [
              '浅草寺是东京都内历史最悠久的寺庙，相传创建于公元628年，源于两位渔夫在隅田川中捞起一尊观音像的传说，至今仍是东京香火最鼎盛的信仰中心。寺庙的门面是著名的“雷门”，悬挂着一盏高约4米、重达700公斤的巨型红灯笼，两侧伫立着守护寺院的风神与雷神像，是江户文化最具代表性的象征，也是旅人必拍的地标。穿过雷门后，便是长约250米的“仲见世通”商店街，两旁近百间店铺自江户时代延续至今，贩售人形烧、雷おこし米菓、煎饼、和风小物与手工艺品，空气中飘散着现烤点心的甜香。走到底则是庄严的宝藏门与本堂，旅客可在此参拜、求签（おみくじ），体验日本传统的祈福文化。一旁高耸的五重塔与不远处的晴空塔交相辉映，呈现古典与现代并存的独特东京风景，建议安排半日细细游览周边的浅草老街风情。',
              '涩谷是东京乃至全球时尚与青年文化的发源地，永远走在潮流的最前线。最著名的景象莫过于涩谷站前的全向十字路口（Shibuya Scramble Crossing）：当四面信号同时转为绿灯，来自各方的人潮如潮水般交错穿梭，据估算高峰时段单次可有逾三千人同时通过，那种秩序与混乱并存的震撼，已成为东京最具代表性的都市意象，也是无数电影取景之地。十字路口旁矗立着忠犬八公的铜像，是日本最知名的等待与忠诚故事，更是当地人气约定碰面的地标。周边巷弄林立着百货公司、潮流选物店、唱片行、特色居酒屋与深夜咖啡馆，从西武、PARCO到109辣妹文化发源地，无不引领着日本年轻世代的穿搭与消费风向。无论是登上周边高楼的观景台俯瞰车水马龙，或钻进小巷探索独立店家，涩谷都能让人深刻感受东京脉动的速度与能量。',
              '明治神宫是为了供奉明治天皇与昭宪皇太后而建的神社，于1920年落成，是东京最重要的神道信仰圣地之一。最令人惊叹的是，神宫并非坐落于荒野，而是被一片占地约70公顷、由全国各地献纳的约十万棵树木所构成的巨大人工森林环抱——这片“永恒之森”历经百年生长，如今已演替成生机盎然、近乎天然的都市林相，与一墙之隔的繁华原宿、涩谷形成强烈对比。踏入高耸的木造鸟居，沿着铺满碎石的参道缓步前行，两旁古木参天、绿荫蔽日，城市的喧嚣仿佛瞬间被隔绝，只余鸟鸣与踩踏碎石的沙沙声，令人身心沉淀。本殿庄严肃穆，旅客可在此体验投赛钱、二拜二拍手一拜的参拜礼仪，或在绘马上书写愿望、选购御守。每逢新年，这里更是全日本参拜人数最多的神社。是繁华东京市中心难得的静谧绿洲与神圣之所。'
            ],
            coords: [
              { lat: 35.7148, lon: 139.7967 },
              { lat: 35.6595, lon: 139.7004 },
              { lat: 35.6764, lon: 139.6993 }
            ]
          };
        } else if (isEn) {
          return {
            images: [
              'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600',
              'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600',
              'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600',
            ],
            titles: ['Sensō-ji Temple and Kaminarimon Gate', 'Shibuya Crossing and Trendy Exploration', 'Meiji Jingu Forest Walk'],
            localTitles: ['浅草寺 (雷門)', '渋谷スクランブル交差点', '明治神宮'],
            descs: [
              'Sensō-ji is Tokyo\\\'s oldest temple, said to have been founded in 628 after two fishermen pulled a statue of the Kannon goddess from the Sumida River — a legend that still makes it the city\\\'s most visited place of worship. Its face is the famous Kaminarimon (Thunder Gate), hung with a giant red lantern nearly 4 meters tall and weighing some 700kg, flanked by the guardian statues of the gods of wind and thunder; it is the definitive symbol of Edo culture and a must-photograph landmark. Beyond the gate stretches Nakamise-dori, a 250-meter shopping street whose nearly one hundred stalls have operated since the Edo period, selling ningyo-yaki cakes, rice crackers, senbei, Japanese trinkets and crafts amid the sweet aroma of freshly baked treats. At its end stand the imposing Hozomon Gate and the main hall, where visitors pray and draw omikuji fortune slips to experience traditional Japanese blessing customs. The towering five-story pagoda nearby and the Tokyo Skytree in the distance create a striking blend of classical and modern Tokyo — allow half a day to savor the old-town atmosphere of Asakusa.',
              'Shibuya is the birthplace of fashion and youth culture in Tokyo, perpetually at the cutting edge of trends. Its most famous sight is the Shibuya Scramble Crossing: when all the signals turn green at once, crowds surge across from every direction — an estimated three thousand-plus people in a single peak crossing — a spectacle of order and chaos that has become Tokyo\\\'s defining urban image and a backdrop for countless films. Beside the crossing stands the bronze statue of Hachiko, the loyal dog whose story of devotion is among Japan\\\'s most beloved, and a popular local meeting point. The surrounding lanes brim with department stores, boutique select shops, record stores, izakayas and late-night cafes; from Seibu and PARCO to the birthplace of the 109 gyaru culture, Shibuya sets the pace for how young Japan dresses and spends. Whether viewing the bustle from a rooftop observation deck or exploring independent shops in the back streets, Shibuya lets you feel the speed and energy of Tokyo\\\'s pulse.',
              'Meiji Jingu, completed in 1920, is a Shinto shrine dedicated to the deified spirits of Emperor Meiji and Empress Shoken, and one of Tokyo\\\'s most important sacred sites. Remarkably, the shrine does not sit in open wilderness but is embraced by a vast man-made forest of about 70 hectares, planted with some 100,000 trees donated from across Japan. This "eternal forest" has matured over a century into a lush, almost natural woodland — a stark contrast to bustling Harajuku and Shibuya just beyond its walls. Passing through the towering wooden torii gate and walking the gravel approach beneath a canopy of ancient trees, the noise of the city seems to vanish, leaving only birdsong and the crunch of gravel underfoot — a deeply calming experience. At the solemn main hall, visitors can offer coins and perform the two-bow, two-clap, one-bow ritual, write wishes on ema plaques, or buy protective omamori charms. At New Year it draws the largest number of worshippers of any shrine in Japan — a rare tranquil green oasis and sacred space in the heart of Tokyo.'
            ],
            coords: [
              { lat: 35.7148, lon: 139.7967 },
              { lat: 35.6595, lon: 139.7004 },
              { lat: 35.6764, lon: 139.6993 }
            ]
          };
        } else {
          // Default zh-TW
          return {
            images: [
              'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600',
              'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600',
              'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600',
            ],
            titles: ['淺草寺與雷門江戶風情', '澀谷十字路口與潮流探索', '明治神宮森呼吸'],
            localTitles: ['淺草寺 (雷門)', '渋谷スクランブル交差点', '明治神宮'],
            descs: [
              '淺草寺是東京都內歷史最悠久的寺廟，相傳創建於公元628年，源於兩位漁夫在隅田川中撈起一尊觀音像的傳說，至今仍是東京香火最鼎盛的信仰中心。寺廟的門面是著名的「雷門」，懸掛著一盞高約4公尺、重達700公斤的巨型紅燈籠，兩側佇立著守護寺院的風神與雷神像，是江戶文化最具代表性的象徵，也是旅人必拍的地標。穿過雷門後，便是長約250公尺的「仲見世通」商店街，兩旁近百間店鋪自江戶時代延續至今，販售人形燒、雷おこし米菓、煎餅、和風小物與手工藝品，空氣中飄散著現烤點心的甜香。走到底則是莊嚴的寶藏門與本堂，旅客可在此參拜、求籤（おみくじ），體驗日本傳統的祈福文化。一旁高聳的五重塔與不遠處的晴空塔交相輝映，呈現古典與現代並存的獨特東京風景，建議安排半日細細遊覽周邊的淺草老街風情。',
              '澀谷是東京乃至全球時尚與青年文化的發源地，永遠走在潮流的最前線。最著名的景象莫過於澀谷站前的全向十字路口（Shibuya Scramble Crossing）：當四面號誌同時轉為綠燈，來自各方的人潮如潮水般交錯穿梭，據估算尖峰時段單次可有逾三千人同時通過，那種秩序與混亂並存的震撼，已成為東京最具代表性的都市意象，也是無數電影取景之地。十字路口旁矗立著忠犬八公的銅像，是日本最知名的等待與忠誠故事，更是當地人氣約定碰面的地標。周邊巷弄林立著百貨公司、潮流選物店、唱片行、特色居酒屋與深夜咖啡館，從西武、PARCO到109辣妹文化發源地，無不引領著日本年輕世代的穿搭與消費風向。無論是登上周邊高樓的觀景台俯瞰車水馬龍，或鑽進小巷探索獨立店家，澀谷都能讓人深刻感受東京脈動的速度與能量。',
              '明治神宮是為了供奉明治天皇與昭憲皇太后而建的神社，於1920年落成，是東京最重要的神道信仰聖地之一。最令人驚嘆的是，神宮並非坐落於荒野，而是被一片佔地約70公頃、由全國各地獻納的約十萬棵樹木所構成的巨大人工森林環抱——這片「永恆之森」歷經百年生長，如今已演替成生機盎然、近乎天然的都市林相，與一牆之隔的繁華原宿、澀谷形成強烈對比。踏入高聳的木造鳥居，沿著鋪滿碎石的參道緩步前行，兩旁古木參天、綠蔭蔽日，城市的喧囂彷彿瞬間被隔絕，只餘鳥鳴與踩踏碎石的沙沙聲，令人身心沉澱。本殿莊嚴肅穆，旅客可在此體驗投賽錢、二拜二拍手一拜的參拜禮儀，或在繪馬上書寫願望、選購御守。每逢新年，這裡更是全日本參拜人數最多的神社。是繁華東京市中心難得的靜謐綠洲與神聖之所。'
            ],
            coords: [
              { lat: 35.7148, lon: 139.7967 }, // 淺草寺
              { lat: 35.6595, lon: 139.7004 }, // 澀谷十字路口
              { lat: 35.6764, lon: 139.6993 }  // 明治神宮
            ]
          };
        }
      }

      if (isThailand) {
        if (isZhCn) {
          return {
            images: [
              'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600',
              'https://images.unsplash.com/photo-1562790351-d273a961e0e9?w=600',
              'https://images.unsplash.com/photo-1582967788606-a171c1080cb0?w=600',
            ],
            titles: ['大皇宫与玉佛寺金碧辉煌', '安帕瓦水上市场热闹体验', '郑王庙夕阳光辉'],
            localTitles: ['พระบรมมหาราชวังและวัดพระแก้ว', 'ตลาดน้ำอัมพวา', 'วัดอรุณราชวราราม'],
            descs: [
              '大皇宫坐落于昭披耶河东岸，自1782年拉玛一世将首都迁至曼谷后，便成为暹罗王室两百余年的官方居所与行政中心。整座宫殿群占地逾二十一万平方米，由数十栋风格各异的建筑构成，巧妙融合泰式传统尖顶、高棉式佛塔与十九世纪引进的欧式新古典立面，金箔、彩色玻璃与陶瓷碎片在烈日下交织出令人屏息的奢华光辉。宫内最神圣的核心是玉佛寺（Wat Phra Kaew），供奉着以整块翡翠雕成、高约66公分的玉佛，是泰国地位最崇高的国宝，泰王会依寒、暑、雨三季亲自为玉佛更换金缕衣袍。漫步其间，可见描绘《罗摩衍那》史诗的回廊壁画、守护宫门的巨型夜叉雕像，以及金光灿烂的舍利塔。参观时请务必遵守服装规定，穿着覆盖肩膀与膝盖的衣物，并预留至少两小时细细品味这座泰国历史与信仰的中心。',
              '安帕瓦水上市场是泰国古老运河文化最生动的缩影，距曼谷市区约一个半小时车程，座落于夜功府宁静的水乡之间。每逢周末午后至夜晚，狭窄的河道便热闹起来：商家划着木船在水道上穿梭，船上架着炭火现烤海鲜、现炒河粉、椰糖甜点与南洋水果，买卖双方隔着河岸与船舷交易，空气中弥漫着炭香与泰式香料的气味。沿岸的老木屋商铺贩售手工艺品、衣饰与在地小吃，傍晚还可搭乘长尾船游河，欣赏两岸寺庙与传统高脚屋，并在入夜后观赏河畔萤火虫在红树林间明灭闪烁的梦幻景象。相较于观光化严重的丹嫩莎朵，安帕瓦更贴近泰国人真实的常民生活，是体验在地饮食、人情与运河风情的绝佳去处，建议安排于下午前往，衔接黄昏与夜市时段。',
              '郑王庙又称黎明寺，座落于昭披耶河西岸，是曼谷最具代表性的地标之一，得名自郑信大帝（达信王）在此登基立国的历史。寺庙的主体是一座高达约82米的高棉式中央佛塔（prang），象征着佛教宇宙观中的须弥山，四周环绕四座较小的卫星塔。最令人惊叹的是，整座塔身并非以单纯的石材砌成，而是镶嵌了数以万计的中国彩瓷碎片与贝壳——这些原是早年商船压舱的瓷器，工匠将之拼贴成繁复的花卉与神兽图案，在阳光下闪烁着细致而斑斓的光泽。旅客可沿着陡峭的阶梯攀上塔身平台，俯瞰昭披耶河与对岸大皇宫的壮丽景致。郑王庙之美在黄昏时分达到极致：当夕阳西下，金红色的霞光为塔身镀上暖色，倒影映于河面，与往来的船只交织成一幅极具诗意的画面，是摄影与赏景的不二之选。'
            ],
            coords: [
              { lat: 13.7500, lon: 100.4915 }, // 大皇宮
              { lat: 13.4253, lon: 99.9558 },  // 安帕瓦水上市場
              { lat: 13.7437, lon: 100.4889 }  // 鄭王廟
            ]
          };
        } else if (isEn) {
          return {
            images: [
              'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600',
              'https://images.unsplash.com/photo-1562790351-d273a961e0e9?w=600',
              'https://images.unsplash.com/photo-1582967788606-a171c1080cb0?w=600',
            ],
            titles: ['Grand Palace and Temple of the Emerald Buddha', 'Amphawa Floating Market Experience', 'Wat Arun Golden Sunset'],
            localTitles: ['พระบรมมหาราชวังและวัดพระแก้ว', 'ตลาดน้ำอัมพวา', 'วัดอรุณราชวราราม'],
            descs: [
              'Standing on the east bank of the Chao Phraya River, the Grand Palace has been the official residence and administrative seat of the Kings of Siam for over two centuries since King Rama I moved the capital to Bangkok in 1782. Sprawling across more than 210,000 square meters, the complex comprises dozens of buildings that fuse traditional Thai spires, Khmer-style prangs and nineteenth-century European neoclassical facades, all shimmering with gold leaf, colored glass and porcelain mosaic under the tropical sun. Its sacred heart is Wat Phra Kaew, the Temple of the Emerald Buddha, which enshrines a 66cm statue carved from a single block of jade — Thailand\\\'s most revered national treasure, whose golden robes are ceremonially changed by the King three times a year for the cool, hot and rainy seasons. Visitors can admire mural-lined cloisters depicting the Ramakien epic, towering yaksha guardian statues, and gilded stupas. A strict dress code applies (shoulders and knees must be covered); allow at least two hours to take in this center of Thai history and faith.',
              'Amphawa Floating Market is the most vivid surviving expression of Thailand\\\'s old canal culture, set among the tranquil waterways of Samut Songkhram province about ninety minutes from central Bangkok. From weekend afternoons into the evening the narrow canal comes alive: vendors paddle wooden boats laden with charcoal-grilled seafood, freshly fried noodles, palm-sugar desserts and tropical fruit, trading with customers lining the banks. Riverside wooden shophouses sell handicrafts, clothing and local snacks, and at dusk you can board a long-tail boat to cruise past riverside temples and stilt houses, then watch fireflies twinkle through the mangroves after dark. Far less touristy than Damnoen Saduak, Amphawa offers an authentic glimpse of everyday Thai life, food and riverine charm — best visited in the afternoon to flow naturally into the sunset and night-market hours.',
              'Wat Arun, the Temple of Dawn, rises on the west bank of the Chao Phraya River and is one of Bangkok\\\'s most iconic landmarks, named for the era when King Taksin the Great founded his reign here. Its centerpiece is a Khmer-style central prang soaring roughly 82 meters high, symbolizing Mount Meru of Buddhist cosmology and ringed by four smaller satellite towers. Remarkably, the spire is not built of plain stone but encrusted with tens of thousands of fragments of Chinese porcelain and seashells — originally ballast from trading ships — which artisans pieced into intricate floral and mythical-creature patterns that glitter in fine, multicolored detail under the sun. Visitors can climb the steep steps to a viewing terrace overlooking the river and the Grand Palace opposite. Wat Arun is at its most beautiful at dusk, when the setting sun bathes the tower in warm golden-red light and its reflection shimmers on the water amid passing boats — a uniquely poetic scene and a photographer\\\'s favorite.'
            ],
            coords: [
              { lat: 13.7500, lon: 100.4915 },
              { lat: 13.4253, lon: 99.9558 },
              { lat: 13.7437, lon: 100.4889 }
            ]
          };
        } else {
          // Default zh-TW
          return {
            images: [
              'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600',
              'https://images.unsplash.com/photo-1562790351-d273a961e0e9?w=600',
              'https://images.unsplash.com/photo-1582967788606-a171c1080cb0?w=600',
            ],
            titles: ['大皇宮與玉佛寺金碧輝煌', '安帕瓦水上市場熱鬧體驗', '鄭王廟夕陽光輝'],
            localTitles: ['พระบรมมหาราชวังและวัดพระแก้ว', 'ตลาดน้ำอัมพวา', 'วัดอรุณราชวราราม'],
            descs: [
              '大皇宮坐落於昭披耶河東岸，自1782年拉瑪一世將首都遷至曼谷後，便成為暹羅王室兩百餘年的官方居所與行政中心。整座宮殿群佔地逾二十一萬平方公尺，由數十棟風格各異的建築構成，巧妙融合泰式傳統尖頂、高棉式佛塔與十九世紀引進的歐式新古典立面，金箔、彩色玻璃與陶瓷碎片在烈日下交織出令人屏息的奢華光輝。宮內最神聖的核心是玉佛寺（Wat Phra Kaew），供奉著以整塊翡翠雕成、高約66公分的玉佛，是泰國地位最崇高的國寶，泰王會依寒、暑、雨三季親自為玉佛更換金縷衣袍。漫步其間，可見描繪《羅摩衍那》史詩的迴廊壁畫、守護宮門的巨型夜叉雕像，以及金光燦爛的舍利塔。參觀時請務必遵守服裝規定，穿著覆蓋肩膀與膝蓋的衣物，並預留至少兩小時細細品味這座泰國歷史與信仰的中心。',
              '安帕瓦水上市場是泰國古老運河文化最生動的縮影，距曼谷市區約一個半小時車程，座落於夜功府寧靜的水鄉之間。每逢週末午後至夜晚，狹窄的河道便熱鬧起來：商家划著木船在水道上穿梭，船上架著炭火現烤海鮮、現炒河粉、椰糖甜點與南洋水果，買賣雙方隔著河岸與船舷交易，空氣中瀰漫著炭香與泰式香料的氣味。沿岸的老木屋商鋪販售手工藝品、衣飾與在地小吃，傍晚還可搭乘長尾船遊河，欣賞兩岸寺廟與傳統高腳屋，並在入夜後觀賞河畔螢火蟲在紅樹林間明滅閃爍的夢幻景象。相較於觀光化嚴重的丹嫩莎朵，安帕瓦更貼近泰國人真實的常民生活，是體驗在地飲食、人情與運河風情的絕佳去處，建議安排於下午前往，銜接黃昏與夜市時段。',
              '鄭王廟又稱黎明寺，座落於昭披耶河西岸，是曼谷最具代表性的地標之一，得名自鄭信大帝（達信王）在此登基立國的歷史。寺廟的主體是一座高達約82公尺的高棉式中央佛塔（prang），象徵著佛教宇宙觀中的須彌山，四周環繞四座較小的衛星塔。最令人驚嘆的是，整座塔身並非以單純的石材砌成，而是鑲嵌了數以萬計的中國彩瓷碎片與貝殼——這些原是早年商船壓艙的瓷器，工匠將之拼貼成繁複的花卉與神獸圖案，在陽光下閃爍著細緻而斑斕的光澤。旅客可沿著陡峭的階梯攀上塔身平台，俯瞰昭披耶河與對岸大皇宮的壯麗景致。鄭王廟之美在黃昏時分達到極致：當夕陽西下，金紅色的霞光為塔身鍍上暖色，倒影映於河面，與往來的船隻交織成一幅極具詩意的畫面，是攝影與賞景的不二之選。'
            ],
            coords: [
              { lat: 13.7500, lon: 100.4915 },
              { lat: 13.4253, lon: 99.9558 },
              { lat: 13.7437, lon: 100.4889 }
            ]
          };
        }
      }

      // Default: Taipei / general template
      if (isZhCn) {
        return {
          images: [
            'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=600',
            'https://images.unsplash.com/photo-1571474004502-c1def214ac6d?w=600',
            'https://images.unsplash.com/photo-1555529669-e69e7aa0db9a?w=600',
          ],
          titles: ['台北 101 与信义商圈俯瞰', '九份老街悲情城市茶香', '士林夜市在地美食巡礼'],
          localTitles: ['台北101', '九份老街', '士林夜市'],
          descs: [
            '台北101落成于2004年，曾以508米的高度蝉联世界第一高楼宝座长达数年，至今仍是台湾最具辨识度的地标与现代科技的里程碑。其造型灵感取自竹节，以八层为一节、节节高升，蕴含中华文化中“生生不息”的吉祥寓意，外墙采用双层隔热帷幕玻璃。搭乘金氏世界纪录认证的超高速电梯，仅需约37秒便能从5楼直达89楼室内观景台，将台北盆地壮丽的城市天际线、蜿蜒的基隆河与远处的群山尽收眼底；天气晴朗时还可登上91楼户外观景台感受高空的风。塔内最受瞩目的，是一颗悬挂于87至92楼之间、重达660公吨的金色风阻尼器钢球，能在强风与地震时摆动以抵消大楼晃动，是建筑工学的精彩展示。楼下的购物中心汇聚国际精品、餐厅与美食街，而每年跨年的101烟火秀更是闻名全球，吸引数十万人共同迎接新年。',
            '九份是一座依山面海的古老矿业小镇，座落于新北市瑞芳的山城之间。日治时期因发现金矿而盛极一时，淘金人潮涌入，造就了“小上海”“小香港”的繁华景象；金矿没落后归于沉寂，却因此完整保留了昔日的山城聚落风貌。九份真正声名大噪，源于侯孝贤导演的电影《悲情城市》在此取景，加上其层叠错落的红灯笼、蜿蜒陡峭的石阶与古朴茶楼，被许多游客联想为宫崎骏动画《神隐少女》的场景（尽管官方并未证实）。漫步狭窄的基山街，两旁挤满贩售芋圆、草仔粿、鱼丸汤与古早味点心的店家，香气四溢；走累了便可步入面海的茶楼，点一壶高山茶，在氤氲茶香与窗外山海交织的景致中虚度一个慵懒的午后。傍晚时分华灯初上，红灯笼次第亮起，整座山城笼罩在金黄而怀旧的光晕里，宛如时光倒流，是摄影与漫游的绝佳去处。',
            '夜市是台湾最具代表性的饮食文化核心，而士林夜市正是台北规模最大、历史最悠久的夜市之一，自清代慈諴宫庙口的小吃摊集结发展至今，已超过百年。这里汇聚了数百摊琳琅满目的庶民美食：超大片现炸鸡排、淋上蛋液的蚵仔煎、香气十足的大肠包小肠、生炒花枝、药炖排骨，以及风靡全球、源自台湾的珍珠奶茶，几乎囊括了所有经典台味，让人一路吃到撑。除了美食，士林夜市的地下美食街与周边街区还林立着服饰、鞋包、美妆与各式新奇小物的摊位，价格亲民、讨价还价之间充满人情味；穿插其中的还有套圈圈、弹珠台、射气球等怀旧夜市游戏，洋溢着浓厚的庶民欢乐气氛。无论是想大快朵颐、采买伴手礼，还是单纯感受台北入夜后熙来攘往的热闹与热情民风，士林夜市都是不可错过的必访之地。'
          ],
          coords: [
            { lat: 25.0339, lon: 121.5645 }, // 台北101
            { lat: 25.1095, lon: 121.8443 }, // 九份老街
            { lat: 25.0879, lon: 121.5240 }  // 士林夜市
          ]
        };
      } else if (isEn) {
        return {
          images: [
            'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=600',
            'https://images.unsplash.com/photo-1571474004502-c1def214ac6d?w=600',
            'https://images.unsplash.com/photo-1555529669-e69e7aa0db9a?w=600',
          ],
          titles: ['Taipei 101 and Xinyi Shopping District', 'Jiufen Old Street Tea Tasting', 'Shilin Night Market Food Tour'],
          localTitles: ['台北101', '九份老街', '士林夜市'],
          descs: [
            'Completed in 2004, Taipei 101 held the title of the world\\\'s tallest building for several years at 508 meters and remains Taiwan\\\'s most recognizable landmark and a milestone of modern engineering. Its silhouette is inspired by a stalk of bamboo, rising in eight-floor segments that evoke the auspicious idea of ceaseless growth in Chinese culture, clad in a double-layer insulating curtain wall. A Guinness World Record-certified ultra-high-speed elevator whisks visitors from the 5th floor to the 89th-floor indoor observatory in about 37 seconds, unveiling a sweeping view of the Taipei Basin, the winding Keelung River and the surrounding mountains; on clear days you can step out onto the 91st-floor outdoor deck to feel the high-altitude wind. The tower\\\'s star attraction is a 660-tonne golden tuned mass damper suspended between the 87th and 92nd floors, which sways to counteract building movement during typhoons and earthquakes — a fascinating display of structural engineering. The mall below gathers international luxury brands, restaurants and a food court, while the annual New Year\\\'s Eve fireworks launched from the tower are world-famous, drawing hundreds of thousands to welcome the new year.',
            'Jiufen is a historic mountainside town nestled in the hills of Ruifang, New Taipei City, facing the sea. It boomed during the Japanese colonial era after gold was discovered, drawing waves of prospectors and earning nicknames like "Little Shanghai" and "Little Hong Kong"; when the mines declined it fell quiet, which is precisely why its old hillside settlement has been so well preserved. Jiufen rose to fame through Hou Hsiao-hsien\\\'s film A City of Sadness, and with its tiers of red lanterns, steep winding stone steps and rustic teahouses, many visitors associate it with the scenery of Miyazaki\\\'s Spirited Away (though this has never been officially confirmed). Strolling the narrow Jishan Street, you pass shop after shop selling taro balls, herbal rice cakes, fish-ball soup and old-fashioned snacks amid mouth-watering aromas; when tired, you can step into a sea-facing teahouse, order a pot of high-mountain tea and idle away a lazy afternoon enveloped in fragrant steam and views of mountains meeting ocean. At dusk the lanterns flicker on one by one, bathing the whole town in a nostalgic golden glow as if time has rewound — a wonderful place for photography and wandering.',
            'Night markets are the heart of Taiwan\\\'s culinary culture, and Shilin is one of Taipei\\\'s largest and most historic, having grown from the food stalls around the Cixian Temple since the Qing dynasty — more than a century of history. Here hundreds of stalls serve a dazzling array of street food: oversized deep-fried chicken cutlets, egg-laden oyster omelets, fragrant "big sausage wrapped in small sausage," stir-fried squid, herbal pork-rib soup, and the globally beloved Taiwan-born bubble tea — virtually every classic Taiwanese flavor, enough to eat your way to bursting. Beyond food, the underground food court and surrounding streets are lined with stalls of clothing, shoes and bags, cosmetics and novelty goods at friendly prices, where good-natured haggling adds to the warmth; interspersed are nostalgic carnival games like ring toss, pinball and balloon darts, brimming with cheerful local energy. Whether you want to feast, shop for souvenirs, or simply soak up the bustle and warm hospitality of Taipei after dark, Shilin Night Market is an unmissable destination.'
          ],
          coords: [
            { lat: 25.0339, lon: 121.5645 },
            { lat: 25.1095, lon: 121.8443 },
            { lat: 25.0879, lon: 121.5240 }
          ]
        };
      } else {
        // Default zh-TW
        return {
          images: [
            'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=600',
            'https://images.unsplash.com/photo-1571474004502-c1def214ac6d?w=600',
            'https://images.unsplash.com/photo-1555529669-e69e7aa0db9a?w=600',
          ],
          titles: ['台北 101 與信義商圈俯瞰', '九份老街悲情城市茶香', '士林夜市在地美食巡禮'],
          localTitles: ['台北101', '九份老街', '士林夜市'],
          descs: [
            '台北101落成於2004年，曾以508公尺的高度蟬聯世界第一高樓寶座長達數年，至今仍是台灣最具辨識度的地標與現代科技的里程碑。其造型靈感取自竹節，以八層為一節、節節高升，蘊含中華文化中「生生不息」的吉祥寓意，外牆採用雙層隔熱帷幕玻璃。搭乘金氏世界紀錄認證的超高速電梯，僅需約37秒便能從5樓直達89樓室內觀景台，將台北盆地壯麗的城市天際線、蜿蜒的基隆河與遠處的群山盡收眼底；天氣晴朗時還可登上91樓戶外觀景台感受高空的風。塔內最受矚目的，是一顆懸掛於87至92樓之間、重達660公噸的金色風阻尼器鋼球，能在強風與地震時擺動以抵消大樓晃動，是建築工學的精彩展示。樓下的購物中心匯聚國際精品、餐廳與美食街，而每年跨年的101煙火秀更是聞名全球，吸引數十萬人共同迎接新年。',
            '九份是一座依山面海的古老礦業小鎮，座落於新北市瑞芳的山城之間。日治時期因發現金礦而盛極一時，淘金人潮湧入，造就了「小上海」「小香港」的繁華景象；金礦沒落後歸於沉寂，卻因此完整保留了昔日的山城聚落風貌。九份真正聲名大噪，源於侯孝賢導演的電影《悲情城市》在此取景，加上其層疊錯落的紅燈籠、蜿蜒陡峭的石階與古樸茶樓，被許多遊客聯想為宮崎駿動畫《神隱少女》的場景（儘管官方並未證實）。漫步狹窄的基山街，兩旁擠滿販售芋圓、草仔粿、魚丸湯與古早味點心的店家，香氣四溢；走累了便可步入面海的茶樓，點一壺高山茶，在氤氳茶香與窗外山海交織的景致中虛度一個慵懶的午後。傍晚時分華燈初上，紅燈籠次第亮起，整座山城籠罩在金黃而懷舊的光暈裡，宛如時光倒流，是攝影與漫遊的絕佳去處。',
            '夜市是台灣最具代表性的飲食文化核心，而士林夜市正是台北規模最大、歷史最悠久的夜市之一，自清代慈諴宮廟口的小吃攤集結發展至今，已超過百年。這裡匯聚了數百攤琳瑯滿目的庶民美食：超大片現炸雞排、淋上蛋液的蚵仔煎、香氣十足的大腸包小腸、生炒花枝、藥燉排骨，以及風靡全球、源自台灣的珍珠奶茶，幾乎囊括了所有經典台味，讓人一路吃到撐。除了美食，士林夜市的地下美食街與周邊街區還林立著服飾、鞋包、美妝與各式新奇小物的攤位，價格親民、討價還價之間充滿人情味；穿插其中的還有套圈圈、彈珠台、射氣球等懷舊夜市遊戲，洋溢著濃厚的庶民歡樂氣氛。無論是想大快朵頤、採買伴手禮，還是單純感受台北入夜後熙來攘往的熱鬧與熱情民風，士林夜市都是不可錯過的必訪之地。'
          ],
          coords: [
            { lat: 25.0339, lon: 121.5645 },
            { lat: 25.1095, lon: 121.8443 },
            { lat: 25.0879, lon: 121.5240 }
          ]
        };
      }
    };

    // 解析每個目的地當日要用的範本：優先採用傳入的真實 POI（規則式引擎），否則退回內建範本。
    const resolveTemplates = (destName: string): DestTemplate => {
      const poiTpl = poiByDest?.[destName];
      if (poiTpl && poiTpl.titles.length > 0) return poiTpl;
      return getDestTemplates(destName, locale);
    };
    // 各目的地的景點取用游標，逐日遞增以避免全程重複景點。
    const destCursor: Record<string, number> = {};

    // Collect references from user input survey (Attractions / URLs)
    const userMustVisits = survey?.mustVisitAttractions || [];
    const userReferences = survey?.referenceAttractions || [];
    const userSpecificLocations = survey?.specificLocations || [];

    // 判斷某筆特定地點是否為住宿（飯店/度假村/villa…），以及其涵蓋的日期範圍。
    const isHotelItem = (v?: string) => !!v && /飯店|hotel|resort|villa|inn|住宿|旅館|ホテル/i.test(v);
    const parseRange = (raw?: string): { startStr: string; endStr: string } | null => {
      if (!raw) return null;
      const parts = raw.split(/\s*[~]\s*|\s+to\s+/i).map(s => s.trim()).filter(Boolean);
      let startStr = parts[0];
      let endStr = parts[1] || parts[0];
      if (parts.length === 1) {
        const m = raw.match(/^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/);
        if (m) { startStr = m[1]; endStr = m[2]; }
      }
      return { startStr, endStr };
    };
    // 找出涵蓋指定日期的住宿名稱（支援日期區間），作為當日 hotel loop 的起訖點。
    // excludeCheckoutDay：若該日恰為住宿區間的最後一天（退房日，且非單日入住），則不視為「當晚住宿」，
    // 因現實邏輯中退房當日不會續住，當晚應改採下一段住宿（由呼叫端再查詢次日日期取得）。
    const resolveHotelForDate = (dateStr: string, excludeCheckoutDay = false): string | null => {
      for (const loc of userSpecificLocations) {
        if (!isHotelItem(loc.value)) continue;
        const r = parseRange(loc.preferredDate);
        if (!r) continue;
        if (excludeCheckoutDay && dateStr === r.endStr && r.endStr !== r.startStr) continue;
        if (dateStr >= r.startStr && dateStr <= r.endStr) return loc.value;
      }
      return null;
    };

    for (let i = 0; i < dayCount; i++) {
      const currentDayDate = new Date(start.getTime() + i * 86400000);
      const dateStr = `${currentDayDate.getFullYear()}-${String(currentDayDate.getMonth() + 1).padStart(2, '0')}-${String(currentDayDate.getDate()).padStart(2, '0')}`;

      const destIndex = i % (survey?.destinations?.length || 1);
      const currentDest = survey?.destinations?.[destIndex] || { name: mainDest, country };

      // 當日所用範本（真實 POI 優先）與不重複的景點游標
      const templates = resolveTemplates(currentDest.name);
      const cursor = destCursor[currentDest.name] || 0;
      const morningIdx2 = templates.titles.length ? cursor % templates.titles.length : 0;
      const afternoonIdx2 = templates.titles.length ? (cursor + 1) % templates.titles.length : 0;
      destCursor[currentDest.name] = cursor + 2;

      // 當日起點住宿（昨晚入住、今早從此處出發；依日期區間解析），找不到則退回通用名稱。
      const dayHotelName = resolveHotelForDate(dateStr) || strings.hotelName;

      // 當晚住宿（今晚實際入住、回程終點；退房當日不續住，改查次日所屬住宿）。
      let nightHotelName = strings.hotelName;
      if (i < dayCount - 1) {
        const nextDayDate = new Date(start.getTime() + (i + 1) * 86400000);
        const nextDateStr = `${nextDayDate.getFullYear()}-${String(nextDayDate.getMonth() + 1).padStart(2, '0')}-${String(nextDayDate.getDate()).padStart(2, '0')}`;
        nightHotelName = resolveHotelForDate(nextDateStr) || resolveHotelForDate(dateStr, true) || strings.hotelName;
      }

      // Activities building
      const activities: Activity[] = [];

      // 非住宿的特定地點才當作當日景點插入；住宿改由 hotel loop 起訖點處理，不重複列為景點。
      const matchedSpecific = userSpecificLocations.find(item => !isHotelItem(item.value) && item.preferredDate === dateStr)
        || userSpecificLocations.find(item => !isHotelItem(item.value) && (() => { const r = parseRange(item.preferredDate); return !!r && dateStr >= r.startStr && dateStr <= r.endStr; })());
      const matchedMust = matchedSpecific ? null : (userMustVisits.find(item => item.preferredDate === dateStr) || userMustVisits[i]);
      
      // 1. Depart Hotel or Arrive at Airport
      if (i === 0) {
        const titleText = (outgoingFlight && outgoingFlight.flightNumber) ? `${strings.arriveAirport} (${outgoingFlight.flightNumber})` : strings.arriveAirport;
        activities.push({
          id: `act-${i}-start`,
          order: 0,
          startTime: '08:30',
          endTime: '10:00',
          title: titleText,
          localTitle: (outgoingFlight && outgoingFlight.flightNumber) ? `Airport (${outgoingFlight.flightNumber})` : 'Airport',
          type: 'transport',
          description: strings.arriveAirportDesc,
          location: {
            name: `${currentDest.name}${strings.arriveAirportLocName}`,
            address: `${currentDest.name}${strings.arriveAirportLocAddress}`,
            latitude: currentDest.latitude || 0,
            longitude: currentDest.longitude || 0
          },
          duration: 90,
          transport: { mode: 'charter', duration: 45, distance: 30000, description: strings.airportTransportDesc },
          links: [{ label: strings.airportLink, url: 'https://www.klook.com/', type: 'booking' }],
          notes: strings.airportNotes,
          isMustVisit: false,
          photoUrl: 'local-asset://airport_map',
          cost: { amount: 0, currency },
          openingHours: strings.airportHours
        });

        // 1b. 抵達後直接前往飯店辦理入住（行李寄放/入住），符合「先安頓住宿再展開行程」之現實邏輯。
        activities.push({
          id: `act-${i}-checkin`,
          order: 1,
          startTime: '10:45',
          endTime: '11:15',
          title: `${strings.checkInHotel}（${nightHotelName}）`,
          localTitle: nightHotelName,
          type: 'hotel',
          description: strings.checkInHotelDesc,
          location: {
            name: nightHotelName,
            address: `${currentDest.name}${strings.hotelAddress}`,
            latitude: currentDest.latitude || 0,
            longitude: currentDest.longitude || 0
          },
          duration: 30,
          transport: { mode: 'charter', duration: 30, distance: 15000, description: strings.hotelTransportDesc },
          links: [{ label: strings.hotelLink, url: 'https://www.klook.com/', type: 'booking' }],
          notes: '',
          isMustVisit: false,
          cost: { amount: 0, currency },
          openingHours: '24小時開放'
        });
      } else {
        activities.push({
          id: `act-${i}-start`,
          order: 0,
          startTime: '08:30',
          endTime: '09:00',
          title: `${strings.departHotel}（${dayHotelName}）`,
          localTitle: dayHotelName,
          type: 'hotel',
          description: strings.departHotelDesc,
          location: {
            name: dayHotelName,
            address: `${currentDest.name}${strings.hotelAddress}`,
            latitude: currentDest.latitude || 0,
            longitude: currentDest.longitude || 0
          },
          duration: 30,
          transport: { mode: 'charter', duration: 30, distance: 15000, description: strings.hotelTransportDesc },
          links: [{ label: strings.hotelLink, url: 'https://www.klook.com/', type: 'booking' }],
          notes: '',
          isMustVisit: false,
          cost: { amount: 0, currency },
          openingHours: '24小時開放'
        });
      }

      // 2. Morning Activity
      const morningIdx = morningIdx2;
      let morningTitle = templates.titles[morningIdx]!;
      let morningLocalTitle = templates.localTitles[morningIdx]!;
      let morningDesc = templates.descs[morningIdx]!;
      let morningPhoto = templates.images[morningIdx]!;
      let morningCoord = templates.coords?.[morningIdx];
      let morningLinks = [];
      let morningStartTime = '09:00';
      let morningDuration = 150;

      if (matchedSpecific) {
        morningTitle = matchedSpecific.value;
        morningLocalTitle = matchedSpecific.value;
        morningDesc = matchedSpecific.notes ? `${matchedSpecific.value} (${matchedSpecific.notes})` : matchedSpecific.value;
        morningStartTime = matchedSpecific.preferredTime || '09:00';
        morningDuration = matchedSpecific.duration || 120;
        if (matchedSpecific.type === 'url' && matchedSpecific.value.startsWith('http')) {
          morningLinks.push({
            label: strings.refUrlLabel,
            url: matchedSpecific.value,
            type: 'info' as const
          });
        }
      } else if (matchedMust) {
        morningTitle = strings.mustVisitTitle.replace('{value}', matchedMust.value);
        morningLocalTitle = matchedMust.value;
        morningDesc = strings.mustVisitDesc.replace('{value}', matchedMust.value);
        morningStartTime = matchedMust.preferredTime || '09:00';
        if (matchedMust.type === 'url' && matchedMust.value.startsWith('http')) {
          morningLinks.push({
            label: strings.refUrlLabel,
            url: matchedMust.value,
            type: 'info' as const
          });
        }
      } else if (userReferences[i]) {
        const ref = userReferences[i]!;
        if (ref.type === 'url' && ref.value.startsWith('http')) {
          morningDesc = `${strings.refUrlDesc} ${morningDesc}`;
          morningLinks.push({
            label: ref.fileName || strings.refUrlLabel,
            url: ref.value,
            type: 'info' as const
          });
        }
      }

      activities.push({
        id: `act-${i}-1`,
        order: 1,
        startTime: morningStartTime,
        endTime: addMinutesToTime(morningStartTime, morningDuration),
        title: morningTitle,
        localTitle: morningLocalTitle,
        type: 'attraction',
        description: morningDesc,
        location: {
          name: matchedSpecific?.value || matchedMust?.value || morningTitle || `${currentDest.name}${strings.classicAttraction}`,
          address: `${currentDest.name}`,
          latitude: (!matchedSpecific && !matchedMust && morningCoord) ? morningCoord.lat : (currentDest.latitude || 0),
          longitude: (!matchedSpecific && !matchedMust && morningCoord) ? morningCoord.lon : (currentDest.longitude || 0)
        },
        duration: morningDuration,
        links: morningLinks,
        notes: matchedSpecific?.notes || strings.attractionNotes,
        isMustVisit: !!matchedSpecific || !!matchedMust,
        photoUrl: morningPhoto,
        rating: 4.8,
        cost: { amount: 0, currency },
        openingHours: '09:00 - 17:30'
      });

      // 3. Afternoon Activity (Restaurant)
      const lunchTitles: Record<string, string[]> = {
        'zh-TW': ['在地推薦人氣私房菜', '文青風特色咖啡廳輕食', '老字號經典道地小吃', '米其林必比登推薦餐廳'],
        'zh-CN': ['在地推荐人气私房菜', '文青风特色咖啡厅轻食', '老字号经典道地小吃', '米其林必比登推荐餐厅'],
        'en': ['Local Recommended Restaurant', 'Trendy Boutique Cafe', 'Classic Traditional Eatery', 'Michelin Bib Gourmand Selection']
      };
      const activeLunchTitles = lunchTitles[locale] || lunchTitles['en'];
      const currentLunchTitle = activeLunchTitles[i % activeLunchTitles.length];

      // 預設午餐改用內建實體餐廳（含真實座標），逐日輪替；無對應資料時退回通用佔位描述。
      const destRestaurants = getDestRestaurants(currentDest.name, locale);
      const lunchPick = destRestaurants.length ? destRestaurants[i % destRestaurants.length] : null;

      activities.push({
        id: `act-${i}-2`,
        order: 2,
        startTime: '12:00',
        endTime: '13:30',
        title: lunchPick ? `${strings.lunchTitle}${lunchPick.title}` : `${strings.lunchTitle}${currentLunchTitle}`,
        localTitle: lunchPick ? lunchPick.localTitle : 'Local Restaurant',
        type: 'restaurant',
        description: lunchPick ? lunchPick.desc : strings.lunchDesc,
        location: {
          name: lunchPick ? lunchPick.title : strings.lunchLocName,
          address: `${currentDest.name}${strings.lunchLocAddress}`,
          latitude: lunchPick ? lunchPick.lat : (currentDest.latitude || 0),
          longitude: lunchPick ? lunchPick.lon : (currentDest.longitude || 0)
        },
        duration: 90,
        transport: { mode: 'public', duration: 15, distance: 0, description: strings.lunchTransportDesc },
        links: lunchPick ? [{ label: strings.grabLink, url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lunchPick.localTitle)}`, type: 'info' as const }] : [],
        notes: strings.lunchNotes,
        isMustVisit: false,
        photoUrl: templates.images[2],
        rating: 4.7,
        cost: { amount: lunchPick ? lunchPick.cost : 350, currency },
        openingHours: '11:00 - 21:00'
      });

      // 4. Late Afternoon Activity (Sightseeing / Shopping)
      const afternoonIdx = afternoonIdx2;
      const afternoonTitle = templates.titles[afternoonIdx]!;
      const afternoonLocalTitle = templates.localTitles[afternoonIdx]!;
      const afternoonDesc = templates.descs[afternoonIdx]!;
      const afternoonCoord = templates.coords?.[afternoonIdx];

      activities.push({
        id: `act-${i}-3`,
        order: 3,
        startTime: '14:30',
        endTime: '17:30',
        title: afternoonTitle,
        localTitle: afternoonLocalTitle,
        type: 'activity',
        description: afternoonDesc,
        location: {
          name: afternoonTitle || `${currentDest.name}${strings.commercialDistrict}`,
          address: `${currentDest.name}`,
          latitude: afternoonCoord ? afternoonCoord.lat : (currentDest.latitude || 0),
          longitude: afternoonCoord ? afternoonCoord.lon : (currentDest.longitude || 0)
        },
        duration: 180,
        links: [],
        notes: strings.activityNotes,
        isMustVisit: false,
        photoUrl: templates.images[afternoonIdx],
        rating: 4.9,
        cost: { amount: 0, currency },
        openingHours: '24小時開放'
      });

      // 5. Return to Hotel or Depart to Airport
      if (i === dayCount - 1) {
        const titleText = (returnFlight && returnFlight.flightNumber) ? `${strings.arriveAirport} (${returnFlight.flightNumber})` : strings.arriveAirport;
        activities.push({
          id: `act-${i}-end`,
          order: 4,
          startTime: '18:00',
          endTime: '20:00',
          title: titleText,
          localTitle: (returnFlight && returnFlight.flightNumber) ? `Airport (${returnFlight.flightNumber})` : 'Airport',
          type: 'transport',
          description: strings.arriveAirportDesc,
          location: {
            name: `${currentDest.name}${strings.arriveAirportLocName}`,
            address: `${currentDest.name}${strings.arriveAirportLocAddress}`,
            latitude: currentDest.latitude || 0,
            longitude: currentDest.longitude || 0
          },
          duration: 120,
          transport: { mode: 'charter', duration: 45, distance: 30000, description: strings.returnHotelTransportDesc },
          links: [{ label: strings.grabLink, url: 'https://www.grab.com/', type: 'info' }],
          notes: returnFlight ? `航班時間：${returnFlight.departureTime}。請務必再三確認護照與隨身行李是否帶齊。` : strings.airportNotes,
          isMustVisit: false,
          photoUrl: 'local-asset://airport_map',
          cost: { amount: 0, currency },
          openingHours: strings.airportHours
        });
      } else {
        // 回到飯店的時間依當日最後一項活動的結束時間順延，避免與 CLAUDE.md 之每日 08:00-21:00
        // 時間限制及「合理間隔」規範脫鉤；超出範圍將由 clampFallbackItineraryTimes 統一校正。
        const lastAct = activities[activities.length - 1];
        const returnTransportDuration = lastAct?.transport?.duration || 15;
        const returnStartTime = lastAct ? addMinutesToTime(lastAct.endTime, returnTransportDuration) : '18:00';
        const returnEndTime = addMinutesToTime(returnStartTime, 30);

        activities.push({
          id: `act-${i}-end`,
          order: activities.length,
          startTime: returnStartTime,
          endTime: returnEndTime,
          title: `${strings.returnHotel}（${nightHotelName}）`,
          localTitle: nightHotelName,
          type: 'hotel',
          description: strings.returnHotelDesc,
          location: {
            name: nightHotelName,
            address: `${currentDest.name}${strings.hotelAddress}`,
            latitude: currentDest.latitude || 0,
            longitude: currentDest.longitude || 0
          },
          duration: 30,
          transport: { mode: 'charter', duration: 30, distance: 15000, description: strings.returnHotelTransportDesc },
          links: [{ label: strings.grabLink, url: 'https://www.grab.com/', type: 'info' }],
          notes: '',
          isMustVisit: false,
          cost: { amount: 0, currency },
          openingHours: '24小時開放'
        });
      }

      // 3. Fallback 航班時間對齊校正
      if (i === 0) {
        // 第一天去程對齊
        const arrTime = (outgoingFlight && outgoingFlight.arrivalTime) ? outgoingFlight.arrivalTime : '08:30';
        const arrEndTime = addMinutesToTime(arrTime, 90);
        const firstAct = activities[0];
        if (firstAct) {
          firstAct.startTime = arrTime;
          firstAct.endTime = arrEndTime;
          firstAct.duration = 90;
        }

        // 順延
        for (let idx = 1; idx < activities.length; idx++) {
          const prev = activities[idx - 1];
          const curr = activities[idx];
          const transDuration = prev.transport?.duration || 15;
          const earliestStart = addMinutesToTime(prev.endTime, transDuration);
          if (curr.startTime < earliestStart) {
            const duration = curr.duration || 60;
            curr.startTime = earliestStart;
            curr.endTime = addMinutesToTime(earliestStart, duration);
          }
        }
      } else if (i === dayCount - 1) {
        // 最後一天回程對齊
        const depTime = (returnFlight && returnFlight.departureTime) ? returnFlight.departureTime : '18:00';
        const airportStart = subMinutesFromTime(depTime, 150);
        const lastAct = activities[activities.length - 1];
        if (lastAct) {
          lastAct.startTime = airportStart;
          lastAct.endTime = depTime;
          lastAct.duration = 150;
        }

        // 前推
        let targetEnd = airportStart;
        const remainingActivities = activities.slice(0, -1);
        for (let idx = remainingActivities.length - 1; idx >= 0; idx--) {
          const act = remainingActivities[idx];
          const transDuration = act.transport?.duration || 15;
          const latestEnd = subMinutesFromTime(targetEnd, transDuration);
          if (act.endTime > latestEnd) {
            act.endTime = latestEnd;
            const duration = act.duration || 60;
            act.startTime = subMinutesFromTime(latestEnd, duration);
          }
          targetEnd = act.startTime;
        }

        // 過濾早於 07:30 的中間活動
        const filteredActs = activities.filter((act, idx) => {
          if (idx === 0 || idx === activities.length - 1) return true;
          return act.startTime >= '07:30';
        });

        filteredActs.forEach((a, idx) => {
          a.order = idx;
        });

        activities.length = 0;
        activities.push(...filteredActs);
      }

      // 4. 強制執行嚴格的 08:00 - 21:00 每日活動時間校正自癒
      const clampedActivities = clampFallbackItineraryTimes(activities);

      // 5. 構建每日行程資料
      const dayTitleTemplate = strings.dayTitle.replace('{day}', String(i + 1)).replace('{dest}', currentDest.name);
      const daySummaryTemplate = strings.daySummary.replace('{dest}', currentDest.name);

      days.push({
        dayNumber: i + 1,
        date: dateStr,
        title: dayTitleTemplate,
        summary: daySummaryTemplate,
        region: currentDest.name,
        estimatedCost: {
          amount: (survey?.dailyMealBudget || 800) * ((survey?.travelers?.adults || 2) + (survey?.travelers?.children || []).length),
          currency
        },
        walkingDistance: 5400,
        activities: clampedActivities,
        hotel: {
          name: i === dayCount - 1 ? dayHotelName : nightHotelName,
          address: `${currentDest.name}${strings.hotelAddress}`,
          ...(survey?.customBookingUrl ? { bookingUrl: survey.customBookingUrl } : {})
        },
        localTips: [
          {
            category: 'tipping',
            title: strings.checklistTipTitle,
            content: strings.checklistTipContent
          },
          {
            category: 'wifi',
            title: strings.wifiTipTitle,
            content: strings.wifiTipContent
          }
        ]
      });
    }

    const titleTemplate = strings.itineraryTitle
      .replace('{dests}', survey.destinations.map(d => d.name).join(' & '))
      .replace('{days}', String(dayCount));

    const generatedItinerary: Itinerary = {
      id: `itinerary-${Date.now().toString(36)}`,
      surveyId: survey.id,
      userId: survey.userId,
      title: titleTemplate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready',
      days,
      emergencyContacts: [
        { label: strings.emergencyPolice, number: '1155', description: strings.emergencyPoliceDesc },
        { label: strings.emergencyGeneral, number: '119' }
      ],
      totalEstimatedCost: {
        amount: days.reduce((acc, d) => acc + d.estimatedCost.amount, 0),
        currency
      },
      currency
    };

    healItineraryCoordinates(generatedItinerary, survey);
    return generatedItinerary;
  },
  /**
   * 規則式批次分析：解析使用者貼入的網址或景點名稱，推估標題與分類，
   * 並與既有行程比對是否重複，不依賴 LLM。
   */
  async analyzeBatchUrls(urlsText: string, itinerary?: Itinerary | null): Promise<any> {
    const region = itinerary?.days?.find(d => d.region)?.region || '';
    const existingTitles = new Set(
      (itinerary?.days || []).flatMap(d => d.activities.map(a => a.title.trim().toLowerCase()))
    );

    const lines = urlsText.split('\n').map(l => l.trim()).filter(Boolean);

    const analysisResults = lines.map(line => {
      const { title, url } = extractTitleFromLine(line);
      const category = guessCategoryFromText(`${title} ${url}`);
      const isDuplicate = existingTitles.has(title.trim().toLowerCase());

      return {
        title,
        url,
        category,
        region: region || '未知地區',
        aiDecision: isDuplicate ? 'not_recommended' : 'optional',
        aiDecisionReason: isDuplicate
          ? '此名稱與既有行程中的景點相同或相近，建議確認是否重複後再考慮加入。'
          : '已透過規則式系統解析名稱與分類，請自行確認地理位置與營業時間是否符合行程動線。',
        warnings: isDuplicate ? '與既有行程項目同名，可能重複' : '無',
        suggestion: '建議安排於鄰近既有景點的時段，並於出發前再次確認地點、營業時間與交通方式。',
      };
    });

    return { analysisResults };
  },

  /**
   * 取得目的地旅遊指南資訊（貨幣、緊急聯絡電話、常用短語、消費參考）。
   * 完全採用內建離線範本，不依賴 LLM。
   */
  async getDestinationGuideInfo(country: string): Promise<any> {
    const fallback = getFallbackGuideInfo(country);
    if (!fallback) return fallback;

    const key = detectGuideCountryKey(country);
    fallback.isFallback = true;
    fallback.isCovered = isCoveredGuideCountry(key);
    fallback.countryKey = key || undefined;
    fallback.downloadableCountry = !fallback.isCovered ? getDownloadableGuideCountry(key) : undefined;
    return fallback;
  }
};

export default aiService;

/** 將活動類型對應到適合的 POI 分類，供「重新抽選」時篩選候選景點 */
interface RestaurantSeed {
  title: string; localTitle: string; desc: string; lat: number; lon: number; cost: number;
}

/**
 * 內建實體餐廳清單（含真實座標），作為每日午餐的預設建議與「換一個」的離線備援。
 * title 對齊 UI 語系、localTitle 提供官方當地名稱（供現場叫車/地圖搜尋）。
 */
function getDestRestaurants(dest: string, lang: string): RestaurantSeed[] {
  const lower = (dest || '').toLowerCase();
  const isZhCn = lang === 'zh-CN';
  const isEn = lang !== 'zh-TW' && lang !== 'zh-CN';
  const pick = (tw: string, cn: string, en: string) => isEn ? en : (isZhCn ? cn : tw);

  const isJapan = lower.includes('東京') || lower.includes('tokyo') || lower.includes('日本') || lower.includes('japan');
  const isThailand = lower.includes('曼谷') || lower.includes('bangkok') || lower.includes('泰國') || lower.includes('thai') || lower.includes('芭達雅') || lower.includes('pattaya');

  if (isThailand) {
    return [
      { title: pick('Thip Samai 鬼門炒河粉', 'Thip Samai 鬼门炒河粉', 'Thip Samai Pad Thai'), localTitle: 'ทิพย์สมัย ผัดไทยประตูผี', desc: pick('曼谷公認最具代表性的炒河粉名店，以蛋包炒河粉聞名，創業逾七十年，每晚門庭若市。', '曼谷公认最具代表性的炒河粉名店，以蛋包炒河粉闻名，创业逾七十年，每晚门庭若市。', 'Bangkok\\\'s most iconic pad thai institution, famous for its egg-wrapped noodles and over 70 years of history.'), lat: 13.7530, lon: 100.5063, cost: 120 },
      { title: pick('Jay Fai 米其林一星街頭海鮮', 'Jay Fai 米其林一星街头海鲜', 'Jay Fai (1 Michelin Star)'), localTitle: 'เจ๊ไฝ', desc: pick('戴著護目鏡掌廚的傳奇老闆娘，以炭火現炒的蟹肉蛋包與海鮮冬蔭功享譽國際，米其林一星。', '戴着护目镜掌厨的传奇老板娘，以炭火现炒的蟹肉蛋包与海鲜冬荫功享誉国际，米其林一星。', 'Run by the legendary goggle-wearing chef, celebrated worldwide for charcoal-fired crab omelets; one Michelin star.'), lat: 13.7536, lon: 100.5044, cost: 800 },
      { title: pick('Krua Apsorn 家常泰菜名店', 'Krua Apsorn 家常泰菜名店', 'Krua Apsorn'), localTitle: 'ครัวอัปษร', desc: pick('曾獲皇室御廚背書的家常泰菜餐廳，招牌咖哩蟹肉與炒水空心菜深受在地人喜愛。', '曾获皇室御厨背书的家常泰菜餐厅，招牌咖喱蟹肉与炒水空心菜深受在地人喜爱。', 'A beloved home-style Thai restaurant endorsed by royal chefs, known for stir-fried crab with yellow curry.'), lat: 13.7589, lon: 100.5043, cost: 350 }
    ];
  }
  if (isJapan) {
    return [
      { title: pick('一蘭拉麵 澀谷店', '一兰拉面 涩谷店', 'Ichiran Ramen Shibuya'), localTitle: '一蘭 渋谷店', desc: pick('以個人專注隔間與濃郁豚骨湯頭聞名的連鎖拉麵名店，可依喜好客製湯頭濃度與辣度。', '以个人专注隔间与浓郁豚骨汤头闻名的连锁拉面名店，可依喜好客制汤头浓度与辣度。', 'Famous ramen chain with private focus booths and rich tonkotsu broth, customizable to taste.'), lat: 35.6614, lon: 139.7006, cost: 1200 },
      { title: pick('邁泉豬排 青山總店', '迈泉猪排 青山总店', 'Tonkatsu Maisen Aoyama'), localTitle: 'とんかつ まい泉 青山本店', desc: pick('改建自老澡堂的炸豬排名店，豬排酥嫩多汁、入口即化，搭配自製醬汁堪稱東京一絕。', '改建自老澡堂的炸猪排名店，猪排酥嫩多汁、入口即化，搭配自制酱汁堪称东京一绝。', 'Set in a former bathhouse, this tonkatsu institution serves famously tender, juicy cutlets.'), lat: 35.6657, lon: 139.7106, cost: 2000 },
      { title: pick('築地壽司清', '筑地寿司清', 'Tsukiji Sushiko'), localTitle: '築地寿司清', desc: pick('鄰近築地市場的老字號壽司店，使用當日直送鮮魚，江戶前握壽司新鮮細緻。', '邻近筑地市场的老字号寿司店，使用当日直送鲜鱼，江户前握寿司新鲜细致。', 'A long-established sushi house near Tsukiji using daily-fresh fish for refined Edomae nigiri.'), lat: 35.6655, lon: 139.7707, cost: 3000 }
    ];
  }
  // 預設：台北 / 通用
  return [
    { title: pick('鼎泰豐 信義店', '鼎泰丰 信义店', 'Din Tai Fung Xinyi'), localTitle: '鼎泰豐', desc: pick('享譽國際的小籠包名店，十八摺薄皮湯包鮮美多汁，米其林推薦、觀光客必訪。', '享誉国际的小笼包名店，十八折薄皮汤包鲜美多汁，米其林推荐、观光客必访。', 'World-renowned for its 18-fold xiaolongbao soup dumplings; Michelin-recommended.'), lat: 25.0330, lon: 121.5630, cost: 400 },
    { title: pick('阜杭豆漿', '阜杭豆浆', 'Fuhang Soy Milk'), localTitle: '阜杭豆漿', desc: pick('華山市場二樓的排隊名店，現烤厚燒餅夾蛋與鹹豆漿是台北經典早午餐。', '华山市场二楼的排队名店，现烤厚烧饼夹蛋与咸豆浆是台北经典早午餐。', 'A famous queue spot serving thick baked flatbread and savory soy milk — a Taipei breakfast classic.'), lat: 25.0444, lon: 121.5197, cost: 120 },
    { title: pick('阿宗麵線', '阿宗面线', 'Ay-Chung Flour-Rice Noodles'), localTitle: '阿宗麵線', desc: pick('西門町站著吃的傳奇小吃，柴魚高湯麵線淋上滷大腸與香菜，是台北街頭代表味。', '西门町站着吃的传奇小吃，柴鱼高汤面线淋上卤大肠与香菜，是台北街头代表味。', 'A legendary Ximending street snack: bonito-broth thin noodles topped with braised intestine.'), lat: 25.0438, lon: 121.5070, cost: 90 }
  ];
}

const ACTIVITY_TYPE_TO_POI_CATEGORIES: Record<string, PoiCategory[]> = {
  attraction: ['cultural', 'historic', 'architecture', 'museum', 'viewpoint', 'other'],
  restaurant: ['food'],
  cafe: ['food'],
  shopping: ['shopping', 'market'],
  spa: ['other', 'entertainment'],
  entertainment: ['entertainment', 'amusement'],
  activity: ['amusement', 'entertainment', 'nature', 'park', 'viewpoint'],
  hotel: ['other'],
  transport: ['other'],
};

/** 兩座經緯度座標間的直線距離（公尺） */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 由真實 POI 組裝出一個「重新抽選」候選活動 */
function buildAlternativeFromPOI(
  poi: POI,
  current: Activity,
  next: Activity | undefined,
  region: string,
  locale: string,
  labels: Record<PoiCategory, string>
): Activity {
  const label = labels[poi.category] || labels.other;
  const isZh = locale.startsWith('zh');

  const description = isZh
    ? `「${poi.name}」是${region}著名的${label}，深受旅客喜愛。建議安排充裕的時間細細探訪，感受當地獨特的氛圍與風情。實際開放時間與票價請於出發前再次確認。`
    : `${poi.name} is a well-known ${label} in ${region}, popular with travelers. Allow enough time to explore it and soak in the local atmosphere. Please re-confirm opening hours and ticket prices before you go.`;

  const notes = isZh
    ? `規則式系統依據您的興趣與行程節點，自當地真實景點資料庫中為您推薦此替代方案，可作為「${current.title}」的同時段選項。`
    : `Recommended by the rule-based engine from local POI data as an alternative to "${current.title}" for the same time slot, based on your interests.`;

  let transport = current.transport ? { ...current.transport } : undefined;
  const nextLat = next?.location?.latitude;
  const nextLon = next?.location?.longitude;
  if (typeof nextLat === 'number' && typeof nextLon === 'number' && (nextLat !== 0 || nextLon !== 0)) {
    const distance = Math.round(haversineMeters(poi.lat, poi.lon, nextLat, nextLon));
    const mode: TransportInfo['mode'] = distance <= 1200 ? 'walk' : distance <= 6000 ? 'public' : 'taxi';
    const speedMetersPerMin = mode === 'walk' ? 70 : mode === 'public' ? 300 : 500;
    const duration = Math.max(5, Math.round(distance / speedMetersPerMin));
    transport = {
      mode,
      duration,
      distance,
      description: isZh
        ? `自「${poi.name}」前往「${next!.title}」，預估距離約 ${distance} 公尺，建議${mode === 'walk' ? '步行' : mode === 'public' ? '搭乘大眾運輸' : '搭乘計程車或叫車'}前往。`
        : `From "${poi.name}" to "${next!.title}", approx. ${distance} m. Recommended: ${mode === 'walk' ? 'walk' : mode === 'public' ? 'public transit' : 'taxi/ride-hailing'}.`
    };
  }

  return {
    id: `alt-${poi.xid || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    order: current.order,
    startTime: current.startTime,
    endTime: current.endTime,
    title: poi.name,
    localTitle: poi.localName || poi.name,
    type: current.type,
    description,
    location: {
      name: poi.name,
      address: region,
      latitude: poi.lat,
      longitude: poi.lon,
    },
    duration: current.duration,
    rating: current.rating,
    cost: current.cost,
    openingHours: current.openingHours,
    links: [{
      label: isZh ? `Google 地圖搜尋：${poi.name}` : `Google Maps: ${poi.name}`,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${poi.name} ${region}`)}`,
      type: 'map',
    }],
    notes,
    isMustVisit: false,
    transport,
  };
}

/**
 * 規則式「重新抽選」：自當地真實 POI 資料庫（OpenTripMap）中，
 * 篩選出與原活動同類型、且非重複的候選景點，組成 3 個替代方案。
 * 完全不依賴 LLM。
 */
export async function regenerateActivityAlternatives(
  survey: TripSurvey,
  currentActivity: Activity,
  prevActivity: Activity | undefined,
  nextActivity: Activity | undefined,
  region: string
): Promise<Activity[]> {
  const locale = survey?.locale || i18n.locale || 'zh-TW';
  const labels = CATEGORY_LABEL[locale] || CATEGORY_LABEL['en'];
  const targetCategories = ACTIVITY_TYPE_TO_POI_CATEGORIES[currentActivity.type] || ['cultural', 'historic', 'viewpoint', 'other'];

  const lat = currentActivity.location?.latitude;
  const lon = currentActivity.location?.longitude;

  let pois: POI[] = [];
  try {
    pois = await fetchDestinationPOIs({
      destName: region,
      lat: lat && lat !== 0 ? lat : undefined,
      lon: lon && lon !== 0 ? lon : undefined,
      interests: survey?.interests || [],
      limit: 40,
    });
  } catch (e) {
    console.warn('[regenerateActivityAlternatives] POI 取得失敗', e);
  }

  const excludeName = currentActivity.title.trim().toLowerCase();
  let candidates = pois.filter(p =>
    targetCategories.includes(p.category) && p.name.trim().toLowerCase() !== excludeName
  );
  if (candidates.length < 3) {
    candidates = pois.filter(p => p.name.trim().toLowerCase() !== excludeName);
  }
  if (candidates.length === 0) {
    // 餐廳/咖啡無 POI 資料時，退回內建實體餐廳清單，確保「換一個」仍能提供真實選擇。
    if (currentActivity.type === 'restaurant' || currentActivity.type === 'cafe') {
      const seeds = getDestRestaurants(region, locale)
        .filter(s => s.title.trim().toLowerCase() !== excludeName && s.localTitle.trim().toLowerCase() !== excludeName);
      if (seeds.length > 0) {
        return seeds.slice(0, 3).map((s, idx) => ({
          ...currentActivity,
          id: `${currentActivity.id}-alt-${idx}`,
          title: s.title,
          localTitle: s.localTitle,
          description: s.desc,
          location: {
            name: s.title,
            address: region,
            latitude: s.lat,
            longitude: s.lon,
          },
          cost: { amount: s.cost, currency: currentActivity.cost?.currency || 'TWD' },
        }));
      }
    }
    throw new Error('NO_ALTERNATIVES_FOUND');
  }

  return candidates
    .slice(0, 3)
    .map(poi => buildAlternativeFromPOI(poi, currentActivity, nextActivity, region, locale, labels));
}

function clampFallbackItineraryTimes(activities: Activity[]): Activity[] {
  if (activities.length === 0) return activities;

  const ABSOLUTE_START = '08:00';
  const ABSOLUTE_END = '21:00';

  // 1. Force first activity startTime to be at least 08:00
  let firstAct = activities[0];
  if (firstAct.startTime < ABSOLUTE_START) {
    const dur = firstAct.duration || 60;
    firstAct.startTime = ABSOLUTE_START;
    firstAct.endTime = addMinutesToTime(ABSOLUTE_START, dur);
  } else if (firstAct.startTime > ABSOLUTE_END) {
    firstAct.startTime = '20:00';
    firstAct.endTime = ABSOLUTE_END;
    firstAct.duration = 60;
  }

  // 2. Align subsequent activities forward
  for (let idx = 1; idx < activities.length; idx++) {
    const prev = activities[idx - 1];
    const curr = activities[idx];
    const transDuration = prev.transport?.duration || 15;
    const earliestStart = addMinutesToTime(prev.endTime, transDuration);
    if (curr.startTime < earliestStart) {
      const duration = curr.duration || 60;
      curr.startTime = earliestStart;
      curr.endTime = addMinutesToTime(earliestStart, duration);
    }
  }

  // 3. Backward correction from the last activity if it exceeds 21:00
  let lastAct = activities[activities.length - 1];
  if (lastAct.endTime > ABSOLUTE_END) {
    lastAct.endTime = ABSOLUTE_END;
    const dur = lastAct.duration || 60;
    lastAct.startTime = subMinutesFromTime(ABSOLUTE_END, dur);
  }

  // 4. Align backwards to prevent overlap
  let targetEnd = lastAct.startTime;
  for (let idx = activities.length - 2; idx >= 0; idx--) {
    const act = activities[idx];
    const transDuration = act.transport?.duration || 15;
    const latestEnd = subMinutesFromTime(targetEnd, transDuration);
    if (act.endTime > latestEnd) {
      act.endTime = latestEnd;
      const duration = act.duration || 60;
      act.startTime = subMinutesFromTime(latestEnd, duration);
    }
    targetEnd = act.startTime;
  }

  // 5. If backwards push makes the first activity start before 08:00, compress durations
  if (firstAct.startTime < ABSOLUTE_START) {
    firstAct.startTime = ABSOLUTE_START;
    const firstDur = Math.max(30, firstAct.duration || 60);
    firstAct.endTime = addMinutesToTime(ABSOLUTE_START, firstDur);
    firstAct.duration = firstDur;

    for (let idx = 1; idx < activities.length; idx++) {
      const prev = activities[idx - 1];
      const curr = activities[idx];
      const transDuration = prev.transport?.duration || 15;
      const earliestStart = addMinutesToTime(prev.endTime, transDuration);
      curr.startTime = earliestStart;
      
      const [currH, currM] = earliestStart.split(':').map(Number);
      const remainingMinutes = (21 * 60) - ((currH || 0) * 60 + (currM || 0));
      let allowedDur = curr.duration || 60;
      
      if (allowedDur > remainingMinutes) {
        allowedDur = Math.max(30, remainingMinutes);
      }
      
      curr.duration = allowedDur;
      curr.endTime = addMinutesToTime(earliestStart, allowedDur);
    }
  }

  // 6. Clean up: filter out any activity starting after 21:00 and reorder
  const validActs = activities.filter(act => act.startTime <= ABSOLUTE_END);
  validActs.forEach((act, idx) => {
    act.order = idx;
    act.duration = typeof act.duration === 'string' ? parseInt(act.duration, 10) : act.duration;
  });

  return validActs;
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  if (!timeStr) return '08:00';
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = (h || 0) * 60 + (m || 0) + minutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function subMinutesFromTime(timeStr: string, minutes: number): string {
  if (!timeStr) return '18:00';
  const [h, m] = timeStr.split(':').map(Number);
  let totalMin = (h || 0) * 60 + (m || 0) - minutes;
  if (totalMin < 0) totalMin = 0; // Prevent negative times
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

