import type { Firestore } from 'firebase/firestore'
import type { AffectationRecord } from '@/utils/affectation'
import type { DossierResultatIssue } from '@/utils/dossier-resultat'
import {
  collection,
  doc,

  getDocs,
  query,
  runTransaction,
  where,
} from 'firebase/firestore'
import { NOTE_HONORAIRE_MESSAGES } from '@/constants/note-honoraire'
import { isAffectationActive } from '@/utils/affectation'

export interface CreateNoteHonoraireInput {
  dossierId: string
  resultat: DossierResultatIssue
  titre: string
  contenuHtml: string
}

export interface CreateNoteHonoraireResult {
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
  if (!dossierId) {
    return 0
  }
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

  const [existingNotesCount, affectationRefs] = await Promise.all([
    countNotesHonorairesForDossier(firestore, input.dossierId),
    getDocs(
      query(
        collection(firestore, 'affectations'),
        where('dossierId', '==', input.dossierId),
      ),
    ),
  ])

  if (existingNotesCount > 0) {
    throw new Error(NOTE_HONORAIRE_MESSAGES.alreadyExists)
  }

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

    let affectationsCloturees = 0

    for (const affDoc of affectationRefs.docs) {
      const affSnap = await transaction.get(affDoc.ref)
      if (!affSnap.exists()) {
        continue
      }
      const aff = { id: affSnap.id, ...affSnap.data() } as AffectationRecord
      if (!isAffectationActive(aff)) {
        continue
      }
      transaction.update(affSnap.ref, {
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
