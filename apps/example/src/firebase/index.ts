import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { configureAuthPersistence } from './auth'
import { getFirebaseConfig } from './env'

export const firebaseApp = initializeApp(getFirebaseConfig())
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)

/** À appeler une fois au démarrage (persistance Auth). */
export async function initFirebase() {
  await configureAuthPersistence()
}
