import { TripSurvey } from '../types/survey';
import { Itinerary, ItineraryDay, Activity } from '../types/itinerary';
import { PACEngine } from "./pac";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { settingsService } from './settings';
import { verifyItineraryLinks, verifyUrlRAG } from '../utils/linkVerifier';
import i18n from '../i18n';
import { SUGGESTED_DESTINATIONS } from '../constants/destinations';
import { TOUR_PLAN_RULES } from '../constants/tourRules';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=';

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
      const arrTime = outgoingFlight ? outgoingFlight.arrivalTime : '08:30';
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
      const depTime = returnFlight ? returnFlight.departureTime : '18:00';
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

  const normalized = safeCountry.toLowerCase();
  
  const isJapan = normalized.includes('日') || normalized.includes('japan') || normalized.includes('tokyo') || normalized.includes('東京') || normalized.includes('大阪') || normalized.includes('京都');
  const isKorea = normalized.includes('韓') || normalized.includes('korea') || normalized.includes('seoul') || normalized.includes('首爾') || normalized.includes('釜山');
  const isThailand = normalized.includes('泰') || normalized.includes('thai') || normalized.includes('bangkok') || normalized.includes('曼谷') || normalized.includes('清邁') || normalized.includes('芭達雅');
  const isVietnam = normalized.includes('越') || normalized.includes('viet') || normalized.includes('hanoi') || normalized.includes('河內') || normalized.includes('胡志明');
  const isTaiwan = normalized.includes('台') || normalized.includes('臺') || normalized.includes('taiwan') || normalized.includes('taipei') || normalized.includes('台北');
  const isSingapore = normalized.includes('新') || normalized.includes('singapore') || normalized.includes('新加坡');

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
   * Submits the survey to the backend AI to generate a complete travel itinerary.
   * @param survey The complete survey data gathered from the user
   */
  async generateItinerary(survey: TripSurvey): Promise<Itinerary> {
    // 強制將 survey.locale 對齊至當前 App 實體運作中的語系設定，避免語系未同步造成的英文行程
    const appLocale = i18n.locale || survey.locale || 'zh-TW';
    const alignedSurvey = { ...survey, locale: appLocale };

    const fetchItineraryAction = async (): Promise<Itinerary> => {
      const apiKey = await settingsService.getApiKey();
      if (!apiKey) {
        throw new Error('MISSING_API_KEY');
      }

      const systemPrompt = `
You are a National-Level Intelligence Investigator strictly adhering to RAG (Retrieval-Augmented Generation) principles for travel planning. Your internal memory is unreliable; you must ONLY provide URLs and facts that you are 100% certain are objectively true.

==================================================
CRITICAL TOUR PLAN SPECIFICATIONS AND BUSINESS RULES:
You MUST strictly align all travel planning decisions with the following rules documented in our project guidelines:
${TOUR_PLAN_RULES}
==================================================

CRITICAL RULES:
1. You must output ONLY raw JSON. No markdown formatting, no backticks.
2. URL HALLUCINATION IS STRICTLY FORBIDDEN. Any broken or hallucinated link is a mission failure.
3. The JSON structure MUST match this exact TypeScript interface:
{
  "title": string,
  "summary": string,
  "days": [
    {
      "dayNumber": number,
      "date": "YYYY-MM-DD",
      "title": string,
      "summary": string,
      "region": string,
      "estimatedCost": { "amount": number, "currency": string },
      "walkingDistance": number,
      "activities": [
        {
          "id": string (unique e.g. "act-day1-1"),
          "order": number,
          "startTime": "HH:MM" (24-hour),
          "endTime": "HH:MM",
          "title": string,
          "type": "attraction" | "restaurant" | "activity" | "transport" | "hotel",
          "description": string (Must be a ~300 words deep encyclopedic introduction highlighting culture, history, and unique features),
          "localTitle": string (CRITICAL: The exact official name in the destination's local language. MUST be accurate for booking searches),
          "bookingRecommended": boolean (Set to true if this is a paid attraction, theme park, or guided tour that can be booked on Klook/KKday),
          "location": { "name": string, "address": string, "latitude": number (real world coordinate), "longitude": number (real world coordinate) },
          "duration": number (minutes),
          "transport": { "mode": "walk"|"public"|"charter"|"taxi", "duration": number, "distance": number, "description": string },
          "notes": string,
          "rating": number (1-5),
          "cost": { "amount": number, "currency": string },
          "openingHours": string,
          "links": [ { "label": string, "url": string, "type": "info"|"booking" } ]
        }
      ]
    }
  ]
}

3. AIRPORT & HOTEL LOOP RULE: 
- Day 1: The FIRST activity (order 0) MUST be "Arrive at Airport" (type: "transport"). The LAST activity MUST be "Return to Hotel" (type: "hotel").
- Middle Days: The FIRST activity MUST be "Depart from Hotel" (type: "hotel"). The LAST activity MUST be "Return to Hotel" (type: "hotel").
- Final Day: The FIRST activity MUST be "Depart from Hotel" (type: "hotel"). The LAST activity MUST be "Arrive at Airport for Departure" (type: "transport").
4. TRANSPORT RULE: The transport.duration and transport.distance MUST be realistically estimated based on the actual road travel route (not straight-line distance) from the previous activity's location. DO NOT use static values. The distance must be in meters. If transport is 'public' or 'walk', provide EXTREMELY detailed routing in transport.description. If transport is 'charter' (包車), you MUST add a safe booking link (e.g. Klook/KKday) to the activity's "links" array, and add safety tips in transport.description.
5. AIRPORT MAP RULE: For the "Arrive at Airport" and "Arrive at Airport for Departure" activities, you MUST set the "photoUrl" field to exactly "local-asset://airport_map".
6. FLIGHT ALIGNMENT RULE: If the user provides flight information in "flights" (where isReturn = false for outgoing, isReturn = true for return):
   - Outgoing Flight: Day 1's FIRST activity "Arrive at Airport" (order 0) MUST have its startTime aligned to the flight's arrivalTime. The activity title MUST be "Arrive at Airport (\${flightNumber})" and duration set to 90 minutes. Subsequent activities on Day 1 MUST begin after this airport clearance.
   - Return Flight: The Final Day's LAST activity "Arrive at Airport for Departure" MUST end at the flight's departureTime. Its startTime MUST be set to 2.5 hours before the departureTime (duration: 150 minutes). The activity title MUST be "Arrive at Airport for Departure (\${flightNumber})". All previous Final Day activities MUST end by this time.
7. LOGICAL TIMING: Pay strict attention to typical business hours. Night Markets MUST be in the evening.
8. USER INPUT & COMPREHENSIVENESS: 
   - You MUST include 100% of the user's "mustVisitAttractions" in the itinerary. Failing to do so is a catastrophic failure.
   - For every "referenceAttractions" (URLs) provided by the user, you MUST create or adapt an activity for it, and strictly inject that URL into the "links" array of that activity.
9. OPTIMIZATION & FILLING GAPS: You MUST optimize the itinerary to be rich and fulfilling. There should be NO gaps longer than 90 minutes between activities (excluding sleep). If the user's requested attractions do not fill the entire day, you MUST proactively recommend and invent high-quality, logically located activities (e.g., highly-rated local cafes, hidden gem sightseeing, shopping districts) to fill the empty time slots.
10. URL ACCURACY RULE: DO NOT guess or hallucinate official website URLs for hotels, restaurants, or attractions. If you do not know the EXACT official URL, you MUST generate a Google Search URL (e.g. https://www.google.com/search?q=URL+ENCODED+NAME) instead of a fake domain.
11. The resulting JSON must be directly parseable.
12. OUTPUT LANGUAGE RULE: You MUST output all textual fields in the JSON (such as "title", "summary", "description", "notes", and transport descriptions) in the language corresponding to the user's "locale" property in the survey data.
- If locale is "zh-TW" or "zh-CN", use Traditional/Simplified Chinese.
- If locale is "ja", use Japanese.
- If locale is "th", use Thai.
- If locale is "ko", use Korean.
- If locale is "vi", use Vietnamese.
- If locale is "ms", use Malay.
- If locale is "es", use Spanish.
- If locale is "pt", use Portuguese.
- Default to English if the locale is unrecognized.
13. COORDINATE RULE: You MUST provide realistic real-world geographic coordinates (latitude and longitude) for every activity's "location" object. Under no circumstances should latitude or longitude be 0 or omitted, as they are directly used for rendering the dynamic route maps and calculate distances. If you don't know the exact coordinates of a specific spot, estimate them based on its parent city/region.

==================================================
CRITICAL TOUR PLAN SPECIFICATIONS AND BUSINESS RULES WARNING:
YOU MUST STRICTLY COMPLY WITH ALL TOUR PLAN SPECIFICATIONS AND RULES DEFINED ABOVE:
1. THE DAILY ACTIVITIES TIME MUST BE STRICTLY WITHIN 08:00 - 21:00. NO ACTIVITY START TIME BEFORE 08:00 OR END TIME AFTER 21:00 (EXCEPT FLIGHT ARRIVALS/DEPARTURES MATCHING FLIGHT ALIGNMENT RULE).
2. THE AIRPORT AND HOTEL LOOP RULES MUST BE 100% FOLLOWED.
3. THE OUTPUT TEXTUAL FIELDS MUST BE ALIGNED WITH THE USER'S LOCALE: "${alignedSurvey.locale || 'zh-TW'}".
4. THE "localTitle" FIELD MUST BE IN DESTINATION'S LOCAL LANGUAGE.
FAILURE TO ADHERE TO THESE SPECIFICATIONS WILL CAUSE CRITICAL SYSTEM ERRORS.
==================================================`;

      const response = await fetch(`${GEMINI_API_URL}${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(alignedSurvey) }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.7
          }
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        if (response.status === 400 && errJson.error?.message?.includes('API key not valid')) {
          throw new Error('INVALID_API_KEY');
        }
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textOutput) {
        throw new Error('Invalid response structure from Gemini API');
      }

      let parsedResult: any;
      try {
        parsedResult = JSON.parse(textOutput);
      } catch (e) {
        throw new Error('Failed to parse Gemini JSON output');
      }

      // --- 強制 RAG 超連結檢驗 (URL -> 原文 -> 分析) ---
      // 非同步批次檢驗所有 AI 產生的網址，剔除幻覺並補上安全搜尋
      parsedResult = await verifyItineraryLinks(parsedResult);

      // --- 強制校正 LLM 經緯度座標 (Proactive Healing) ---
      healItineraryCoordinates(parsedResult, alignedSurvey);

      // --- 強制校正 LLM 行程起訖點 (Post-processing Guard) ---
      if (parsedResult.days && parsedResult.days.length > 0) {
        const days = parsedResult.days;
        const firstDay = days[0];
        const lastDay = days[days.length - 1];
        const destName = firstDay.region || survey.destinations[0]?.name || '當地';
        const currency = survey.currency || 'TWD';

        const outgoingFlight = survey.flights?.find(f => !f.isReturn);
        const returnFlight = survey.flights?.find(f => f.isReturn);

        // 檢查第一天第一站 (去程對齊)
        if (firstDay.activities && firstDay.activities.length > 0) {
          const arrTime = outgoingFlight ? outgoingFlight.arrivalTime : '08:30';
          const arrEndTime = addMinutesToTime(arrTime, 90);
          const firstAct = firstDay.activities[0];

          if (!firstAct.title.includes('機場') && !firstAct.title.toLowerCase().includes('airport')) {
            firstDay.activities.unshift({
              id: `act-day1-start-forced`,
              order: 0,
              startTime: arrTime,
              endTime: arrEndTime,
              title: outgoingFlight ? `抵達當地機場 (${outgoingFlight.flightNumber})` : '抵達當地機場',
              type: 'transport',
              description: '順利抵達當地機場，完成通關手續並領取行李。建議您先在機場購買當地的網卡或兌換部分當地貨幣，為接下來的旅程做好準備。',
              location: { name: `${destName}國際機場`, address: `${destName}機場航廈` },
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

          // 重新排序與順延時間
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

        // 檢查最後一天最後一站 (回程對齊)
        if (lastDay.activities && lastDay.activities.length > 0) {
          const depTime = returnFlight ? returnFlight.departureTime : '18:00';
          const airportStart = subMinutesFromTime(depTime, 150);
          let lastAct = lastDay.activities[lastDay.activities.length - 1];

          if (!lastAct.title.includes('機場') && !lastAct.title.toLowerCase().includes('airport')) {
            lastDay.activities.push({
              id: `act-day${days.length}-end-forced`,
              order: lastDay.activities.length,
              startTime: airportStart,
              endTime: depTime,
              title: returnFlight ? `抵達機場準備返航 (${returnFlight.flightNumber})` : '抵達機場準備返國',
              type: 'transport',
              description: '帶著滿滿的美好回憶，抵達機場準備搭機返國。建議您預留足夠的時間辦理退稅手續，並在免稅店做最後的採購。',
              location: { name: `${destName}國際機場`, address: `${destName}機場航廈` },
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

          // 重新排序並過濾掉時間太早的中間活動 (例如 07:30 以前的中間景點活動)
          const validActs = lastDay.activities.filter((act: any, idx: number) => {
            if (idx === 0 || idx === lastDay.activities.length - 1) return true;
            return act.startTime >= '07:30';
          });
          
          validActs.forEach((a: any, idx: number) => a.order = idx);
          lastDay.activities = validActs;
        }
      }
      // ---------------------------------------------------

      // Add missing metadata fields required by our type
      const generatedItinerary: Itinerary = {
        ...parsedResult,
        id: `itinerary-${Date.now().toString(36)}`,
        surveyId: survey.id,
        userId: survey.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'ready',
        currency: survey.currency || 'TWD',
        totalEstimatedCost: {
          amount: parsedResult.days.reduce((acc: number, d: any) => acc + (d.estimatedCost?.amount || 0), 0),
          currency: survey.currency || 'TWD'
        }
      };

      // 嘗試發送生圖請求 (動態生成全行程 3D 地圖)
      try {
        const destNames = survey.destinations.map(d => d.name).join(' and ');
        const keyAttractions = survey.mustVisitAttractions?.slice(0, 5).map(a => {
          if (a.type === 'file') return a.fileName || 'document';
          return a.value;
        }).join(', ') || '';
        const mapPrompt = `A vibrant isometric 3D map of ${destNames} tourism city, featuring detailed golden temples, a busy floating market on a blue river, a modern airport, transportation, and a city skyline. Key landmarks: ${keyAttractions}. The style should be highly detailed, bright, colorful, isometric view, simulation game aesthetic like SimCity or mobile tycoon games. No text overlay.`;
        
        const imgResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: mapPrompt }],
            parameters: { sampleCount: 1 }
          })
        });

        if (imgResponse.ok) {
          const imgData = await imgResponse.json();
          const base64Image = imgData?.predictions?.[0]?.bytesBase64Encoded;
          if (base64Image) {
             generatedItinerary.mapImageUrl = `data:image/png;base64,${base64Image}`;
          }
        } else {
          console.warn('Map generation API returned non-OK status:', response.status);
        }
      } catch (err) {
        console.warn('Map image generation failed, falling back to default image.', err);
      }

      return generatedItinerary;
    };

    const fallbackAction = (): Itinerary => {
      return this.generateFallbackItinerary(alignedSurvey);
    };

    return PACEngine.executeWithHealing(
      fetchItineraryAction,
      fallbackAction,
      'generateItinerary',
      1, // Reduce retries for API key errors to avoid spamming
      ['MISSING_API_KEY', 'INVALID_API_KEY']
    );
  },

  /**
   * Generates a structural fallback itinerary matching survey inputs
   */
  generateFallbackItinerary(survey: TripSurvey): Itinerary {
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

    const templates = getDestTemplates(mainDest, locale);

    // Collect references from user input survey (Attractions / URLs)
    const userMustVisits = survey?.mustVisitAttractions || [];
    const userReferences = survey?.referenceAttractions || [];

    for (let i = 0; i < dayCount; i++) {
      const currentDayDate = new Date(start.getTime() + i * 86400000);
      const dateStr = `${currentDayDate.getFullYear()}-${String(currentDayDate.getMonth() + 1).padStart(2, '0')}-${String(currentDayDate.getDate()).padStart(2, '0')}`;
      
      const destIndex = i % (survey?.destinations?.length || 1);
      const currentDest = survey?.destinations?.[destIndex] || { name: mainDest, country };

      // Activities building
      const activities: Activity[] = [];

      // If user has a specific must-visit attraction for this day, insert it first
      const matchedMust = userMustVisits.find(item => item.preferredDate === dateStr) || userMustVisits[i];
      
      // 1. Depart Hotel or Arrive at Airport
      if (i === 0) {
        const titleText = outgoingFlight ? `${strings.arriveAirport} (${outgoingFlight.flightNumber})` : strings.arriveAirport;
        activities.push({
          id: `act-${i}-start`,
          order: 0,
          startTime: '08:30',
          endTime: '10:00',
          title: titleText,
          localTitle: outgoingFlight ? `Airport (${outgoingFlight.flightNumber})` : 'Airport',
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
          title: strings.departHotel,
          localTitle: 'Hotel',
          type: 'hotel',
          description: strings.departHotelDesc,
          location: {
            name: strings.hotelName,
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
      const morningIdx = (i * 2) % templates.titles.length;
      let morningTitle = templates.titles[morningIdx]!;
      let morningLocalTitle = templates.localTitles[morningIdx]!;
      let morningDesc = templates.descs[morningIdx]!;
      let morningPhoto = templates.images[morningIdx]!;
      let morningLinks = [];

      if (matchedMust) {
        morningTitle = strings.mustVisitTitle.replace('{value}', matchedMust.value);
        morningLocalTitle = matchedMust.value;
        morningDesc = strings.mustVisitDesc.replace('{value}', matchedMust.value);
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
        startTime: matchedMust?.preferredTime || '09:00',
        endTime: '11:30',
        title: morningTitle,
        localTitle: morningLocalTitle,
        type: 'attraction',
        description: morningDesc,
        location: {
          name: matchedMust?.value || `${currentDest.name}${strings.classicAttraction}`,
          address: `${currentDest.name}`,
          latitude: currentDest.latitude || 0,
          longitude: currentDest.longitude || 0
        },
        duration: 150,
        links: morningLinks,
        notes: strings.attractionNotes,
        isMustVisit: !!matchedMust,
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
      const afternoonIdx = (i * 2 + 1) % templates.titles.length;
      const afternoonTitle = templates.titles[afternoonIdx]!;
      const afternoonLocalTitle = templates.localTitles[afternoonIdx]!;
      const afternoonDesc = templates.descs[afternoonIdx]!;
      
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
          name: `${currentDest.name}${strings.commercialDistrict}`,
          address: `${currentDest.name}`,
          latitude: currentDest.latitude || 0,
          longitude: currentDest.longitude || 0
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
        const titleText = returnFlight ? `${strings.arriveAirport} (${returnFlight.flightNumber})` : strings.arriveAirport;
        activities.push({
          id: `act-${i}-end`,
          order: 4,
          startTime: '18:00',
          endTime: '20:00',
          title: titleText,
          localTitle: returnFlight ? `Airport (${returnFlight.flightNumber})` : 'Airport',
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
          title: strings.returnHotel,
          localTitle: 'Hotel',
          type: 'hotel',
          description: strings.returnHotelDesc,
          location: {
            name: strings.hotelName,
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
        const arrTime = outgoingFlight ? outgoingFlight.arrivalTime : '08:30';
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
        const depTime = returnFlight ? returnFlight.departureTime : '18:00';
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
  async analyzeBatchUrls(urlsText: string, itinerary?: Itinerary | null): Promise<any> {
    const itineraryContext = itinerary && itinerary.days 
      ? `\n**既有行程摘要**：\n${JSON.stringify(
          itinerary.days.map((d, index) => ({
            day: index + 1,
            date: d.date,
            activities: d.activities.map(a => ({ id: a.id, title: a.title, time: a.startTime }))
          }))
        )}\n`
      : '';

    const prompt = `您是一位專業的旅遊行程規劃助手。現在使用者提供了一些想要新增的行程網址或景點名稱。
請針對這些新增項目進行分析，評估它們的地理位置、景點分類，以及如果適用，與既有行程的同質性。
${itineraryContext}
**使用者貼入的新增網址/景點**：
${urlsText}

**分析要求與限制**：
1. 分析每一個輸入。如果使用者貼入的是網址，請根據網址推估出景點的實際中文名稱與細節。
2. 進行以下評估：
   - **分類與地理位置**：推估其主要區域及分類 (如: coffee/food/shopping/camera/hotel/transport/info)。
   - **決策分類 (aiDecision)**：必須為 'adoptable' (可採用)、'not_recommended' (不建議) 或 'optional' (可選擇性)。
   - **決策理由 (aiDecisionReason)**：詳細的中文評估理由。
   - **同質性與地理警示 (warnings)**：分析是否與既有行程同質性太高、或地理位置太遠導致不順路。沒有則寫 "無"。
   - **排程建議說明 (suggestion)**：建議怎麼安排。
   
3. 務必使用 JSON 格式回傳，直接輸出以 \`{ "analysisResults": [...] }\` 格式的 JSON，不要加上 \`\`\`json 等任何 markdown 標記。

JSON 結構樣式：
{
  "analysisResults": [
    {
      "title": "景點名稱",
      "url": "輸入的原始網址",
      "category": "分類",
      "region": "地理區域",
      "aiDecision": "adoptable | not_recommended | optional",
      "aiDecisionReason": "詳細評估理由",
      "warnings": "警示內容或無",
      "suggestion": "排程建議說明"
    }
  ]
}`;

    try {
      const apiKey = await settingsService.getApiKey();
      if (!apiKey) {
        throw new Error('MISSING_API_KEY');
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: "application/json",
          }
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} ${errText}`);
      }

      const data = await response.json();
      let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textOutput) throw new Error('No response content from Gemini');
      
      textOutput = textOutput.replace(/```json\n/g, '').replace(/```/g, '').trim();
      return JSON.parse(textOutput);
    } catch (error) {
      console.error('analyzeBatchUrls error:', error);
      throw error;
    }
  },

  /**
   * Generates dynamic destination guide info (currency, emergency contacts, local phrases)
   */
  async getDestinationGuideInfo(country: string): Promise<any> {
    const locale = i18n.locale || 'zh-TW';
    const langNames: Record<string, string> = {
      'zh-TW': '繁體中文 (Traditional Chinese)',
      'zh-CN': '簡體中文 (Simplified Chinese)',
      'en': 'English',
      'ja': '日本語 (Japanese)',
      'ko': '韓國語 (Korean)',
      'th': '泰語 (Thai)',
      'vi': '越南語 (Vietnamese)',
      'ms': '馬來語 (Malay)',
      'es': '西班牙語 (Spanish)',
      'pt': '葡萄牙語 (Portuguese)'
    };
    const targetLang = langNames[locale] || 'Traditional Chinese';

    const prompt = `您是一位專業的在地導遊。使用者準備前往「${country}」旅遊。
請根據這個國家，整理出以下實用旅遊資訊。
請特別注意，所有的文字內容（例如常用短語的 translation 對照 zh 欄位、消費項目 item 的名稱、emergencyContacts 的 title 和 subTitle）必須使用「${targetLang}」來呈現。
請以嚴格的 JSON 格式回傳，不含任何 markdown 標記。

要求：
1. currencyCode: 當地官方貨幣的 3 碼 ISO 代碼 (如 JPY, THB, KRW)。如果是台灣，回傳 TWD。
2. currencyName: 當地貨幣的中文名稱 (如 日圓, 泰銖, 韓元)。
3. emergencyContacts: 陣列，提供 3 到 4 組最重要的緊急聯絡電話。欄位包含 title (使用 ${targetLang} 描述，如 觀光警察), subTitle (使用 ${targetLang} 描述，如 24小時英文服務), phone (如 1155)。
4. usefulPhrases: 陣列，提供 3 句最實用的在地問候或結帳用語。欄位包含 local (當地拼音或寫法), zh (使用 ${targetLang} 呈現對照翻譯), isHighlight (boolean, 將結帳或最重要的設為 true)。
5. guideItems: 陣列，提供 3 到 4 項當地具代表性的平民美食或按摩等服務的「預估價格」。欄位包含 item (使用 ${targetLang} 描述，如 路邊攤拉麵), priceRange (如 ~ 800 - 1000 ¥)。

請以如下的 JSON 格式輸出：
{
  "currencyCode": "THB",
  "currencyName": "泰銖",
  "emergencyContacts": [
    { "title": "...", "subTitle": "...", "phone": "..." }
  ],
  "usefulPhrases": [
    { "local": "...", "zh": "...", "isHighlight": false }
  ],
  "guideItems": [
    { "item": "...", "priceRange": "..." }
  ]
}`;

    try {
      const apiKey = await settingsService.getApiKey();
      if (!apiKey) {
        console.warn('[getDestinationGuideInfo] No API key available, using fallback directly.');
        const fallback = getFallbackGuideInfo(country);
        if (fallback) fallback.isFallback = true;
        return fallback;
      }
      console.log('[getDestinationGuideInfo] API Key found (first 8:', apiKey.substring(0, 8), '...)');

      console.log('[getDestinationGuideInfo] Calling Gemini API for:', country);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: "application/json",
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status}`);
      }

      const data = await response.json();
      let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) throw new Error('No response content from Gemini');
      
      const jsonStart = textOutput.indexOf('{');
      const jsonEnd = textOutput.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        textOutput = textOutput.substring(jsonStart, jsonEnd + 1);
      }
      return JSON.parse(textOutput);
    } catch (error) {
      console.error('getDestinationGuideInfo error, returning fallback:', error);
      const fallback = getFallbackGuideInfo(country);
      if (fallback) fallback.isFallback = true;
      return fallback;
    }
  }
};

