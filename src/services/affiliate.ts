/**
 * Affiliate Link Service
 * Provides direct links to Klook / KKday search results for a given destination/keyword.
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
  /**
   * Returns Klook / KKday search result links for the given keyword and region.
   */
  async searchTickets(keyword: string, region: string): Promise<AffiliateTicket[]> {
    return [
      {
        id: `klook-${Date.now()}`,
        title: `Klook ${region} 行程與票券`,
        price: '查看即時售價',
        currency: '',
        url: `https://www.klook.com/zh-TW/search/result/?query=${encodeURIComponent(keyword)}`,
        platform: 'klook'
      },
      {
        id: `kkday-${Date.now()}`,
        title: `KKday ${region} 體驗與交通`,
        price: '查看即時售價',
        currency: '',
        url: `https://www.kkday.com/zh-tw/product/productlist?word=${encodeURIComponent(keyword)}`,
        platform: 'kkday'
      }
    ];
  }
}

export const affiliateService = new AffiliateService();
