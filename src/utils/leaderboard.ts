import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp, 
  doc, 
  setDoc 
} from 'firebase/firestore';
import { db, auth, ensureSignedIn, handleFirestoreError, OperationType } from './firebase';

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  socialUrl?: string;
  userId: string;
  createdAt: any;
}

const COLLECTION_NAME = 'leaderboard';

/**
 * Generates or retrieves a persistent visitor ID for the high score leaderboard
 * in case standard Firebase Anonymous Auth is disabled on the project.
 */
export function getOrCreateVisitorId(): string {
  let vid = sessionStorage.getItem('space_shooter_visitor_id');
  if (!vid) {
    vid = 'pilot-' + Math.random().toString(36).substring(2, 11) + '-' + Math.random().toString(36).substring(2, 11);
    sessionStorage.setItem('space_shooter_visitor_id', vid);
  }
  return vid;
}

/**
 * Uploads a score submission to the Firestore leaderboard collection
 */
export async function submitScore(playerName: string, score: number, socialUrl?: string): Promise<void> {
  // Attempt to sign in anonymously (non-blocking fallback)
  try {
    await ensureSignedIn();
  } catch (err) {
    console.warn("Non-blocking sign-in issue:", err);
  }

  const userId = auth.currentUser?.uid || getOrCreateVisitorId();
  const cleanPlayerName = playerName.trim() || "Unknown Pilot";
  const cleanSocialUrl = socialUrl?.trim() || "";

  // Structure payload exactly matching firestore.rules expected fields
  const payload: Record<string, any> = {
    playerName: cleanPlayerName.substring(0, 25), // max length 25
    score: Math.floor(score),
    userId: userId,
    createdAt: serverTimestamp(),
  };

  if (cleanSocialUrl) {
    payload.socialUrl = cleanSocialUrl.substring(0, 200); // max length 200
  }

  const path = `${COLLECTION_NAME}`;
  try {
    // We generate a deterministic ID or random doc first
    const newDocRef = doc(collection(db, COLLECTION_NAME));
    await setDoc(newDocRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Fetches the top 10 scores worldwide from the Firestore leaderboard
 */
export async function getTopScores(): Promise<LeaderboardEntry[]> {
  try {
    await ensureSignedIn();
  } catch (err) {
    console.warn("Non-blocking sign-in issue on fetch:", err);
  }
  
  const path = COLLECTION_NAME;
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('score', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(q);
    const entries: LeaderboardEntry[] = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      entries.push({
        id: docSnap.id,
        playerName: data.playerName || 'Anonymous Pilot',
        score: Number(data.score) || 0,
        socialUrl: data.socialUrl || '',
        userId: data.userId || '',
        createdAt: data.createdAt,
      });
    });
    
    return entries;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
