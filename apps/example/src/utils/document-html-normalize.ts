/** Marqueur racine des notes d’honoraires générées par l’application. */
export const NOTE_HONORAIRE_DOC_MARKER = 'data-docu-note-honoraire'

const PRINT_WRAPPER_PATTERNS: RegExp[] = [
  /<header class="cabinet-header">[\s\S]*?<\/header>/gi,
  /<h1 class="cabinet-doc-title">[\s\S]*?<\/h1>/gi,
  /<p class="print-meta">[\s\S]*?<\/p>/gi,
  /<footer class="cabinet-footer">[\s\S]*?<\/footer>/gi,
]

function dedupeMarkedSections(html: string, attr: string, value: string): string {
  const pattern = new RegExp(
    `<([a-z][a-z0-9]*)[^>]*\\s${attr}=["']${value}["'][^>]*>[\\s\\S]*?<\\/\\1>`,
    'gi',
  )
  let kept = false
  return html.replace(pattern, (match) => {
    if (kept) return ''
    kept = true
    return match
  })
}

/** Supprime les en-têtes cabinet legacy (premier bloc tableau « Conseils » / « Tél. »). */
function dedupeLegacyCabinetTable(html: string): string {
  const pattern = /<table[^>]*>[\s\S]*?<strong>\s*Conseils\s*:?\s*<\/strong>[\s\S]*?<\/table>/gi
  let kept = false
  return html.replace(pattern, (match) => {
    if (kept) return ''
    kept = true
    return match
  })
}

function dedupeDocumentTitles(html: string): string {
  const pattern = /<h1[^>]*data-note-section=["']title["'][^>]*>[\s\S]*?<\/h1>/gi
  let kept = false
  return html.replace(pattern, (match) => {
    if (kept) return ''
    kept = true
    return match
  })
}

/** Nettoie une note d’honoraires : un seul en-tête cabinet, un seul titre, pas de wrapper d’impression. */
export function normalizeNoteHonoraireHtml(html: string): string {
  let next = html.trim()
  if (!next) return next

  for (const pattern of PRINT_WRAPPER_PATTERNS) {
    next = next.replace(pattern, '')
  }

  next = dedupeMarkedSections(next, 'data-note-section', 'cabinet')
  next = dedupeMarkedSections(next, 'data-note-section', 'title')
  next = dedupeMarkedSections(next, 'data-note-section', 'dossier')
  next = dedupeDocumentTitles(next)
  next = dedupeLegacyCabinetTable(next)

  return next.replace(/\n{3,}/g, '\n\n').trim()
}

/** Nettoie une pièce juridique avant impression ou enregistrement. */
export function normalizePieceJuridiqueHtml(html: string): string {
  let next = html.trim()
  if (!next) return next

  for (const pattern of PRINT_WRAPPER_PATTERNS) {
    next = next.replace(pattern, '')
  }

  return next.replace(/\n{3,}/g, '\n\n').trim()
}
