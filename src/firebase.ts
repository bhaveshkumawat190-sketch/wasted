import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, runTransaction, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

// Initialize anonymous auth
export const initAuth = () => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user);
        unsubscribe();
      } else {
        signInAnonymously(auth).then((result) => {
          resolve(result.user);
          unsubscribe();
        }).catch((error) => {
          if (error.code === 'auth/admin-restricted-operation') {
            console.warn("Like system: Anonymous Auth is disabled in Firebase Console. Likes will be unavailable until enabled.");
          } else {
            console.error("Auth error:", error);
          }
          resolve(null); // Resolve with null so the app continues
          unsubscribe();
        });
      }
    });
  });
};

export const getLikeCount = (callback: (count: number) => void) => {
  const statsRef = doc(db, 'stats', 'likes');
  return onSnapshot(statsRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data().count || 0);
    } else {
      if (auth.currentUser) {
        setDoc(statsRef, { count: 0 }).catch(() => {});
      }
      callback(0);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'stats/likes');
  });
};

export const checkIfLiked = async (uid: string) => {
  const userLikeRef = doc(db, 'user_likes', uid);
  try {
    const docSnap = await getDoc(userLikeRef);
    return docSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `user_likes/${uid}`);
    return false;
  }
};

export const addLike = async (uid: string) => {
  const userLikeRef = doc(db, 'user_likes', uid);
  const statsRef = doc(db, 'stats', 'likes');

  try {
    await runTransaction(db, async (transaction) => {
      const userLikeDoc = await transaction.get(userLikeRef);
      if (userLikeDoc.exists()) {
        throw new Error('Already liked');
      }

      const statsDoc = await transaction.get(statsRef);
      const currentCount = statsDoc.exists() ? statsDoc.data().count : 0;

      transaction.set(userLikeRef, {
        uid: uid,
        timestamp: serverTimestamp()
      });

      transaction.set(statsRef, {
        count: currentCount + 1
      }, { merge: true });
    });
    return true;
  } catch (e) {
    if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(e, OperationType.WRITE, 'transaction: addLike');
    }
    console.error('Transaction failed: ', e);
    return false;
  }
};
