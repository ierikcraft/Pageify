import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { OperationType, FirestoreErrorInfo } from './types';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Set up Google Auth Provider
export const provider = new GoogleAuthProvider();

// Add default scopes
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');

// Flag to track sign-in in progress
let isSigningIn = false;

// Cache the Google Access Token in-memory and sessionStorage
let cachedAccessToken: string | null = sessionStorage.getItem('pageify_cached_access_token');

// Handle Firestore specific error JSON rendering for system monitoring
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error Details:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initialize Auth listener and resolve cached access tokens/user status
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const savedRole = localStorage.getItem('pageify_login_role') || 'cliente';
      if (savedRole === 'cliente') {
        // Clients do not need Google Drive / Sheets credentials or access token at all.
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken || '');
      } else {
        // Admins need drive/sheets credential access token
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else if (!isSigningIn) {
          // If we have an admin user but no cached token and aren't logging in, let them sign in
          if (onAuthFailure) onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem('pageify_cached_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Initiate Google Sign In via Pop-up with role configuration
export const googleSignIn = async (role: 'admin' | 'cliente'): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    localStorage.setItem('pageify_login_role', role);

    const customProvider = new GoogleAuthProvider();
    if (role === 'admin') {
      customProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
      customProvider.addScope('https://www.googleapis.com/auth/drive.file');
      // Force account consent window to let the admin select sheets permissions explicitly
      customProvider.setCustomParameters({
        prompt: 'consent'
      });
    }
    customProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    customProvider.addScope('https://www.googleapis.com/auth/userinfo.email');

    const result = await signInWithPopup(auth, customProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    const accessToken = credential?.accessToken || '';
    cachedAccessToken = accessToken || null;
    
    if (accessToken) {
      sessionStorage.setItem('pageify_cached_access_token', accessToken);
    } else {
      sessionStorage.removeItem('pageify_cached_access_token');
    }

    return { user: result.user, accessToken };
  } catch (error: any) {
    console.error('Core Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Retrieve currently cached access token for Sheets sync features
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Sign Out of session & clean states
export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  sessionStorage.removeItem('pageify_cached_access_token');
  localStorage.removeItem('pageify_login_role');
};
