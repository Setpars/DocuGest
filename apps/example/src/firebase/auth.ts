import { onAuthStateChanged, type User } from 'firebase/auth'
import { applyAuthPersistence } from './auth-persistence'
import { auth } from './index'

/** Configure la persistance Auth selon la préférence « Se souvenir de moi ». */
export async function configureAuthPersistence() {
  await applyAuthPersistence()
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
