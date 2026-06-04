export type DossierResultatIssue = 'gagné' | 'perdu'

export function normalizeResultatKey(value?: string): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function parseDossierResultat(value?: string): DossierResultatIssue | null {
  const s = normalizeResultatKey(value)
  if (!s) return null
  if (s.includes('gagn') || s === 'gagne') return 'gagné'
  if (s.includes('perd') || s === 'perdu') return 'perdu'
  return null
}

export function resultatIssueLabel(value?: string): string {
  const issue = parseDossierResultat(value)
  if (issue === 'gagné') return 'Gagnée'
  if (issue === 'perdu') return 'Perdue'
  return ''
}

export type DossierIssueCategory = 'gagne' | 'perdu' | 'encours' | 'clos'

export function classifyDossierIssue(statut?: string, resultat?: string): DossierIssueCategory {
  const issue = parseDossierResultat(resultat)
  if (issue === 'gagné') return 'gagne'
  if (issue === 'perdu') return 'perdu'
  if (String(statut ?? '').toLowerCase() === 'clos') return 'clos'
  return 'encours'
}

export const ISSUE_CATEGORY_META: Record<
  DossierIssueCategory,
  { label: string, badgeClass: string }
> = {
  gagne: {
    label: 'Gagnée',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  perdu: {
    label: 'Perdue',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  },
  encours: {
    label: 'En cours',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  clos: {
    label: 'Clos',
    badgeClass: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
}

export const RESULTAT_ISSUE_META: Record<
  DossierResultatIssue,
  { label: string, badgeClass: string }
> = {
  'gagné': {
    label: 'Gagnée',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  perdu: {
    label: 'Perdue',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  },
}
