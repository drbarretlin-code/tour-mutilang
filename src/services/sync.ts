import { ref, onValue, set, update, off } from 'firebase/database';
import { rtdb } from './firebase';
import { Itinerary } from '../types/itinerary';
import { TripSurvey } from '../types/survey';
import { PACEngine } from './pac';

export const syncService = {
  /**
   * Subscribes to real-time updates of a trip itinerary in RTDB.
   * Useful for travel companion collaboration.
   * @param itineraryId The ID of the itinerary to subscribe to
   * @param callback Function called with updated itinerary data
   * @returns Unsubscribe function
   */
  subscribeToItinerary(itineraryId: string, callback: (itinerary: Itinerary) => void): () => void {
    const itineraryRef = ref(rtdb, `itineraries/${itineraryId}`);
    
    onValue(itineraryRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val() as Itinerary;
        callback(data);
      }
    });

    // Return unsubscribe function
    return () => {
      off(itineraryRef);
    };
  },

  /**
   * Publishes itinerary updates to RTDB for all subscribers to see instantly.
   * @param itineraryId The ID of the itinerary
   * @param updates Object containing the fields to update
   */
  async updateItineraryRealtime(itineraryId: string, updates: Partial<Itinerary>): Promise<void> {
    const action = async () => {
      const itineraryRef = ref(rtdb, `itineraries/${itineraryId}`);
      const dataToUpdate = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await update(itineraryRef, dataToUpdate);
    };

    if (PACEngine.getState().network === 'offline') {
      PACEngine.enqueuePendingTask(`update_${itineraryId}_${Date.now()}`, action);
      return;
    }

    await PACEngine.executeWithHealing(
      action,
      () => {
        PACEngine.enqueuePendingTask(`retry_update_${itineraryId}_${Date.now()}`, action);
      },
      'updateItineraryRealtime'
    );
  },

  /**
   * Initializes / pushes an entire itinerary into RTDB.
   */
  async publishItinerary(itinerary: Itinerary): Promise<void> {
    const action = async () => {
      const itineraryRef = ref(rtdb, `itineraries/${itinerary.id}`);
      await set(itineraryRef, itinerary);
    };

    if (PACEngine.getState().network === 'offline') {
      PACEngine.enqueuePendingTask(`publish_${itinerary.id}`, action);
      return;
    }

    await PACEngine.executeWithHealing(
      action,
      () => {
        PACEngine.enqueuePendingTask(`retry_publish_${itinerary.id}`, action);
      },
      'publishItinerary'
    );
  },

  /**
   * Subscribes to survey status updates (e.g. tracking when AI has finished generating)
   */
  subscribeToSurveyStatus(surveyId: string, callback: (status: TripSurvey['status']) => void): () => void {
    const statusRef = ref(rtdb, `planning_requests/${surveyId}/status`);
    
    onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as TripSurvey['status']);
      }
    });

    return () => {
      off(statusRef);
    };
  }
};
export default syncService;
