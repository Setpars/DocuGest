import {
  collection,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { onUnmounted, ref } from 'vue'
import { COLLECTIONS } from '@/constants/collections'
import { mapAffectationFromFirestore, mapPaiementFromFirestore } from '@/domain/mappers'
import { fetchAvocatNameMap } from '@/services/affectation'
import type { Paiement, PaiementDossierRef } from '@/types/paiement'
import type { AffectationRecord } from '@/utils/affectation'
import { normalizeDevise } from '@/utils/currency'

function mapDossierDoc(currentDoc: { id: string, data: () => Record<string, unknown> | object }): PaiementDossierRef {
  const data = currentDoc.data() as Record<string, unknown>
  return {
    id: currentDoc.id,
    motif: String(data.motif ?? data.titre ?? 'Sans intitulé'),
    clientNom: String(data.clientNom ?? data.nom_client ?? data.client ?? ''),
    juridiction: String(data.juridiction ?? ''),
    statut: String(data.statut ?? 'Ouvert'),
    avocatId: String(data.avocatId ?? ''),
    montantHonorairesTotal: Number(data.montantHonorairesTotal ?? 0) || undefined,
    deviseHonoraires: normalizeDevise(data.deviseHonoraires ?? data.devise),
  }
}

export function usePaiementsRealtime(firestore: Firestore) {
  const paiements = ref<Paiement[]>([])
  const allDossiers = ref<PaiementDossierRef[]>([])
  const affectations = ref<AffectationRecord[]>([])
  const avocatNames = ref<Record<string, string>>({})
  const loading = ref(true)
  const syncError = ref('')

  let unsubs: Unsubscribe[] = []

  function start() {
    stop()
    loading.value = true
    syncError.value = ''

    let ready = { pai: false, dos: false, aff: false, names: false }

    const checkReady = () => {
      if (Object.values(ready).every(Boolean)) loading.value = false
    }

    void fetchAvocatNameMap(firestore).then((names) => {
      avocatNames.value = names
      ready.names = true
      checkReady()
    }).catch(() => {
      syncError.value = 'Impossible de charger les avocats.'
      ready.names = true
      checkReady()
    })

    unsubs = [
      onSnapshot(
        collection(firestore, COLLECTIONS.paiement),
        (snap) => {
          paiements.value = snap.docs
            .map((currentDoc) =>
              mapPaiementFromFirestore(currentDoc.id, currentDoc.data() as Record<string, unknown>),
            )
            .sort((a, b) => String(b.date_paiement).localeCompare(String(a.date_paiement)))
          ready.pai = true
          checkReady()
        },
        () => {
          syncError.value = 'Erreur de synchronisation des paiements.'
          ready.pai = true
          checkReady()
        },
      ),
      onSnapshot(
        collection(firestore, COLLECTIONS.dossier),
        (snap) => {
          allDossiers.value = snap.docs.map((currentDoc) => mapDossierDoc(currentDoc))
          ready.dos = true
          checkReady()
        },
        () => {
          syncError.value = 'Erreur de synchronisation des dossiers.'
          ready.dos = true
          checkReady()
        },
      ),
      onSnapshot(
        collection(firestore, COLLECTIONS.affectation),
        (snap) => {
          affectations.value = snap.docs.map((currentDoc) =>
            mapAffectationFromFirestore(currentDoc.id, currentDoc.data() as Record<string, unknown>),
          )
          ready.aff = true
          checkReady()
        },
        () => {
          syncError.value = 'Erreur de synchronisation des affectations.'
          ready.aff = true
          checkReady()
        },
      ),
    ]
  }

  function stop() {
    for (const unsub of unsubs) unsub()
    unsubs = []
  }

  onUnmounted(stop)

  return {
    paiements,
    allDossiers,
    affectations,
    avocatNames,
    loading,
    syncError,
    start,
    stop,
  }
}
