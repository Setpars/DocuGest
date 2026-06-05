import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
  type Firestore,
} from 'firebase/firestore'
import { NOTE_HONORAIRE_MESSAGES } from '@/constants/note-honoraire'
import { isAffectationActive, type AffectationRecord } from '@/utils/affectation'
import type { DossierResultatIssue } from '@/utils/dossier-resultat'

export type CreateNoteHonoraireInput = {
  dossierId: string
  resultat: DossierResultatIssue
  titre: string
  contenuHtml: string
}

export type CreateNoteHonoraireResult = {
  noteId: string
  affectationsCloturees: number
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

/** Vérifie l’absence de note d’honoraires pour un dossier (hors transaction). */
export async function countNotesHonorairesForDossier(
  firestore: Firestore,
  dossierId: string,
): Promise<number> {
  if (!dossierId) return 0
  const snap = await getDocs(
    query(
      collection(firestore, 'dossier_documents'),
      where('dossierId', '==', dossierId),
      where('type', '==', 'note_honoraire'),
    ),
  )
  return snap.size
}

/**
 * Crée la note d’honoraires (unique par dossier) et clôture atomiquement
 * le dossier + les affectations actives.
 */
export async function createNoteHonoraireWithCloture(
  firestore: Firestore,
  input: CreateNoteHonoraireInput,
): Promise<CreateNoteHonoraireResult> {
  const now = new Date().toISOString()
  const today = todayIsoDate()

  return runTransaction(firestore, async (transaction) => {
    const dossierRef = doc(firestore, 'dossiers', input.dossierId)
    const dossierSnap = await transaction.get(dossierRef)
    if (!dossierSnap.exists()) {
      throw new Error('Dossier introuvable.')
    }

    const dossierData = dossierSnap.data()
    const montant = Number(dossierData.montantHonorairesTotal ?? 0)
    if (montant <= 0) {
      throw new Error(NOTE_HONORAIRE_MESSAGES.missingMontant)
    }
    if (dossierData.noteHonoraireId) {
      throw new Error(NOTE_HONORAIRE_MESSAGES.alreadyExists)
    }

    const notesQuery = query(
      collection(firestore, 'dossier_documents'),
      where('dossierId', '==', input.dossierId),
      where('type', '==', 'note_honoraire'),
    )
    const notesSnap = await transaction.get(notesQuery)
    if (!notesSnap.empty) {
      throw new Error(NOTE_HONORAIRE_MESSAGES.alreadyExists)
    }

    const noteRef = doc(collection(firestore, 'dossier_documents'))
    transaction.set(noteRef, {
      dossierId: input.dossierId,
      type: 'note_honoraire',
      titre: input.titre.trim(),
      contenuHtml: input.contenuHtml,
      createdAt: now,
      updatedAt: now,
    })

    const dossierPatch: Record<string, unknown> = {
      statut: 'Clos',
      resultat: input.resultat,
      noteHonoraireId: noteRef.id,
      updatedAt: now,
    }
    if (!dossierData.date_fermeture) {
      dossierPatch.date_fermeture = today
    }
    transaction.update(dossierRef, dossierPatch)

    const affectationsQuery = query(
      collection(firestore, 'affectations'),
      where('dossierId', '==', input.dossierId),
    )
    const affectationsSnap = await transaction.get(affectationsQuery)
    let affectationsCloturees = 0

    for (const affDoc of affectationsSnap.docs) {
      const aff = { id: affDoc.id, ...affDoc.data() } as AffectationRecord
      if (!isAffectationActive(aff)) continue
      transaction.update(affDoc.ref, {
        statut: 'Terminée',
        date_fin: aff.date_fin?.trim() ? aff.date_fin : today,
        updatedAt: now,
      })
      affectationsCloturees++
    }

    return {
      noteId: noteRef.id,
      affectationsCloturees,
    }
  })
}
