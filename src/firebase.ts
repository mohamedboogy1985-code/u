import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { SavedTranscription } from './types';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Use the databaseId provisioned for this applet
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Test connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network is limited.');
    }
    return false;
  }
}

// Subscribe to auth state changes
export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      await syncUserProfile(user).catch((err) => console.warn('Could not sync user profile:', err));
    }
    callback(user);
  });
}

// User sign-in helper
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await syncUserProfile(result.user).catch((err) => console.warn('Could not sync user profile:', err));
    return result.user;
  } catch (error) {
    console.error('Sign-in error:', error);
    throw error;
  }
}

// User sign-out helper
export async function logOut(): Promise<void> {
  return signOut(auth);
}

// Sync user profile document in /users/{userId}
export async function syncUserProfile(user: User, preferredLanguage: string = 'ar') {
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(
      userDocRef,
      {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        preferredLanguage,
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error syncing user profile:', error);
  }
}

// Save transcription to Firestore
export async function saveTranscriptionToFirestore(
  userId: string,
  data: {
    smartText: string;
    verbatimText: string;
    durationSeconds: number;
    wordCount: number;
    language?: string;
    summary?: string;
    source?: 'live' | 'file' | 'voice_live';
  }
): Promise<string> {
  try {
    const ref = collection(db, 'users', userId, 'transcriptions');
    const docRef = await addDoc(ref, {
      ...data,
      userId,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving transcription:', error);
    throw error;
  }
}

// Fetch user transcriptions
export async function getUserTranscriptions(userId: string): Promise<SavedTranscription[]> {
  try {
    const ref = collection(db, 'users', userId, 'transcriptions');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId || userId,
        smartText: data.smartText || '',
        verbatimText: data.verbatimText || '',
        durationSeconds: Number(data.durationSeconds || 0),
        wordCount: Number(data.wordCount || 0),
        language: data.language,
        summary: data.summary,
        source: data.source || 'live',
        createdAt: data.createdAt || new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error('Error fetching transcriptions:', error);
    return [];
  }
}

// Delete a saved transcription
export async function deleteTranscriptionFromFirestore(userId: string, transcriptionId: string): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'transcriptions', transcriptionId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting transcription:', error);
    throw error;
  }
}

// Save chat message (for voice reply conversations)
export async function saveChatMessage(
  userId: string,
  message: {
    role: 'user' | 'model';
    content: string;
    modelUsed?: string;
    groundingMetadata?: string;
  }
): Promise<string> {
  try {
    const ref = collection(db, 'users', userId, 'chatHistory');
    const docRef = await addDoc(ref, {
      ...message,
      userId,
      timestamp: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving chat message:', error);
    throw error;
  }
}

// Get chat history
export async function getChatHistory(userId: string) {
  try {
    const ref = collection(db, 'users', userId, 'chatHistory');
    const q = query(ref, orderBy('timestamp', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
}

export type { User };
