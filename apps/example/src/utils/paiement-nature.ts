import {
  NATURE_PAIEMENT_AUTRE_SELECT,
  NATURE_PAIEMENT_LABELS,
  NATURE_PAIEMENT_OPTIONS,
} from '@/constants/paiement'
import type { NaturePaiementPreset, Paiement } from '@/types/paiement'

export function isNaturePaiementPreset(value: string): value is NaturePaiementPreset {
  return (NATURE_PAIEMENT_OPTIONS as string[]).includes(value)
}

/** Valeur normalisée stockée en base. */
export function parseNaturePaiement(value: unknown): string {
  const raw = String(value ?? '').trim()
  return raw || 'Honoraires'
}

export function getNaturePaiementLabel(value: unknown): string {
  const raw = parseNaturePaiement(value)
  if (isNaturePaiementPreset(raw)) {
    return NATURE_PAIEMENT_LABELS[raw]
  }
  return raw
}

export function isPaiementHonoraires(
  paiement: Pick<Paiement, 'nature_paiement'>,
): boolean {
  return parseNaturePaiement(paiement.nature_paiement) === 'Honoraires'
}

export function filterPaiementsByNature(
  paiements: Paiement[],
  nature: string,
): Paiement[] {
  return paiements.filter((p) => parseNaturePaiement(p.nature_paiement) === nature)
}

export function getHonorairesPaiements(paiements: Paiement[]): Paiement[] {
  return filterPaiementsByNature(paiements, 'Honoraires')
}

export function natureToFormFields(stored: unknown): {
  nature_select: string
  nature_paiement_autre: string
} {
  const raw = parseNaturePaiement(stored)
  if (isNaturePaiementPreset(raw)) {
    return { nature_select: raw, nature_paiement_autre: '' }
  }
  return { nature_select: NATURE_PAIEMENT_AUTRE_SELECT, nature_paiement_autre: raw }
}

export function natureFromFormFields(
  natureSelect: string,
  natureAutre: string,
): string {
  if (natureSelect === NATURE_PAIEMENT_AUTRE_SELECT) {
    return natureAutre.trim()
  }
  return natureSelect
}

export function isFormNatureAutre(natureSelect: string): boolean {
  return natureSelect === NATURE_PAIEMENT_AUTRE_SELECT
}

/** Options de filtre : prédéfinies + natures personnalisées déjà utilisées. */
export function collectNatureFilterOptions(paiements: Paiement[]): string[] {
  const set = new Set<string>(NATURE_PAIEMENT_OPTIONS)
  for (const p of paiements) {
    const raw = parseNaturePaiement(p.nature_paiement)
    if (raw) set.add(raw)
  }
  return [...set].sort((a, b) => {
    const aPreset = isNaturePaiementPreset(a)
    const bPreset = isNaturePaiementPreset(b)
    if (aPreset && !bPreset) return -1
    if (!aPreset && bPreset) return 1
    return a.localeCompare(b, 'fr')
  })
}
