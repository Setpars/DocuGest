/**
 * Modèle domaine aligné sur le diagramme de classes UML.
 */

export type DossierStatut = 'Ouvert' | 'En cours' | 'Suspendu' | 'Clos'

export type Dossier = {
  id: string
  motif: string
  partie_en_cause: string
  date_ouverture: string
  date_fermeture: string | null
  resume_affaire: string
  statut: DossierStatut
  juridiction: string
  clientId?: string
  clientNom?: string
  clientGenre?: string
  clientNationalite?: string
  clientAdresse?: string
  clientTelephone?: string
  avocatId?: string
}

export type Client = {
  id: string
  nom: string
  genre: string
  nationalite: string
  adresse: string
  numTel: string
  dossiersCount?: number
}

export type Avocat = {
  id: string
  nom: string
  specialite: string
  adresse: string
  num_tel: string
  genre: string
}

export type Affectation = {
  id: string
  avocatId: string
  dossierId: string
  date_affectation: string
  date_fin?: string
  role: string
  statut: string
  observation?: string
}

export type AgendaType = 'rendez-vous' | 'audience'

export type AgendaEntry = {
  id: string
  dossierId?: string
  date: string
  type: AgendaType
  heure: string
  jour: string
  description: string
}
