import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  type User,
} from 'firebase/auth'
import { auth } from './index'

let authReady = false
let authReadyPromise: Promise<void> | null = null
let resolveAuthReady: (() => void) | null = null

function ensureAuthReadyPromise() {
  if (!authReadyPromise) {
    authReadyPromise = new Promise<void>((resolve) => {
      resolveAuthReady = resolve
    })
  }
  return authReadyPromise
}

/** Persistance locale + attente du premier événement `onAuthStateChanged`. */
export async function initFirebaseAuthPersistence(): Promise<void> {
  ensureAuthReadyPromise()
  try {
    await setPersistence(auth, browserLocalPersistence)
  } catch {
    // Déjà configuré ou environnement non navigateur
  }
}

/**
 * Résout après le premier `onAuthStateChanged` (utilisateur restauré ou null).
 * À appeler une seule fois au démarrage.
 */
export function bindAuthStateListener(onUser: (user: User | null) => void | Promise<void>): void {
  ensureAuthReadyPromise()
  onAuthStateChanged(auth, async (user) => {
    try {
      await onUser(user)
    } finally {
      if (!authReady) {
        authReady = true
        resolveAuthReady?.()
      }
    }
  })
}

export function isFirebaseAuthReady(): boolean {
  return authReady
}

export function waitForFirebaseAuthReady(): Promise<void> {
  if (authReady) return Promise.resolve()
  return ensureAuthReadyPromise()
}

export function getFirebaseAuthUser(): User | null {
  return auth.currentUser
}
