import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/firebase'

export type LoginAccountChoice = {
  email: string
  nom: string
}

const loginDirectoryCol = collection(db, 'login_directory')
const usersCol = collection(db, 'utilisateurs')
const CACHE_KEY = 'cabinet_login_accounts_cache'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function loginDirectoryDocId(email: string) {
  return normalizeEmail(email)
}

/** Enregistre ou met à jour une entrée publique pour la page de connexion. */
export async function upsertLoginDirectoryEntry(entry: {
  email: string
  nom: string
  actif: boolean
}) {
  const email = loginDirectoryDocId(entry.email)
  await setDoc(doc(db, 'login_directory', email), {
    email,
    nom: entry.nom.trim() || email,
    actif: entry.actif,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
}

export async function removeLoginDirectoryEntry(email: string) {
  try {
    await deleteDoc(doc(db, 'login_directory', loginDirectoryDocId(email)))
  } catch {
    // ignore
  }
}

function cacheLoginAccounts(accounts: LoginAccountChoice[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(accounts))
  } catch {
    // ignore
  }
}

function loadCachedLoginAccounts(): LoginAccountChoice[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return rememberedEmailChoice()
    const parsed = JSON.parse(raw) as LoginAccountChoice[]
    if (!Array.isArray(parsed)) return rememberedEmailChoice()
    return parsed.filter(a => EMAIL_REGEX.test(a.email))
  } catch {
    return rememberedEmailChoice()
  }
}

function rememberedEmailChoice(): LoginAccountChoice[] {
  const email = localStorage.getItem('login_email')?.trim()
  if (email && EMAIL_REGEX.test(email)) {
    return [{ email: normalizeEmail(email), nom: email }]
  }
  return []
}

/** Mémorise un compte après connexion réussie (secours hors ligne). */
export function rememberLoginAccount(email: string, nom?: string) {
  const normalized = normalizeEmail(email)
  const cached = loadCachedLoginAccounts()
  const next: LoginAccountChoice[] = [
    { email: normalized, nom: (nom || normalized).trim() },
    ...cached.filter(a => a.email !== normalized),
  ]
  cacheLoginAccounts(next.slice(0, 30))
}

/** Comptes actifs affichés sur la page de connexion (lecture publique Firestore). */
export async function fetchLoginAccountChoices(): Promise<LoginAccountChoice[]> {
  try {
    const snap = await getDocs(query(loginDirectoryCol, where('actif', '==', true)))
    const list = snap.docs
      .map((d) => {
        const data = d.data()
        const email = normalizeEmail(String(data.email ?? d.id))
        return {
          email,
          nom: String(data.nom ?? email).trim() || email,
        }
      })
      .filter(a => EMAIL_REGEX.test(a.email))

    list.sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.email.localeCompare(b.email, 'fr'))

    if (list.length > 0) {
      cacheLoginAccounts(list)
      return list
    }
  } catch {
    // règles Firestore ou réseau
  }

  return loadCachedLoginAccounts()
}

/**
 * Synchronise l’annuaire depuis `utilisateurs` (réservé au doyen connecté).
 * Utile pour les installations existantes avant l’annuaire public.
 */
export async function rebuildLoginDirectoryFromUsers(): Promise<void> {
  const snap = await getDocs(usersCol)
  await Promise.all(snap.docs.map(async (d) => {
    const data = d.data()
    const email = String(data.email ?? '').trim()
    if (!email || !EMAIL_REGEX.test(email)) return
    await upsertLoginDirectoryEntry({
      email: normalizeEmail(email),
      nom: String(data.nom ?? email),
      actif: data.actif !== false,
    })
  }))
}
