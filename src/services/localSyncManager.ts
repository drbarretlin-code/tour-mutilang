import AsyncStorage from '@react-native-async-storage/async-storage';
import { Itinerary } from '../types/itinerary';
import { TripSurvey } from '../types/survey';
import { dbService } from './db';
import { syncService } from './sync';
import { PACEngine } from './pac';

const ITINERARY_PREFIX = '@itinerary:';
const SURVEY_PREFIX = '@survey:';

export interface LocalSyncState {
  isDirty: boolean;
  lastWriteTime: string;
}

export const localSyncManager = {
  /**
   * 初始化同步管理器，監聽網路狀態，當回復連線時觸發自動增量同步。
   */
  initialize() {
    PACEngine.subscribe((state) => {
      if (state.network === 'online') {
        console.log('[LocalSyncManager] Network online detected. Triggering sync pending changes...');
        this.syncPendingChanges().catch((err) => {
          console.error('[LocalSyncManager] Failed to sync pending changes on reconnect:', err);
        });
      }
    });
  },

  /**
   * 儲存行程至本地，並視情況標記 isDirty。
   */
  async saveItineraryLocal(itinerary: Itinerary, isDirty = true): Promise<void> {
    const key = `${ITINERARY_PREFIX}${itinerary.id}`;
    const syncState: LocalSyncState = {
      isDirty,
      lastWriteTime: itinerary.updatedAt || new Date().toISOString()
    };
    
    // 同時儲存主體資料與同步狀態
    await AsyncStorage.multiSet([
      [key, JSON.stringify(itinerary)],
      [`${key}:state`, JSON.stringify(syncState)]
    ]);

    // 若在連線狀態且標記為 dirty，嘗試即時推送到雲端
    if (isDirty && PACEngine.getState().network === 'online') {
      try {
        await dbService.saveItinerary(itinerary);
        await syncService.publishItinerary(itinerary);
        // 成功推送到雲端後，清除 dirty 標記
        await this.markItineraryClean(itinerary.id);
      } catch (err) {
        console.warn(`[LocalSyncManager] Immediate cloud sync failed for itinerary ${itinerary.id}, will retry later:`, err);
      }
    }
  },

  /**
   * 取得本地行程。
   */
  async getItineraryLocal(id: string): Promise<Itinerary | null> {
    const key = `${ITINERARY_PREFIX}${id}`;
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as Itinerary;
    } catch {
      return null;
    }
  },

  /**
   * 清除行程的 dirty 狀態。
   */
  async markItineraryClean(id: string): Promise<void> {
    const key = `${ITINERARY_PREFIX}${id}:state`;
    const data = await AsyncStorage.getItem(key);
    if (data) {
      const state = JSON.parse(data) as LocalSyncState;
      state.isDirty = false;
      await AsyncStorage.setItem(key, JSON.stringify(state));
    }
  },

  /**
   * 儲存問卷至本地，並視情況標記 isDirty。
   */
  async saveSurveyLocal(survey: TripSurvey, isDirty = true): Promise<void> {
    const key = `${SURVEY_PREFIX}${survey.id}`;
    const syncState: LocalSyncState = {
      isDirty,
      lastWriteTime: survey.updatedAt || new Date().toISOString()
    };

    await AsyncStorage.multiSet([
      [key, JSON.stringify(survey)],
      [`${key}:state`, JSON.stringify(syncState)]
    ]);

    if (isDirty && PACEngine.getState().network === 'online') {
      try {
        await dbService.saveSurvey(survey);
        await this.markSurveyClean(survey.id);
      } catch (err) {
        console.warn(`[LocalSyncManager] Immediate cloud sync failed for survey ${survey.id}, will retry later:`, err);
      }
    }
  },

  /**
   * 取得本地問卷。
   */
  async getSurveyLocal(id: string): Promise<TripSurvey | null> {
    const key = `${SURVEY_PREFIX}${id}`;
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as TripSurvey;
    } catch {
      return null;
    }
  },

  /**
   * 清除問卷的 dirty 狀態。
   */
  async markSurveyClean(id: string): Promise<void> {
    const key = `${SURVEY_PREFIX}${id}:state`;
    const data = await AsyncStorage.getItem(key);
    if (data) {
      const state = JSON.parse(data) as LocalSyncState;
      state.isDirty = false;
      await AsyncStorage.setItem(key, JSON.stringify(state));
    }
  },

  /**
   * 增量同步本地所有未同步的行程與問卷變更（採用 Last-Write-Wins 解決衝突）。
   */
  async syncPendingChanges(): Promise<void> {
    const allKeys = await AsyncStorage.getAllKeys();
    
    // 1. 同步問卷 (Surveys)
    const surveyStateKeys = allKeys.filter(k => k.startsWith(SURVEY_PREFIX) && k.endsWith(':state'));
    for (const stateKey of surveyStateKeys) {
      const surveyId = stateKey.slice(SURVEY_PREFIX.length, -6);
      const stateData = await AsyncStorage.getItem(stateKey);
      if (!stateData) continue;
      const state = JSON.parse(stateData) as LocalSyncState;

      if (state.isDirty) {
        const localSurvey = await this.getSurveyLocal(surveyId);
        if (!localSurvey) continue;

        try {
          const cloudSurvey = await dbService.getSurvey(surveyId);
          if (cloudSurvey) {
            const localTime = new Date(state.lastWriteTime).getTime();
            const cloudTime = new Date(cloudSurvey.updatedAt || 0).getTime();

            if (localTime >= cloudTime) {
              // 本地較新：覆蓋雲端
              await dbService.saveSurvey(localSurvey);
              await this.markSurveyClean(surveyId);
            } else {
              // 雲端較新：覆蓋本地
              await this.saveItineraryLocal(cloudSurvey as any, false); // 儲存並不標記 dirty
              await this.markSurveyClean(surveyId);
            }
          } else {
            // 雲端無此資料：新增到雲端
            await dbService.saveSurvey(localSurvey);
            await this.markSurveyClean(surveyId);
          }
        } catch (err) {
          console.warn(`[LocalSyncManager] Failed to sync survey ${surveyId}:`, err);
        }
      }
    }

    // 2. 同步行程 (Itineraries)
    const itineraryStateKeys = allKeys.filter(k => k.startsWith(ITINERARY_PREFIX) && k.endsWith(':state'));
    for (const stateKey of itineraryStateKeys) {
      const itineraryId = stateKey.slice(ITINERARY_PREFIX.length, -6);
      const stateData = await AsyncStorage.getItem(stateKey);
      if (!stateData) continue;
      const state = JSON.parse(stateData) as LocalSyncState;

      if (state.isDirty) {
        const localItin = await this.getItineraryLocal(itineraryId);
        if (!localItin) continue;

        try {
          const cloudItin = await dbService.getItinerary(itineraryId);
          if (cloudItin) {
            const localTime = new Date(state.lastWriteTime).getTime();
            const cloudTime = new Date(cloudItin.updatedAt || 0).getTime();

            if (localTime >= cloudTime) {
              // 本地較新：覆蓋雲端
              await dbService.saveItinerary(localItin);
              await syncService.publishItinerary(localItin);
              await this.markItineraryClean(itineraryId);
            } else {
              // 雲端較新：覆蓋本地
              await this.saveItineraryLocal(cloudItin, false);
              await this.markItineraryClean(itineraryId);
            }
          } else {
            // 雲端無此資料：新增到雲端
            await dbService.saveItinerary(localItin);
            await syncService.publishItinerary(localItin);
            await this.markItineraryClean(itineraryId);
          }
        } catch (err) {
          console.warn(`[LocalSyncManager] Failed to sync itinerary ${itineraryId}:`, err);
        }
      }
    }
  }
};

export default localSyncManager;
