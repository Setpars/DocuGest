import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
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
import {
  criteriaFromForm,
  findClientsByEmail,
  findClientsByName,
  findClientsByPhone,
  findExistingClientInList,
  isPersistedClientRecord,
} from '@/utils/client-identity'
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

export type DossierRawRecord = Record<string, unknown> & { id: string }

export async function fetchAllDossiersRaw(firestore: Firestore): Promise<DossierRawRecord[]> {
  const snap = await getDocs(collection(firestore, COLLECTIONS.dossier))
  return snap.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Record<string, unknown>),
  }))
}

/** Relation 1 client → N dossiers : requête indexée par `clientId`. */
export async function fetchDossiersByClientId(
  firestore: Firestore,
  clientId: string,
): Promise<DossierRawRecord[]> {
  if (!clientId || clientId.startsWith('dossier:')) return []
  const snap = await getDocs(
    query(
      collection(firestore, COLLECTIONS.dossier),
      where('clientId', '==', clientId),
    ),
  )
  return snap.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Record<string, unknown>),
  }))
}

function isPersistedClientId(clientId: string): boolean {
  return Boolean(clientId) && !clientId.startsWith('dossier:')
}

function dossierBelongsToClient(
  dossier: Record<string, unknown>,
  client: ClientRecord,
): boolean {
  const dossierClientId = dossier.clientId ? String(dossier.clientId) : ''
  const dossierNom = String(dossier.clientNom ?? dossier.nom_client ?? '')

  if (isPersistedClientId(client.id)) {
    if (dossierClientId) {
      return dossierClientId === client.id
    }
    return Boolean(dossierNom) && clientNamesMatch(dossierNom, client.nom)
  }

  return !dossierClientId && Boolean(dossierNom) && clientNamesMatch(dossierNom, client.nom)
}

/** Fusionne dossiers liés par `clientId` et dossiers legacy (sans clientId, même nom). */
export async function resolveDossiersRawForClient(
  firestore: Firestore,
  client: ClientRecord,
): Promise<DossierRawRecord[]> {
  const byId = new Map<string, DossierRawRecord>()

  if (isPersistedClientId(client.id)) {
    const linked = await fetchDossiersByClientId(firestore, client.id)
    for (const item of linked) {
      byId.set(item.id, item)
    }
  }

  const allRaw = await fetchAllDossiersRaw(firestore)
  for (const item of allRaw) {
    if (byId.has(item.id)) continue
    if (dossierBelongsToClient(item, client)) {
      byId.set(item.id, item)
    }
  }

  return [...byId.values()]
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
  const matches = findClientsByName(registry, nom)
  return matches.length === 1 ? matches[0] : undefined
}

function snapshotFromClient(client: ClientRecord): DossierClientSnapshot {
  return {
    clientId: client.id,
    clientNom: client.nom,
    clientGenre: client.genre,
    clientNationalite: client.nationalite,
    clientAdresse: client.adresse,
    clientTelephone: client.numTel,
  }
}

function mergeClientPools(registry: ClientRecord[], persisted: ClientRecord[]): ClientRecord[] {
  const map = new Map<string, ClientRecord>()
  for (const client of [...registry, ...persisted]) {
    if (isPersistedClientRecord(client)) {
      map.set(client.id, client)
    }
  }
  return [...map.values()]
}

export async function fetchClientByEmail(
  firestore: Firestore,
  email: string,
): Promise<ClientRecord | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) return null
  const snap = await getDocs(
    query(
      collection(firestore, COLLECTIONS.client),
      where('email', '==', normalized),
    ),
  )
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  return mapClientFromFirestore(docSnap.id, docSnap.data() as Record<string, unknown>)
}

export async function resolveExistingClientForDossier(
  firestore: Firestore,
  form: ClientFormData,
  registry: ClientRecord[],
): Promise<ClientRecord | null> {
  let clientId = form.clientId?.trim() || ''
  if (clientId.startsWith('dossier:')) clientId = ''

  if (clientId) {
    const byId = await getClientById(firestore, clientId)
    if (byId) return byId
  }

  const persisted = await fetchAllClients(firestore)
  const pool = mergeClientPools(registry, persisted)

  const fromRegistry = findExistingClientInList(pool, criteriaFromForm(form))
  if (fromRegistry) return fromRegistry

  const email = form.email?.trim()
  if (email) {
    const fromEmail = await fetchClientByEmail(firestore, email)
    if (fromEmail) return fromEmail
  }

  return null
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
    .filter((d) => dossierBelongsToClient(d, client))
    .map((d) => mapDossierSummary(String(d.id), d, affectations, avocatNames))
    .sort((a, b) => String(b.date_ouverture).localeCompare(String(a.date_ouverture)))
}

