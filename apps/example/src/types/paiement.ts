/**
 * Modèle Paiement (Firestore: collection `paiements`)
 * - id, type_paiement, montant_a_payer, montant_payer, description, date_paiement
 * - dossierId : lien vers le dossier (plusieurs paiements possibles par dossier)
 */
import type { Devise } from '@/utils/currency'

/** Mode de règlement (moyen de paiement). */
export type TypePaiement = 'Espèces' | 'Virement' | 'Chèque' | 'Carte' | 'Mobile Money' | 'Autre'

/** Natures prédéfinies dans la liste. */
export type NaturePaiementPreset = 'Honoraires' | 'Frais de consultation' | 'Frais de visite'

/** Nature enregistrée (prédéfinie ou libellé personnalisé). */
export type NaturePaiement = NaturePaiementPreset | (string & {})

export type PaiementStatut = 'paye' | 'partiel' | 'en_attente'

export type Paiement = {
  id: string
  dossierId: string
  nature_paiement: string
  type_paiement: TypePaiement
  devise: Devise
  montant_a_payer: number
  montant_payer: number
  description: string
  date_paiement: string
}

export type PaiementDossierRef = {
  id: string
  motif: string
  clientNom: string
  juridiction: string
  avocatId?: string
  /** Montant total des honoraires fixé une fois sur le dossier */
  montantHonorairesTotal?: number
  deviseHonoraires?: Devise
}

export type PaiementFormData = {
  id: string | null
  dossierId: string
  /** Valeur du select : prédéfinie ou `Autre` */
  nature_select: string
  /** Libellé si nature_select === Autre */
  nature_paiement_autre: string
  type_paiement: TypePaiement
  devise: Devise
  /** Montant de ce versement uniquement */
  montant_payer: string
  description: string
  date_paiement: string
}
