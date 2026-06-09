import { ref, onValue, set, update, off } from 'firebase/database';
import { rtdb } from './firebase';
import { Itinerary } from '../types/itinerary';
import { TripSurvey } from '../types/survey';
import { PACEngine } from './pac';

// 本地記憶體快取，用以記錄成功發布或監聽到的最新行程，供 Diff 比對使用
const lastPublishedItineraries: Record<string, Itinerary> = {};

/**
 * 深度比對兩個行程物件，並產生 Firebase RTDB 相容的扁平化路徑 updates 對象
 */
function diffItinerary(oldItin: Itinerary, newItin: Itinerary): Record<string, any> {
  const updates: Record<string, any> = {};

  // 1. 比對行程基本屬性
  const baseKeys: (keyof Itinerary)[] = ['title', 'status', 'currency', 'mapImageUrl'];
  for (const key of baseKeys) {
    if (newItin[key] !== oldItin[key]) {
      updates[key] = newItin[key] !== undefined ? newItin[key] : null;
    }
  }

  // 2. 比對總估算費用
  if (JSON.stringify(newItin.totalEstimatedCost) !== JSON.stringify(oldItin.totalEstimatedCost)) {
    updates['totalEstimatedCost'] = newItin.totalEstimatedCost !== undefined ? newItin.totalEstimatedCost : null;
  }

  // 3. 比對緊急聯絡人資訊 (列表長度不同或有變更時直接覆蓋)
  if (JSON.stringify(newItin.emergencyContacts) !== JSON.stringify(oldItin.emergencyContacts)) {
    updates['emergencyContacts'] = newItin.emergencyContacts || [];
  }

  // 4. 比對每日行程 (days) 陣列
  const oldDays = oldItin.days || [];
  const newDays = newItin.days || [];

  if (oldDays.length !== newDays.length) {
    // 天數異動屬結構性變更，直接覆蓋 days
    updates['days'] = newDays;
  } else {
    // 天數相同，逐日比對內部屬性
    for (let i = 0; i < newDays.length; i++) {
      const oldDay = oldDays[i];
      const newDay = newDays[i];

      if (newDay.title !== oldDay.title) updates[`days/${i}/title`] = newDay.title;
      if (newDay.summary !== oldDay.summary) updates[`days/${i}/summary`] = newDay.summary;
      if (newDay.region !== oldDay.region) updates[`days/${i}/region`] = newDay.region;
      if (newDay.walkingDistance !== oldDay.walkingDistance) updates[`days/${i}/walkingDistance`] = newDay.walkingDistance;

      if (JSON.stringify(newDay.weather) !== JSON.stringify(oldDay.weather)) {
        updates[`days/${i}/weather`] = newDay.weather !== undefined ? newDay.weather : null;
      }
      if (JSON.stringify(newDay.estimatedCost) !== JSON.stringify(oldDay.estimatedCost)) {
        updates[`days/${i}/estimatedCost`] = newDay.estimatedCost !== undefined ? newDay.estimatedCost : null;
      }
      if (JSON.stringify(newDay.hotel) !== JSON.stringify(oldDay.hotel)) {
        updates[`days/${i}/hotel`] = newDay.hotel !== undefined ? newDay.hotel : null;
      }
      if (JSON.stringify(newDay.localTips) !== JSON.stringify(oldDay.localTips)) {
        updates[`days/${i}/localTips`] = newDay.localTips || [];
      }

      // 5. 比對當日活動 (activities) 列表
      const oldActs = oldDay.activities || [];
      const newActs = newDay.activities || [];

      if (oldActs.length !== newActs.length) {
        // 活動數量不同（新增/刪除），直接覆蓋當日的 activities
        updates[`days/${i}/activities`] = newActs;
      } else {
        // 數量相同，逐個活動進行欄位級比對
        for (let j = 0; j < newActs.length; j++) {
          const oldAct = oldActs[j];
          const newAct = newActs[j];

          if (JSON.stringify(oldAct) !== JSON.stringify(newAct)) {
            // 對於單一活動的修改，直接覆蓋該活動節點，兼顧效率與顆粒度
            updates[`days/${i}/activities/${j}`] = newAct;
          }
        }
      }
    }
  }

  return updates;
}

