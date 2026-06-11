/**
 * Trip Survey Types
 * Defines all data structures for the trip planning survey form.
 */

// ─── Tier 1: Required Fields ───

export interface TravelDates {
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  isFlexible: boolean;
  flexDays?: number; // 1-3
}

export interface Destination {
  id: string;
  name: string;
  placeId?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  order: number;
}

export interface TravelerGroup {
  adults: number;
  children: ChildInfo[];
  infants: number;
  seniors: number;
}

export interface ChildInfo {
  id: string;
  age: number;
}

export type TripType =
  | 'family'
  | 'couple'
  | 'solo'
  | 'friends'
  | 'business'
  | 'honeymoon';

export type BudgetLevel =
  | 'economy'
  | 'moderate'
  | 'luxury'
  | 'unlimited';

export type TransportMode =
  | 'public'
  | 'taxi'
  | 'rental'
  | 'charter'
  | 'walking';

export type BookingPlatform =
  | 'agoda'
  | 'hotels_com'
  | 'booking'
  | 'airbnb'
  | 'trip_com'
  | 'custom';

export type MapProvider =
  | 'apple'
  | 'google'
  | 'amap'
  | 'baidu';

// ─── Tier 2: Recommended Fields ───

export interface FlightInfo {
  id: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  isReturn: boolean;
}

export type InterestTag =
  | 'culture'
  | 'nature'
  | 'food'
  | 'shopping'
  | 'nightlife'
  | 'water'
  | 'family'
  | 'photo'
  | 'temple'
  | 'spa'
  | 'themepark'
  | 'art'
  | 'market';

export type TravelPace =
  | 'packed'
  | 'balanced'
  | 'relaxed';

export type DietaryRestriction =
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'peanut_allergy'
  | 'seafood_allergy'
  | 'none';

export type AccommodationType =
  | 'hotel'
  | 'homestay'
  | 'hostel'
  | 'resort'
  | 'apartment';

// ─── Tier 3: Optional Fields ───

export type MorningPreference =
  | 'early_bird'
  | 'normal'
  | 'late_riser';

export type AccommodationLocation =
  | 'city_center'
  | 'near_attractions'
  | 'quiet'
  | 'beachfront';

export type AccommodationAmenity =
  | 'pool'
  | 'gym'
  | 'breakfast'
  | 'kitchen'
  | 'laundry'
  | 'parking';

export type AccessibilityNeed =
  | 'wheelchair'
  | 'stroller'
  | 'mobility';

export type InsuranceStatus =
  | 'have'
  | 'need'
  | 'skip';

export interface MultiModalInput {
  id: string;
  type: 'url' | 'image' | 'file' | 'text';
  value: string;    // URL string, file URI, or text
  fileName?: string;
  mimeType?: string;
  preferredDate?: string;
  preferredTime?: string;
  duration?: number; // 建議停留時間 (分鐘)
  notes?: string;    // 距離或備註
}

// ─── Composite Survey Data ───

export interface TripSurvey {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'submitted' | 'generating' | 'completed';

  // Tier 1: Required
  dates: TravelDates;
  destinations: Destination[];
  travelers: TravelerGroup;
  tripType: TripType;
  departureCity: string;
  departurePlaceId?: string;
  budgetLevel: BudgetLevel;
  transportModes: TransportMode[];
  bookingPlatforms: BookingPlatform[];
  customBookingUrl?: string;
  mapProvider: MapProvider;
  locale: string;

  // Tier 2: Recommended
  flights: FlightInfo[];
  interests: InterestTag[];
  pace: TravelPace;
  dietaryRestrictions: DietaryRestriction[];
  accommodationType: AccommodationType[];
  currency: string;

  // Tier 3: Optional
  referenceAttractions: MultiModalInput[];
  mustVisitAttractions: MultiModalInput[];
  specificLocations?: MultiModalInput[];
  morningPreference: MorningPreference;
  dailyMealBudget?: number;
  accommodationLocation?: AccommodationLocation;
  accommodationAmenities: AccommodationAmenity[];
  accessibilityNeeds: AccessibilityNeed[];
  hasInternationalLicense: boolean;
  passportNationality?: string;
  insuranceStatus: InsuranceStatus;
  notes: string;
}

// ─── Default Values Factory ───

export function createDefaultSurvey(userId: string): TripSurvey {
  return {
    id: generateId(),
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',

    dates: {
      startDate: '2026-07-14',
      endDate: '2026-07-20',
      isFlexible: false,
    },
    destinations: [
      { id: generateId(), name: '曼谷', country: '泰國', order: 0 },
      { id: generateId(), name: '芭達雅', country: '泰國', order: 1 },
      { id: generateId(), name: '羅勇', country: '泰國', order: 2 }
    ],
    travelers: { adults: 2, children: [], infants: 0, seniors: 0 },
    tripType: 'family',
    departureCity: '台北',
    budgetLevel: 'moderate',
    transportModes: ['public', 'charter'],
    bookingPlatforms: ['booking'],
    mapProvider: 'google',
    locale: 'zh-TW',

    flights: [],
    interests: ['food', 'shopping', 'nightlife', 'water'],
    pace: 'packed',
    dietaryRestrictions: [],
    accommodationType: ['hotel', 'resort'],
    currency: 'TWD',

    referenceAttractions: [
      { id: generateId(), type: 'text', value: '1.docx: 需安排單趟跨城包車 (芭達雅至曼谷)。抵達曼谷後，全程搭乘 BTS 捷運。' }
    ],
    mustVisitAttractions: [
      { id: generateId(), type: 'text', value: '羅勇 Pa Dee 咖啡廳' },
      { id: generateId(), type: 'text', value: '羅勇 水果園' },
      { id: generateId(), type: 'text', value: '羅勇 森林餐廳' },
      { id: generateId(), type: 'text', value: '芭提雅寰庭帕塔納克酒店 (Cross Pattaya)' },
      { id: generateId(), type: 'text', value: 'Kliff Beach Club 懸崖海景餐廳' },
      { id: generateId(), type: 'text', value: '羅摩衍那水上樂園 (Ramayana Water Park)' },
      { id: generateId(), type: 'text', value: 'House of Benedict' },
      { id: generateId(), type: 'text', value: 'The Lunar Beach House' },
      { id: generateId(), type: 'text', value: '四方水上市場' },
      { id: generateId(), type: 'text', value: '芭達雅夜市 (Thepprasit Night Market)' },
      { id: generateId(), type: 'text', value: 'Terminal 21 旁邊小吃與手標牌泰式奶茶' },
      { id: generateId(), type: 'text', value: '丹嫩沙多水上市場' },
      { id: generateId(), type: 'text', value: '美功鐵道市場' },
      { id: generateId(), type: 'text', value: 'Big C Supercenter' },
      { id: generateId(), type: 'text', value: 'Park Sathorn Restaurant' }
    ],
    specificLocations: [],
    morningPreference: 'normal',
    accommodationAmenities: [],
    accessibilityNeeds: [],
    hasInternationalLicense: false,
    insuranceStatus: 'skip',
    notes: '必須考量到家庭旅遊的體力負荷，以及交通順暢度',
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
