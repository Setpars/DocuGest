import { CABINET_HONORAIRES } from '@/constants/cabinet-honoraires'
import { clientNamesMatch } from '@/utils/client-name'
import { normalizeDevise, type Devise } from '@/utils/currency'
import { montantUsdEnLettres } from '@/utils/montant-en-lettres'

export type LigneHonoraire = {
  designation: string
  montant: number
}

export type NoteHonoraireDossierInfo = {
  motif: string
  clientNom: string
  clientGenre?: string
  partieEnCause?: string
  juridiction?: string
  resumeAffaire?: string
  referenceAffaire?: string
  objet?: string
  /** Surcharge manuelle ; par défaut = client du dossier (payeur des honoraires). */
  destinataire?: string
  /** Client issu de la collection `clients` (prioritaire sur le snapshot dossier). */
  clientFromRegistry?: { nom: string, genre?: string } | null
  montantTotal?: number
  devise?: string
  lignes?: LigneHonoraire[]
}

export type NoteHonoraireClientResolved = {
  nom: string
  genre?: string
}

/** Payeur / destinataire = toujours le client, jamais la partie adverse. */
export function resolveClientForNoteHonoraire(input: {
  clientNom?: string
  clientGenre?: string
  partieEnCause?: string
  clientFromRegistry?: { nom: string, genre?: string } | null
}): NoteHonoraireClientResolved {
  const partie = input.partieEnCause?.trim() || ''
  const fromRegistry = input.clientFromRegistry?.nom?.trim() || ''
  const fromDossier = input.clientNom?.trim() || ''

  let nom = fromRegistry || fromDossier
  let genre = input.clientFromRegistry?.genre || input.clientGenre

  if (nom && partie && clientNamesMatch(nom, partie)) {
    nom = fromRegistry && !clientNamesMatch(fromRegistry, partie) ? fromRegistry : ''
    if (!nom && fromDossier && !clientNamesMatch(fromDossier, partie)) {
      nom = fromDossier
    }
  }

  if (!nom && fromRegistry) {
    nom = fromRegistry
    genre = input.clientFromRegistry?.genre || genre
  }

  return { nom, genre }
}

