import {
  getAffectationsForDossier,
  isAffectationActive,
  resolveDossierAvocats,
  type AffectationRecord,
} from '@/utils/affectation'

export const DOSSIER_STATUTS_ACTIFS = ['Ouvert', 'En cours'] as const

export function isDossierStatutActif(statut?: string): boolean {
  return DOSSIER_STATUTS_ACTIFS.includes(statut as (typeof DOSSIER_STATUTS_ACTIFS)[number])
}

/** Au moins une affectation active ou un pointeur avocat legacy sur le dossier. */
export function hasDossierActiveAssignment(
  dossierId: string,
  affectations: AffectationRecord[],
  legacyAvocatId?: string,
): boolean {
  const actives = getAffectationsForDossier(affectations, dossierId).filter(isAffectationActive)
  if (actives.length > 0) return true
  return Boolean(legacyAvocatId?.trim())
}

/** Dossier pris en charge par au moins un avocat (affectation ou pointeur legacy). */
export function isDossierSuivi(
  dossierId: string,
  affectations: AffectationRecord[],
  avocatNames: Record<string, string>,
  legacyAvocatId?: string,
): boolean {
  const avocats = resolveDossierAvocats(dossierId, affectations, avocatNames, legacyAvocatId)
  return avocats.length > 0
}

export function collectDossiersSuivisIds(
  dossiers: Array<{ id: string, avocatId?: string }>,
  affectations: AffectationRecord[],
  avocatNames: Record<string, string>,
): Set<string> {
  const ids = new Set<string>()
  for (const dossier of dossiers) {
    if (isDossierSuivi(dossier.id, affectations, avocatNames, dossier.avocatId)) {
      ids.add(dossier.id)
    }
  }
  return ids
}
