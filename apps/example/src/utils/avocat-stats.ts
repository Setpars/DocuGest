import { parseDossierResultat } from '@/utils/dossier-resultat'
import {
  getAffectationAvocatId,
  getAffectationDossierId,
  isAffectationActive,
  normalizeAffectationStatut,
  type AffectationRecord,
} from '@/utils/affectation'

export type AvocatDossierOutcome = 'gagne' | 'perdu' | 'encours'

export type AvocatResultCounts = {
  gagne: number
  perdu: number
  enCours: number
  /** Dossiers avec affectation encore active */
  dossiersSuivis: number
  /** Tous les dossiers liés à l’avocat (actifs + clôturés) */
  totalAssignes: number
}

export type DossierOutcomeInput = {
  id: string
  resultat?: string
  statut?: string
  avocatId?: string
}

/**
 * Issue d’un dossier pour un avocat : priorité au `resultat` du dossier (note d’honoraires),
 * puis au statut terminal des affectations, sinon « en cours » si une affectation est active.
 */
function resolveIssueFromAffectations(affs: AffectationRecord[]): AvocatDossierOutcome | null {
  const sorted = [...affs].sort((a, b) =>
    String(b.date_affectation ?? '').localeCompare(String(a.date_affectation ?? '')),
  )
  for (const aff of sorted) {
    const s = normalizeAffectationStatut(aff.statut)
    if (s.includes('gagn')) return 'gagne'
    if (s.includes('perd')) return 'perdu'
  }
  return null
}

export function resolveAvocatDossierOutcome(
  dossier: DossierOutcomeInput | undefined,
  affsForAvocatDossier: AffectationRecord[],
): AvocatDossierOutcome {
  const fromDossier = parseDossierResultat(dossier?.resultat)
  if (fromDossier === 'gagné') return 'gagne'
  if (fromDossier === 'perdu') return 'perdu'

  const fromAff = resolveIssueFromAffectations(affsForAvocatDossier)
  if (fromAff) return fromAff

  if (affsForAvocatDossier.some(isAffectationActive)) return 'encours'

  return 'encours'
}

/** Dossiers liés à l’avocat : affectations + pointeur legacy `dossier.avocatId`. */
export function collectAvocatDossierIds(
  avocatId: string,
  affectations: AffectationRecord[],
  dossiers: DossierOutcomeInput[],
): Set<string> {
  const ids = new Set<string>()
  for (const aff of affectations) {
    if (getAffectationAvocatId(aff) !== avocatId) continue
    const dossierId = getAffectationDossierId(aff)
    if (dossierId) ids.add(dossierId)
  }
  for (const dossier of dossiers) {
    if (dossier.avocatId === avocatId) ids.add(dossier.id)
  }
  return ids
}

export function computeAvocatResultCountsFromData(
  avocatId: string,
  affectations: AffectationRecord[],
  dossiers: DossierOutcomeInput[],
): AvocatResultCounts {
  const dossiersById = new Map(dossiers.map((item) => [item.id, item]))
  const affs = affectations.filter((item) => getAffectationAvocatId(item) === avocatId)
  const dossierIds = collectAvocatDossierIds(avocatId, affectations, dossiers)

  let gagne = 0
  let perdu = 0
  let enCours = 0

  for (const dossierId of dossierIds) {
    const affsDossier = affs.filter((aff) => getAffectationDossierId(aff) === dossierId)
    const outcome = resolveAvocatDossierOutcome(dossiersById.get(dossierId), affsDossier)
    if (outcome === 'gagne') gagne++
    else if (outcome === 'perdu') perdu++
    else enCours++
  }

  return {
    gagne,
    perdu,
    enCours,
    dossiersSuivis: enCours,
    totalAssignes: gagne + perdu + enCours,
  }
}
