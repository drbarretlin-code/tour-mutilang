import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from './logger';

const logger = createLogger('guidePackManager');

export interface EnrichedPoiData {
  localTitle?: string;
  title?: Record<string, string>;
  desc?: Record<string, string>;
  links?: { label: string; url: string; type: string }[];
  photoUrl?: string;
}

export interface GuidePack {
  destName: string;
  pois: Record<string, EnrichedPoiData>;
}

class GuidePackManager {
  private cache: Record<string, GuidePack> = {};

  private normalizeName(name: string): string {
    return (name || '').toLowerCase().trim();
  }

  async preloadGuidePacks(destNames: string[], locale: string = 'en') {
    for (const dest of destNames) {
      if (!dest || this.cache[dest]) continue;

      try {
        // Simulate network fetch for OTA Guide Pack
        // In a real app, this would fetch from a CDN or backend API
        logger.info(`Simulating OTA Guide Pack download for: ${dest}`);
        const pack = await this.simulateFetchGuidePack(dest, locale);
        if (pack) {
          this.cache[dest] = pack;
        }
      } catch (e) {
        logger.warn(`Failed to preload guide pack for ${dest}`, e);
      }
    }
  }

  private async simulateFetchGuidePack(destName: string, locale: string): Promise<GuidePack> {
    // Simulated delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate some rich data for a destination
    // For demonstration, we'll provide generic enriched data or mock some famous POIs if they contain keywords
    
    const pois: Record<string, EnrichedPoiData> = {};
    
    return {
      destName,
      pois
    };
  }

  getEnrichedData(destName: string, poiName: string, lat?: number, lon?: number): EnrichedPoiData | null {
    if (!destName || !poiName) return null;
    const pack = this.cache[destName];
    if (!pack) return null;

    const normName = this.normalizeName(poiName);
    
    // 1. Exact or partial match in POI names
    for (const [key, data] of Object.entries(pack.pois)) {
      if (normName.includes(key) || key.includes(normName)) {
        return data;
      }
    }
    
    // 2. Simulated dynamic enrichment based on generic patterns if OTA pack is available
    if (normName.includes('museum') || normName.includes('博物館')) {
      return {
        title: { 'en': `${poiName} (Official Museum)`, 'zh-TW': `${poiName} (官方博物館)`, 'zh-CN': `${poiName} (官方博物馆)` },
        desc: { 'en': `A highly recommended museum in ${destName}, known for its extensive local exhibits and rich history. Check the official tourism website for seasonal events.`, 'zh-TW': `位於${destName}的知名博物館，館藏豐富，是深入了解當地歷史文化不可錯過的地點。建議出發前於當地觀光局網站確認最新特展資訊。` },
        links: [{ label: 'Official Tourism Guide', url: `https://example.com/guide/${encodeURIComponent(destName)}`, type: 'info' }]
      };
    }
    
    if (normName.includes('park') || normName.includes('公園')) {
      return {
        title: { 'en': `${poiName} (City Park Oasis)`, 'zh-TW': `${poiName} (都市綠洲公園)`, 'zh-CN': `${poiName} (都市绿洲公园)` },
        desc: { 'en': `A beautiful park in the heart of ${destName}, popular with both locals and bloggers for its scenic walking paths and natural beauty.`, 'zh-TW': `${destName}的人氣公園，深受當地居民與旅遊部落客喜愛，是遠離塵囂、散步野餐的絕佳去處。` }
      };
    }

    // If no OTA data is found, return null so the system falls back to its AI-generated or built-in descriptions.
    return null;
  }
}

export const guidePackManager = new GuidePackManager();
