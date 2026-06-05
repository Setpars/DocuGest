import type { Devise } from '@/utils/currency'
import type { Paiement, PaiementDossierRef, PaiementStatut } from '@/types/paiement'
import { getHonorairesPaiements } from '@/utils/paiement-nature'

/** Dossier avec au moins un montant d’honoraires ou un paiement enregistré. */
export function hasDossierFinancialData(
  montantHonorairesTotal: number | undefined,
  paiementsCount: number,
): boolean {
  return (Number(montantHonorairesTotal) || 0) > 0 || paiementsCount > 0
}

export type DossierPaiementSummary = {
  montantDu: number
  montantVerse: number
  reste: number
  devise: Devise
  statut: PaiementStatut
}

export function getDossierMontantDu(
  dossier: PaiementDossierRef | undefined,
  paiementsDossier: Paiement[],
): number {
  if (dossier?.montantHonorairesTotal && dossier.montantHonorairesTotal > 0) {
    return dossier.montantHonorairesTotal
  }
  const legacy = paiementsDossier.map(p => Number(p.montant_a_payer) || 0)
  return legacy.length ? Math.max(...legacy) : 0
}

export function getDossierPaiementSummary(
  dossier: PaiementDossierRef | undefined,
  paiementsDossier: Paiement[],
): DossierPaiementSummary {
  const honoraires = getHonorairesPaiements(paiementsDossier)
  const montantDu = getDossierMontantDu(dossier, honoraires)
  const montantVerse = honoraires.reduce((sum, p) => sum + (Number(p.montant_payer) || 0), 0)
  const reste = Math.max(0, montantDu - montantVerse)
  const devise = dossier?.deviseHonoraires ?? paiementsDossier[0]?.devise ?? 'CDF'

  let statut: PaiementStatut = 'en_attente'
  if (montantDu > 0 && montantVerse >= montantDu) statut = 'paye'
  else if (montantVerse > 0) statut = 'partiel'

  return { montantDu, montantVerse, reste, devise, statut }
}