/** Civilité pour l’en-tête « A … » — le client, pas la partie adverse. */
export function formatDestinataireNoteHonoraire(
  clientNom: string,
  options?: { genre?: string, explicit?: string, partieEnCause?: string },
): string {
  let brut = (options?.explicit || clientNom || '').trim()
  const partie = options?.partieEnCause?.trim()
  if (partie && brut && clientNamesMatch(brut, partie)) {
    brut = clientNom.trim()
  }
  if (!brut) return 'Monsieur, Madame,'

  if (/^(Monsieur|Madame|M\.|Mme|Me)\b/i.test(brut)) return brut

  if (/\b(SARL|SA|SPRL|SAS|GIE|ASBL|S\.A\.|S\.À\s*R\.?L|SNC)\b/i.test(brut)) {
    return brut
  }

  const g = (options?.genre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const prefix = g.includes('fem') ? 'Madame' : 'Monsieur'

  if (/^(directeur|ministre|maire|gouverneur|president|procureur|conservateur)\b/i.test(brut)) {
    return `Monsieur le ${brut}`
  }

  return `${prefix} ${brut}`
}

function buildPreambleDefault(
  clientNom: string,
  partieEnCause: string | undefined,
  refAffaire: string,
  juridiction: string,
) {
  const client = clientNom.trim()
  const partie = partieEnCause?.trim()
  let concernant = ''
  if (client && partie) {
    concernant = ` concernant notre client ${client}, dans le litige qui l’oppose à ${partie}`
  } else if (client) {
    concernant = ` concernant notre client ${client}`
  } else if (partie) {
    concernant = ` dans le cadre du dossier « ${refAffaire} » (partie adverse : ${partie})`
  }

  return `Conformément à la décision n° CNO/BIS/88 du 11 juillet 1988 modifiée par la décision n° CNO/4/90 du 22 décembre 1990, et suite au dossier « ${refAffaire} »${concernant}${juridiction !== '…' ? ` devant ${juridiction}` : ''}, nous avons l’honneur de vous adresser la présente note d’honoraires à notre client.`
}

/** Met à jour le destinataire dans une note déjà rédigée (ligne « A … » et formule de politesse). */
export function patchDestinataireInNoteHtml(html: string, destinataire: string): string {
  let next = html.replace(
    /(<strong><u>\s*A\s*)([^<]*)(<\/u><\/strong>)/i,
    `$1${destinataire}$3`,
  )
  next = next.replace(
    /(Veuillez agréer,\s*)([^,]+)(,\s*l’expression de notre considération distinguée)/i,
    `$1${destinataire}$3`,
  )
  return next
}

export type NoteHonoraireCabinetInfo = Partial<typeof CABINET_HONORAIRES>

/** Postes types (cabinet CCEAJ — Likasi), en USD. */
export const LIGNES_HONORAIRES_MODELE: LigneHonoraire[] = [
  { designation: 'Etude du dossier au cabinet', montant: 300 },
  { designation: 'Comparution à l\'audience', montant: 100 },
  { designation: 'Conclusions', montant: 650 },
  { designation: 'Maximum', montant: 7000 },
]

function formatMontant(devise: Devise, value: number) {
  if (devise === 'CDF') {
    return `${new Intl.NumberFormat('fr-CD', { maximumFractionDigits: 0 }).format(value)} FC`
  }
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} USD`
}

function montantEnLettres(devise: Devise, value: number) {
  if (devise === 'USD') return montantUsdEnLettres(value)
  const n = new Intl.NumberFormat('fr-CD', { maximumFractionDigits: 0 }).format(value)
  return `${n} francs congolais`
}

function formatDateLettre(date = new Date()) {
  const raw = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const parts = raw.split(' ')
  if (parts.length >= 2) {
    parts[1] = parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
  }
  return parts.join(' ')
}

function buildReference(seq = 8) {
  const year = new Date().getFullYear()
  return `${String(seq).padStart(3, '0')}/${CABINET_HONORAIRES.prefixeReference}/${year}`
}

function ligneHonoraireRow(designation: string, montant: number, devise: Devise) {
  const chiffres = formatMontant(devise, montant)
  const lettres = montantEnLettres(devise, montant)
  return `<tr>
    <td style="padding:8px 10px;border:1px solid #222;vertical-align:top">${designation}</td>
    <td style="padding:8px 10px;border:1px solid #222;text-align:right;white-space:nowrap">${chiffres}<br><span style="font-size:10pt;font-style:italic">(${lettres})</span></td>
  </tr>`
}

function resolveLignes(dossier: NoteHonoraireDossierInfo, _devise: Devise): LigneHonoraire[] {
  const base = dossier.lignes?.length ? dossier.lignes : [...LIGNES_HONORAIRES_MODELE]
  const sum = base.reduce((s, l) => s + l.montant, 0)
  const target = dossier.montantTotal && dossier.montantTotal > 0 ? dossier.montantTotal : sum

  if (target === sum || sum === 0) return base

  const ratio = target / sum
  const scaled = base.map((l, i) => ({
    designation: l.designation,
    montant: i === base.length - 1
      ? target - base.slice(0, -1).reduce((s, x) => s + Math.round(x.montant * ratio), 0)
      : Math.round(l.montant * ratio),
  }))
  return scaled
}

/** Modèle aligné sur la note d’honoraires du cabinet (CCEAJ Maître KABASH & Confrères — Likasi). */
export function buildNoteHonoraireHtml(
  dossier: NoteHonoraireDossierInfo,
  cabinetOverrides: NoteHonoraireCabinetInfo = {},
): string {
  const cabinet = { ...CABINET_HONORAIRES, ...cabinetOverrides }
  const devise = normalizeDevise(dossier.devise ?? 'USD')
  const lignes = resolveLignes(dossier, devise)
  const total = lignes.reduce((s, l) => s + l.montant, 0)

  const ref = buildReference()
  const ville = cabinet.ville
  const dateLettre = formatDateLettre()
  const objet = dossier.objet || 'Notes d\'honoraires pour intervention judiciaire'
  const client = resolveClientForNoteHonoraire({
    clientNom: dossier.clientNom,
    clientGenre: dossier.clientGenre,
    partieEnCause: dossier.partieEnCause,
    clientFromRegistry: dossier.clientFromRegistry,
  })
  const destinataire = formatDestinataireNoteHonoraire(client.nom, {
    explicit: dossier.destinataire,
    genre: client.genre,
    partieEnCause: dossier.partieEnCause,
  })
  const refAffaire = dossier.referenceAffaire || dossier.motif || '…'
  const juridiction = dossier.juridiction || '…'

  const lignesHtml = lignes.map(l => ligneHonoraireRow(l.designation, l.montant, devise)).join('')
  const totalChiffres = formatMontant(devise, total)
  const totalLettres = montantEnLettres(devise, total)

  const preamble = dossier.resumeAffaire?.trim()
    || buildPreambleDefault(client.nom, dossier.partieEnCause, refAffaire, juridiction)

  return `<div style="font-family:'Times New Roman',Times,serif;font-size:11pt;line-height:1.45;color:#111;max-width:210mm;margin:0 auto">

<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
  <tr>
    <td style="width:72%;vertical-align:top;padding-right:12px">
      <p style="margin:0 0 6px;font-size:11pt;font-weight:bold;text-transform:uppercase;line-height:1.35">${cabinet.nom}</p>
      <p style="margin:0 0 4px">${cabinet.adresse}</p>
      <p style="margin:0 0 4px"><strong>Conseils :</strong> ${cabinet.conseillers}</p>
      <p style="margin:0"><strong>Tél. :</strong> ${cabinet.telephones}</p>
    </td>
    <td style="width:28%;vertical-align:top;text-align:center">
      <div style="border:1px solid #999;border-radius:8px;padding:16px 8px;font-size:28pt;color:#b8860b" title="Logo cabinet">⚖</div>
    </td>
  </tr>
</table>

<p style="margin:12px 0 4px"><strong>N° réf. :</strong> ${ref}</p>
<p style="margin:0 0 12px;text-align:right">${ville}, le ${dateLettre}</p>
<p style="margin:8px 0"><strong>OBJET :</strong> ${objet}</p>
<p style="margin:16px 0;text-align:right"><strong><u>A ${destinataire}</u></strong></p>

<p style="margin:16px 0;text-align:justify">${preamble}</p>

<p style="margin:12px 0;text-align:justify">
Les honoraires et frais se décomposent comme suit (Article 9 du chapitre III de la décision en matière civile et commerciale) :
</p>

<table style="width:100%;border-collapse:collapse;margin:16px 0">
  <thead>
    <tr style="background:#f5f5f5">
      <th style="padding:8px 10px;border:1px solid #222;text-align:left">Désignation</th>
      <th style="padding:8px 10px;border:1px solid #222;text-align:right;width:42%">Montant</th>
    </tr>
  </thead>
  <tbody>
    ${lignesHtml}
    <tr>
      <td style="padding:10px;border:1px solid #222"><strong>TOTAL FRAIS</strong></td>
      <td style="padding:10px;border:1px solid #222;text-align:right"><strong>${totalChiffres}</strong><br><strong style="font-size:10pt">(${totalLettres})</strong></td>
    </tr>
  </tbody>
</table>

<p style="margin:14px 0;text-align:justify"><strong>N.B. :</strong></p>
<ul style="margin:8px 0 16px 20px;text-align:justify">
  <li>Honoraires complémentaires fixés à <strong>${cabinet.honorairesComplementairesPct} %</strong> des sommes recouvrées ou encaissées par le client.</li>
  <li>Le règlement constitue une obligation du client ; nous vous prions de bien vouloir nous acquitter dans un délai de <strong>${cabinet.delaiPaiementHeures} heures</strong> à compter de la réception de la présente. À défaut, nous nous verrons contraints d’engager les voies d’exécution forcée, la présente valant <em>mise en demeure</em>.</li>
</ul>

<p style="margin:20px 0;text-align:justify">
Veuillez agréer, ${destinataire}, l’expression de notre considération distinguée.
</p>

<p style="margin:40px 0 8px;text-align:right">
<strong>POUR LE CABINET,</strong><br>
L’un de ses Conseils<br>
<strong><u>${cabinet.signataire}</u></strong><br>
${cabinet.signataireQualite}
</p>
<p style="margin:24px 0 0;text-align:right;font-size:10pt;color:#666">[Cachet et signature]</p>

</div>`
}
