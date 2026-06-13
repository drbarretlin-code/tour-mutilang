import { Itinerary, Activity } from '../types/itinerary';
import { timeToMins, minsToTime, getTravelTime } from './itineraryValidator';

/**
 * 根據新的開始時間，自動修復並對齊當天所有行程的時間軸與交通車程。
 * 若發生嚴重衝突（例如行程被迫順延至深夜），將自動壓縮非必訪行程的停留時間，或移除低優先權的景點。
 */
export function repairItineraryTimes(
  itinerary: Itinerary,
  dayNumber: number,
  changedActivityId: string,
  newStartTime: string
): Itinerary {
  // 深拷貝 Itinerary 避免副作用
  const nextItinerary: Itinerary = JSON.parse(JSON.stringify(itinerary));
  const dayData = nextItinerary.days.find(d => d.dayNumber === dayNumber);
  if (!dayData || !dayData.activities || dayData.activities.length === 0) {
    return itinerary;
  }

  const activities = dayData.activities;
  const changedActIdx = activities.findIndex(a => a.id === changedActivityId);
  if (changedActIdx === -1) return itinerary;

  const changedAct = activities[changedActIdx];
  changedAct.startTime = newStartTime;
  changedAct.endTime = minsToTime(timeToMins(newStartTime) + (changedAct.duration || 90));

  // 1. 順序校正：從被修改的活動往後推算所有後續活動的開始時間
  for (let i = changedActIdx + 1; i < activities.length; i++) {
    const prevAct = activities[i - 1];
    const currAct = activities[i];
    
    // 計算從前一站到當前站的交通時間
    const transit = currAct.transport?.duration || getTravelTime(prevAct.location, currAct.location);
    const prevEndMins = timeToMins(prevAct.endTime);
    const currStartMins = timeToMins(currAct.startTime);
    const earliestStartMins = prevEndMins + transit;

    // 若當前活動的開始時間早於「前站結束時間 + 交通」，則必須往後順延
    if (currStartMins < earliestStartMins) {
      currAct.startTime = minsToTime(earliestStartMins);
      currAct.endTime = minsToTime(earliestStartMins + (currAct.duration || 90));
      if (currAct.transport) {
        currAct.transport.duration = transit;
      }
    }
  }

  // 2. 檢驗是否大幅超時（以晚上 22:00，即 1320 分鐘為臨界線）
  const lastAct = activities[activities.length - 1];
  const lastEndMins = timeToMins(lastAct.endTime);
  const MAX_LIMIT_MINS = 22 * 60; // 22:00

  if (lastEndMins > MAX_LIMIT_MINS) {
    // 2.1 階段一：壓縮非必訪活動的停留時間（下限為 45 分鐘）
    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      // 排除必訪、住宿、交通及餐飲活動，僅對景點/購物進行壓縮
      if (
        !act.isMustVisit && 
        act.id !== changedActivityId && 
        !['hotel', 'transport', 'meal', 'restaurant'].includes(act.type) &&
        act.duration > 45
      ) {
        act.duration = 45;
        act.endTime = minsToTime(timeToMins(act.startTime) + act.duration);
      }
    }

    // 重新校正時間軸
    recalculateTimeline(activities, changedActIdx);

    // 2.2 階段二：若仍超時，開始依優先權由低至高修剪（移除）非必訪活動
    let lastEnd = timeToMins(activities[activities.length - 1].endTime);
    while (lastEnd > MAX_LIMIT_MINS) {
      // 找出非必訪、且不是必要類型的活動索引（從最後面開始找）
      let pruneIdx = -1;
      for (let i = activities.length - 1; i >= 0; i--) {
        const act = activities[i];
        if (
          !act.isMustVisit && 
          act.id !== changedActivityId && 
          !['hotel', 'transport', 'meal', 'restaurant'].includes(act.type)
        ) {
          pruneIdx = i;
          break;
        }
      }

      // 如果找不到任何可修剪的活動，跳出循環，避免死循環
      if (pruneIdx === -1) break;

      // 移除該活動
      activities.splice(pruneIdx, 1);
      
      // 重新校正時間軸並更新 lastEnd
      recalculateTimeline(activities, Math.min(changedActIdx, activities.length - 1));
      lastEnd = timeToMins(activities[activities.length - 1].endTime);
    }
  }

  // 3. 重新為所有活動的 order 屬性編號
  activities.forEach((act, idx) => {
    act.order = idx;
  });

  nextItinerary.status = 'modified';
  return nextItinerary;
}

/**
 * 輔助函式：自指定索引起，重新向後滾動計算時間軸
 */
function recalculateTimeline(activities: Activity[], startIdx: number) {
  const safeStart = Math.max(0, startIdx);
  for (let i = safeStart + 1; i < activities.length; i++) {
    const prevAct = activities[i - 1];
    const currAct = activities[i];
    const transit = currAct.transport?.duration || getTravelTime(prevAct.location, currAct.location);
    const prevEndMins = timeToMins(prevAct.endTime);
    
    currAct.startTime = minsToTime(prevEndMins + transit);
    currAct.endTime = minsToTime(prevEndMins + transit + (currAct.duration || 90));
    if (currAct.transport) {
      currAct.transport.duration = transit;
    }
  }
}

