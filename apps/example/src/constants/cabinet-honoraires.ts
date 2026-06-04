/** Identité du cabinet (modèle note d’honoraires — CCEAJ Maître KABASH & Confrères). */
export const CABINET_HONORAIRES = {
  nom: import.meta.env.VITE_CABINET_NOM
    || 'CABINET CONSEIL D\'ETUDES ET ANALYSES JURIDIQUES MAITRE KABASH & CONFRERES',
  adresse: import.meta.env.VITE_CABINET_ADRESSE
    || '013/15, Avenue du Commerce, Quartier Centre Ville, Commune & Ville de Likasi',
  conseillers: import.meta.env.VITE_CABINET_CONSEILLERS || 'Yann KABASH — Kevin BIAYA',
  telephones: import.meta.env.VITE_CABINET_TELEPHONES
    || '(+243) 97 271 271 1 — (+243) 99 277 060 9',
  ville: import.meta.env.VITE_CABINET_VILLE || 'Likasi',
  prefixeReference: import.meta.env.VITE_CABINET_REF_PREFIX || 'CAB/C.C.E.A.J.MeK&C./LKS',
  signataire: import.meta.env.VITE_CABINET_SIGNATAIRE || 'Maître Yann KABASH KAWEL',
  signataireQualite: import.meta.env.VITE_CABINET_SIGNATAIRE_QUALITE || 'RDJ 0477',
  honorairesComplementairesPct: 20,
  delaiPaiementHeures: 48,
}
