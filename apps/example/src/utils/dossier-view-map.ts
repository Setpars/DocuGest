import type { DossierRawRecord } from '@/services/client-dossier'
import { normalizeDevise, type Devise } from '@/utils/currency'

export type DossierStatut = 'Ouvert' | 'En cours' | 'Suspendu' | 'Clos'

export type DossierListView = {
  id: string
  motif: string
  partie_en_cause: string
  date_ouverture: string
  date_fermeture: string | null
  resume_affaire: string
  statut: DossierStatut
  juridiction: string
  clientId?: string
  clientNom: string
  clientGenre?: string
  clientNationalite?: string
  clientAdresse?: string
  clientTelephone: string
  montantHonorairesTotal: number
  noteHonoraireId?: string
  deviseHonoraires: Devise
  avocatId?: string
  resultat?: string
}

export function mapDossierDocFromRaw(raw: DossierRawRecord): DossierListView {
  const data = raw as Record<string, unknown>
  return {
    id: raw.id,
    motif: String(data.motif ?? data.titre ?? ''),
    partie_en_cause: String(data.partie_en_cause ?? data.reference ?? ''),
    date_ouverture: String(data.date_ouverture ?? data.createdAt ?? ''),
    date_fermeture: data.date_fermeture ? String(data.date_fermeture) : null,
    resume_affaire: String(data.resume_affaire ?? data.description ?? ''),
    statut: (String(data.statut ?? 'Ouvert') as DossierStatut) || 'Ouvert',
    juridiction: String(data.juridiction ?? ''),
    clientId: data.clientId ? String(data.clientId) : undefined,
    clientNom: String(data.clientNom ?? data.nom_client ?? data.client ?? ''),
    clientGenre: String(data.clientGenre ?? ''),
    clientNationalite: String(data.clientNationalite ?? ''),
    clientAdresse: String(data.clientAdresse ?? ''),
    clientTelephone: String(data.clientTelephone ?? data.telephone ?? ''),
    montantHonorairesTotal: Number(data.montantHonorairesTotal ?? 0),
    deviseHonoraires: normalizeDevise(data.deviseHonoraires),
    noteHonoraireId: data.noteHonoraireId ? String(data.noteHonoraireId) : undefined,
    avocatId: String(data.avocatId ?? ''),
    resultat: String(data.resultat ?? ''),
  }
}

export function dossierPickerFromRaw(raw: DossierRawRecord) {
  const view = mapDossierDocFromRaw(raw)
  return {
    id: view.id,
    motif: view.motif,
    clientNom: view.clientNom,
  }
}
