import {
  collection,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { onUnmounted, ref } from 'vue'
import { fetchAvocatNameMap } from '@/services/affectation'
import type { Paiement, PaiementDossierRef } from '@/types/paiement'
import type { AffectationRecord } from '@/utils/affectation'
import { normalizeDevise } from '@/utils/currency'
import { parseNaturePaiement } from '@/utils/paiement-nature'
import type { TypePaiement } from '@/types/paiement'

function mapDossierDoc(currentDoc: { id: string, data: () => Record<string, unknown> | object }): PaiementDossierRef {
  const data = currentDoc.data() as Record<string, unknown>
  return {
    id: currentDoc.id,
    motif: String(data.motif ?? data.titre ?? 'Sans intitulé'),
    clientNom: String(data.clientNom ?? data.nom_client ?? data.client ?? ''),
    juridiction: String(data.juridiction ?? ''),
    avocatId: String(data.avocatId ?? ''),
    montantHonorairesTotal: Number(data.montantHonorairesTotal ?? 0) || undefined,
    deviseHonoraires: normalizeDevise(data.deviseHonoraires ?? data.devise),
  }
}

function mapPaiementDoc(currentDoc: { id: string, data: () => Record<string, unknown> | object }): Paiement {
  const data = currentDoc.data() as Record<string, unknown>
  return {
    id: currentDoc.id,
    dossierId: String(data.dossierId ?? data.dossier_id ?? ''),
    nature_paiement: parseNaturePaiement(data.nature_paiement),
    type_paiement: String(data.type_paiement ?? 'Virement') as TypePaiement,
    devise: normalizeDevise(data.devise),
    montant_a_payer: Number(data.montant_a_payer ?? 0),
    montant_payer: Number(data.montant_payer ?? 0),
    description: String(data.description ?? ''),
    date_paiement: String(data.date_paiement ?? ''),
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
        collection(firestore, 'paiements'),
        (snap) => {
          paiements.value = snap.docs
            .map((currentDoc) => mapPaiementDoc(currentDoc))
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
        collection(firestore, 'dossiers'),
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
        collection(firestore, 'affectations'),
        (snap) => {
          affectations.value = snap.docs.map((currentDoc) => ({
            id: currentDoc.id,
            ...(currentDoc.data() as Omit<AffectationRecord, 'id'>),
          }))
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
