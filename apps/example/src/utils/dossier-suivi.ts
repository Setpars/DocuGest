import {
  resolveDossierAvocats,
  type AffectationRecord,
} from '@/utils/affectation'

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
