import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { TripSurvey, createDefaultSurvey } from '../types/survey';
import { Itinerary } from '../types/itinerary';
import { dbService } from '../services/db';
import { syncService } from '../services/sync';
import { aiService } from '../services/ai';
import { PACEngine } from '../services/pac';

interface SurveyContextType {
  survey: TripSurvey;
  activeItinerary: Itinerary | null;
  setActiveItinerary: (it: Itinerary | null) => void;
  updateSurvey: (updates: Partial<TripSurvey>) => void;
  updateDates: (startDate: string, endDate: string, isFlexible: boolean, flexDays?: number) => void;
  addDestination: (name: string, placeId?: string, country?: string) => void;
  removeDestination: (id: string) => void;
  reorderDestinations: (destinations: TripSurvey['destinations']) => void;
  addFlight: (flightNumber: string, departureTime: string, arrivalTime: string, isReturn: boolean) => void;
  removeFlight: (id: string) => void;
  addReferenceAttraction: (type: 'url' | 'image' | 'file' | 'text', value: string, fileName?: string, mimeType?: string) => void;
  removeReferenceAttraction: (id: string) => void;
  addMustVisitAttraction: (type: 'url' | 'image' | 'file' | 'text', value: string, preferredDate?: string, preferredTime?: string, fileName?: string, mimeType?: string) => void;
  removeMustVisitAttraction: (id: string) => void;
  saveDraft: () => Promise<void>;
  submitSurvey: () => Promise<void>;
  resetSurvey: () => Promise<void>;
  loadSurveyForEdit: (surveyData: TripSurvey, itineraryIdToReplace: string) => void;
  cancelEditingItinerary: () => void;
  editingItineraryId: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
}

const SurveyContext = createContext<SurveyContextType | undefined>(undefined);

const SURVEY_DRAFT_KEY = '@trip_survey_draft';

