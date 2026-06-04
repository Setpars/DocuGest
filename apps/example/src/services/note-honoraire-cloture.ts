import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import type { DossierResultatIssue } from '@/utils/dossier-resultat'
import {
  getAffectationsForDossier,
  isAffectationActive,
  statutAffectationFromResultat,
  type AffectationRecord,
} from '@/utils/affectation'

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

async function fetchAffectationRecords(firestore: Firestore): Promise<AffectationRecord[]> {
  const snap = await getDocs(collection(firestore, 'affectations'))
  return snap.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Omit<AffectationRecord, 'id'>),
  }))
}

/**
 * Clôture du dossier et fin de toutes les affectations actives (note d’honoraires émise).
 */
export async function cloturerDossierApresNoteHonoraire(
  firestore: Firestore,
  dossierId: string,
  resultat: DossierResultatIssue,
): Promise<{ affectationsCloturees: number }> {
  const today = todayIsoDate()
  const statutAff = statutAffectationFromResultat(resultat)

  const [dossierSnap, allAffectations] = await Promise.all([
    getDoc(doc(firestore, 'dossiers', dossierId)),
    fetchAffectationRecords(firestore),
  ])

  const actives = getAffectationsForDossier(allAffectations, dossierId).filter(isAffectationActive)

  await Promise.all(
    actives.map((aff) =>
      updateDoc(doc(firestore, 'affectations', aff.id), {
        statut: statutAff,
        date_fin: aff.date_fin?.trim() ? aff.date_fin : today,
      }),
    ),
  )

  const dossierData = dossierSnap.exists() ? dossierSnap.data() : undefined
  const patch: Record<string, string> = {
    statut: 'Clos',
    resultat,
  }
  if (!dossierData?.date_fermeture) {
    patch.date_fermeture = today
  }

  await updateDoc(doc(firestore, 'dossiers', dossierId), patch)

  return { affectationsCloturees: actives.length }
}