export function countDossiersForClient(
  dossiers: Record<string, unknown>[],
  client: ClientRecord,
): number {
  return dossiers.filter((d) => dossierBelongsToClient(d, client)).length
}

export async function loadClientWithDossiers(
  firestore: Firestore,
  clientId: string,
): Promise<ClientWithDossiers | null> {
  const [client, affectations, avocatNames] = await Promise.all([
    getClientById(firestore, clientId),
    fetchAllAffectations(firestore),
    fetchAvocatNameMap(firestore).catch(() => ({} as Record<string, string>)),
  ])
  if (!client) return null

  const dossiersRaw = await resolveDossiersRawForClient(firestore, client)
  const dossiers = filterDossiersForClient(dossiersRaw, client, affectations, avocatNames)
  return {
    ...client,
    dossiers,
    dossiersCount: dossiers.length,
  }
}

/**
 * Résout le client pour un dossier :
 * - client existant → liaison seule (pas d’écrasement de la fiche client) ;
 * - nouveau client → création Firestore puis liaison via `clientId`.
 */
export async function syncClientForDossier(
  firestore: Firestore,
  form: ClientFormData,
  registry: ClientRecord[],
): Promise<DossierClientSnapshot | null> {
  const nom = form.nom.trim()
  if (!nom) return null

  const existing = await resolveExistingClientForDossier(firestore, form, registry)
  if (existing) {
    return snapshotFromClient(existing)
  }

  const persisted = await fetchAllClients(firestore)
  const pool = mergeClientPools(registry, persisted)

  if (form.email?.trim()) {
    const emailDupes = findClientsByEmail(pool, form.email)
    if (emailDupes.length > 0) {
      throw new Error('Un client est déjà enregistré avec cette adresse e-mail.')
    }
  }

  if (form.numTel?.trim()) {
    const phoneDupes = findClientsByPhone(pool, form.numTel)
    if (phoneDupes.length > 0) {
      throw new Error('Un client est déjà enregistré avec ce numéro de téléphone.')
    }
  }

  const now = new Date().toISOString()
  const payload = clientToFirestore({ ...form, updatedAt: now })
  const ref = await addDoc(collection(firestore, COLLECTIONS.client), {
    ...payload,
    createdAt: now,
  })

  return snapshotFromClient({
    id: ref.id,
    nom: payload.nom,
    genre: payload.genre,
    nationalite: payload.nationalite,
    adresse: payload.adresse,
    numTel: payload.numTel,
    email: payload.email,
  })
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

  const pool = mergeClientPools(registry, await fetchAllClients(firestore))
  const duplicateName = findClientsByName(pool, nom).find((item) => item.id !== clientId)
  if (duplicateName) {
    throw new Error('Un autre client enregistré porte déjà ce nom.')
  }
  if (form.email?.trim()) {
    const duplicateEmail = findClientsByEmail(pool, form.email).find((item) => item.id !== clientId)
    if (duplicateEmail) {
      throw new Error('Un autre client utilise déjà cette adresse e-mail.')
    }
  }
  if (form.numTel?.trim()) {
    const duplicatePhone = findClientsByPhone(pool, form.numTel).find((item) => item.id !== clientId)
    if (duplicatePhone) {
      throw new Error('Un autre client utilise déjà ce numéro de téléphone.')
    }
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
  const linkedIds = new Set<string>()

  if (client) {
    const dossiersRaw = await resolveDossiersRawForClient(firestore, client)
    for (const dossier of dossiersRaw) {
      linkedIds.add(dossier.id)
    }
  } else {
    const byClientId = await fetchDossiersByClientId(firestore, clientId)
    for (const dossier of byClientId) {
      linkedIds.add(dossier.id)
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
