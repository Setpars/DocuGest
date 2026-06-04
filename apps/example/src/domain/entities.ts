/**
 * Entités métier (diagramme de classes).
 * L’identifiant document Firestore est exposé comme `id` (équivalent idClient, idDossier, …).
 */

export type DossierStatut = 'Ouvert' | 'En cours' | 'Suspendu' | 'Clos'

/** Client(idClient, nom, genre, nationalité, adresse, numTel) */
export type ClientEntity = {
  id: string
  nom: string
  genre: string
  nationalite: string
  adresse: string
  numTel: string
}

/** Dossier(…, #idClient) */
export type DossierEntity = {
  id: string
  motif: string
  partie_en_cause: string
  date_ouverture: string
  date_fermeture: string | null
  resume_affaire: string
  statut: DossierStatut
  juridiction: string
  clientId: string
  /** Champs dénormalisés (affichage / recherche) */
  clientNom?: string
  clientGenre?: string
  clientNationalite?: string
  clientAdresse?: string
  clientTelephone?: string
  avocatId?: string
}

/** Paiement(…, #idDossier) — extensions métier : nature, montant_payer, devise */
export type PaiementEntity = {
  id: string
  dossierId: string
  type_paiement: string
  montant_a_payer: number
  montant_payer: number
  description: string
  date_paiement: string
  nature_paiement?: string
  devise?: string
}

export type AgendaType = 'rendez-vous' | 'audience'

/** Agenda(…, #idDossier) */
export type AgendaEntity = {
  id: string
  dossierId: string
  date: string
  type: AgendaType
  heure: string
  jour: string
  description: string
}

/** Avocat(idAvocat, nom, specialite, adresse, num_tel, genre) */
export type AvocatEntity = {
  id: string
  nom: string
  specialite: string
  adresse: string
  num_tel: string
  genre: string
}

/** Affectation(#idDossier, #idAvocat, …) */
export type AffectationEntity = {
  id: string
  dossierId: string
  avocatId: string
  date_affectation: string
  date_fin?: string | null
  role: string
  statut: string
  observation?: string
}