export default aiService;

export async function regenerateActivityAlternatives(
  survey: TripSurvey,
  currentActivity: Activity,
  prevActivity: Activity | undefined,
  nextActivity: Activity | undefined,
  region: string
): Promise<Activity[]> {
  console.log('[regenerateActivityAlternatives] Starting for:', currentActivity.title, 'region:', region);
  const apiKey = await settingsService.getApiKey();
  if (!apiKey) {
    console.error('[regenerateActivityAlternatives] MISSING_API_KEY: settingsService.getApiKey() returned null.');
    throw new Error('MISSING_API_KEY');
  }
  console.log('[regenerateActivityAlternatives] API Key obtained (first 8 chars):', apiKey.substring(0, 8) + '...');

  const locale = survey.locale || 'zh-TW';
  const systemPrompt = `
You are a National-Level Intelligence Investigator strictly adhering to RAG (Retrieval-Augmented Generation) principles for travel planning.
The user wants to RE-ROLL (replace) an existing activity in their itinerary.
You MUST provide exactly 3 high-quality alternative activities that fit the same time slot and logical route.

==================================================
CRITICAL TOUR PLAN SPECIFICATIONS AND BUSINESS RULES:
You MUST strictly align all travel planning decisions with the following rules documented in our project guidelines:
${TOUR_PLAN_RULES}
==================================================

CRITICAL RULES:
1. Output ONLY a raw JSON array of 3 Activity objects. No markdown formatting, no backticks.
2. The JSON structure MUST match this exact TypeScript interface:
[
  {
    "id": string (unique UUID e.g. "generate-a-unique-uuid"),
    "startTime": "HH:MM" (24-hour time),
    "endTime": "HH:MM" (24-hour time),
    "title": string (Place Name),
    "localTitle": string (CRITICAL: The exact official name in the destination's local language. MUST be accurate for booking/map searches),
    "type": "attraction" | "restaurant" | "cafe" | "shopping" | "spa" | "entertainment" | "hotel" | "transport" | "activity",
    "description": string (Must be a ~200 words deep introduction highlighting culture, history, and unique features),
    "location": { "name": string, "address": string, "latitude": number, "longitude": number },
    "duration": number (minutes),
    "rating": number (1-5),
    "cost": { "amount": number, "currency": string },
    "openingHours": string,
    "links": [ { "label": string, "url": string, "type": "info" | "booking" } ],
    "notes": string (Explain why this is a good alternative and fits the user's plan),
    "transport": { 
      "mode": "walk" | "public" | "charter" | "taxi", 
      "duration": number (minutes to travel to the next activity), 
      "distance": number (meters to travel to the next activity), 
      "description": string (Detailed routing details from this alternative activity to the next activity)
    }
  }
]
3. GEOGRAPHIC & ROUTE LOGIC: The new activities MUST logically fit geographically between the previous activity and the next activity.
4. TIME WINDOW: The start and end times MUST fit the time window of the original activity being replaced.
5. transport ESTIMATION: You MUST realistically estimate the transport duration, distance (in meters), and mode from this alternative activity to the next activity. Do NOT use static default values.
6. URL HALLUCINATION IS FORBIDDEN. Only provide real official URLs or Google Search URLs.
7. OUTPUT LANGUAGE RULE: You MUST output all textual fields in the JSON (such as "title", "description", "notes", and transport descriptions) in the language corresponding to the user's locale: "${locale}".
   - If locale is "zh-TW" or "zh-CN", use Traditional/Simplified Chinese.
   - If locale is "ja", use Japanese.
   - If locale is "th", use Thai.
   - If locale is "ko", use Korean.
   - If locale is "vi", use Vietnamese.
   - If locale is "ms", use Malay.
   - If locale is "es", use Spanish.
   - If locale is "pt", use Portuguese.
   - Default to English if the locale is unrecognized.
`;

  const contextData = {
    originalActivityToReplace: currentActivity,
    previousActivity: prevActivity || "None (Start of day)",
    nextActivity: nextActivity || "None (End of day)",
    region: region,
    userPreferences: {
      budget: survey.budgetLevel,
      travelStyle: survey.tripType,
      interests: survey.interests,
      dietary: survey.dietaryRestrictions
    }
  };

  const response = await fetch(`${GEMINI_API_URL}${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(contextData) }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.8 // slightly higher for variety
      }
    }),
  });

  if (!response.ok) throw new Error(`Gemini API returned status ${response.status}`);

  const data = await response.json();
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textOutput) throw new Error('Invalid response structure from Gemini API');

  let alternatives: Activity[];
  try {
    alternatives = JSON.parse(textOutput);
    if (!Array.isArray(alternatives) || alternatives.length === 0) {
      throw new Error('Not an array');
    }
  } catch (e) {
    throw new Error('Failed to parse Gemini JSON output for alternatives');
  }

  // Validating links for all alternatives
  for (const alt of alternatives) {
    if (alt.links && alt.links.length > 0) {
      const validLinks = [];
      for (const link of alt.links) {
        const verification = await verifyUrlRAG(link.url, [alt.title, region]);
        if (verification.isValid) {
          validLinks.push(link);
        } else if (verification.verifiedUrl) {
          validLinks.push({ ...link, url: verification.verifiedUrl, label: `Search: ${alt.title}` });
        }
      }
      alt.links = validLinks;
    }
  }

  return alternatives.slice(0, 3);
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

