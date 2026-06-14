/**
 * Itinerary Types
 * Defines data structures for daily itinerary display.
 */

export interface Itinerary {
  id: string;
  surveyId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'generating' | 'ready' | 'modified';
  days: ItineraryDay[];
  emergencyContacts: EmergencyContact[];
  totalEstimatedCost: CostEstimate;
  currency: string;
  mapImageUrl?: string;
  /** 此行程是否由離線範本產生（AI 生成失敗時的備援），用於在 UI 上明確提示使用者 */
  generatedByFallback?: boolean;
  /** 若使用離線範本，記錄 AI 失敗的真實原因，便於診斷 */
  fallbackReason?: string;
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  title: string;
  summary: string;
  region: string;
  weather?: WeatherForecast;
  estimatedCost: CostEstimate;
  walkingDistance: number; // meters
  activities: Activity[];
  hotel?: HotelInfo;
  localTips?: LocalTip[];
  routeGeometry?: string; // Cached OSRM route geometry for offline map rendering
}

export interface Activity {
  id: string;
  order: number;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  title: string;
  localTitle?: string; // title in local language
  type: ActivityType;
  description: string;
  location: LocationInfo;
  duration: number; // minutes
  cost?: CostEstimate;
  transport?: TransportInfo;
  openingHours?: string;
  closedDays?: string[];
  rating?: number;
  links: ActivityLink[];
  notes: string;
  isMustVisit: boolean;
  bookingRecommended?: boolean;
  photoUrl?: string;
  environment?: 'indoor' | 'outdoor';
}

export type ActivityType =
  | 'attraction'
  | 'restaurant'
  | 'shopping'
  | 'transport'
  | 'hotel'
  | 'activity'
  | 'cafe'
  | 'spa'
  | 'entertainment';

export interface LocationInfo {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  mapUrl?: string;
}

export interface TransportInfo {
  mode: 'walk' | 'drive' | 'public' | 'taxi' | 'charter';
  duration: number; // minutes
  distance: number; // meters
  cost?: number;
  description?: string;
}

export interface CostEstimate {
  amount: number;
  currency: string;
  breakdown?: {
    category: string;
    amount: number;
  }[];
}

export interface HotelInfo {
  name: string;
  address: string;
  checkIn?: string;
  checkOut?: string;
  contact?: string;
  bookingUrl?: string;
  mapUrl?: string;
  location?: LocationInfo;
}

export interface EmergencyContact {
  label: string;
  number: string;
  description?: string;
}

export interface WeatherForecast {
  temperature: number;
  temperatureUnit: 'C' | 'F';
  condition: string;
  icon: string;
  rainChance: number;
  humidity: number;
  suggestion?: string;
}

export interface LocalTip {
  category: 'tipping' | 'customs' | 'wifi' | 'safety' | 'general';
  title: string;
  content: string;
}

export interface ActivityLink {
  label: string;
  url: string;
  type: 'info' | 'booking' | 'map' | 'review';
}
