import type { DossierAvocatSummary } from '@/utils/affectation'

export type DossierInsightAffectation = {
  id: string
  avocatId: string
  avocatNom: string
  date_affectation: string
  date_fin: string | null
  role: string
  statut: string
  observation: string
}

export type DossierInsightPaiement = {
  id: string
  nature_paiement: string
  natureLabel: string
  montant: number
  devise: string
  date_paiement: string
  mode: string
  reference: string
}

export type DossierInsightDocument = {
  id: string
  type: string
  titre: string
  updatedAt: string
  createdAt: string
  /** Présent pour les notes d’honoraires (aperçu sur la fiche). */
  contenuHtml?: string
}

export type DossierInsight = {
  id: string
  motif: string
  partie_en_cause: string
  resume_affaire: string
  statut: string
  resultat: string
  juridiction: string
  date_ouverture: string
  date_fermeture: string | null
  clientId: string
  clientNom: string
  clientGenre: string
  clientNationalite: string
  clientAdresse: string
  clientTelephone: string
  montantHonorairesTotal: number
  deviseHonoraires: string
  avocats: DossierAvocatSummary[]
  affectations: DossierInsightAffectation[]
  paiements: DossierInsightPaiement[]
  documents: DossierInsightDocument[]
  totalPaye: number
  soldeRestant: number
}

export type AvocatHistoriqueEntry = {
  dossierId: string
  motif: string
  clientNom: string
  partie_en_cause: string
  juridiction: string
  statut: string
  resultat: string
  date_ouverture: string
  date_fermeture: string | null
  issueCategory: 'gagne' | 'perdu' | 'encours' | 'clos'
  affectations: DossierInsightAffectation[]
  derniereAffectation: string
}

export type AvocatHistoriqueSummary = {
  avocatId: string
  avocatNom: string
  specialite: string
  total: number
  enCours: number
  gagne: number
  perdu: number
  closSansIssue: number
  entries: AvocatHistoriqueEntry[]
}
