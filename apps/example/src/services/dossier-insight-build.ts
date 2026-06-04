import type {
  DossierInsight,
  DossierInsightAffectation,
  DossierInsightDocument,
  DossierInsightPaiement,
} from '@/types/dossier-insight'
import { normalizeDevise, type Devise } from '@/utils/currency'
import {
  getAffectationAvocatId,
  getAffectationDossierId,
  resolveDossierAvocats,
  type AffectationRecord,
} from '@/utils/affectation'
import { getNaturePaiementLabel, parseNaturePaiement } from '@/utils/paiement-nature'

export type DossierInsightBuildParts = {
  dossierBase: Record<string, unknown> | null
  affectationRecords: Array<Record<string, unknown> & { id: string }>
  paiementRecords: Array<Record<string, unknown> & { id: string }>
  documentRecords: Array<Record<string, unknown> & { id: string }>
  avocatNames: Record<string, string>
}

function mapAffectation(
  item: AffectationRecord,
  avocatNames: Record<string, string>,
): DossierInsightAffectation {
  const avocatId = getAffectationAvocatId(item)
  return {
    id: item.id,
    avocatId,
    avocatNom: avocatNames[avocatId] || 'Avocat inconnu',
    date_affectation: String(item.date_affectation ?? ''),
    date_fin: item.date_fin ? String(item.date_fin) : null,
    role: String(item.role ?? ''),
    statut: String(item.statut ?? ''),
    observation: String(item.observation ?? ''),
  }
}

export function mapDossierFields(id: string, data: Record<string, unknown>) {
  return {
    id,
    motif: String(data.motif ?? data.titre ?? ''),
    partie_en_cause: String(data.partie_en_cause ?? data.reference ?? ''),
    resume_affaire: String(data.resume_affaire ?? data.description ?? ''),
    statut: String(data.statut ?? 'Ouvert'),
    resultat: String(data.resultat ?? ''),
    juridiction: String(data.juridiction ?? ''),
    date_ouverture: String(data.date_ouverture ?? data.createdAt ?? ''),
    date_fermeture: data.date_fermeture ? String(data.date_fermeture) : null,
    clientId: data.clientId ? String(data.clientId) : '',
    clientNom: String(data.clientNom ?? data.nom_client ?? ''),
    clientGenre: String(data.clientGenre ?? ''),
    clientNationalite: String(data.clientNationalite ?? ''),
    clientAdresse: String(data.clientAdresse ?? ''),
    clientTelephone: String(data.clientTelephone ?? data.telephone ?? ''),
    montantHonorairesTotal: Number(data.montantHonorairesTotal ?? 0),
    deviseHonoraires: normalizeDevise(data.deviseHonoraires) as Devise,
    legacyAvocatId: data.avocatId ? String(data.avocatId) : undefined,
  }
}

function mapPaiementInsight(
  id: string,
  p: Record<string, unknown>,
): DossierInsightPaiement {
  const nature = parseNaturePaiement(p.nature_paiement)
  return {
    id,
    nature_paiement: nature,
    natureLabel: getNaturePaiementLabel(nature),
    montant: Number(p.montant_payer ?? p.montant ?? 0),
    devise: normalizeDevise(p.devise),
    date_paiement: String(p.date_paiement ?? p.date ?? ''),
    mode: String(p.type_paiement ?? p.mode ?? p.moyen ?? ''),
    reference: String(p.reference ?? p.description ?? ''),
  }
}

export function buildDossierInsightFromParts(
  dossierId: string,
  parts: DossierInsightBuildParts,
): DossierInsight | null {
  if (!parts.dossierBase) return null

  const base = mapDossierFields(dossierId, parts.dossierBase)

  const affectationRecords = parts.affectationRecords
    .filter((item) => getAffectationDossierId(item as AffectationRecord) === dossierId)
    .map((item) => item as AffectationRecord)

  const affectations = affectationRecords
    .map((item) => mapAffectation(item, parts.avocatNames))
    .sort((a, b) => String(b.date_affectation).localeCompare(String(a.date_affectation)))

  const avocats = resolveDossierAvocats(
    dossierId,
    affectationRecords,
    parts.avocatNames,
    base.legacyAvocatId,
  )

  const paiements: DossierInsightPaiement[] = parts.paiementRecords
    .map((item) => mapPaiementInsight(item.id, item))
    .sort((a, b) => String(b.date_paiement).localeCompare(String(a.date_paiement)))

  const documents: DossierInsightDocument[] = parts.documentRecords
    .map((item) => {
      const d = item
      const type = String(d.type ?? 'note_honoraire')
      const contenuHtml = type === 'note_honoraire' ? String(d.contenuHtml ?? '') : undefined
      return {
        id: item.id,
        type,
        titre: String(d.titre ?? ''),
        updatedAt: String(d.updatedAt ?? d.createdAt ?? ''),
        createdAt: String(d.createdAt ?? d.updatedAt ?? ''),
        ...(contenuHtml ? { contenuHtml } : {}),
      }
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))

  const honorairesPayes = paiements
    .filter((p) => p.nature_paiement === 'Honoraires')
    .filter((p) => p.devise === base.deviseHonoraires)
    .reduce((sum, p) => sum + p.montant, 0)

  const soldeRestant = Math.max(0, base.montantHonorairesTotal - honorairesPayes)

  const { legacyAvocatId: _legacy, ...publicBase } = base

  return {
    ...publicBase,
    avocats,
    affectations,
    paiements,
    documents,
    totalPaye: honorairesPayes,
    soldeRestant,
  }
}
