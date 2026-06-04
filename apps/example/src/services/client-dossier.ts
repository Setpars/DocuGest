import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import { COLLECTIONS } from '@/constants/collections'
import { clientToFirestore, mapClientFromFirestore } from '@/domain/mappers'
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

export async function fetchAllClients(firestore: Firestore): Promise<ClientRecord[]> {
  const snap = await getDocs(collection(firestore, COLLECTIONS.client))
  return snap.docs.map((item) => mapClientFromFirestore(item.id, item.data() as Record<string, unknown>))
}

export async function fetchAllDossiersRaw(firestore: Firestore) {
  const snap = await getDocs(collection(firestore, COLLECTIONS.dossier))
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
  const snap = await getDoc(doc(firestore, COLLECTIONS.client, clientId))
  if (!snap.exists()) return null
  return mapClientFromFirestore(snap.id, snap.data() as Record<string, unknown>)
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
  const payload = clientToFirestore({ ...form, updatedAt: now })
  const clientsCol = collection(firestore, COLLECTIONS.client)

  let clientId = form.clientId?.trim() || ''
  if (clientId.startsWith('dossier:')) clientId = ''

  if (clientId) {
    await updateDoc(doc(firestore, COLLECTIONS.client, clientId), payload)
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
    await updateDoc(doc(firestore, COLLECTIONS.client, existing.id), payload)
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

function dossierClientPatch(snapshot: DossierClientSnapshot) {
  return {
    clientId: snapshot.clientId,
    clientNom: snapshot.clientNom,
    clientGenre: snapshot.clientGenre,
    clientNationalite: snapshot.clientNationalite,
    clientAdresse: snapshot.clientAdresse,
    clientTelephone: snapshot.clientTelephone,
  }
}

/**
 * Met à jour la fiche client et propage les champs sur tous les dossiers liés.
 */
export async function updateClientById(
  firestore: Firestore,
  clientId: string,
  form: ClientFormData,
  registry: ClientRecord[],
): Promise<DossierClientSnapshot> {
  const nom = form.nom.trim()
  if (!nom) throw new Error('Le nom du client est obligatoire.')
  if (!clientId || clientId.startsWith('dossier:')) {
    throw new Error('Ce client ne peut pas être modifié ici (fiche issue d’un dossier uniquement).')
  }

  const duplicate = findExactClientInRegistry(registry, nom)
  if (duplicate && duplicate.id !== clientId) {
    throw new Error('Un autre client enregistré porte déjà ce nom.')
  }

  const now = new Date().toISOString()
  const payload = clientToFirestore({ ...form, updatedAt: now })
  await updateDoc(doc(firestore, COLLECTIONS.client, clientId), payload)

  const snapshot: DossierClientSnapshot = {
    clientId,
    clientNom: payload.nom,
    clientGenre: payload.genre,
    clientNationalite: payload.nationalite,
    clientAdresse: payload.adresse,
    clientTelephone: payload.numTel,
  }

  const client = await getClientById(firestore, clientId)
  const dossiersRaw = await fetchAllDossiersRaw(firestore)
  const linkedIds = new Set<string>()

  if (client) {
    for (const dossier of filterDossiersForClient(dossiersRaw, client)) {
      linkedIds.add(dossier.id)
    }
  }

  for (const dossier of dossiersRaw) {
    if (String(dossier.clientId ?? '') === clientId) {
      linkedIds.add(String(dossier.id))
    }
  }

  const patch = dossierClientPatch(snapshot)
  await Promise.all(
    [...linkedIds].map((dossierId) =>
      updateDoc(doc(firestore, COLLECTIONS.dossier, dossierId), patch),
    ),
  )

  return snapshot
}
