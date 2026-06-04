import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import type {
  ClientDossierSummary,
  ClientFormData,
  ClientRecord,
  ClientWithDossiers,
} from '@/types/client'
import { fetchAllAffectations, fetchAvocatNameMap } from '@/services/affectation'
import { clientNamesMatch, normalizeClientName } from '@/utils/client-name'
import { resolveDossierAvocats, type AffectationRecord } from '@/utils/affectation'

export type DossierClientSnapshot = {
  clientId: string
  clientNom: string
  clientGenre: string
  clientNationalite: string
  clientAdresse: string
  clientTelephone: string
}

function mapClientDoc(id: string, data: Record<string, unknown>): ClientRecord {
  return {
    id,
    nom: String(data.nom ?? ''),
    genre: String(data.genre ?? ''),
    nationalite: String(data.nationalite ?? ''),
    adresse: String(data.adresse ?? ''),
    numTel: String(data.numTel ?? data.telephone ?? ''),
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  }
}

function mapDossierSummary(
  id: string,
  data: Record<string, unknown>,
  affectations: AffectationRecord[] = [],
  avocatNames: Record<string, string> = {},
): ClientDossierSummary {
  const legacyAvocatId = data.avocatId ? String(data.avocatId) : undefined
  return {
    id,
    motif: String(data.motif ?? data.titre ?? ''),
    statut: String(data.statut ?? 'Ouvert'),
    juridiction: String(data.juridiction ?? ''),
    date_ouverture: String(data.date_ouverture ?? data.createdAt ?? ''),
    date_fermeture: data.date_fermeture ? String(data.date_fermeture) : null,
    resultat: String(data.resultat ?? ''),
    avocats: resolveDossierAvocats(id, affectations, avocatNames, legacyAvocatId),
  }
}

function clientPayloadFromForm(form: ClientFormData, now: string) {
  return {
    nom: form.nom.trim(),
    genre: form.genre.trim() || 'Non précisé',
    nationalite: form.nationalite.trim() || 'Non précisée',
    adresse: form.adresse.trim() || 'Non précisée',
    numTel: form.numTel.trim() || 'Non précisé',
    updatedAt: now,
  }
}

export async function fetchAllClients(firestore: Firestore): Promise<ClientRecord[]> {
  const snap = await getDocs(collection(firestore, 'clients'))
  return snap.docs.map((item) => mapClientDoc(item.id, item.data() as Record<string, unknown>))
}

export async function fetchAllDossiersRaw(firestore: Firestore) {
  const snap = await getDocs(collection(firestore, 'dossiers'))
  return snap.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Record<string, unknown>),
  }))
}

/** Registre clients : collection `clients` + noms issus des dossiers (cohérence / anti-doublon). */
export function buildClientRegistry(
  clients: ClientRecord[],
  dossiers: Record<string, unknown>[],
): ClientRecord[] {
  const byId = new Map<string, ClientRecord>()
  const byName = new Map<string, ClientRecord>()

  for (const client of clients) {
    byId.set(client.id, client)
    byName.set(normalizeClientName(client.nom), client)
  }

  for (const dossier of dossiers) {
    const nom = String(dossier.clientNom ?? dossier.nom_client ?? '').trim()
    if (!nom) continue

    const clientId = dossier.clientId ? String(dossier.clientId) : ''
    if (clientId && byId.has(clientId)) continue

    const key = normalizeClientName(nom)
    if (byName.has(key)) continue

    const inferred: ClientRecord = {
      id: clientId || `dossier:${key}`,
      nom,
      genre: String(dossier.clientGenre ?? ''),
      nationalite: String(dossier.clientNationalite ?? ''),
      adresse: String(dossier.clientAdresse ?? ''),
      numTel: String(dossier.clientTelephone ?? dossier.telephone ?? ''),
    }
    byName.set(key, inferred)
    if (clientId) byId.set(clientId, inferred)
  }

  const merged = new Map<string, ClientRecord>()
  for (const client of clients) merged.set(client.id, client)
  for (const client of byName.values()) {
    if (!merged.has(client.id)) merged.set(client.id, client)
  }
  return [...merged.values()].sort((a, b) =>
    a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }),
  )
}

