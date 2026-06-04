import { CABINET_PRINT } from '@/constants/cabinet-print'
import type { DossierInsight } from '@/types/dossier-insight'
import { buildFicheConsultationPrintHtml } from '@/utils/fiche-consultation-document'
import { formatDateFr } from '@/utils/date'

export { buildFicheConsultationPrintHtml } from '@/utils/fiche-consultation-document'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const PRINT_PAGE_CSS = `
@page { size: A4; margin: 16mm 14mm 18mm; }
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  color: #000;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body {
  font-family: "Times New Roman", Times, "Liberation Serif", serif;
  font-size: 12pt;
  line-height: 1.45;
}
`

/** Styles pour le contenu riche (éditeur) : texte net, tableaux et images lisibles. */
export const PRINT_RICH_CONTENT_CSS = `
.print-body {
  margin: 0;
  padding: 0;
}
.print-meta {
  font-size: 10pt;
  color: #333;
  border-bottom: 1px solid #ccc;
  margin-bottom: 1.25rem;
  padding-bottom: 0.5rem;
}
.print-content {
  color: #000 !important;
  font-size: 12pt;
  line-height: 1.55;
}
.print-content * {
  color: #000 !important;
  max-width: 100%;
}
.print-content p,
.print-content li,
.print-content td,
.print-content th {
  font-size: 12pt !important;
  line-height: 1.55 !important;
}
.print-content h1 { font-size: 16pt !important; }
.print-content h2 { font-size: 14pt !important; }
.print-content h3 { font-size: 13pt !important; }
.print-content img {
  max-width: 100% !important;
  height: auto !important;
  page-break-inside: avoid;
}
.print-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75em 0;
  page-break-inside: avoid;
}
.print-content th,
.print-content td {
  border: 1px solid #000 !important;
  padding: 6px 8px !important;
  vertical-align: top;
}
.print-content strong,
.print-content b {
  font-weight: 700;
}
.print-content em,
.print-content i {
  font-style: italic;
}
.print-content ul,
.print-content ol {
  margin: 0.5em 0 0.5em 1.5em;
  padding: 0;
}
.print-content blockquote {
  border-left: 3px solid #000;
  margin: 0.75em 0;
  padding-left: 1em;
}
.print-content a {
  color: #000 !important;
  text-decoration: underline;
}
`

export const PRINT_CABINET_HEADER_CSS = `
.cabinet-header {
  border-bottom: 2px solid #000;
  margin-bottom: 1rem;
  padding-bottom: 0.65rem;
}
.cabinet-header-top {
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: center;
  gap: 8px;
}
.cabinet-header-scale {
  font-size: 26pt;
  text-align: center;
  color: #8b6914;
}
.cabinet-header-center { text-align: center; }
.cabinet-header-sigle {
  font-size: 13pt;
  font-weight: 700;
  margin: 0;
}
.cabinet-header-nom {
  font-size: 9.5pt;
  font-weight: 700;
  text-transform: uppercase;
  margin: 2px 0 0;
  line-height: 1.3;
}
.cabinet-header-addr {
  font-size: 8.5pt;
  margin: 4px 0 0;
}
.cabinet-header-row {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 9pt;
  margin-top: 6px;
}
.cabinet-doc-title {
  text-align: center;
  font-size: 13pt;
  font-weight: 700;
  text-decoration: underline;
  margin: 12px 0 16px;
  letter-spacing: 0.03em;
}
.cabinet-footer {
  margin-top: 2rem;
  padding-top: 0.5rem;
  border-top: 1px solid #999;
  font-size: 9pt;
  text-align: center;
  line-height: 1.4;
}
`