export function SurveyProvider({ children }: { children: ReactNode }) {
  const [survey, setSurvey] = useState<TripSurvey>(createDefaultSurvey('anonymous'));
  const [activeItinerary, setActiveItinerary] = useState<Itinerary | null>(null);
  const [editingItineraryId, setEditingItineraryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load draft on mount or when user changes
  useEffect(() => {
    async function loadSurveyDraft() {
      setIsLoading(true);
      const user = auth.currentUser;
      const userId = user ? user.uid : 'anonymous';

      try {
        const defaultSurvey = createDefaultSurvey(userId);

        if (user) {
          // Try loading from Firestore
          const docRef = doc(db, 'surveys', `${userId}_draft`);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Merge with default survey to ensure complete object structure
            setSurvey({
              ...defaultSurvey,
              ...data,
              dates: { ...defaultSurvey.dates, ...data.dates },
              travelers: { ...defaultSurvey.travelers, ...data.travelers },
              destinations: data.destinations || [],
              userId // Ensure correct userId
            } as TripSurvey);
            setIsLoading(false);
            return;
          }
        }

        // Fallback to Local Storage
        const localDraft = await AsyncStorage.getItem(SURVEY_DRAFT_KEY);
        if (localDraft) {
          const parsed = JSON.parse(localDraft);
          // Merge with default survey to ensure complete object structure
          setSurvey({
            ...defaultSurvey,
            ...parsed,
            dates: { ...defaultSurvey.dates, ...parsed.dates },
            travelers: { ...defaultSurvey.travelers, ...parsed.travelers },
            destinations: parsed.destinations || [],
            userId // Ensure correct userId
          } as TripSurvey);
        } else {
          setSurvey(defaultSurvey);
        }
      } catch (error) {
        console.error('Error loading survey draft:', error);
        setSurvey(createDefaultSurvey(userId));
      } finally {
        setIsLoading(false);
      }
    }

    // Subscribe to auth state changes to reload draft
    const unsubscribe = auth.onAuthStateChanged(() => {
      loadSurveyDraft();
    });

    return unsubscribe;
  }, []);

  const updateSurvey = (updates: Partial<TripSurvey>) => {
    setSurvey((prev) => {
      const updated = { ...prev, ...updates, updatedAt: new Date().toISOString() };
      
      // Defer the side-effect outside the React render phase using setTimeout 0
      setTimeout(() => {
        PACEngine.debounceWrite(
          SURVEY_DRAFT_KEY,
          JSON.stringify(updated),
          async (key, val) => {
            // Local save
            await AsyncStorage.setItem(key, val);

            // Remote sync for logged-in users
            const user = auth.currentUser;
            if (user) {
              const docRef = doc(db, 'surveys', `${user.uid}_draft`);
              // Using JSON.parse(val) naturally strips all undefined properties 
              // that were in 'updated', satisfying Firestore's strict rules.
              setDoc(docRef, JSON.parse(val)).catch(err => console.warn('Remote draft sync failed:', err));
            }
          },
          1200
        );
      }, 0);

      return updated;
    });
  };

  const updateDates = (startDate: string, endDate: string, isFlexible: boolean, flexDays?: number) => {
    updateSurvey({
      dates: { startDate, endDate, isFlexible, flexDays }
    });
  };

  const addDestination = (name: string, placeId?: string, country?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const order = survey.destinations.length;
    const newDest = { id, name, placeId, country, order };
    updateSurvey({
      destinations: [...survey.destinations, newDest]
    });
  };

  const removeDestination = (id: string) => {
    const filtered = survey.destinations.filter((d) => d.id !== id);
    // Recalculate order
    const ordered = filtered.map((d, index) => ({ ...d, order: index }));
    updateSurvey({ destinations: ordered });
  };

  const reorderDestinations = (destinations: TripSurvey['destinations']) => {
    const ordered = destinations.map((d, index) => ({ ...d, order: index }));
    updateSurvey({ destinations: ordered });
  };

  const addFlight = (flightNumber: string, departureTime: string, arrivalTime: string, isReturn: boolean) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newFlight = { id, flightNumber, departureTime, arrivalTime, isReturn };
    updateSurvey({
      flights: [...survey.flights, newFlight]
    });
  };

  const removeFlight = (id: string) => {
    updateSurvey({
      flights: survey.flights.filter((f) => f.id !== id)
    });
  };

  const addReferenceAttraction = (
    type: 'url' | 'image' | 'file' | 'text',
    value: string,
    fileName?: string,
    mimeType?: string
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newItem = { id, type, value, fileName, mimeType };
    updateSurvey({
      referenceAttractions: [...survey.referenceAttractions, newItem]
    });
  };

  const removeReferenceAttraction = (id: string) => {
    updateSurvey({
      referenceAttractions: survey.referenceAttractions.filter((item) => item.id !== id)
    });
  };

  const addMustVisitAttraction = (
    type: 'url' | 'image' | 'file' | 'text',
    value: string,
    preferredDate?: string,
    preferredTime?: string,
    fileName?: string,
    mimeType?: string
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newItem = { id, type, value, preferredDate, preferredTime, fileName, mimeType };
    updateSurvey({
      mustVisitAttractions: [...survey.mustVisitAttractions, newItem]
    });
  };

  const removeMustVisitAttraction = (id: string) => {
    updateSurvey({
      mustVisitAttractions: survey.mustVisitAttractions.filter((item) => item.id !== id)
    });
  };

  const saveDraft = async () => {
    try {
      // 1. Always save to Local Storage (Offline support)
      await AsyncStorage.setItem(SURVEY_DRAFT_KEY, JSON.stringify(survey));

      // 2. Save to Remote Firestore if logged in
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, 'surveys', `${user.uid}_draft`);
        await setDoc(docRef, JSON.parse(JSON.stringify(survey)));
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  };

  const resetSurvey = async () => {
    try {
      const user = auth.currentUser;
      const userId = user ? user.uid : 'anonymous';
      
      // 1. Clear Local AsyncStorage
      await AsyncStorage.removeItem(SURVEY_DRAFT_KEY);
      
      // 2. Clear Remote Firestore draft if logged in
      if (user) {
        const docRef = doc(db, 'surveys', `${userId}_draft`);
        await deleteDoc(docRef);
      }
      
      // 3. Reset React State
      setSurvey(createDefaultSurvey(userId));
      setEditingItineraryId(null);
    } catch (error) {
      console.error('Error resetting survey:', error);
    }
  };

  const loadSurveyForEdit = (surveyData: TripSurvey, itineraryIdToReplace: string) => {
    setSurvey(surveyData);
    setEditingItineraryId(itineraryIdToReplace);
    setActiveItinerary(null);
  };

  const cancelEditingItinerary = () => {
    setEditingItineraryId(null);
  };

  const submitSurvey = async () => {
    setIsSubmitting(true);
    const user = auth.currentUser;
    const userId = user ? user.uid : 'anonymous';
    const finalSurvey: TripSurvey = {
      ...survey,
      userId,
      status: 'submitted',
      updatedAt: new Date().toISOString()
    };

    try {
      // In pure text/URL mode, we no longer upload images to Firebase Storage.
      // 1. Just proceed with the original user input references and must-visits.
      finalSurvey.referenceAttractions = survey.referenceAttractions;
      finalSurvey.mustVisitAttractions = survey.mustVisitAttractions;

      // 2. Save survey draft & submissions in Firestore if logged in
      if (user) {
        await dbService.saveSurvey(finalSurvey);
        const draftRef = doc(db, 'surveys', `${userId}_draft`);
        await setDoc(draftRef, JSON.parse(JSON.stringify(createDefaultSurvey(userId))));
      }

      // 3. Generate travel itinerary using secure AI Service
      const itinerary = await aiService.generateItinerary(finalSurvey);

      // 4. Save and Publish itinerary
      if (user) {
        if (editingItineraryId) {
          // Do not delete the old itinerary to preserve history as requested by the user.
          setEditingItineraryId(null);
        }
        await dbService.saveItinerary(itinerary);
        await syncService.publishItinerary(itinerary);
      }

      // 5. Update local state and offline cache
      setSurvey(finalSurvey);
      setActiveItinerary(itinerary);

      // Save to active offline cache keys
      await AsyncStorage.setItem('@trip_active_survey', JSON.stringify(finalSurvey));
      await AsyncStorage.setItem('@trip_active_itinerary', JSON.stringify(itinerary));

      // Sync local cached itineraries list
      try {
        const cachedListStr = await AsyncStorage.getItem('@trip_cached_itineraries_list');
        let cachedList: Itinerary[] = [];
        if (cachedListStr) {
          cachedList = JSON.parse(cachedListStr) as Itinerary[];
        }
        
        // If itinerary is editing/replacing a previous one, check if we should replace or prepend
        const index = cachedList.findIndex(item => item.id === itinerary.id);
        if (index > -1) {
          cachedList[index] = itinerary;
        } else {
          // Prepend new plans
          cachedList.unshift(itinerary);
        }
        await AsyncStorage.setItem('@trip_cached_itineraries_list', JSON.stringify(cachedList));
      } catch (listErr) {
        console.warn('Failed to sync offline itineraries list:', listErr);
      }

      // Clear local draft
      await AsyncStorage.removeItem(SURVEY_DRAFT_KEY);

    } catch (error) {
      console.warn('Error submitting survey:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SurveyContext.Provider
      value={{
        survey,
        activeItinerary,
        setActiveItinerary,
        updateSurvey,
        updateDates,
        addDestination,
        removeDestination,
        reorderDestinations,
        addFlight,
        removeFlight,
        addReferenceAttraction,
        removeReferenceAttraction,
        addMustVisitAttraction,
        removeMustVisitAttraction,
        saveDraft,
        submitSurvey,
        resetSurvey,
        loadSurveyForEdit,
        cancelEditingItinerary,
        editingItineraryId,
        isLoading,
        isSubmitting,
      }}
    >
      {children}
    </SurveyContext.Provider>
  );
}

export function useSurvey() {
  const ctx = useContext(SurveyContext);
  if (!ctx) {
    throw new Error('useSurvey must be used within a SurveyProvider');
  }
  return ctx;
}
