import {
  disableNetwork,
  enableNetwork,
  waitForPendingWrites,
} from 'firebase/firestore'
import { db } from '@/firebase'

/** Le cache IndexedDB est activé via `initializeFirestore` + `persistentLocalCache`. */
export function isFirestorePersistenceEnabled() {
  return true
}

/** Attend que les écritures en attente soient envoyées au serveur. */
export async function flushPendingFirestoreWrites() {
  try {
    await waitForPendingWrites(db)
  } catch {
    // Pas d’écriture en attente ou réseau indisponible
  }
}

export async function setFirestoreNetworkEnabled(enabled: boolean) {
  if (enabled) {
    await enableNetwork(db)
  } else {
    await disableNetwork(db)
  }
}
