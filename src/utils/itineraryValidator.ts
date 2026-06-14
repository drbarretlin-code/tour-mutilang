import { Activity, Itinerary } from '../types/itinerary';

// 1. 大圓距離計算公式 (Haversine Formula)
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === 0 || lon1 === 0 || lat2 === 0 || lon2 === 0) return 0;
  const R = 6371; // 地球半徑 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 2. 估算景點停留時間 (分鐘)
export function getActivityDuration(type: string, title: string): number {
  const t = (title || '').toLowerCase();
  const cat = (type || '').toLowerCase();
  
  if (t.includes('午餐') || t.includes('晚餐') || t.includes('savoey') || t.includes('餐廳') || t.includes('美食') || t.includes('飯') || cat === 'restaurant') {
    return 90;
  }
  if (t.includes('咖啡') || t.includes('cafe') || cat === 'cafe') {
    return 60;
  }
  if (t.includes('逛街') || t.includes('iconsiam') || t.includes('市集') || t.includes('夜市') || t.includes('商場') || t.includes('outlet') || cat === 'shopping') {
    return 120;
  }
  if (t.includes('動物園') || t.includes('safari') || t.includes('樂園') || cat === 'entertainment') {
    return 240;
  }
  if (cat === 'hotel') {
    return 60;
  }
  if (cat === 'transport') {
    return 30;
  }
  return 90; // 預設停留 90 分鐘
}

// 3. 計算兩點間的交通車程 (分鐘)
export function getTravelTime(
  loc1: { latitude?: number; longitude?: number } | undefined,
  loc2: { latitude?: number; longitude?: number } | undefined,
  region1?: string,
  region2?: string
): number {
  const lat1 = loc1?.latitude || 0;
  const lon1 = loc1?.longitude || 0;
  const lat2 = loc2?.latitude || 0;
  const lon2 = loc2?.longitude || 0;

  if (lat1 !== 0 && lon1 !== 0 && lat2 !== 0 && lon2 !== 0) {
    const distKm = haversineDistance(lat1, lon1, lat2, lon2);
    // 以平均時速 30 km/h 估算，並加上 10 分鐘塞車/轉乘緩衝
    return Math.round((distKm / 30) * 60) + 10;
  }

  // Fallback（無座標時）：採通用、與國家無關的估算 —— 不同區域 90 分、同區域 40 分。
  // 全球地理編碼修復後，絕大多數活動皆有座標而走上方 haversine，此處僅為極端缺資料時的保底。
  const r1 = region1 || '';
  const r2 = region2 || '';
  if (r1 && r2 && r1 !== r2) return 90;
  return 40;
}

// 時間字串轉換為分鐘數
export function timeToMins(tStr: string): number {
  if (!tStr) return 0;
  const parts = tStr.split(':');
  if (parts.length < 2) return 0;
  return Number(parts[0]) * 60 + Number(parts[1]);
}

// 分鐘數轉換為時間字串 (HH:mm)
export function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface ValidationResult {
  hasConflict: boolean;
  reason: string;
  warningType?: 'time' | 'location' | 'similarity';
  similarActivityId?: string;
  similarActivityTitle?: string;
}

