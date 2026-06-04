import type { NaturePaiementPreset, TypePaiement } from '@/types/paiement'

/** Mode de règlement (espèces, virement, …). */
export const MODE_PAIEMENT_OPTIONS: TypePaiement[] = [
  'Espèces',
  'Virement',
  'Chèque',
  'Carte',
  'Mobile Money',
  'Autre',
]

/** Valeur du select pour saisir une nature hors liste. */
export const NATURE_PAIEMENT_AUTRE_SELECT = 'Autre'

/** Objet du paiement encaissé (liste prédéfinie). */
export const NATURE_PAIEMENT_OPTIONS: NaturePaiementPreset[] = [
  'Honoraires',
  'Frais de consultation',
  'Frais de visite',
]

export const NATURE_PAIEMENT_LABELS: Record<NaturePaiementPreset, string> = {
  Honoraires: 'Honoraires',
  'Frais de consultation': 'Frais de consultation',
  'Frais de visite': 'Frais de visite',
}
