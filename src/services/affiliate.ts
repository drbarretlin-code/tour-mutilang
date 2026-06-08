/**
 * Affiliate API Integration Service
 * Placeholder for Klook / KKday Affiliate APIs.
 * 
 * To fully implement, you must apply for affiliate API access:
 * Klook: https://affiliate.klook.com/
 * KKday: https://affiliate.kkday.com/
 */

export interface AffiliateTicket {
  id: string;
  title: string;
  price: string;
  currency: string;
  url: string;
  platform: 'klook' | 'kkday';
}

class AffiliateService {
  private klookApiKey: string;
  private kkdayApiKey: string;

  constructor() {
    this.klookApiKey = process.env.EXPO_PUBLIC_KLOOK_API_KEY || '';
    this.kkdayApiKey = process.env.EXPO_PUBLIC_KKDAY_API_KEY || '';
  }

  /**
   * Search tickets across OTA platforms.
   * If API keys are not provided, it gracefully falls back to generating standard search URLs
   * without real-time prices.
   */
  async searchTickets(keyword: string, region: string): Promise<AffiliateTicket[]> {
    const results: AffiliateTicket[] = [];

    // KLOOK Integration
    if (this.klookApiKey) {
      // TODO: Replace with actual Klook API request
      // const klookRes = await fetch(`https://api.klook.com/v1/affiliate/search?keyword=${keyword}`, { headers: { 'X-API-KEY': this.klookApiKey }});
    } else {
      // Mock Fallback
      results.push({
        id: `klook-mock-${Date.now()}`,
        title: `Klook ${region} 行程與票券`,
        price: '查看即時售價',
        currency: '',
        url: `https://www.klook.com/zh-TW/search/result/?query=${encodeURIComponent(keyword)}`,
        platform: 'klook'
      });
    }

    // KKDAY Integration
    if (this.kkdayApiKey) {
      // TODO: Replace with actual KKday API request
    } else {
      // Mock Fallback
      results.push({
        id: `kkday-mock-${Date.now()}`,
        title: `KKday ${region} 體驗與交通`,
        price: '查看即時售價',
        currency: '',
        url: `https://www.kkday.com/zh-tw/product/productlist?word=${encodeURIComponent(keyword)}`,
        platform: 'kkday'
      });
    }

    return results;
  }
}

export const affiliateService = new AffiliateService();
