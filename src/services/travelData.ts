/**
 * Alternative Travel API Integration Service
 * Placeholder for RapidAPI / Tripadvisor Content API
 * 
 * Used to fetch structured POI (Point of Interest) data, reviews, and high-quality images.
 */

export interface TravelPOI {
  id: string;
  name: string;
  localName?: string;
  category: 'attraction' | 'restaurant' | 'hotel';
  rating: number;
  reviewCount: number;
  imageUrl?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
}

class TravelDataService {
  private rapidApiKey: string;

  constructor() {
    this.rapidApiKey = process.env.EXPO_PUBLIC_RAPID_API_KEY || '';
  }

  /**
   * Fetch POIs by destination keyword.
   * Currently uses mock fallback if API key is not present.
   */
  async fetchDestinationPOIs(destination: string, category: 'attraction' | 'restaurant' | 'hotel' = 'attraction'): Promise<TravelPOI[]> {
    if (this.rapidApiKey) {
      // TODO: Implement actual RapidAPI or Tripadvisor fetch
      // const res = await fetch(`https://api.rapidapi.com/.../search?query=${destination}&category=${category}`);
    }
    
    // Mock Fallback
    return [
      {
        id: `poi-mock-1-${Date.now()}`,
        name: `${destination} Highlights Tour`,
        localName: `${destination} 精華體驗`,
        category,
        rating: 4.8,
        reviewCount: 1250,
        description: `Experience the best of ${destination} with verified local guides.`
      }
    ];
  }
}

export const travelDataService = new TravelDataService();
