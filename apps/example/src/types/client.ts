/** Données client saisies dans le formulaire dossier. */
export type ClientFormData = {
  clientId: string | null
  nom: string
  genre: string
  nationalite: string
  adresse: string
  numTel: string
  email: string
}

/** Fiche client persistée dans Firestore (`clients`). */
export type ClientRecord = {
  id: string
  nom: string
  genre: string
  nationalite: string
  adresse: string
  numTel: string
  email?: string
  createdAt?: string
  updatedAt?: string
}

export type DossierAvocatSummary = {
  id: string
  nom: string
  role: string
}

export type ClientDossierSummary = {
  id: string
  motif: string
  statut: string
  juridiction: string
  date_ouverture: string
  date_fermeture: string | null
  resultat?: string
  avocats: DossierAvocatSummary[]
}

export type ClientWithDossiers = ClientRecord & {
  dossiers: ClientDossierSummary[]
  dossiersCount: number
}

export function emptyClientForm(): ClientFormData {
  return {
    clientId: null,
    nom: '',
    genre: '',
    nationalite: '',
    adresse: '',
    numTel: '',
    email: '',
  }
}

export function clientFormFromRecord(record: ClientRecord): ClientFormData {
  return {
    clientId: record.id,
    nom: record.nom,
    genre: record.genre,
    adresse: record.adresse,
    nationalite: record.nationalite,
    numTel: record.numTel,
    email: record.email ?? '',
  }
}

export function clientFormFromDossierFields(data: {
  clientId?: string
  clientNom?: string
  clientGenre?: string
  clientNationalite?: string
  clientAdresse?: string
  clientTelephone?: string
  clientEmail?: string
}): ClientFormData {
  return {
    clientId: data.clientId ?? null,
    nom: String(data.clientNom ?? ''),
    genre: String(data.clientGenre ?? ''),
    nationalite: String(data.clientNationalite ?? ''),
    adresse: String(data.clientAdresse ?? ''),
    numTel: String(data.clientTelephone ?? ''),
    email: String(data.clientEmail ?? ''),
  }
}