/**
 * 雨天備案一鍵切換：將指定天數的戶外景點，與後續天數的室內景點進行位置與時間對調。
 * 若仍有剩餘的戶外景點，則採用內建室內備份景點覆蓋。
 */
export function swapOutdoorWithIndoor(itinerary: Itinerary, targetDayNumber: number): Itinerary {
  const nextItinerary: Itinerary = JSON.parse(JSON.stringify(itinerary));
  const targetDay = nextItinerary.days.find(d => d.dayNumber === targetDayNumber);
  if (!targetDay || !targetDay.activities || targetDay.activities.length === 0) {
    return itinerary;
  }

  // 找出所有非必訪的戶外景點/活動索引
  const outdoorIndices = targetDay.activities
    .map((act, idx) => ({ act, idx }))
    .filter(({ act }) => act.environment === 'outdoor' && !act.isMustVisit && ['attraction', 'activity'].includes(act.type))
    .map(({ idx }) => idx);

  if (outdoorIndices.length === 0) {
    return itinerary;
  }

  // 搜尋其他天數的非必訪室內景點/活動
  for (const day of nextItinerary.days) {
    if (day.dayNumber === targetDayNumber) continue;

    for (let idx = 0; idx < day.activities.length; idx++) {
      const act = day.activities[idx];
      if (act.environment === 'indoor' && !act.isMustVisit && ['attraction', 'activity'].includes(act.type)) {
        const nextOutdoorIdx = outdoorIndices.shift();
        if (nextOutdoorIdx === undefined) break;

        const targetAct = targetDay.activities[nextOutdoorIdx];

        // 對調景點核心內容資訊 (保留 startTime, endTime, order, transport)
        const temp = {
          title: targetAct.title,
          localTitle: targetAct.localTitle,
          description: targetAct.description,
          location: targetAct.location,
          duration: targetAct.duration,
          environment: targetAct.environment,
          type: targetAct.type,
          cost: targetAct.cost,
          rating: targetAct.rating,
          photoUrl: targetAct.photoUrl,
          links: targetAct.links,
          notes: targetAct.notes,
          openingHours: targetAct.openingHours
        };

        targetAct.title = act.title;
        targetAct.localTitle = act.localTitle;
        targetAct.description = act.description;
        targetAct.location = act.location;
        targetAct.duration = act.duration;
        targetAct.environment = act.environment;
        targetAct.type = act.type;
        targetAct.cost = act.cost;
        targetAct.rating = act.rating;
        targetAct.photoUrl = act.photoUrl;
        targetAct.links = act.links;
        targetAct.notes = act.notes;
        targetAct.openingHours = act.openingHours;

        act.title = temp.title;
        act.localTitle = temp.localTitle;
        act.description = temp.description;
        act.location = temp.location;
        act.duration = temp.duration;
        act.environment = temp.environment;
        act.type = temp.type;
        act.cost = temp.cost;
        act.rating = temp.rating;
        act.photoUrl = temp.photoUrl;
        act.links = temp.links;
        act.notes = temp.notes;
        act.openingHours = temp.openingHours;
      }
    }
    if (outdoorIndices.length === 0) break;
  }

  // 若仍有未配對成功的戶外景點，改以在地特色室內景點覆蓋
  if (outdoorIndices.length > 0) {
    const fallbackIndoorPois = [
      {
        title: '當地特色歷史博物館 (室內備案)',
        localTitle: 'Local History Museum',
        description: '典藏與展示了豐富的文物與歷史故事，是雨天避雨並深入理解在地歷史與人文創作的理想去處。',
        location: {
          name: '歷史博物館',
          address: '市中心博愛路 1 號',
          latitude: targetDay.activities[0].location.latitude,
          longitude: targetDay.activities[0].location.longitude
        },
        duration: 90,
        environment: 'indoor' as const,
        type: 'attraction' as const,
        openingHours: '09:00 - 17:00'
      },
      {
        title: '在地人氣文創購物商城 (室內備案)',
        localTitle: 'Trendy Indoor Mall',
        description: '集結了當地特色文創店家、美食餐飲與伴手禮名店，提供一站式的雨天室內逛街購物與餐飲體驗。',
        location: {
          name: '文創購物中心',
          address: '捷運市中心站 3 號出口旁',
          latitude: targetDay.activities[0].location.latitude,
          longitude: targetDay.activities[0].location.longitude
        },
        duration: 120,
        environment: 'indoor' as const,
        type: 'activity' as const,
        openingHours: '10:00 - 22:00'
      }
    ];

    for (const outIdx of outdoorIndices) {
      const fallback = fallbackIndoorPois.shift();
      if (!fallback) break;
      const targetAct = targetDay.activities[outIdx];

      targetAct.title = fallback.title;
      targetAct.localTitle = fallback.localTitle;
      targetAct.description = fallback.description;
      targetAct.location = fallback.location;
      targetAct.duration = fallback.duration;
      targetAct.environment = fallback.environment;
      targetAct.type = fallback.type;
      targetAct.openingHours = fallback.openingHours;
    }
  }

  // 重新計算並修復時間軸與車程
  if (targetDay.activities.length > 0) {
    const firstAct = targetDay.activities[0];
    return repairItineraryTimes(nextItinerary, targetDayNumber, firstAct.id, firstAct.startTime);
  }

  return nextItinerary;
}

