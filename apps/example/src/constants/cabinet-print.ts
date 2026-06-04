/** Identité visuelle du cabinet pour les impressions officielles (fiche, pièces, notes). */
export const CABINET_PRINT = {
  sigle: import.meta.env.VITE_CABINET_SIGLE || 'EMK&C',
  nom: import.meta.env.VITE_CABINET_NOM_COURT
    || 'ETUDES MAITRE KABASH & CONFRERES',
  nomLong: import.meta.env.VITE_CABINET_NOM
    || 'CABINET CONSEIL D\'ETUDES ET ANALYSES JURIDIQUES MAITRE KABASH & CONFRERES',
  adresse: import.meta.env.VITE_CABINET_ADRESSE
    || '13/15, Avenue du Commerce, Quartier Centre-Ville, Commune & Ville de Likasi',
  adresseFooter: import.meta.env.VITE_CABINET_ADRESSE_FOOTER
    || '13/15, Avenue du Commerce, Quartier Centre-Ville, Commune & Ville de Likasi, Référence Bâtiment SONAL RDC',
  maitres: import.meta.env.VITE_CABINET_MAITRES || 'Yann KABASH — Kevin BIAYA',
  telephones: import.meta.env.VITE_CABINET_TELEPHONES
    || '(+243) 97 271 271 1 — (+243) 99 277 060 9',
  ville: import.meta.env.VITE_CABINET_VILLE || 'Likasi',
  titreFicheConsultation: import.meta.env.VITE_CABINET_TITRE_FICHE || 'LAW OFFICE CONSULTING',
}
