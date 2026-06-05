import type { ClientRecord } from '@/types/client'
import type { Paiement, TypePaiement } from '@/types/paiement'
import type { AgendaEntry, AgendaType } from '@/types/agenda'
import type {
  AgendaEntity,
  AvocatEntity,
  ClientEntity,
  DossierEntity,
  DossierStatut,
  PaiementEntity,
} from '@/domain/entities'
import type { AffectationRecord } from '@/utils/affectation'
import { normalizeDevise, type Devise } from '@/utils/currency'
import { parseNaturePaiement } from '@/utils/paiement-nature'

function str(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key]
    if (value !== undefined && value !== null && value !== '') {
      return String(value)
    }
  }
  return ''
}

function num(data: Record<string, unknown>, key: string, fallback = 0): number {
  const value = Number(data[key])
  return Number.isFinite(value) ? value : fallback
}

/** Lit une clé étrangère (camelCase ou snake_case ou UML idXxx). */
export function readFk(
  data: Record<string, unknown>,
  ...keys: string[]
): string {
  return str(data, ...keys)
}

export function mapClientFromFirestore(id: string, data: Record<string, unknown>): ClientRecord {
  const entity = mapClientEntityFromFirestore(id, data)
  return {
    ...entity,
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  }
}

export function mapClientEntityFromFirestore(id: string, data: Record<string, unknown>): ClientEntity {
  return {
    id,
    nom: str(data, 'nom'),
    genre: str(data, 'genre'),
    nationalite: str(data, 'nationalite', 'nationalité'),
    adresse: str(data, 'adresse'),
    numTel: str(data, 'numTel', 'num_tel', 'telephone', 'clientTelephone'),
    email: str(data, 'email', 'courriel'),
  }
}

export type ClientFirestorePayload = {
  nom: string
  genre: string
  nationalite: string
  adresse: string
  numTel: string
  email: string
  updatedAt?: string
  createdAt?: string
}

export function clientToFirestore(form: {
  nom: string
  genre: string
  nationalite: string
  adresse: string
  numTel: string
  email?: string
  updatedAt?: string
  createdAt?: string
}): ClientFirestorePayload {
  const email = String(form.email ?? '').trim().toLowerCase()
  return {
    nom: form.nom.trim(),
    genre: form.genre.trim() || 'Non précisé',
    nationalite: form.nationalite.trim() || 'Non précisée',
    adresse: form.adresse.trim() || 'Non précisée',
    numTel: form.numTel.trim() || 'Non précisé',
    email,
    ...(form.updatedAt ? { updatedAt: form.updatedAt } : {}),
    ...(form.createdAt ? { createdAt: form.createdAt } : {}),
  }
}

export function mapDossierEntityFromFirestore(id: string, data: Record<string, unknown>): DossierEntity {
  const statut = str(data, 'statut', 'status') || 'Ouvert'
  return {
    id,
    motif: str(data, 'motif', 'titre'),
    partie_en_cause: str(data, 'partie_en_cause', 'partieEnCause'),
    date_ouverture: str(data, 'date_ouverture', 'createdAt'),
    date_fermeture: data.date_fermeture ? String(data.date_fermeture) : null,
    resume_affaire: str(data, 'resume_affaire', 'resumeAffaire'),
    statut: statut as DossierStatut,
    juridiction: str(data, 'juridiction'),
    clientId: readFk(data, 'clientId', 'idClient', 'client_id'),
    clientNom: str(data, 'clientNom', 'nom_client') || undefined,
    clientGenre: str(data, 'clientGenre') || undefined,
    clientNationalite: str(data, 'clientNationalite') || undefined,
    clientAdresse: str(data, 'clientAdresse') || undefined,
    clientTelephone: str(data, 'clientTelephone', 'client_telephone') || undefined,
    avocatId: str(data, 'avocatId') || undefined,
  }
}

