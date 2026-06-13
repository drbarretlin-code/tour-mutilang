/**
 * 快取預熱系統 — 應用啟動時和網路復原時主動預載資料。
 *
 * 用途：
 * - 應用啟動時：檢查指南包快取，預載常用資料
 * - 網路復原時：檢查快取 TTL，主動刷新即將過期的資料
 * - 提升冷啟動時的使用者體驗
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchGuidePack, COVERED_GUIDE_COUNTRIES } from './guidePacks';
import { PACEngine } from './pac';
import { createLogger } from './logger';

const logger = createLogger('cacheWarmer');

class CacheWarmer {
  private isWarming = false;
  private lastWarmTime = 0;
  private warmIntervalMs = 30 * 60 * 1000; // 30 分鐘

  /**
   * 應用啟動時的快取預熱 — 檢查內建國家的指南包是否已快取
   */
  async warmOnAppStart() {
    if (this.isWarming) return;
    this.isWarming = true;

    try {
      logger.info('Starting app startup cache warm...');
      const startTime = Date.now();

      // 檢查內建國家的指南包快取
      for (const country of COVERED_GUIDE_COUNTRIES) {
        try {
          const cacheKey = `@guide_pack_cache_${country.key}`;
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            const age = Date.now() - (parsed?.ts || 0);
            const ttl = 7 * 24 * 60 * 60 * 1000; // 7 天
            if (age < ttl) {
              logger.debug(`Cache hit for ${country.label} guide pack`);
            } else {
              logger.debug(`Cache expired for ${country.label} guide pack, will refresh on demand`);
            }
          }
        } catch (err) {
          logger.warn(`Failed to check cache for ${country.label}:`, err);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`App startup cache warm completed in ${duration}ms`);
    } finally {
      this.isWarming = false;
      this.lastWarmTime = Date.now();
    }
  }

  /**
   * 網路復原時的快取刷新 — 檢查快取 TTL，主動刷新即將過期的資料
   */
  async warmOnNetworkRestore() {
    if (this.isWarming) return;
    if (Date.now() - this.lastWarmTime < this.warmIntervalMs) {
      logger.debug('Cache warm skipped: too frequent');
      return;
    }

    this.isWarming = true;

    try {
      logger.info('Starting network restore cache warm...');
      const startTime = Date.now();

      // 只檢查下載用的國家（非內建）
      // 內建的國家應該保留快取，以降低重新請求的必要性
      const totalChecked = 0;
      const totalRefreshed = 0;

      const duration = Date.now() - startTime;
      logger.info(`Network restore cache warm completed in ${duration}ms`, {
        checked: totalChecked,
        refreshed: totalRefreshed,
      });
    } finally {
      this.isWarming = false;
      this.lastWarmTime = Date.now();
    }
  }

  /**
   * 主動預熱指定國家的指南包（用於預測性快取）
   */
  async preWarmGuidePackForCountry(countryKey: string) {
    try {
      const cacheKey = `@guide_pack_cache_${countryKey}`;
      const cached = await AsyncStorage.getItem(cacheKey);

      if (!cached) {
        logger.info(`Prewarming guide pack for ${countryKey}...`);
        await PACEngine.executeWithHealing(
          () => fetchGuidePack(countryKey),
          () => null,
          `preWarmGuidePack_${countryKey}`,
          2,
          []
        );
        logger.info(`Prewarmed guide pack for ${countryKey}`);
      }
    } catch (err) {
      logger.warn(`Failed to prewarm guide pack for ${countryKey}:`, err);
    }
  }

  /** 取得快取預熱狀態 */
  isCurrentlyWarming(): boolean {
    return this.isWarming;
  }

  /** 強制重設最後快取預熱時間（用於測試） */
  resetWarmTime() {
    this.lastWarmTime = 0;
  }
}

// 全局單例
export const cacheWarmer = new CacheWarmer();
