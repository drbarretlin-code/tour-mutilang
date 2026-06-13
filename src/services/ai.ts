import { TripSurvey } from '../types/survey';
import { Itinerary, ItineraryDay, Activity, TransportInfo } from '../types/itinerary';
import i18n from '../i18n';
import { SUGGESTED_DESTINATIONS } from '../constants/destinations';
import { fetchDestinationPOIs, POI, PoiCategory } from './poi';
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
    if (locale.startsWith('zh')) {
      tpl.descs.push(`「${p.name}」是${destName}著名的${label}，深受旅客喜愛。建議安排充裕的時間細細探訪，感受當地獨特的氛圍與風情。實際開放時間與票價請於出發前再次確認。`);
    } else {
      tpl.descs.push(`${p.name} is a well-known ${label} in ${destName}, popular with travelers. Allow enough time to explore it and soak in the local atmosphere. Please re-confirm opening hours and ticket prices before you go.`);
    }
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
              '浅草寺是东京都内历史最悠久的寺庙，创建于公元628年。其标志性的巨型红灯笼“雷门”是江户文化的象征，两侧的仲见世通商店街贩售各式传统小吃与工艺品，是体验日本传统佛教底蕴的必访之地。',
              '涩谷是东京乃至全球时尚与青年文化的发源地。著名的涩谷站前十字路口在绿灯亮起时，成百上千的人潮交织穿梭，极具震撼感。周边林立着百货公司、潮流品牌与特色居酒屋。',
              '明治神宫是为了供奉明治天皇与昭宪皇太后而建的神社。神宫掩映在占地70公顷的巨大人工森林中，踏入神宫，尘嚣顿消，是繁华东京市中心难得的静谧绿洲与神圣之所。'
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
              'Sensō-ji is Tokyo\\\'s oldest temple, founded in 628. Its iconic red lantern at the Kaminarimon Gate symbolizes Edo culture. The Nakamise-dori street is filled with traditional snacks and crafts, making it a must-visit to experience Japan\\\'s Buddhist heritage.',
              'Shibuya is the birthplace of fashion and youth culture in Tokyo. The famous Shibuya Crossing sees hundreds of people crossing in all directions simultaneously when the lights turn green. Surrounding areas are packed with shopping malls, trend brands, and izakayas.',
              'Meiji Jingu is a Shinto shrine dedicated to the deified spirits of Emperor Meiji and his consort. Enclosed in a 70-hectare forest, entering the shrine grounds makes you forget the busy city, providing a rare green oasis in Tokyo.'
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
              '淺草寺是東京都內歷史最悠久的寺廟，創建於公元628年。其標誌性的巨型紅燈籠「雷門」是江戶文化的象徵，兩側的仲見世通商店街販售各式傳統小吃與工藝品，是體驗日本傳統佛教底蘊的必訪之地。',
              '澀谷是東京乃至全球時尚與青年文化的發源地。著名的澀谷站前十字路口在綠燈亮起時，成百上千的人潮交織穿梭，極具震撼感。周邊林立著百貨公司、潮流品牌與特色居酒屋。',
              '明治神宮是為了供奉明治天皇與昭憲皇太后而建的神社。神宮掩映在佔地70公頃的巨大人工森林中，踏入神宮，塵囂頓消，是繁華東京市中心難得的靜謐綠洲與神聖之所。'
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
              '大皇宫是曼谷王朝的象征，自1782年建立起便是暹罗王室的官方官邸。其内部建筑融合了泰式传统与欧式风情，雕梁画栋、极尽奢华。供奉于玉佛寺的翡翠玉佛更是泰国最崇高的国宝。',
              '水上市场是泰国古老运河文化的缩影。商家划着装满新鲜水果、椰子烤肉的小船在河道上穿梭兜售，空气中弥漫着地道泰式调味料的香气，是体验泰国常民风情与美食的绝佳去处。',
              '郑王庙又称黎明寺，座落于昭批耶河畔。其主塔高达82米，塔身镶嵌了无数碎陶瓷与贝壳，在阳光下熠熠生辉。黄昏时分，夕阳将塔影拉长，倒映在河面上，极具诗意。'
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
              'The Grand Palace is a complex of buildings at the heart of Bangkok, serving as the official residence of the Kings of Siam since 1782. Its architecture blends traditional Thai and European styles. The Emerald Buddha housed in Wat Phra Kaew is Thailand\\\'s most sacred object.',
              'The floating markets showcase Thailand\\\'s ancient canal culture. Merchants row small boats laden with fresh fruits and grilled food, selling directly to visitors. The air is filled with authentic Thai seasoning aroma, making it a perfect spot to experience local life.',
              'Wat Arun, also known as the Temple of Dawn, is situated on the west bank of the Chao Phraya River. Its central prang rises 82 meters high, decorated with colorful porcelain and seashells. At sunset, the golden light reflections on the river are exceptionally poetic.'
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
              '大皇宮是曼谷王朝的象徵，自1782年建立起便是暹羅王室的官方官邸。其內部建築融合了泰式傳統與歐式風情，雕樑畫棟、極盡奢華。供奉於玉佛寺的翡翠玉佛更是泰國最崇高的國寶。',
              '水上市場是泰國古老運河文化的縮影。商家劃著裝滿新鮮水果、椰子烤肉的小船在河道上穿梭兜售，空氣中瀰漫著地道泰式調味料的香氣，是體驗泰國常民風情與美食的絕佳去處。',
              '鄭王廟又稱黎明寺，座落於昭批耶河畔。其主塔高達82米，塔身鑲嵌了無數碎陶瓷與貝殼，在陽光下熠熠生輝。黃昏時分，夕陽將塔影拉長，倒映在河面上，極具詩意。'
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
            '台北101曾是世界第一高楼，是台湾现代科技的里程碑。搭乘超高速电梯仅需37秒即可直达89楼观景台，俯瞰台北盆地壮丽的城市天际线，并近距离观察重达660公吨的风阻尼器巨大钢球。',
            '九份是一座依山面海的古老矿业小镇，因李安导演《悲情城市》与传闻中神似宫崎骏《千与千寻》场景而声名大噪。窄小的石阶、错落有致的红灯笼与茶楼，漫步其间，仿佛时空倒流。',
            '夜市是台湾最具代表性的饮食文化核心。士林夜市历史悠久，汇聚了超大鸡排、蚵仔煎、大肠包小肠与珍珠奶茶等全球知名的饭餐美食，是感受台北夜生活与热情民风的必选地。'
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
            'Taipei 101 was once the tallest building in the world and is a milestone of Taiwan\\\'s modern technology. An ultra-high-speed elevator whisks you to the 89th-floor observatory in just 37 seconds for a breathtaking 360-degree view of Taipei Basin.',
            'Jiufen is a historic mountainside gold-mining town famous for its atmospheric teahouses and narrow cobblestone alleys. It inspired the film A City of Sadness and draws comparison to Spirited Away scenery.',
            'Night markets are the core of Taiwan\\\'s culinary culture. Shilin Night Market is historical, serving famous foods like giant fried chicken cutlets, oyster omelets, and bubble tea. A must-visit to experience local life.'
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
            '台北101曾是世界第一高樓，是台灣現代科技的里程碑。搭乘超高速電梯僅需37秒即可直達89樓觀景台，俯瞰台北盆地壯麗的城市天際線，並近距離觀察重達660公噸的風阻尼器巨大鋼球。',
            '九份是一座依山面海的古老礦業小鎮，因李安導演《悲情城市》與傳聞中神似宮崎駿《神隱少女》場景而聲名大噪。窄小的石階、錯落有致的紅燈籠與茶樓，漫步其間，彷彿時空倒流。',
            '夜市是台灣最具代表性的飲食文化核心。士林夜市歷史悠久，匯聚了超大雞排、蚵仔煎、大腸包小腸與珍珠奶茶等全球知名的庶民美食，是感受台北夜生活與熱情民風的必選地。'
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
    const resolveHotelForDate = (dateStr: string): string | null => {
      for (const loc of userSpecificLocations) {
        if (!isHotelItem(loc.value)) continue;
        const r = parseRange(loc.preferredDate);
        if (r && dateStr >= r.startStr && dateStr <= r.endStr) return loc.value;
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

      // 當日住宿（依日期區間解析），作為每日起訖點；找不到則退回通用名稱。
      const dayHotelName = resolveHotelForDate(dateStr) || strings.hotelName;

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
      
      activities.push({
        id: `act-${i}-2`,
        order: 2,
        startTime: '12:00',
        endTime: '13:30',
        title: `${strings.lunchTitle}${currentLunchTitle}`,
        localTitle: 'Local Restaurant',
        type: 'restaurant',
        description: strings.lunchDesc,
        location: {
          name: strings.lunchLocName,
          address: `${currentDest.name}${strings.lunchLocAddress}`,
          latitude: currentDest.latitude || 0,
          longitude: currentDest.longitude || 0
        },
        duration: 90,
        transport: { mode: 'public', duration: 15, distance: 2000, description: strings.lunchTransportDesc },
        links: [],
        notes: strings.lunchNotes,
        isMustVisit: false,
        photoUrl: templates.images[2],
        rating: 4.7,
        cost: { amount: 350, currency },
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
        activities.push({
          id: `act-${i}-end`,
          order: 4,
          startTime: '18:00',
          endTime: '18:30',
          title: `${strings.returnHotel}（${dayHotelName}）`,
          localTitle: dayHotelName,
          type: 'hotel',
          description: strings.returnHotelDesc,
          location: {
            name: dayHotelName,
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
          name: strings.hotelName,
          address: `${currentDest.name}${strings.hotelAddress}`,
          bookingUrl: survey?.customBookingUrl || undefined
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

