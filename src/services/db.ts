import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { TripSurvey } from '../types/survey';
import { Itinerary } from '../types/itinerary';
import { PACEngine } from './pac';

export function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (value !== undefined) {
          cleaned[key] = cleanUndefined(value);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

export const dbService = {
  // ─── Survey CRUD ───
  
  async saveSurvey(survey: TripSurvey): Promise<void> {
    if (!isFirebaseConfigured) return; // 未設定 Firebase：純本機運作，不寫雲端。
    try {
      const docRef = doc(db, 'surveys', survey.id);
      const cleaned = cleanUndefined(survey);
      await setDoc(docRef, cleaned);
    } catch (error) {
      console.error('Firestore saveSurvey error:', error);
      throw error;
    }
  },

  async getSurvey(surveyId: string): Promise<TripSurvey | null> {
    try {
      const docRef = doc(db, 'surveys', surveyId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as TripSurvey;
      }
      return null;
    } catch (error) {
      console.error('Firestore getSurvey error:', error);
      throw error;
    }
  },

  async getUserSurveys(userId: string): Promise<TripSurvey[]> {
    try {
      const surveysCol = collection(db, 'surveys');
      const q = query(surveysCol, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const surveys: TripSurvey[] = [];
      querySnapshot.forEach((doc) => {
        surveys.push(doc.data() as TripSurvey);
      });
      return surveys;
    } catch (error) {
      console.error('Firestore getUserSurveys error:', error);
      throw error;
    }
  },

  async deleteSurvey(surveyId: string): Promise<void> {
    try {
      const docRef = doc(db, 'surveys', surveyId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Firestore deleteSurvey error:', error);
      throw error;
    }
  },

  // ─── Itinerary CRUD ───

  async saveItinerary(itinerary: Itinerary): Promise<void> {
    // 未設定 Firebase 時，純本機運作，不嘗試雲端寫入（避免必然失敗而誤觸發降級提示）。
    if (!isFirebaseConfigured) return;

    const action = async () => {
      const docRef = doc(db, 'itineraries', itinerary.id);
      const cleaned = cleanUndefined(itinerary);
      await setDoc(docRef, cleaned);
    };

    if (PACEngine.getState().network === 'offline') {
      PACEngine.enqueuePendingTask(`firestore_save_${itinerary.id}`, action);
      return;
    }

    await PACEngine.executeWithHealing(
      action,
      () => {
        PACEngine.enqueuePendingTask(`retry_firestore_save_${itinerary.id}`, action);
      },
      'saveItinerary'
    );
  },

  async getItinerary(itineraryId: string): Promise<Itinerary | null> {
    try {
      const docRef = doc(db, 'itineraries', itineraryId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as Itinerary;
      }
      return null;
    } catch (error) {
      console.error('Firestore getItinerary error:', error);
      throw error;
    }
  },

  async getUserItineraries(userId: string): Promise<Itinerary[]> {
    try {
      const itinerariesCol = collection(db, 'itineraries');
      const q = query(itinerariesCol, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const itineraries: Itinerary[] = [];
      querySnapshot.forEach((doc) => {
        itineraries.push(doc.data() as Itinerary);
      });
      return itineraries;
    } catch (error) {
      console.error('Firestore getUserItineraries error:', error);
      throw error;
    }
  },

  async updateItineraryStatus(itineraryId: string, status: Itinerary['status']): Promise<void> {
    try {
      const docRef = doc(db, 'itineraries', itineraryId);
      await updateDoc(docRef, { status, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.error('Firestore updateItineraryStatus error:', error);
      throw error;
    }
  },

  async deleteItinerary(itineraryId: string): Promise<void> {
    try {
      const docRef = doc(db, 'itineraries', itineraryId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Firestore deleteItinerary error:', error);
      throw error;
    }
  }
};