export function buildCabinetLetterheadHtml(documentTitle: string): string {
  const c = CABINET_PRINT
  return `
<header class="cabinet-header">
  <div class="cabinet-header-top">
    <div class="cabinet-header-scale" aria-hidden="true">⚖</div>
    <div class="cabinet-header-center">
      <p class="cabinet-header-sigle">${escapeHtml(c.sigle)}</p>
      <p class="cabinet-header-nom">${escapeHtml(c.nom)}</p>
      <p class="cabinet-header-addr">${escapeHtml(c.adresse)}</p>
    </div>
    <div class="cabinet-header-scale" aria-hidden="true">⚖</div>
  </div>
  <div class="cabinet-header-row">
    <span><strong>Maîtres :</strong> ${escapeHtml(c.maitres)}</span>
    <span><strong>Tél. :</strong> ${escapeHtml(c.telephones)}</span>
  </div>
</header>
<h1 class="cabinet-doc-title">${escapeHtml(documentTitle)}</h1>
`
}

export function buildCabinetFooterHtml(): string {
  const today = formatDateFr(new Date().toISOString().slice(0, 10))
  return `
<footer class="cabinet-footer">
  <p>${escapeHtml(CABINET_PRINT.ville)}, le ${escapeHtml(today)}</p>
  <p>${escapeHtml(CABINET_PRINT.adresseFooter)}</p>
</footer>
`
}

export type EditorPrintOptions = {
  title: string
  dossierMeta: string
  contenuHtml: string
  documentKind: 'note_honoraire' | 'piece_juridique'
}

export function buildEditorDocumentPrintHtml(options: EditorPrintOptions): string {
  const docTitle = options.documentKind === 'piece_juridique'
    ? 'PIÈCE JURIDIQUE'
    : 'NOTE D’HONORAIRES'

  const body = `
${buildCabinetLetterheadHtml(docTitle)}
<p class="print-meta"><strong>Dossier :</strong> ${escapeHtml(options.dossierMeta)}<br>
<strong>Document :</strong> ${escapeHtml(options.title)}</p>
<div class="print-content">${options.contenuHtml}</div>
${buildCabinetFooterHtml()}`

  return buildPrintPageHtml({
    title: options.title,
    extraCss: PRINT_RICH_CONTENT_CSS + PRINT_CABINET_HEADER_CSS,
    bodyHtml: `<div class="print-body">${body}</div>`,
  })
}

export function buildPrintPageHtml(options: {
  title: string
  bodyHtml: string
  extraCss?: string
}): string {
  const title = escapeHtml(options.title)
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    ${PRINT_PAGE_CSS}
    ${options.extraCss ?? ''}
  </style>
</head>
<body>
  ${options.bodyHtml}
</body>
</html>`
}

export const PRINT_POPUP_BLOCKED_MESSAGE =
  'Impossible d’ouvrir la fenêtre d’impression. Autorisez les pop-ups pour ce site, puis réessayez.'

/** Ouvre le document HTML dans une nouvelle fenêtre et lance l’impression. */
export function openPrintDocument(html: string): boolean {
  const printWindow = window.open('', '_blank', 'width=920,height=780')
  if (!printWindow) return false

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()

  const trigger = () => {
    printWindow.print()
  }
  if (printWindow.document.readyState === 'complete') {
    setTimeout(trigger, 250)
  } else {
    printWindow.onload = () => setTimeout(trigger, 250)
  }
  return true
}

/** Impression via nouvelle fenêtre ; alerte si pop-up bloquée. */
export function printInNewWindow(html: string): boolean {
  const ok = openPrintDocument(html)
  if (!ok) window.alert(PRINT_POPUP_BLOCKED_MESSAGE)
  return ok
}

export function openPrintFromElement(
  element: HTMLElement | null | undefined,
  options: { title: string, extraCss?: string },
): boolean {
  if (!element) return false
  const html = buildPrintPageHtml({
    title: options.title,
    bodyHtml: element.outerHTML,
    extraCss: options.extraCss ?? '',
  })
  return printInNewWindow(html)
}

export function printFicheConsultation(insight: DossierInsight): boolean {
  return printInNewWindow(buildFicheConsultationPrintHtml(insight))
}

export function printEditorDocument(options: EditorPrintOptions): boolean {
  return printInNewWindow(buildEditorDocumentPrintHtml(options))
}
