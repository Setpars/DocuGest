import type { PieceJuridiqueKind } from '@/types/dossier-document'

export const PIECE_KIND_META: Record<PieceJuridiqueKind, { label: string, description: string }> = {
  assignation: {
    label: 'Assignation',
    description: 'Citation à comparaître et exposé des faits',
  },
  conclusions: {
    label: 'Conclusions',
    description: 'Moyens de droit et de fait',
  },
  requete: {
    label: 'Requête / Mémoire',
    description: 'Exposé introductif de la demande',
  },
  pv: {
    label: 'Procès-verbal',
    description: 'PV d’audience ou de constat',
  },
  lettre: {
    label: 'Lettre au greffe / partie',
    description: 'Courrier formel lié au dossier',
  },
  libre: {
    label: 'Document libre',
    description: 'Pièce personnalisée',
  },
}

function dateFr() {
  return new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function buildPieceTemplate(
  kind: PieceJuridiqueKind,
  ctx: { motif: string, client: string, partie: string, juridiction: string },
): { titre: string, html: string } {
  const lieu = ctx.juridiction || '…'
  const client = ctx.client || '…'
  const dossier = ctx.motif || '…'
  const partie = ctx.partie || '…'
  const date = dateFr()

  const header = `<p style="text-align:right">${lieu}, le ${date}</p>
<p><br></p>
<p><strong>Dossier :</strong> ${dossier}</p>
<p><strong>Client :</strong> ${client}</p>
<p><strong>Partie adverse :</strong> ${partie}</p>
<p><br></p>`

  switch (kind) {
    case 'assignation':
      return {
        titre: `Assignation — ${dossier}`,
        html: `${header}
<p style="text-align:center"><strong>ASSIGNATION</strong></p>
<p><br></p>
<p>Madame, Monsieur le Juge,</p>
<p><br></p>
<p>La société / personne <strong>${client}</strong>, représentée par le cabinet, a l'honneur de vous exposer ce qui suit :</p>
<p><br></p>
<p><strong>I. FAITS</strong></p>
<p>…</p>
<p><br></p>
<p><strong>II. DROIT</strong></p>
<p>…</p>
<p><br></p>
<p><strong>III. PAR CES MOTIFS</strong></p>
<p>Il est demandé au Tribunal de …</p>
<p><br></p>
<p>Veuillez agréer, Madame, Monsieur le Juge, l'expression de notre haute considération.</p>
<p><br></p>
<p><strong>Pour le cabinet</strong></p>
<p>Signature</p>`,
      }
    case 'conclusions':
      return {
        titre: `Conclusions — ${dossier}`,
        html: `${header}
<p style="text-align:center"><strong>CONCLUSIONS</strong></p>
<p><br></p>
<p><strong>EN LA CAUSE :</strong></p>
<p>Client : ${client}</p>
<p>Contre : ${partie}</p>
<p><br></p>
<p><strong>I. RAPPEL DES FAITS</strong></p>
<p>…</p>
<p><br></p>
<p><strong>II. DISCUSSION</strong></p>
<p>…</p>
<p><br></p>
<p><strong>III. PAR CES MOTIFS</strong></p>
<p>Il plaise au Tribunal …</p>`,
      }
    case 'requete':
      return {
        titre: `Requête — ${dossier}`,
        html: `${header}
<p style="text-align:center"><strong>REQUÊTE INTRODUCTIVE</strong></p>
<p><br></p>
<p><strong>EXPOSÉ</strong></p>
<p>…</p>
<p><br></p>
<p><strong>DEMANDES</strong></p>
<p>Il est demandé au Tribunal de bien vouloir :</p>
<ol>
  <li>…</li>
</ol>`,
      }
    case 'pv':
      return {
        titre: `Procès-verbal — ${dossier}`,
        html: `${header}
<p style="text-align:center"><strong>PROCÈS-VERBAL</strong></p>
<p><br></p>
<p>L'an ${new Date().getFullYear()}, le ${date},</p>
<p><br></p>
<p>Je soussigné(e), …, certifie avoir …</p>
<p><br></p>
<p><strong>Observations :</strong></p>
<p>…</p>
<p><br></p>
<p>Fait à ${lieu}, le ${date}</p>
<p>Signature</p>`,
      }
    case 'lettre':
      return {
        titre: `Lettre — ${dossier}`,
        html: `${header}
<p><strong>Objet :</strong> Dossier ${dossier}</p>
<p><br></p>
<p>Madame, Monsieur,</p>
<p><br></p>
<p>Par la présente, nous avons l'honneur de …</p>
<p><br></p>
<p>Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>
<p><br></p>
<p><strong>Le secrétariat du cabinet</strong></p>`,
      }
    default:
      return {
        titre: `Pièce — ${dossier}`,
        html: `${header}
<p style="text-align:center"><strong>PIÈCE JURIDIQUE</strong></p>
<p><br></p>
<p>…</p>`,
      }
  }
}
