import type { ClientFormData, ClientRecord } from '@/types/client'
import { clientNamesMatch } from '@/utils/client-name'

/** Chiffres uniquement (comparaison téléphone). */
export function normalizePhone(tel: string): string {
  return tel.replace(/\D/g, '')
}

export function phonesMatch(a: string, b: string): boolean {
  const left = normalizePhone(a)
  const right = normalizePhone(b)
  if (left.length < 8 || right.length < 8) return false
  return left === right || left.endsWith(right) || right.endsWith(left)
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  const value = normalizeEmail(email)
  return value.length > 3 && value.includes('@') && value.includes('.')
}

export function emailsMatch(a: string, b: string): boolean {
  const left = normalizeEmail(a)
  const right = normalizeEmail(b)
  return isValidEmail(left) && left === right
}

export function isPersistedClientRecord(client: ClientRecord): boolean {
  return Boolean(client.id) && !client.id.startsWith('dossier:')
}

export type ClientLookupCriteria = {
  clientId?: string | null
  nom?: string
  numTel?: string
  email?: string
}

function dedupeClients(clients: ClientRecord[]): ClientRecord[] {
  const map = new Map<string, ClientRecord>()
  for (const client of clients) {
    if (isPersistedClientRecord(client)) {
      map.set(client.id, client)
    }
  }
  return [...map.values()]
}

export function findClientsByPhone(clients: ClientRecord[], numTel: string): ClientRecord[] {
  const tel = numTel.trim()
  if (!tel) return []
  return dedupeClients(clients).filter((client) => phonesMatch(client.numTel, tel))
}

export function findClientsByEmail(clients: ClientRecord[], email: string): ClientRecord[] {
  const value = email.trim()
  if (!emailsMatch(value, value)) return []
  return dedupeClients(clients).filter((client) => emailsMatch(client.email ?? '', value))
}

export function findClientsByName(clients: ClientRecord[], nom: string): ClientRecord[] {
  const value = nom.trim()
  if (!value) return []
  return dedupeClients(clients).filter((client) => clientNamesMatch(client.nom, value))
}

/**
 * Recherche un client existant (priorité : id → email → téléphone → nom exact).
 * Retourne `undefined` si plusieurs candidats pour un même critère (sauf id).
 */
export function findExistingClientInList(
  clients: ClientRecord[],
  criteria: ClientLookupCriteria,
): ClientRecord | undefined {
  const pool = dedupeClients(clients)

  const id = criteria.clientId?.trim()
  if (id && !id.startsWith('dossier:')) {
    return pool.find((client) => client.id === id)
  }

  const email = criteria.email?.trim()
  if (email && isValidEmail(email)) {
    const matches = findClientsByEmail(pool, email)
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) return undefined
  }

  const tel = criteria.numTel?.trim()
  if (tel) {
    const matches = findClientsByPhone(pool, tel)
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) return undefined
  }

  const nom = criteria.nom?.trim()
  if (nom) {
    const matches = findClientsByName(pool, nom)
    if (matches.length === 1) return matches[0]
  }

  return undefined
}

export function findAmbiguousClients(
  clients: ClientRecord[],
  criteria: ClientLookupCriteria,
): ClientRecord[] {
  const pool = dedupeClients(clients)
  const tel = criteria.numTel?.trim()
  if (tel) {
    const matches = findClientsByPhone(pool, tel)
    if (matches.length > 1) return matches
  }
  const email = criteria.email?.trim()
  if (email && isValidEmail(email)) {
    const matches = findClientsByEmail(pool, email)
    if (matches.length > 1) return matches
  }
  const nom = criteria.nom?.trim()
  if (nom) {
    return findClientsByName(pool, nom)
  }
  return []
}

export function clientFormMatchesRecord(form: ClientFormData, client: ClientRecord): boolean {
  return (
    clientNamesMatch(form.nom, client.nom)
    && (!form.numTel.trim() || phonesMatch(form.numTel, client.numTel) || !normalizePhone(client.numTel))
    && (!form.email?.trim() || emailsMatch(form.email, client.email ?? '') || !client.email?.trim())
  )
}

export function criteriaFromForm(form: ClientFormData): ClientLookupCriteria {
  return {
    clientId: form.clientId,
    nom: form.nom,
    numTel: form.numTel,
    email: form.email,
  }
}
