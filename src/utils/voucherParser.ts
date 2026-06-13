import { Itinerary, Activity } from '../types/itinerary';

export interface ParsedVoucherInfo {
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  keywords: string[];
  possibleLocations: string[];
}

/**
 * 從憑證/確認信的純文字內容中，提取可能的日期、時間、關鍵字與地點。
 */
export function parseVoucherText(text: string): ParsedVoucherInfo {
  const info: ParsedVoucherInfo = {
    keywords: [],
    possibleLocations: []
  };

  if (!text) return info;

  // 1. 搜尋日期格式 (支援 YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, MM/DD/YYYY)
  const dateRegexes = [
    /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/, // YYYY-MM-DD
    /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/  // DD-MM-YYYY or MM-DD-YYYY
  ];

  for (const regex of dateRegexes) {
    const match = text.match(regex);
    if (match) {
      if (match[1].length === 4) {
        // YYYY-MM-DD
        const y = match[1];
        const m = match[2].padStart(2, '0');
        const d = match[3].padStart(2, '0');
        info.date = `${y}-${m}-${d}`;
        break;
      } else if (match[3].length === 4) {
        // Assume DD-MM-YYYY or MM-DD-YYYY. We'll use YYYY-MM-DD format
        const y = match[3];
        const m = match[1].padStart(2, '0'); // simplified assumption
        const d = match[2].padStart(2, '0');
        info.date = `${y}-${m}-${d}`;
        break;
      }
    }
  }

  // 2. 搜尋時間格式 (HH:mm 或 HH:mm AM/PM)
  const timeRegex = /\b(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?\b/;
  const timeMatch = text.match(timeRegex);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const min = timeMatch[2];
    const ampm = timeMatch[3];

    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && hour < 12) {
        hour += 12;
      } else if (ampm.toLowerCase() === 'am' && hour === 12) {
        hour = 0;
      }
    }
    info.time = `${String(hour).padStart(2, '0')}:${min}`;
  }

  // 3. 掃描關鍵字以判斷活動類型
  const KEYWORD_MAP: Record<string, string[]> = {
    flight: ['flight', 'airline', 'airport', 'gate', 'boarding', 'terminal', '航班', '機票', '登機', '機場', '航廈'],
    hotel: ['hotel', 'resort', 'check-in', 'checkin', 'room', 'booking', 'reservation', '飯店', '酒店', '民宿', '房號', '登記入住'],
    restaurant: ['restaurant', 'dining', 'table', 'reservation', 'dinner', 'lunch', 'cafe', 'food', '餐廳', '預約', '晚餐', '午餐', '咖啡館', '美食'],
    spa: ['spa', 'massage', 'wellness', 'treatment', 'massage therapist', '按摩', '泰式按摩', '水療', '溫泉'],
    activity: ['ticket', 'admission', 'entry', 'voucher', 'tour', 'klook', 'kkday', '門票', '憑證', '一日遊', '體驗', '活動']
  };

  const lowerText = text.toLowerCase();
  for (const [category, words] of Object.entries(KEYWORD_MAP)) {
    for (const word of words) {
      if (lowerText.includes(word)) {
        info.keywords.push(category);
        break;
      }
    }
  }

  // 4. 抽取可能的地點/名稱 (通常是大寫或包含特定結尾詞，或是引號內的值)
  // Heuristic: 尋找 "at [Location]" 或是 "Location: [Location]" 或是 "Hotel [Name]"
  const locationRegexes = [
    /(?:at|in|location:|hotel|resort|restaurant)\s+([A-Z][a-zA-Z0-9\s,]{3,30})/i,
    /「([^」]+)」/,
    /\"([^\"]{3,30})\"/
  ];

  for (const regex of locationRegexes) {
    const matches = [...text.matchAll(new RegExp(regex, 'g'))];
    for (const m of matches) {
      if (m[1]) {
        const cleaned = m[1].trim();
        if (cleaned && !info.possibleLocations.includes(cleaned) && cleaned.length > 2) {
          info.possibleLocations.push(cleaned);
        }
      }
    }
  }

  return info;
}

/**
 * 根據提取的憑證資訊，在 Itinerary 中尋找最匹配的 Activity。
 * 回傳匹配的 Activity ID、天數與置信度 (0-100)。
 */
export function findMatchingActivity(
  itinerary: Itinerary,
  voucherText: string
): { activityId: string; dayNumber: number; confidence: number } | null {
  const parsed = parseVoucherText(voucherText);
  let bestMatch: { activityId: string; dayNumber: number; confidence: number } | null = null;
  let highestScore = 0;

  for (const day of itinerary.days) {
    // 檢查日期是否吻合
    let dateScore = 0;
    if (parsed.date && day.date === parsed.date) {
      dateScore = 50;
    }

    for (const act of day.activities) {
      let score = dateScore;

      // 1. 時間匹配
      if (parsed.time) {
        const [pH, pM] = parsed.time.split(':').map(Number);
        const [aH, aM] = act.startTime.split(':').map(Number);
        
        const diffMins = Math.abs((pH * 60 + pM) - (aH * 60 + aM));
        if (diffMins <= 30) {
          score += 30; // 30 分鐘內極度吻合
        } else if (diffMins <= 90) {
          score += 15; // 90 分鐘內部分吻合
        }
      }

      // 2. 類型/關鍵字匹配
      for (const kw of parsed.keywords) {
        if (kw === 'flight' && act.type === 'transport') score += 15;
        if (kw === 'hotel' && act.type === 'hotel') score += 15;
        if (kw === 'restaurant' && act.type === 'restaurant') score += 15;
        if (kw === 'spa' && act.type === 'spa') score += 15;
        if (kw === 'activity' && ['activity', 'attraction', 'entertainment', 'shopping'].includes(act.type)) score += 15;
      }

      // 3. 地點文字模糊匹配
      const titleLower = act.title.toLowerCase();
      const localTitleLower = (act.localTitle || '').toLowerCase();
      const addressLower = act.location.address.toLowerCase();

      for (const loc of parsed.possibleLocations) {
        const locLower = loc.toLowerCase();
        if (
          titleLower.includes(locLower) ||
          locLower.includes(titleLower) ||
          localTitleLower.includes(locLower) ||
          addressLower.includes(locLower)
        ) {
          score += 25;
        }
      }

      // 如果分數大於當前最高分且大於基本門檻，更新最佳匹配
      if (score > highestScore && score >= 30) {
        highestScore = score;
        bestMatch = {
          activityId: act.id,
          dayNumber: day.dayNumber,
          confidence: Math.min(score, 100) // 置信度上限為 100
        };
      }
    }
  }

  return bestMatch;
}
