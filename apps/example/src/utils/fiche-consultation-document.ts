import { CABINET_PRINT } from '@/constants/cabinet-print'
import type { DossierInsight } from '@/types/dossier-insight'
import { formatDateFr } from '@/utils/date'
import ficheConsultationStyles from '@/assets/styles/fiche-consultation.css?raw'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const PRINT_PAGE_CSS = `
@page { size: A4; margin: 16mm 14mm 18mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; color: #000; background: #fff; }
body {
  font-family: "Times New Roman", Times, "Liberation Serif", serif;
  font-size: 12pt;
  line-height: 1.45;
}
`

export type FicheConsultationPiece = {
  titre: string
  date: string
}

export type FicheConsultationModel = {
  clientNom: string
  clientAdresse: string
  clientTelephone: string
  resumeAffaire: string
  partieEnCause: string
  numeroDossier: string
  juridiction: string
  phase: string
  avocatsEnCharge: string
  dateOuverture: string
  observations: string
  pieces: FicheConsultationPiece[]
  dateLettre: string
}

export const FICHE_CONSULTATION_CSS = ficheConsultationStyles

export function splitCabinetList(value: string): string[] {
  return value
    .split(/[—–\-,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function displayValue(value?: string | null): string {
  const text = String(value ?? '').trim()
  return text || ''
}

function multilineHtml(value?: string | null): string {
  const text = String(value ?? '').trim()
  if (!text) return '&nbsp;'
  return escapeHtml(text).replace(/\n/g, '<br>')
}

function formatDossierReference(dossierId: string): string {
  const clean = dossierId.replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (clean.length >= 8) return clean.slice(0, 8)
  return clean || dossierId.slice(0, 12)
}

function collectObservations(insight: DossierInsight): string {
  const lines: string[] = []
  for (const aff of insight.affectations) {
    const obs = aff.observation?.trim()
    if (obs) lines.push(`${aff.avocatNom} : ${obs}`)
  }
  if (insight.statut === 'Clos' && insight.resultat) {
    lines.push(`Issue : ${insight.resultat}`)
  }
  return lines.join('\n')
}

export function getFicheConsultationModel(insight: DossierInsight): FicheConsultationModel {
  const pieces = insight.documents
    .filter((doc) => doc.type === 'piece_juridique')
    .map((doc) => ({
      titre: doc.titre,
      date: formatDateFr(doc.updatedAt || doc.createdAt),
    }))

  return {
    clientNom: displayValue(insight.clientNom),
    clientAdresse: displayValue(insight.clientAdresse),
    clientTelephone: displayValue(insight.clientTelephone),
    resumeAffaire: displayValue(insight.resume_affaire),
    partieEnCause: displayValue(insight.partie_en_cause),
    numeroDossier: formatDossierReference(insight.id),
    juridiction: displayValue(insight.juridiction),
    phase: displayValue(insight.statut),
    avocatsEnCharge: insight.avocats.map((a) => a.nom).join(', '),
    dateOuverture: formatDateFr(insight.date_ouverture),
    observations: collectObservations(insight),
    pieces,
    dateLettre: formatDateFr(new Date().toISOString().slice(0, 10)),
  }
}

function fieldBlock(num: number, label: string, lineHtml: string, multi = false) {
  return `
<div class="fiche-field">
  <div class="fiche-field-head"><span class="fiche-field-num">${num}.</span>${escapeHtml(label)}</div>
  <div class="fiche-line${multi ? ' fiche-line--multi' : ''}">${lineHtml}</div>
</div>`
}

function buildPiecesAnnexeHtml(pieces: FicheConsultationPiece[]): string {
  if (pieces.length === 0) {
    return `
<section class="fiche-annexe">
  <h2 class="fiche-annexe__title">Pièces juridiques au dossier</h2>
  <p class="fiche-pieces-empty">Aucune pièce enregistrée pour ce dossier.</p>
</section>`
  }

  const rows = pieces.map((piece, index) => `
    <tr>
      <td style="width:8%">${index + 1}</td>
      <td>${escapeHtml(piece.titre)}</td>
      <td style="width:22%">${escapeHtml(piece.date)}</td>
    </tr>`).join('')

  return `
<section class="fiche-annexe">
  <h2 class="fiche-annexe__title">Pièces juridiques au dossier</h2>
  <table class="fiche-pieces-table">
    <thead>
      <tr>
        <th>N°</th>
        <th>Désignation de la pièce</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>`
}

export function buildFicheConsultationPrintHtml(insight: DossierInsight): string {
  const c = CABINET_PRINT
  const m = getFicheConsultationModel(insight)
  const maitres = splitCabinetList(c.maitres)
  const telephones = splitCabinetList(c.telephones)

  const maitresHtml = maitres.length
    ? maitres.map((name) => `<p class="fiche-contact__item">- ${escapeHtml(name)}</p>`).join('')
    : `<p class="fiche-contact__item">${escapeHtml(c.maitres)}</p>`

  const telHtml = telephones.length
    ? telephones.map((tel) => `<p class="fiche-contact__item">${escapeHtml(tel)}</p>`).join('')
    : `<p class="fiche-contact__item">${escapeHtml(c.telephones)}</p>`

  const lineOrNbsp = (value: string) => (value ? escapeHtml(value) : '&nbsp;')

  const body = `
<article class="fiche-doc">
  <header class="fiche-header">
    <div class="fiche-scale" aria-hidden="true">⚖</div>
    <div class="fiche-brand">
      <p class="fiche-sigle">${escapeHtml(c.sigle)}</p>
      <p class="fiche-nom">${escapeHtml(c.nom)}</p>
      <p class="fiche-adresse">${escapeHtml(c.adresse)}</p>
    </div>
    <div class="fiche-scale" aria-hidden="true">⚖</div>
  </header>

  <div class="fiche-contact">
    <div class="fiche-contact__block">
      <span class="fiche-contact__label">Maîtres :</span>
      ${maitresHtml}
    </div>
    <div class="fiche-contact__block fiche-contact__block--right">
      <span class="fiche-contact__label">Tél. :</span>
      ${telHtml}
    </div>
  </div>

  <h1 class="fiche-title">${escapeHtml(c.titreFicheConsultation)}</h1>

  ${fieldBlock(1, 'Identité du client :', lineOrNbsp(m.clientNom))}
  <div class="fiche-subrow">
    <span class="fiche-subrow__item"><span class="fiche-subrow__label">Adresse :</span> ${lineOrNbsp(m.clientAdresse) || '………………………………'}</span>
    <span class="fiche-subrow__item"><span class="fiche-subrow__label">N° Tél :</span> ${lineOrNbsp(m.clientTelephone) || '……………………'}</span>
  </div>

  ${fieldBlock(2, 'Résumé de l’affaire :', multilineHtml(m.resumeAffaire), true)}

  ${fieldBlock(3, 'Contre :', lineOrNbsp(m.partieEnCause))}
  <div class="fiche-subrow">
    <span class="fiche-subrow__item"><span class="fiche-subrow__label">Adresse :</span> ………………………………</span>
    <span class="fiche-subrow__item"><span class="fiche-subrow__label">N° Tél :</span> …………………………</span>
  </div>

  ${fieldBlock(4, 'N° du dossier :', lineOrNbsp(m.numeroDossier))}

  ${fieldBlock(5, 'Juridiction ou office :', lineOrNbsp(m.juridiction))}
  <div class="fiche-subrow">
    <span class="fiche-subrow__item"><span class="fiche-subrow__label">Phase :</span> ${lineOrNbsp(m.phase) || '…………'}</span>
    ${m.avocatsEnCharge ? `<span class="fiche-subrow__item"><span class="fiche-subrow__label">Avocat(s) :</span> ${escapeHtml(m.avocatsEnCharge)}</span>` : ''}
  </div>

  ${fieldBlock(6, 'Date d’ouverture du dossier :', lineOrNbsp(m.dateOuverture))}

  ${fieldBlock(7, 'Observations :', multilineHtml(m.observations), true)}

  ${buildPiecesAnnexeHtml(m.pieces)}

  <footer class="fiche-footer">
    <p class="fiche-footer-date">${escapeHtml(c.ville)}, le ${escapeHtml(m.dateLettre)}</p>
    <p class="fiche-footer-addr">${escapeHtml(c.adresseFooter)}</p>
  </footer>
</article>`

  const title = escapeHtml(`Fiche de consultation — ${insight.motif}`)
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    ${PRINT_PAGE_CSS}
    ${FICHE_CONSULTATION_CSS}
  </style>
</head>
<body>${body}</body>
</html>`
}
