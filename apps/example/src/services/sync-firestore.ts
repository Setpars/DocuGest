import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'
import {
  flushPendingFirestoreWrites,
  isFirestorePersistenceEnabled,
} from '@/firebase/firestore-offline'
import {
  clearLastSyncError,
  markInitialPullDone,
  setLastSyncAt,
  setLastSyncError,
} from '@/services/local-metadata'

/** Collections métier mises en cache au démarrage / après sync. */
const WARMUP_COLLECTIONS = [
  'clients',
  'dossiers',
  'paiements',
  'agenda',
  'avocats',
  'affectations',
] as const

export type SyncResult = {
  ok: boolean
  pushed: boolean
  pulledCollections: string[]
  error?: string
}

/**
 * Push : envoie les écritures en attente (IndexedDB → Firestore cloud).
 * Pull : lit les collections pour rafraîchir le cache local IndexedDB.
 */
export async function runFirestoreSync(): Promise<SyncResult> {
  const pulledCollections: string[] = []

  if (!isFirestorePersistenceEnabled()) {
    return {
      ok: false,
      pushed: false,
      pulledCollections,
      error: 'Persistance hors ligne non active. Rechargez l’application.',
    }
  }

  try {
    await flushPendingFirestoreWrites()

    for (const name of WARMUP_COLLECTIONS) {
      try {
        await getDocs(collection(db, name))
        pulledCollections.push(name)
      } catch {
        // Collection vide ou règles : on continue
      }
    }

    setLastSyncAt()
    clearLastSyncError()
    markInitialPullDone()

    return {
      ok: true,
      pushed: true,
      pulledCollections,
    }
  } catch (e) {
    const message = (e as Error).message || 'Synchronisation impossible'
    setLastSyncError(message)
    return {
      ok: false,
      pushed: false,
      pulledCollections,
      error: message,
    }
  }
}

/** Premier remplissage du cache après connexion. */
export async function warmupLocalCache() {
  return runFirestoreSync()
}
