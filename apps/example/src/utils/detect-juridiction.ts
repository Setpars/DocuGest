/**
 * Détection heuristique de la juridiction à partir de l’intitulé / motif d’une affaire (contexte RDC).
 */

export type JuridictionDetectionConfidence = 'high' | 'medium' | 'low'

export type JuridictionDetectionResult = {
  juridiction: string
  confidence: JuridictionDetectionConfidence
  reason: string
}

export type DetectJuridictionOptions = {
  /** Juridictions déjà utilisées dans le cabinet (priorité en cas de correspondance partielle). */
  knownJuridictions?: string[]
}

const VILLES_RDC = [
  'likasi',
  'lubumbashi',
  'kolwezi',
  'kinshasa',
  'kisangani',
  'goma',
  'bukavu',
  'matadi',
  'mbuji-mayi',
  'mbujimayi',
  'kananga',
  'kisantu',
  'kipushi',
  'fungurume',
  'kalemie',
  'bunia',
  'beni',
  'butembo',
  'uvira',
  'kindu',
] as const

function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCaseWords(segment: string): string {
  return segment
    .trim()
    .split(/([\s-]+)/)
    .map((part) => {
      if (/^[\s-]+$/.test(part)) return part
      if (part.length <= 2 && part === part.toUpperCase()) return part
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join('')
}

function formatCityName(slug: string): string {
  if (slug === 'mbujimayi' || slug === 'mbuji-mayi') return 'Mbuji-Mayi'
  return titleCaseWords(slug)
}

function findCityInText(normalized: string): string | null {
  for (const ville of VILLES_RDC) {
    const re = new RegExp(`\\b${ville.replace('-', '[\\s-]?')}\\b`, 'i')
    if (re.test(normalized)) return formatCityName(ville)
  }
  return null
}

type PatternRule = {
  re: RegExp
  confidence: JuridictionDetectionConfidence
  format: (match: RegExpMatchArray) => string
  reason: string
}

const EXPLICIT_RULES: PatternRule[] = [
  {
    re: /\b(tribunal\s+de\s+commerce\s+(?:de|du|d[''])\s*([a-zàâäéèêëïîôùûüç0-9][a-zàâäéèêëïîôùûüç0-9\s\-']{1,40}))/i,
    confidence: 'high',
    format: (m) => titleCaseWords(m[1]!.trim()),
    reason: 'Mention explicite d’un tribunal de commerce',
  },
  {
    re: /\b(tribunal\s+de\s+grande\s+instance\s+(?:de|du|d[''])\s*([a-zàâäéèêëïîôùûüç0-9][a-zàâäéèêëïîôùûüç0-9\s\-']{1,40}))/i,
    confidence: 'high',
    format: (m) => titleCaseWords(m[1]!.trim()),
    reason: 'Mention explicite d’un tribunal de grande instance',
  },
  {
    re: /\b(tribunal\s+de\s+paix\s+(?:de|du|d[''])\s*([a-zàâäéèêëïîôùûüç0-9][a-zàâäéèêëïîôùûüç0-9\s\-']{1,40}))/i,
    confidence: 'high',
    format: (m) => titleCaseWords(m[1]!.trim()),
    reason: 'Mention explicite d’un tribunal de paix',
  },
  {
    re: /\b(cour\s+d['']appel\s+(?:de|du|d[''])\s*([a-zàâäéèêëïîôùûüç0-9][a-zàâäéèêëïîôùûüç0-9\s\-']{1,40}))/i,
    confidence: 'high',
    format: (m) => titleCaseWords(m[1]!.trim()),
    reason: 'Mention explicite d’une cour d’appel',
  },
  {
    re: /\b(parquet\s+(?:général\s+)?(?:de|du|d[''])\s*([a-zàâäéèêëïîôùûüç0-9][a-zàâäéèêëïîôùûüç0-9\s\-']{1,40}))/i,
    confidence: 'high',
    format: (m) => titleCaseWords(m[1]!.trim()),
    reason: 'Mention explicite d’un parquet',
  },
  {
    re: /\b(devant\s+(?:le\s+)?)(tribunal[^,;.]{5,60})/i,
    confidence: 'medium',
    format: (m) => titleCaseWords(m[2]!.trim()),
    reason: 'Formule « devant le tribunal… »',
  },
]

function detectFromAbbreviations(normalized: string): JuridictionDetectionResult | null {
  const tc = normalized.match(/\b(?:tc|t\.c\.)\s*(?:de\s+)?([a-zàâäéèêëïîôùûüç\-']{2,30})\b/i)
  if (tc) {
    const city = titleCaseWords(tc[1]!)
    return {
      juridiction: `Tribunal de commerce de ${city}`,
      confidence: 'medium',
      reason: 'Abréviation TC + ville',
    }
  }

  const tgi = normalized.match(/\b(?:tgi|t\.g\.i\.)\s*(?:de\s+)?([a-zàâäéèêëïîôùûüç\-']{2,30})\b/i)
  if (tgi) {
    const city = titleCaseWords(tgi[1]!)
    return {
      juridiction: `Tribunal de grande instance de ${city}`,
      confidence: 'medium',
      reason: 'Abréviation TGI + ville',
    }
  }

  return null
}

function detectFromKeywordsAndCity(normalized: string): JuridictionDetectionResult | null {
  const city = findCityInText(normalized)
  if (!city) return null

  const commerce = /\b(commerce|commercial|recouvrement|créance|creance|sarl|sa\b|société|societe)\b/i.test(normalized)
  const penal = /\b(pénal|penal|criminel|parquet|détention|detention|inculpé|inculpe)\b/i.test(normalized)
  const civil = /\b(civil|divorce|succession|bail|loyer|famille|filiation)\b/i.test(normalized)
  const hasTribunal = /\b(tribunal|cour|juridiction|audience|instance)\b/i.test(normalized)

  if (!hasTribunal && !commerce && !penal && !civil) return null

  if (commerce) {
    return {
      juridiction: `Tribunal de commerce de ${city}`,
      confidence: 'low',
      reason: `Ville (${city}) + termes commerciaux`,
    }
  }
  if (penal) {
    return {
      juridiction: `Tribunal de grande instance de ${city}`,
      confidence: 'low',
      reason: `Ville (${city}) + termes pénaux`,
    }
  }
  if (civil || hasTribunal) {
    return {
      juridiction: `Tribunal de grande instance de ${city}`,
      confidence: 'low',
      reason: `Ville (${city}) + contexte judiciaire`,
    }
  }

  return null
}

function detectFromKnownList(
  normalized: string,
  known: string[],
): JuridictionDetectionResult | null {
  let best: { juridiction: string, score: number } | null = null

  for (const raw of known) {
    const j = raw.trim()
    if (!j) continue
    const nj = normalizeForMatch(j)
    if (nj.length < 8) continue

    if (normalized.includes(nj)) {
      return {
        juridiction: j,
        confidence: 'high',
        reason: 'Correspondance avec une juridiction déjà enregistrée',
      }
    }

    const words = nj.split(/\s+/).filter((w) => w.length > 3)
    if (words.length === 0) continue
    const hits = words.filter((w) => normalized.includes(w)).length
    const score = hits / words.length
    if (score >= 0.6 && (!best || score > best.score)) {
      best = { juridiction: j, score }
    }
  }

  if (best && best.score >= 0.75) {
    return {
      juridiction: best.juridiction,
      confidence: 'medium',
      reason: 'Proche d’une juridiction existante dans le cabinet',
    }
  }

  return null
}

/**
 * Analyse le motif et propose une juridiction si possible.
 */
export function detectJuridictionFromMotif(
  motif: string,
  options: DetectJuridictionOptions = {},
): JuridictionDetectionResult | null {
  const text = motif.trim()
  if (text.length < 4) return null

  const normalized = normalizeForMatch(text)

  for (const rule of EXPLICIT_RULES) {
    const match = text.match(rule.re)
    if (match) {
      return {
        juridiction: rule.format(match),
        confidence: rule.confidence,
        reason: rule.reason,
      }
    }
  }

  const abbr = detectFromAbbreviations(normalized)
  if (abbr) return abbr

  const known = options.knownJuridictions ?? []
  if (known.length > 0) {
    const fromKnown = detectFromKnownList(normalized, known)
    if (fromKnown) return fromKnown
  }

  return detectFromKeywordsAndCity(normalized)
}