// 4. 行程排程合理性衝突驗證器
export function validateActivityTime(
  activity: Activity,
  itinerary: Itinerary,
  dayNumber: number
): ValidationResult {
  const dayData = itinerary.days.find(d => d.dayNumber === dayNumber);
  if (!dayData) {
    return { hasConflict: false, reason: '無效的天數' };
  }

  // 與國家無關：以該天的 region 為基準（活動座標存在時，距離估算會走 haversine，不依賴此值）。
  const dayRegion = dayData.region || '';
  const activityRegion = dayRegion;

  const itemMins = timeToMins(activity.startTime);
  const itemDuration = activity.duration || getActivityDuration(activity.type, activity.title);
  const activities = (dayData.activities || [])
    .filter(a => a.id !== activity.id)
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // 4.1 時間與交通衝突驗證
  for (const act of activities) {
    const actMins = timeToMins(act.startTime);
    const actDuration = act.duration || getActivityDuration(act.type, act.title);

    if (actMins <= itemMins) {
      // 在此活動之前的活動，計算前站到此站的交通車程
      const travel = getTravelTime(act.location, activity.location, dayRegion, activityRegion);
      const neededEnd = actMins + actDuration + travel;
      if (neededEnd > itemMins) {
        const diff = neededEnd - itemMins;
        return {
          hasConflict: true,
          warningType: 'time',
          reason: `時間與交通衝突：您已安排在 ${act.startTime} 進行「${act.title}」（停留約 ${actDuration} 分鐘），且前往此站車程約 ${travel} 分鐘。若排在 ${activity.startTime}，將導致前個活動停留時間不足（被壓縮 ${diff} 分鐘），不符實務旅遊邏輯。`
        };
      }
    } else {
      // 在此活動之後的活動，計算此站到後站的交通車程
      const travel = getTravelTime(activity.location, act.location, activityRegion, dayRegion);
      const neededEnd = itemMins + itemDuration + travel;
      if (neededEnd > actMins) {
        const diff = neededEnd - actMins;
        return {
          hasConflict: true,
          warningType: 'time',
          reason: `時間與交通衝突：此活動停留約 ${itemDuration} 分鐘，且前往下一站「${act.title}」（於 ${act.startTime} 開始）車程需約 ${travel} 分鐘。若排在 ${activity.startTime}，將導致下一站行程遲到 ${diff} 分鐘，不符實務旅遊邏輯。`
        };
      }
    }
  }

  // 4.2 跨區交通衝突驗證
  if (dayRegion !== activityRegion) {
    const crossTravel = getTravelTime(undefined, undefined, dayRegion, activityRegion);
    if (crossTravel >= 120) {
      return {
        hasConflict: true,
        warningType: 'location',
        reason: `跨區交通衝突：此景點位於「${activityRegion}」，而 Day ${dayNumber} 的主要活動區域在「${dayRegion}」，單趟車程長達 ${crossTravel} 分鐘，往返耗費體力且時間嚴重衝突，不建議排在此天。`
      };
    }
  }

  // 4.3 同質性/性質重疊驗證
  let similarAct: Activity | undefined;
  for (const d of itinerary.days) {
    for (const a of d.activities || []) {
      if (a.id === activity.id) continue;
      const isSameType = (a.type === activity.type) && ['cafe', 'restaurant', 'shopping', 'spa'].includes(a.type);
      const hasKeywordMatch = a.title && activity.title && (
        a.title.includes(activity.title) || activity.title.includes(a.title) ||
        (a.title.includes('咖啡') && activity.title.includes('咖啡')) ||
        (a.title.includes('Savoey') && activity.title.includes('Savoey'))
      );
      if (isSameType || hasKeywordMatch) {
        similarAct = a;
        break;
      }
    }
    if (similarAct) break;
  }

  if (similarAct) {
    return {
      hasConflict: false, // 同質性為警告/可選擇性安排，非硬性阻斷衝突
      warningType: 'similarity',
      similarActivityId: similarAct.id,
      similarActivityTitle: similarAct.title,
      reason: `可選擇性安排：此景點與既有行程中的「${similarAct.title}」性質高度重疊，建議若想拜訪此地，可考慮取代或刪除該行程。`
    };
  }

  return { hasConflict: false, reason: '位置順路且時間充裕，推薦採用。' };
}

export interface TimeSlotRecommendation {
  time: string;
  endTime: string;
  score: number;
  buffer: number;
  travelFromPrev: number;
  travelToNext: number;
  prevTitle?: string;
  nextTitle?: string;
}