export const syncService = {
  /**
   * 監聽 Firebase Realtime Database 中行程的即時更新。
   */
  subscribeToItinerary(itineraryId: string, callback: (itinerary: Itinerary) => void): () => void {
    const itineraryRef = ref(rtdb, `itineraries/${itineraryId}`);
    
    onValue(itineraryRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val() as Itinerary;
        // 收到遠端更新時，主動更新本地記憶體快取以對齊狀態
        lastPublishedItineraries[itineraryId] = data;
        callback(data);
      }
    });

    return () => {
      off(itineraryRef);
    };
  },

  /**
   * 發布行程局部更新至 Firebase RTDB。
   */
  async updateItineraryRealtime(itineraryId: string, updates: Partial<Itinerary>): Promise<void> {
    const action = async () => {
      const itineraryRef = ref(rtdb, `itineraries/${itineraryId}`);
      const oldItin = lastPublishedItineraries[itineraryId];
      let finalUpdates = { ...updates } as Record<string, any>;

      // 如果本地存在舊的完整行程快取，且本次更新包含 days，則自動轉換為增量更新
      if (oldItin && updates.days) {
        const tempItin = { ...oldItin, ...updates } as Itinerary;
        finalUpdates = diffItinerary(oldItin, tempItin);
      }

      const dataToUpdate = {
        ...finalUpdates,
        updatedAt: new Date().toISOString()
      };

      // 只有當除了 updatedAt 之外有實際欄位變更時，才寫入資料庫
      if (Object.keys(dataToUpdate).length > 1) {
        await update(itineraryRef, dataToUpdate);

        // 更新本地快取
        if (oldItin) {
          lastPublishedItineraries[itineraryId] = {
            ...oldItin,
            ...updates
          } as Itinerary;
        }
      }
    };

    if (PACEngine.getState().network === 'offline') {
      PACEngine.enqueuePendingTask(`update_${itineraryId}_${Date.now()}`, action);
      return;
    }

    await PACEngine.executeWithHealing(
      action,
      () => {
        PACEngine.enqueuePendingTask(`retry_update_${itineraryId}_${Date.now()}`, action);
      },
      'updateItineraryRealtime'
    );
  },

  /**
   * 發布/發送完整的行程至 Firebase RTDB，內部自動轉換為增量更新。
   */
  async publishItinerary(itinerary: Itinerary): Promise<void> {
    const action = async () => {
      const itineraryRef = ref(rtdb, `itineraries/${itinerary.id}`);
      const oldItin = lastPublishedItineraries[itinerary.id];

      if (!oldItin) {
        // 初次發布，寫入完整物件
        await set(itineraryRef, itinerary);
      } else {
        // 存在舊資料，執行增量路徑更新
        const finalUpdates = diffItinerary(oldItin, itinerary);
        if (Object.keys(finalUpdates).length > 0) {
          const dataToUpdate = {
            ...finalUpdates,
            updatedAt: new Date().toISOString()
          };
          await update(itineraryRef, dataToUpdate);
        }
      }

      // 同步最新狀態至本地快取
      lastPublishedItineraries[itinerary.id] = itinerary;
    };

    if (PACEngine.getState().network === 'offline') {
      PACEngine.enqueuePendingTask(`publish_${itinerary.id}`, action);
      return;
    }

    await PACEngine.executeWithHealing(
      action,
      () => {
        PACEngine.enqueuePendingTask(`retry_publish_${itinerary.id}`, action);
      },
      'publishItinerary'
    );
  },

  /**
   * 訂閱問卷狀態更新。
   */
  subscribeToSurveyStatus(surveyId: string, callback: (status: TripSurvey['status']) => void): () => void {
    const statusRef = ref(rtdb, `planning_requests/${surveyId}/status`);
    
    onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as TripSurvey['status']);
      }
    });

    return () => {
      off(statusRef);
    };
  }
};

export default syncService;
