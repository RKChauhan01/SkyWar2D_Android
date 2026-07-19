import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Guard: If we are attempting to update a document that has already been deleted
  // (e.g. by another player leaving the game room), log a warning and return gracefully
  // instead of throwing a fatal error and crashing the game UI.
  if (operationType === OperationType.UPDATE && 
      (errorMessage.includes('No document to update') || 
       errorMessage.includes('not-found') || 
       errorMessage.includes('NOT_FOUND'))) {
    console.warn(`Non-fatal: Attempted to update a missing or deleted document at ${path}`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  if (errorMessage.includes('Quota exceeded') || errorMessage.includes('quota')) {
    console.warn('Firestore Quota Exceeded: ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  
  throw new Error(JSON.stringify(errInfo));
}

// Dry test function to validate configuration
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// Auto sign in anonymously if enabled, otherwise gracefully fallback to client-side persistent identifier
export async function ensureSignedIn() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e: any) {
      if (e && (e.code === 'auth/admin-restricted-operation' || e.message?.includes('admin-restricted-operation'))) {
        console.log("Firebase anonymous auth is disabled on this project. Falling back to persistent client-side keys.");
      } else {
        console.warn("Non-critical anonymous sign-in warning:", e);
      }
    }
  }
}