export function searchClientsInRegistry(
  registry: ClientRecord[],
  query: string,
  limit = 8,
): ClientRecord[] {
  const q = normalizeClientName(query)
  if (q.length < 2) return []

  return registry
    .filter((client) => normalizeClientName(client.nom).includes(q))
    .slice(0, limit)
}

export function findExactClientInRegistry(
  registry: ClientRecord[],
  nom: string,
): ClientRecord | undefined {
  return registry.find((client) => clientNamesMatch(client.nom, nom))
}

export async function getClientById(
  firestore: Firestore,
  clientId: string,
): Promise<ClientRecord | null> {
  if (!clientId || clientId.startsWith('dossier:')) return null
  const snap = await getDoc(doc(firestore, 'clients', clientId))
  if (!snap.exists()) return null
  return mapClientDoc(snap.id, snap.data() as Record<string, unknown>)
}

export function filterDossiersForClient(
  dossiers: Record<string, unknown>[],
  client: ClientRecord,
  affectations: AffectationRecord[] = [],
  avocatNames: Record<string, string> = {},
): ClientDossierSummary[] {
  return dossiers
    .filter((d) => {
      const dossierClientId = d.clientId ? String(d.clientId) : ''
      if (dossierClientId && dossierClientId === client.id) return true
      const nom = String(d.clientNom ?? d.nom_client ?? '')
      return clientNamesMatch(nom, client.nom)
    })
    .map((d) => mapDossierSummary(String(d.id), d, affectations, avocatNames))
    .sort((a, b) => String(b.date_ouverture).localeCompare(String(a.date_ouverture)))
}

export async function loadClientWithDossiers(
  firestore: Firestore,
  clientId: string,
): Promise<ClientWithDossiers | null> {
  const [client, dossiersRaw, affectations, avocatNames] = await Promise.all([
    getClientById(firestore, clientId),
    fetchAllDossiersRaw(firestore),
    fetchAllAffectations(firestore),
    fetchAvocatNameMap(firestore),
  ])
  if (!client) return null

  const dossiers = filterDossiersForClient(dossiersRaw, client, affectations, avocatNames)
  return {
    ...client,
    dossiers,
    dossiersCount: dossiers.length,
  }
}

/**
 * Crée ou met à jour le client lié à un dossier (sans doublon par nom).
 */
export async function syncClientForDossier(
  firestore: Firestore,
  form: ClientFormData,
  registry: ClientRecord[],
): Promise<DossierClientSnapshot | null> {
  const nom = form.nom.trim()
  if (!nom) return null

  const now = new Date().toISOString()
  const payload = clientPayloadFromForm(form, now)
  const clientsCol = collection(firestore, 'clients')

  let clientId = form.clientId?.trim() || ''
  if (clientId.startsWith('dossier:')) clientId = ''

  if (clientId) {
    await updateDoc(doc(firestore, 'clients', clientId), payload)
    return {
      clientId,
      clientNom: payload.nom,
      clientGenre: payload.genre,
      clientNationalite: payload.nationalite,
      clientAdresse: payload.adresse,
      clientTelephone: payload.numTel,
    }
  }

  const existing =
    findExactClientInRegistry(registry, nom)
    ?? (await fetchAllClients(firestore)).find((c) => clientNamesMatch(c.nom, nom))

  if (existing && !existing.id.startsWith('dossier:')) {
    await updateDoc(doc(firestore, 'clients', existing.id), payload)
    return {
      clientId: existing.id,
      clientNom: payload.nom,
      clientGenre: payload.genre,
      clientNationalite: payload.nationalite,
      clientAdresse: payload.adresse,
      clientTelephone: payload.numTel,
    }
  }

  const ref = await addDoc(clientsCol, {
    ...payload,
    createdAt: now,
  })

  return {
    clientId: ref.id,
    clientNom: payload.nom,
    clientGenre: payload.genre,
    clientNationalite: payload.nationalite,
    clientAdresse: payload.adresse,
    clientTelephone: payload.numTel,
  }
}
