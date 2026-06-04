/** Devises supportées dans l’application (RDC / international). */
export type Devise = 'USD' | 'CDF'

export const DEVISE_OPTIONS: { value: Devise, label: string }[] = [
  { value: 'USD', label: 'Dollar américain (USD)' },
  { value: 'CDF', label: 'Franc congolais (CDF)' },
]

export function normalizeDevise(value: unknown): Devise {
  return value === 'CDF' ? 'CDF' : 'USD'
}

/** Formate un montant selon la devise (USD ou franc congolais). */
export function formatMoney(value: number, devise: Devise = 'USD'): string {
  if (devise === 'CDF') {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: 'CDF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0)
  }

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

/** Affiche les deux devises sur une même ligne (résumés, tableaux de bord). */
export function formatMoneyPair(usd: number, cdf: number): string {
  return `${formatMoney(usd, 'USD')} · ${formatMoney(cdf, 'CDF')}`
}

export type MontantsParDevise = {
  USD: number
  CDF: number
}

export function emptyMontantsParDevise(): MontantsParDevise {
  return { USD: 0, CDF: 0 }
}

/** Additionne un champ numérique des paiements séparé par devise. */
export function sumMontantsParDevise<T extends { devise?: Devise }>(
  items: T[],
  pick: (item: T) => number,
): MontantsParDevise {
  return items.reduce((acc, item) => {
    const devise = normalizeDevise(item.devise)
    acc[devise] += pick(item) || 0
    return acc
  }, emptyMontantsParDevise())
}
