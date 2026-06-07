export * from './survey';
export * from './itinerary';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  locale: string;
  createdAt: string;
}
