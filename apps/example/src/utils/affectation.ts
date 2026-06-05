/** Affectation Firestore (champs legacy snake_case supportés). */
export type AffectationRecord = {
  id: string
  avocatId?: string
  avocat_id?: string
  dossierId?: string
  dossier_id?: string
  role?: string
  statut?: string
  date_affectation?: string
  date_fin?: string | null
  observation?: string
}

export type DossierAvocatSummary = {
  id: string
  nom: string
  role: string
}

export function getAffectationDossierId(affectation: AffectationRecord): string {
  return affectation.dossierId || affectation.dossier_id || ''
}

export function getAffectationAvocatId(affectation: AffectationRecord): string {
  return affectation.avocatId || affectation.avocat_id || ''
}

export function getAffectationsForDossier(
  affectations: AffectationRecord[],
  dossierId: string,
): AffectationRecord[] {
  return affectations.filter((item) => getAffectationDossierId(item) === dossierId)
}

export function resolveDossierAvocats(
  dossierId: string,
  affectations: AffectationRecord[],
  avocatNames: Record<string, string>,
  legacyAvocatId?: string,
): DossierAvocatSummary[] {
  const fromAffs = getAffectationsForDossier(affectations, dossierId).map((item) => {
    const id = getAffectationAvocatId(item)
    return {
      id,
      nom: avocatNames[id] || 'Avocat inconnu',
      role: String(item.role ?? '').trim(),
    }
  })

  const seen = new Set(fromAffs.map((item) => item.id).filter(Boolean))
  if (legacyAvocatId && !seen.has(legacyAvocatId)) {
    fromAffs.push({
      id: legacyAvocatId,
      nom: avocatNames[legacyAvocatId] || 'Avocat inconnu',
      role: '',
    })
  }

  return fromAffs
}

export function formatAvocatsLabel(avocats: DossierAvocatSummary[]): string {
  if (!avocats.length) return 'En attente d’avocat'
  return avocats
    .map((item) => (item.role ? `${item.nom} (${item.role})` : item.nom))
    .join(', ')
}

export function normalizeAffectationStatut(statut?: string): string {
  return String(statut ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Affectation encore en cours (pas clôturée par note d’honoraires ou retrait). */
export function isAffectationActive(aff: AffectationRecord): boolean {
  const s = normalizeAffectationStatut(aff.statut)
  if (s.includes('gagn') || s.includes('perd')) return false
  if (s.includes('clos') || s.includes('termine') || s.includes('annul')) return false
  if (aff.date_fin && String(aff.date_fin).trim()) return false
  return true
}

export function statutAffectationFromResultat(_resultat: 'gagné' | 'perdu'): string {
  return 'Terminée'
}

export function collectUniqueAvocatNames(avocats: DossierAvocatSummary[]): string[] {
  const names = new Set<string>()
  for (const item of avocats) {
    if (item.nom && item.nom !== 'Avocat inconnu') names.add(item.nom)
  }
  return [...names]
}
