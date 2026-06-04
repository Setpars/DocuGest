import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  type User,
} from 'firebase/auth'
import { auth } from '@/firebase'

let persistenceConfigured = false

/** Persistance locale (session conservée après F5). */
export async function configureAuthPersistence() {
  if (persistenceConfigured) return
  await setPersistence(auth, browserLocalPersistence)
  persistenceConfigured = true
}

/**
 * Attend la première émission de `onAuthStateChanged` (restauration Firebase terminée).
 */
export function waitForAuthReady(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })
}