export function mapPaiementFromFirestore(
  id: string,
  data: Record<string, unknown>,
): Paiement {
  const entity = mapPaiementEntityFromFirestore(id, data)
  return {
    id: entity.id,
    dossierId: entity.dossierId,
    nature_paiement: parseNaturePaiement(entity.nature_paiement ?? data.nature_paiement),
    type_paiement: (entity.type_paiement || 'Virement') as TypePaiement,
    devise: normalizeDevise(entity.devise),
    montant_a_payer: entity.montant_a_payer,
    montant_payer: entity.montant_payer,
    description: entity.description,
    date_paiement: entity.date_paiement,
  }
}

export function mapPaiementEntityFromFirestore(id: string, data: Record<string, unknown>): PaiementEntity {
  return {
    id,
    dossierId: readFk(data, 'dossierId', 'idDossier', 'dossier_id'),
    type_paiement: str(data, 'type_paiement'),
    montant_a_payer: num(data, 'montant_a_payer'),
    montant_payer: num(data, 'montant_payer'),
    description: str(data, 'description'),
    date_paiement: str(data, 'date_paiement'),
    nature_paiement: str(data, 'nature_paiement') || undefined,
    devise: str(data, 'devise') || undefined,
  }
}

export function paiementToFirestore(payload: {
  dossierId: string
  nature_paiement: string
  type_paiement: string
  devise: Devise
  montant_a_payer: number
  montant_payer: number
  description: string
  date_paiement: string
}): Record<string, unknown> {
  return {
    dossierId: payload.dossierId,
    nature_paiement: payload.nature_paiement,
    type_paiement: payload.type_paiement,
    devise: payload.devise,
    montant_a_payer: payload.montant_a_payer,
    montant_payer: payload.montant_payer,
    description: payload.description,
    date_paiement: payload.date_paiement,
  }
}

export function mapAgendaFromFirestore(
  id: string,
  data: Record<string, unknown>,
  jourFallback = '',
): AgendaEntry {
  const entity = mapAgendaEntityFromFirestore(id, data, jourFallback)
  return {
    id: entity.id,
    dossierId: entity.dossierId,
    date: entity.date,
    type: entity.type,
    heure: entity.heure,
    jour: entity.jour,
    description: entity.description,
  }
}

export function mapAgendaEntityFromFirestore(
  id: string,
  data: Record<string, unknown>,
  jourFallback = '',
): AgendaEntity {
  const date = str(data, 'date')
  return {
    id,
    dossierId: readFk(data, 'dossierId', 'idDossier', 'dossier_id'),
    date,
    type: (data.type === 'audience' ? 'audience' : 'rendez-vous') as AgendaType,
    heure: str(data, 'heure'),
    jour: str(data, 'jour') || jourFallback,
    description: str(data, 'description'),
  }
}

export function agendaToFirestore(payload: {
  dossierId: string
  date: string
  type: AgendaType
  heure: string
  jour: string
  description: string
}): Record<string, unknown> {
  return {
    dossierId: payload.dossierId,
    date: payload.date,
    type: payload.type,
    heure: payload.heure,
    jour: payload.jour,
    description: payload.description,
  }
}

export function mapAvocatFromFirestore(id: string, data: Record<string, unknown>): AvocatEntity {
  return {
    id,
    nom: str(data, 'nom'),
    specialite: str(data, 'specialite', 'spécialité'),
    adresse: str(data, 'adresse'),
    num_tel: str(data, 'num_tel', 'numTel'),
    genre: str(data, 'genre'),
  }
}

export function mapAffectationFromFirestore(id: string, data: Record<string, unknown>): AffectationRecord {
  return {
    id,
    dossierId: readFk(data, 'dossierId', 'idDossier', 'dossier_id'),
    dossier_id: readFk(data, 'dossier_id', 'idDossier', 'dossierId') || undefined,
    avocatId: readFk(data, 'avocatId', 'idAvocat', 'avocat_id'),
    avocat_id: readFk(data, 'avocat_id', 'idAvocat', 'avocatId') || undefined,
    date_affectation: str(data, 'date_affectation'),
    date_fin: data.date_fin != null && data.date_fin !== '' ? String(data.date_fin) : null,
    role: str(data, 'role'),
    statut: str(data, 'statut', 'status'),
    observation: str(data, 'observation') || undefined,
  }
}
