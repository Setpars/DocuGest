/**
 * Correction orthographique française (locale + option LanguageTool).
 */

export type SpellIssue = {
  offset: number
  length: number
  original: string
  replacements: string[]
  message: string
  source: 'local' | 'languagetool'
}

/** Fautes fréquentes (bureaux juridiques, RDC). Clé = forme erronée normalisée. */
const LOCAL_CORRECTIONS: Record<string, string> = {
  tribunale: 'tribunal',
  tribunaux: 'tribunaux',
  juridicion: 'juridiction',
  juridictions: 'juridictions',
  jurdiction: 'juridiction',
  honoraire: 'honoraires',
  honoraires: 'honoraires',
  creance: 'créance',
  creances: 'créances',
  recuperation: 'récupération',
  recouvrement: 'recouvrement',
  assignation: 'assignation',
  assignasion: 'assignation',
  conclusions: 'conclusions',
  conclusion: 'conclusion',
  requete: 'requête',
  requet: 'requête',
  procedure: 'procédure',
  procedures: 'procédures',
  proces: 'procès',
  audience: 'audience',
  audiences: 'audiences',
  avocat: 'avocat',
  avocats: 'avocats',
  client: 'client',
  clients: 'clients',
  dossier: 'dossier',
  dossiers: 'dossiers',
  affaire: 'affaire',
  affaires: 'affaires',
  litige: 'litige',
  litiges: 'litiges',
  contrat: 'contrat',
  contrats: 'contrats',
  societe: 'société',
  societes: 'sociétés',
  entreprise: 'entreprise',
  lubumbashi: 'Lubumbashi',
  likasi: 'Likasi',
  kolwezi: 'Kolwezi',
  kinshasa: 'Kinshasa',
  developement: 'développement',
  developpement: 'développement',
  evenement: 'événement',
  evenements: 'événements',
  reference: 'référence',
  references: 'références',
  facture: 'facture',
  factures: 'factures',
  paiement: 'paiement',
  paiements: 'paiements',
  versement: 'versement',
  versements: 'versements',
  temoignage: 'témoignage',
  temoignages: 'témoignages',
  temoin: 'témoin',
  temoins: 'témoins',
  condamnation: 'condamnation',
  appelant: 'appelant',
  intimé: 'intimé',
  intime: 'intimé',
  defendeur: 'défendeur',
  demandeur: 'demandeur',
  plaidoirie: 'plaidoirie',
  expertise: 'expertise',
  expertises: 'expertises',
}

function normalizeToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function findLocalIssues(text: string): SpellIssue[] {
  const issues: SpellIssue[] = []
  const wordRe = /[A-Za-zÀ-ÿ]+(?:'[A-Za-zÀ-ÿ]+)?/g
  let match: RegExpExecArray | null

  while ((match = wordRe.exec(text)) !== null) {
    const original = match[0]
    const key = normalizeToken(original)
    const replacement = LOCAL_CORRECTIONS[key]
    if (!replacement || replacement === original) continue
    if (replacement.toLowerCase() === original.toLowerCase()) continue

    const displayReplacement = preserveCase(original, replacement)
    issues.push({
      offset: match.index,
      length: original.length,
      original,
      replacements: [displayReplacement],
      message: `Orthographe : « ${displayReplacement} » suggéré`,
      source: 'local',
    })
  }

  return issues
}

function preserveCase(source: string, target: string): string {
  if (source === source.toUpperCase()) return target.toUpperCase()
  if (source[0] === source[0]?.toUpperCase()) {
    return target.charAt(0).toUpperCase() + target.slice(1)
  }
  return target
}

function findStyleIssues(text: string): SpellIssue[] {
  const issues: SpellIssue[] = []
  const doubleSpace = /\s{2,}/g
  let m: RegExpExecArray | null
  while ((m = doubleSpace.exec(text)) !== null) {
    issues.push({
      offset: m.index,
      length: m[0].length,
      original: m[0],
      replacements: [' '],
      message: 'Espaces multiples',
      source: 'local',
    })
  }
  return issues
}

function dedupeIssues(issues: SpellIssue[]): SpellIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.offset}:${issue.length}:${issue.replacements[0]}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => a.offset - b.offset)
}

async function fetchLanguageToolIssues(text: string): Promise<SpellIssue[]> {
  if (!text.trim() || text.length > 8000) return []

  try {
    const body = new URLSearchParams({
      text,
      language: 'fr',
      enabledOnly: 'false',
    })
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) return []

    const data = await res.json() as {
      matches?: {
        offset: number
        length: number
        message: string
        replacements?: { value: string }[]
      }[]
    }

    return (data.matches ?? [])
      .filter((m) => (m.replacements?.length ?? 0) > 0)
      .map((m) => ({
        offset: m.offset,
        length: m.length,
        original: text.slice(m.offset, m.offset + m.length),
        replacements: (m.replacements ?? []).slice(0, 3).map((r) => r.value),
        message: m.message,
        source: 'languagetool' as const,
      }))
  } catch {
    return []
  }
}

export type SpellCheckOptions = {
  /** Tente LanguageTool (nécessite Internet). Défaut : true. */
  online?: boolean
}

/**
 * Analyse un texte et retourne les problèmes détectés (ordre croissant d’offset).
 */
export async function checkFrenchSpelling(
  text: string,
  options: SpellCheckOptions = {},
): Promise<SpellIssue[]> {
  const online = options.online !== false
  const local = dedupeIssues([
    ...findLocalIssues(text),
    ...findStyleIssues(text),
  ])

  if (!online) return local

  const remote = await fetchLanguageToolIssues(text)
  return dedupeIssues([...local, ...remote])
}

/** Applique une correction à la position indiquée. */
export function applySpellCorrection(
  text: string,
  issue: SpellIssue,
  replacement: string,
): string {
  return text.slice(0, issue.offset) + replacement + text.slice(issue.offset + issue.length)
}

/** Applique toutes les corrections (première suggestion par problème, de la fin vers le début). */
export function applyAllSpellCorrections(text: string, issues: SpellIssue[]): string {
  let result = text
  const sorted = [...issues].sort((a, b) => b.offset - a.offset)
  for (const issue of sorted) {
    const rep = issue.replacements[0]
    if (!rep) continue
    result = applySpellCorrection(result, issue, rep)
  }
  return result
}