// 5. 智慧時段探測器：掃描一天內的所有空檔，找出最佳推薦時間
export function findBestTimeSlots(
  activity: Omit<Activity, 'startTime' | 'endTime'>,
  itinerary: Itinerary,
  dayNumber: number
): TimeSlotRecommendation[] {
  const dayData = itinerary.days.find(d => d.dayNumber === dayNumber);
  if (!dayData) return [];

  const dayRegion = dayData.region || '曼谷';
  const activityRegion = activity.location?.address?.includes('羅勇') ? '羅勇' :
                         activity.location?.address?.includes('芭達雅') || activity.location?.address?.includes('Pattaya') ? '芭達雅' :
                         dayRegion;

  // 跨區大於 2 小時，直接不予推薦時段
  if (dayRegion !== activityRegion && getTravelTime(undefined, undefined, dayRegion, activityRegion) >= 120) {
    return [];
  }

  const itemDuration = activity.duration || getActivityDuration(activity.type, activity.title);
  const activities = (dayData.activities || [])
    .filter(a => a.id !== activity.id)
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const DAY_START = 8 * 60;   // 08:00
  const DAY_END = 22 * 60;    // 22:00

  // 掃描所有可插入的空檔
  const gaps: { start: number; end: number; prevAct: Activity | null; nextAct: Activity | null }[] = [];

  if (activities.length === 0) {
    gaps.push({ start: DAY_START, end: DAY_END, prevAct: null, nextAct: null });
  } else {
    // 早上第一個行程之前
    const firstStart = timeToMins(activities[0]!.startTime);
    if (firstStart > DAY_START) {
      gaps.push({ start: DAY_START, end: firstStart, prevAct: null, nextAct: activities[0]! });
    }

    // 行程之間
    for (let i = 0; i < activities.length - 1; i++) {
      const curr = activities[i]!;
      const next = activities[i + 1]!;
      const currEnd = timeToMins(curr.startTime) + (curr.duration || getActivityDuration(curr.type, curr.title));
      const nextStart = timeToMins(next.startTime);
      if (currEnd < nextStart) {
        gaps.push({ start: currEnd, end: nextStart, prevAct: curr, nextAct: next });
      }
    }

    // 最後一個行程之後
    const last = activities[activities.length - 1]!;
    const lastEnd = timeToMins(last.startTime) + (last.duration || getActivityDuration(last.type, last.title));
    if (lastEnd < DAY_END) {
      gaps.push({ start: lastEnd, end: DAY_END, prevAct: last, nextAct: null });
    }
  }

  const recommendations: TimeSlotRecommendation[] = [];

  for (const gap of gaps) {
    // 計算交通時間
    const travelFromPrev = gap.prevAct
      ? getTravelTime(gap.prevAct.location, activity.location, dayRegion, activityRegion)
      : 0;

    const travelToNext = gap.nextAct
      ? getTravelTime(activity.location, gap.nextAct.location, activityRegion, dayRegion)
      : 0;

    const earliestStart = gap.start + travelFromPrev;
    const latestEnd = gap.end - travelToNext;
    const availableTime = latestEnd - earliestStart;

    if (availableTime >= itemDuration) {
      // 找到一個可以完美容納的時段
      const suggestedStart = earliestStart;
      
      // 計算時段評分
      let score = 100;
      if (suggestedStart >= 14 * 60 && suggestedStart <= 17 * 60) score += 20; // 偏好下午時段
      if (suggestedStart >= 10 * 60 && suggestedStart < 14 * 60) score += 10;  // 上午次優時段
      if (suggestedStart >= 18 * 60) score -= 15; // 太晚扣分
      score += (availableTime - itemDuration) / 10; // 緩衝越充裕評分越高

      recommendations.push({
        time: minsToTime(suggestedStart),
        endTime: minsToTime(suggestedStart + itemDuration),
        score,
        buffer: availableTime - itemDuration,
        travelFromPrev,
        travelToNext,
        prevTitle: gap.prevAct?.title,
        nextTitle: gap.nextAct?.title
      });
    }
  }

  // 依據評分高低排序
  return recommendations.sort((a, b) => b.score - a.score);
}
