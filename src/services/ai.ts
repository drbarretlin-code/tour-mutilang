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
13. COORDINATE RULE: You MUST provide realistic real-world geographic coordinates (latitude and longitude) for every activity's "location" object. Under no circumstances should latitude or longitude be 0 or omitted, as they are directly used for rendering the dynamic route maps and calculate distances. If you don't know the exact coordinates of a specific spot, estimate them based on its parent city/region.`;

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

    const outgoingFlight = survey?.flights?.find(f => !f.isReturn);
    const returnFlight = survey?.flights?.find(f => f.isReturn);

    // Image & description templates based on popular destinations
    const getDestTemplates = (dest: string) => {
      const lower = dest.toLowerCase();
      if (lower.includes('東京') || lower.includes('tokyo') || lower.includes('日本')) {
        return {
          images: [
            'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600', // Tokyo Tower
            'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600', // Shibuya
            'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600', // Temple
          ],
          titles: ['淺草寺與雷門江戶風情', '澀谷十字路口與潮流探索', '明治神宮森呼吸'],
          descs: [
            '淺草寺是東京都內歷史最悠久的寺廟，創建於公元628年。其標誌性的巨型紅燈籠「雷門」是江戶文化的象徵，兩側的仲見世通商店街販售各式傳統小吃與工藝品，是體驗日本傳統佛教底蘊的必訪之地。',
            '澀谷是東京乃至全球時尚與青年文化的發源地。著名的澀谷站前十字路口在綠燈亮起時，成百上千的人潮交織穿梭，極具震撼感。周邊林立著百貨公司、潮流品牌與特色居酒屋。',
            '明治神宮是為了供奉明治天皇與昭憲皇太后而建的神社。神宮掩映在佔地70公頃的巨大人工森林中，踏入神宮，塵囂頓消，是繁華東京市中心難得的靜謐綠洲與神聖之所。'
          ]
        };
      }
      if (lower.includes('曼谷') || lower.includes('bangkok') || lower.includes('泰國')) {
        return {
          images: [
            'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600', // Bangkok Temple
            'https://images.unsplash.com/photo-1562790351-d273a961e0e9?w=600', // Market
            'https://images.unsplash.com/photo-1582967788606-a171c1080cb0?w=600', // River
          ],
          titles: ['大皇宮與玉佛寺金碧輝煌', '安帕瓦水上市場熱鬧體驗', '鄭王廟夕陽光輝'],
          descs: [
            '大皇宮是曼谷王朝的象徵，自1782年建立起便是暹羅王室的官方官邸。其內部建築融合了泰式傳統與歐式風情，雕樑畫棟、極盡奢華。供奉於玉佛寺的翡翠玉佛更是泰國最崇高的國寶。',
            '水上市場是泰國古老運河文化的縮影。商家划著裝滿新鮮水果、椰子烤肉的小船在河道上穿梭兜售，空氣中瀰漫著地道泰式調味料的香氣，是體驗泰國常民風情與美食的絕佳去處。',
            '鄭王廟又稱黎明寺，座落於昭披耶河畔。其主塔高達82米，塔身鑲嵌了無數碎陶瓷與貝殼，在陽光下熠熠生輝。黃昏時分，夕陽將塔影拉長，倒映在河面上，極具詩意。'
          ]
        };
      }
      
      // Default: Taipei / general template
      return {
        images: [
          'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=600', // Taipei 101
          'https://images.unsplash.com/photo-1571474004502-c1def214ac6d?w=600', // Jiufen
          'https://images.unsplash.com/photo-1555529669-e69e7aa0db9a?w=600', // Night Market
        ],
        titles: ['台北 101 與信義商圈俯瞰', '九份老街悲情城市茶香', '士林夜市在地美食巡禮'],
        descs: [
          '台北101曾是世界第一高樓，是台灣現代科技的里程碑。搭乘超高速電梯僅需37秒即可直達89樓觀景台，俯瞰台北盆地壯麗的城市天際線，並近距離觀察重達660公噸的風阻尼器巨大鋼球。',
          '九份是一座依山面海的古老礦業小鎮，因李安導演《悲情城市》與傳聞中神似宮崎駿《神隱少女》場景而聲名大噪。窄小的石階、錯落有致的紅燈籠與茶樓，漫步其間，彷彿時空倒流。',
          '夜市是台灣最具代表性的飲食文化核心。士林夜市歷史悠久，匯聚了超大雞排、蚵宰煎、大腸包小腸與珍珠奶茶等全球知名的庶民美食，是感受台北夜生活與熱情民風的必選地。'
        ]
      };
    };

    const templates = getDestTemplates(mainDest);

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
        activities.push({
          id: `act-${i}-start`,
          order: 0,
          startTime: '08:30',
          endTime: '10:00',
          title: '抵達當地機場',
          type: 'transport',
          description: '順利抵達當地機場，完成通關手續並領取行李。建議您先在機場購買當地的網卡或兌換部分當地貨幣，為接下來的旅程做好準備。',
          location: {
            name: `${currentDest.name}國際機場`,
            address: `${currentDest.name}機場航廈`,
            latitude: currentDest.latitude || 0,
            longitude: currentDest.longitude || 0
          },
          duration: 90,
          transport: { mode: 'charter', duration: 45, distance: 30000, description: '搭乘機場接送專車直達市區，省去搬運行李的麻煩。' },
          links: [{ label: 'Klook 機場接送預訂', url: 'https://www.klook.com/', type: 'booking' }],
          notes: '請備妥入境文件與護照。',
          isMustVisit: false,
          photoUrl: 'local-asset://airport_map',
          cost: { amount: 0, currency },
          openingHours: '24小時開放'
        });
      } else {
        activities.push({
          id: `act-${i}-start`,
          order: 0,
          startTime: '08:30',
          endTime: '09:00',
          title: '從飯店出發',
          type: 'hotel',
          description: '在飯店享用完豐盛的早餐後，整理行囊準備出發。今日行程較為豐富，建議攜帶足夠的飲用水與防曬用品。',
          location: {
            name: `精選特色飯店`,
            address: `${currentDest.name}市中心街區`,
            latitude: currentDest.latitude || 0,
            longitude: currentDest.longitude || 0
          },
          duration: 30,
          transport: { mode: 'charter', duration: 30, distance: 15000, description: '搭乘包車前往第一站，當地包車服務安全有保障，司機皆具備良民證。' },
          links: [{ label: 'Klook 泰國包車推薦', url: 'https://www.klook.com/', type: 'booking' }],
          notes: '',
          isMustVisit: false,
          cost: { amount: 0, currency },
          openingHours: '24小時開放'
        });
      }

      // 2. Morning Activity
      const morningIdx = (i * 2) % templates.titles.length;
      let morningTitle = templates.titles[morningIdx]!;
      let morningDesc = templates.descs[morningIdx]!;
      let morningPhoto = templates.images[morningIdx]!;
      let morningLinks = [];

      if (matchedMust) {
        morningTitle = `必訪景點：${matchedMust.value}`;
        morningDesc = `這是您在問卷中指定安排的必去景點。${templates.descs[0]} \n\n這座景點蘊含了深厚的文化底蘊與獨特的歷史背景，是當地最具代表性的地標之一。我們為您安排在上午時段前往，避開了午後擁擠的人潮，讓您能有更充裕的時間細細品味這裡的建築之美與人文風情。建議您可以尋找當地的專業導覽，進一步了解其背後動人的故事與傳說。`;
        if (matchedMust.type === 'url' && matchedMust.value.startsWith('http')) {
          morningLinks.push({
            label: '您的參考網站',
            url: matchedMust.value,
            type: 'info' as const
          });
        }
      } else if (userReferences[i]) {
        const ref = userReferences[i]!;
        if (ref.type === 'url' && ref.value.startsWith('http')) {
          morningDesc = `（參照您提供的參考網站進行深度遊覽）${morningDesc} \n\n這座景點蘊含了深厚的文化底蘊與獨特的歷史背景，是當地最具代表性的地標之一。我們為您安排在上午時段前往，避開了午後擁擠的人潮，讓您能有更充裕的時間細細品味這裡的建築之美與人文風情。`;
          morningLinks.push({
            label: ref.fileName || '使用者參考網站',
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
        type: 'attraction',
        description: morningDesc,
        location: {
          name: matchedMust?.value || `${currentDest.name}經典名勝`,
          address: `${currentDest.name}`,
          latitude: currentDest.latitude || 0,
          longitude: currentDest.longitude || 0
        },
        duration: 150,
        links: morningLinks,
        notes: '建議穿著舒適好走的鞋子，並攜帶水壺。',
        isMustVisit: !!matchedMust,
        photoUrl: morningPhoto,
        rating: 4.8,
        cost: { amount: 0, currency },
        openingHours: '09:00 - 17:30'
      });

      // 3. Afternoon Activity (Restaurant)
      const lunchTitles = ['在地推薦人氣私房菜', '文青風特色咖啡廳輕食', '老字號經典道地小吃', '米其林必比登推薦餐廳'];
      const currentLunchTitle = lunchTitles[i % lunchTitles.length];
      
      activities.push({
        id: `act-${i}-2`,
        order: 2,
        startTime: '12:00',
        endTime: '13:30',
        title: `午餐：${currentLunchTitle}`,
        type: 'restaurant',
        description: `這家在地私房菜館不僅提供道地的傳統風味，更是當地老饕的首選。每一道菜品背後都有著深厚的家傳淵源，使用每日清晨從市集採購的最新鮮食材製作。AI 根據您的預算級別（${survey?.budgetLevel || '中等'}）與飲食偏好為您精選，提供乾淨衛生的用餐環境與豐富的素食、過敏原標示選擇。`,
        location: {
          name: '人氣在地風味館',
          address: `${currentDest.name}美食街區`,
          latitude: currentDest.latitude || 0,
          longitude: currentDest.longitude || 0
        },
        duration: 90,
        transport: { mode: 'public', duration: 15, distance: 2000, description: '自景點步行約 5 分鐘至捷運站，搭乘淺綠線至市中心站，出站後由 3 號出口步行即達。' },
        links: [],
        notes: '午餐時間人潮較多，已為您將時間挪移避開最擁擠時段。',
        isMustVisit: false,
        photoUrl: templates.images[2],
        rating: 4.7,
        cost: { amount: 350, currency },
        openingHours: '11:00 - 21:00'
      });

      // 4. Late Afternoon Activity (Sightseeing / Shopping)
      const afternoonIdx = (i * 2 + 1) % templates.titles.length;
      const afternoonTitle = templates.titles[afternoonIdx]!;
      const afternoonDesc = templates.descs[afternoonIdx]!;
      
      activities.push({
        id: `act-${i}-3`,
        order: 3,
        startTime: '14:30',
        endTime: '17:30',
        title: afternoonTitle,
        type: 'activity',
        description: `${afternoonDesc} \n\n這裡不僅是購物的絕佳去處，更是體驗當地常民生活脈動的最佳櫥窗。穿梭在琳琅滿目的特色小舖間，您可以發掘許多獨一無二的手工藝品與原創設計。我們特別為您預留了充足的時間，讓您可以悠閒地在此散步、拍照，並在充滿異國情調的咖啡館裡享受一個美好的下午茶時光。`,
        location: {
          name: `${currentDest.name}商圈地標`,
          address: `${currentDest.name}`,
          latitude: currentDest.latitude || 0,
          longitude: currentDest.longitude || 0
        },
        duration: 180,
        links: [],
        notes: '適合拍照留念與挑選伴手禮，可使用行動支付。',
        isMustVisit: false,
        photoUrl: templates.images[afternoonIdx],
        rating: 4.9,
        cost: { amount: 0, currency },
        openingHours: '24小時開放'
      });

      // 5. Return to Hotel or Depart to Airport
      if (i === dayCount - 1) {
        activities.push({
          id: `act-${i}-end`,
          order: 4,
          startTime: '18:00',
          endTime: '20:00',
          title: '抵達機場準備返國',
          type: 'transport',
          description: '帶著滿滿的美好回憶，抵達機場準備搭機返國。建議您預留足夠的時間辦理退稅手續，並在免稅店做最後的採購。',
          location: {
            name: `${currentDest.name}國際機場`,
            address: `${currentDest.name}機場航廈`,
            latitude: currentDest.latitude || 0,
            longitude: currentDest.longitude || 0
          },
          duration: 120,
          transport: { mode: 'charter', duration: 45, distance: 30000, description: '搭乘包車前往機場，請務必再三確認護照與隨身行李是否帶齊。' },
          links: [{ label: '當地推薦安全叫車 App', url: 'https://www.grab.com/', type: 'info' }],
          notes: '請提早2-3小時抵達機場。',
          isMustVisit: false,
          photoUrl: 'local-asset://airport_map',
          cost: { amount: 0, currency },
          openingHours: '24小時開放'
        });
      } else {
        activities.push({
          id: `act-${i}-end`,
          order: 4,
          startTime: '18:00',
          endTime: '18:30',
          title: '返回飯店休息',
          type: 'hotel',
          description: '結束一整天豐富充實的行程，搭乘交通工具返回溫馨舒適的飯店。您可以先洗去一身的疲憊，或是在飯店周邊的便利商店採買宵夜，為明天的旅程充飽電。',
          location: {
            name: `精選特色飯店`,
            address: `${currentDest.name}市中心街區`,
            latitude: currentDest.latitude || 0,
            longitude: currentDest.longitude || 0
          },
          duration: 30,
          transport: { mode: 'charter', duration: 30, distance: 15000, description: '搭乘包車返回飯店，夜間搭車請隨時留意隨身物品。' },
          links: [{ label: '當地推薦安全叫車 App', url: 'https://www.grab.com/', type: 'info' }],
          notes: '',
          isMustVisit: false,
          cost: { amount: 0, currency },
          openingHours: '24小時開放'
        });
      }

      // Fallback 航班時間對齊校正
      if (i === 0) {
        // 第一天 forward correction
        const arrTime = outgoingFlight ? outgoingFlight.arrivalTime : '08:30';
        const arrEndTime = addMinutesToTime(arrTime, 90);
        const firstAct = activities[0];
        if (firstAct) {
          firstAct.startTime = arrTime;
          firstAct.endTime = arrEndTime;
          firstAct.duration = 90;
          if (outgoingFlight) {
            firstAct.title = `抵達當地機場 (${outgoingFlight.flightNumber})`;
          }
        }

        // 後續活動順延
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
        // 最後一天 backward correction
        const depTime = returnFlight ? returnFlight.departureTime : '18:00';
        const airportStart = subMinutesFromTime(depTime, 150);
        const lastAct = activities[activities.length - 1];
        if (lastAct) {
          lastAct.startTime = airportStart;
          lastAct.endTime = depTime;
          lastAct.duration = 150;
          if (returnFlight) {
            lastAct.title = `抵達機場準備返航 (${returnFlight.flightNumber})`;
            lastAct.notes = `航班時間：${depTime}。請務必再三確認護照與隨身行李是否帶齊。`;
          }
        }

        // 前序活動前推
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

        // 過濾時間太早的中間活動
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

      days.push({
        dayNumber: i + 1,
        date: dateStr,
        title: `Day ${i + 1} - ${currentDest.name}探索之旅`,
        summary: `深度探訪 ${currentDest.name} 的核心觀光資源，感受當地的獨特氛圍。`,
        region: currentDest.name,
        estimatedCost: {
          amount: (survey?.dailyMealBudget || 800) * ((survey?.travelers?.adults || 2) + (survey?.travelers?.children || []).length),
          currency
        },
        walkingDistance: 5400,
        activities,
        hotel: {
          name: `精選特色${survey?.accommodationType?.[0] || '飯店'}`,
          address: `${currentDest.name}市中心街區`,
          bookingUrl: survey?.customBookingUrl || undefined
        },
        localTips: [
          {
            category: 'tipping',
            title: '當地小費與消費習慣',
            content: '一般餐廳已包含服務費。路邊小吃與市場以現金支付為主，部分商店支援街口/Line Pay。'
          },
          {
            category: 'wifi',
            title: '上網與通訊建議',
            content: '推薦於機場領取實體 SIM 卡或提前開通 eSIM，在市區內各景點連線訊號極佳。'
          }
        ]
      });
    }

    const generatedItinerary: Itinerary = {
      id: `itinerary-${Date.now().toString(36)}`,
      surveyId: survey.id,
      userId: survey.userId,
      title: `${survey.destinations.map(d => d.name).join(' & ')} ${dayCount} 天智慧之旅`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready',
      days,
      emergencyContacts: [
        { label: '當地觀光警察局', number: '1155', description: '24小時英文求助專線' },
        { label: '緊急求難專線', number: '119' }
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

