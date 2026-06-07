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
      startDate: '',
      endDate: '',
      isFlexible: false,
    },
    destinations: [],
    travelers: { adults: 2, children: [], infants: 0, seniors: 0 },
    tripType: 'family',
    departureCity: '',
    budgetLevel: 'moderate',
    transportModes: [],
    bookingPlatforms: ['booking'],
    mapProvider: 'google',
    locale: 'zh-TW',

    flights: [],
    interests: [],
    pace: 'balanced',
    dietaryRestrictions: [],
    accommodationType: [],
    currency: 'TWD',

    referenceAttractions: [],
    mustVisitAttractions: [],
    morningPreference: 'normal',
    accommodationAmenities: [],
    accessibilityNeeds: [],
    hasInternationalLicense: false,
    insuranceStatus: 'skip',
    notes: '',
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
