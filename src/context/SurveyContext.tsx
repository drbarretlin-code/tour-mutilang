import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { TripSurvey, createDefaultSurvey } from '../types/survey';

interface SurveyContextType {
  survey: TripSurvey;
  updateSurvey: (updates: Partial<TripSurvey>) => void;
  updateDates: (startDate: string, endDate: string, isFlexible: boolean, flexDays?: number) => void;
  addDestination: (name: string, placeId?: string, country?: string) => void;
  removeDestination: (id: string) => void;
  reorderDestinations: (destinations: TripSurvey['destinations']) => void;
  addFlight: (flightNumber: string, departureTime: string, arrivalTime: string, isReturn: boolean) => void;
  removeFlight: (id: string) => void;
  addReferenceAttraction: (type: 'url' | 'image' | 'file' | 'text', value: string, fileName?: string, mimeType?: string) => void;
  removeReferenceAttraction: (id: string) => void;
  addMustVisitAttraction: (type: 'url' | 'image' | 'file' | 'text', value: string, preferredDate?: string, preferredTime?: string) => void;
  removeMustVisitAttraction: (id: string) => void;
  saveDraft: () => Promise<void>;
  submitSurvey: () => Promise<void>;
  isLoading: boolean;
  isSubmitting: boolean;
}

const SurveyContext = createContext<SurveyContextType | undefined>(undefined);

const SURVEY_DRAFT_KEY = '@trip_survey_draft';

export function SurveyProvider({ children }: { children: ReactNode }) {
  const [survey, setSurvey] = useState<TripSurvey>(createDefaultSurvey('anonymous'));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load draft on mount or when user changes
  useEffect(() => {
    async function loadSurveyDraft() {
      setIsLoading(true);
      const user = auth.currentUser;
      const userId = user ? user.uid : 'anonymous';

      try {
        if (user) {
          // Try loading from Firestore
          const docRef = doc(db, 'surveys', `${userId}_draft`);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setSurvey(docSnap.data() as TripSurvey);
            setIsLoading(false);
            return;
          }
        }

        // Fallback to Local Storage
        const localDraft = await AsyncStorage.getItem(SURVEY_DRAFT_KEY);
        if (localDraft) {
          const parsed = JSON.parse(localDraft) as TripSurvey;
          // Ensure correct userId
          setSurvey({ ...parsed, userId });
        } else {
          setSurvey(createDefaultSurvey(userId));
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
      // Save locally in background
      AsyncStorage.setItem(SURVEY_DRAFT_KEY, JSON.stringify(updated));
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
    preferredTime?: string
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newItem = { id, type, value, preferredDate, preferredTime };
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
    const user = auth.currentUser;
    if (!user) return;
    try {
      const docRef = doc(db, 'surveys', `${user.uid}_draft`);
      await setDoc(docRef, survey);
    } catch (error) {
      console.error('Error saving draft to Firestore:', error);
    }
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
      if (user) {
        // Save to active surveys collection
        const docRef = doc(db, 'surveys', finalSurvey.id);
        await setDoc(docRef, finalSurvey);

        // Delete draft
        const draftRef = doc(db, 'surveys', `${userId}_draft`);
        await setDoc(draftRef, createDefaultSurvey(userId));
      }

      // Clear local draft
      await AsyncStorage.removeItem(SURVEY_DRAFT_KEY);

      // Trigger AI generation (e.g., via RTDB status or Firebase Cloud Functions)
      // For now, write a request entry in Realtime Database to trigger planning
      // This matches the no-extra-cost requirement (RTDB free tier)
      // RTDB has a structure: /planning_requests/{surveyId} = { surveyData }
      // This can trigger a background process or client-side generation mock
      setSurvey(finalSurvey);
    } catch (error) {
      console.error('Error submitting survey:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SurveyContext.Provider
      value={{
        survey,
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
