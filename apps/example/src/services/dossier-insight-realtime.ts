import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { fetchAvocatNameMap } from '@/services/affectation'
import { buildDossierInsightFromParts } from '@/services/dossier-insight-build'
import type { DossierInsight } from '@/types/dossier-insight'

export function subscribeDossierInsight(
  firestore: Firestore,
  dossierId: string,
  handlers: {
    onData: (insight: DossierInsight | null) => void
    onError: (message: string) => void
    onReady?: () => void
  },
): Unsubscribe {
  const parts = {
    dossierBase: null as Record<string, unknown> | null,
    affectationRecords: [] as Array<Record<string, unknown> & { id: string }>,
    paiementRecords: [] as Array<Record<string, unknown> & { id: string }>,
    documentRecords: [] as Array<Record<string, unknown> & { id: string }>,
    avocatNames: {} as Record<string, string>,
  }

  let avocatNamesReady = false
  const readyFlags = { dossier: false, aff: false, pai: false, doc: false }
  let notifiedReady = false

  const unsubs: Unsubscribe[] = []

  function tryEmit() {
    if (!parts.dossierBase) {
      handlers.onData(null)
      return
    }
    if (!avocatNamesReady) return
    handlers.onData(buildDossierInsightFromParts(dossierId, parts))
  }

  function markReady(key: keyof typeof readyFlags) {
    readyFlags[key] = true
    if (!notifiedReady && Object.values(readyFlags).every(Boolean)) {
      notifiedReady = true
      handlers.onReady?.()
    }
    tryEmit()
  }

  void fetchAvocatNameMap(firestore).then((names) => {
    parts.avocatNames = names
    avocatNamesReady = true
    tryEmit()
  }).catch(() => {
    handlers.onError('Impossible de charger les avocats.')
  })

  unsubs.push(
    onSnapshot(
      doc(firestore, 'dossiers', dossierId),
      (snap) => {
        if (!snap.exists()) {
          parts.dossierBase = null
          handlers.onData(null)
          markReady('dossier')
          return
        }
        parts.dossierBase = snap.data() as Record<string, unknown>
        markReady('dossier')
      },
      () => handlers.onError('Erreur de synchronisation du dossier.'),
    ),
  )

  unsubs.push(
    onSnapshot(
      collection(firestore, 'affectations'),
      (snap) => {
        parts.affectationRecords = snap.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Record<string, unknown>),
        }))
        markReady('aff')
      },
      () => handlers.onError('Erreur de synchronisation des affectations.'),
    ),
  )

  unsubs.push(
    onSnapshot(
      query(collection(firestore, 'paiements'), where('dossierId', '==', dossierId)),
      (snap) => {
        parts.paiementRecords = snap.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Record<string, unknown>),
        }))
        markReady('pai')
      },
      () => handlers.onError('Erreur de synchronisation des paiements.'),
    ),
  )

  unsubs.push(
    onSnapshot(
      query(collection(firestore, 'dossier_documents'), where('dossierId', '==', dossierId)),
      (snap) => {
        parts.documentRecords = snap.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Record<string, unknown>),
        }))
        markReady('doc')
      },
      () => handlers.onError('Erreur de synchronisation des documents.'),
    ),
  )

  return () => {
    for (const unsub of unsubs) unsub()
  }
}
