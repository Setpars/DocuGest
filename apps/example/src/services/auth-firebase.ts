import { deleteApp, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { getFirebaseConfig } from '@/firebase/env'
import { createGoogleAuthProvider } from '@/firebase/google-auth'
import { getPermissionsForRole } from '@/constants/permissions'
import type { AppUser, AppUserRole, AuthSession } from '@/types/auth'
import { removeLoginDirectoryEntry, upsertLoginDirectoryEntry } from '@/utils/login-directory'
import { assertPasswordPolicy } from '@/utils/password-policy'

const ROLE_VALUES: AppUserRole[] = ['secretaire', 'doyen', 'finance']
const usersCol = collection(db, 'utilisateurs')

const BOOTSTRAP_FLAG_KEY = 'cabinet_bootstrap_done'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class AuthFirebaseError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'AuthFirebaseError'
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function assertValidEmail(email: string) {
  const normalized = normalizeEmail(email)
  if (!EMAIL_REGEX.test(normalized)) {
    throw new AuthFirebaseError('auth/invalid-email', 'Adresse e-mail invalide.')
  }
  return normalized
}

function wrapFirebaseError(err: unknown): AuthFirebaseError {
  const code = (err as { code?: string }).code ?? 'auth/unknown'
  return new AuthFirebaseError(code, mapFirebaseAuthError(code))
}

function normalizeRole(value: unknown): AppUserRole {
  const role = String(value ?? 'secretaire') as AppUserRole
  return ROLE_VALUES.includes(role) ? role : 'secretaire'
}

function mapProfile(uid: string, data: Record<string, unknown>): AppUser {
  const email = String(data.email ?? '')
  return {
    id: uid,
    email,
    nom: String(data.nom ?? ''),
    role: normalizeRole(data.role),
    actif: data.actif !== false,
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  }
}

/** Photo de profil réelle uniquement (ex. Google) — sinon initiales dans l’UI. */
function resolveAvatar(user: User): string {
  const url = user.photoURL?.trim() ?? ''
  if (!url || url.includes('dicebear.com')) return ''
  return url
}

async function buildAuthSession(user: User, profile: AppUser): Promise<AuthSession> {
  const token = await user.getIdToken()
  return {
    token,
    account: profile.email,
    avatar: resolveAvatar(user),
    user: profile,
    permissions: getPermissionsForRole(profile.role),
  }
}

async function loadActiveProfile(uid: string): Promise<AppUser | null> {
  const profile = await fetchUserProfile(uid)
  if (!profile) return null
  if (!profile.actif) return null
  return profile
}

/** Vérifie si au moins un profil doyen existe dans Firestore. */
export async function hasDoyenProfile(): Promise<boolean> {
  try {
    const snap = await getDocs(
      query(usersCol, where('role', '==', 'doyen'), limit(1)),
    )
    return !snap.empty
  } catch {
    try {
      const snap = await getDocs(usersCol)
      return snap.docs.some(d => (d.data() as Record<string, unknown>).role === 'doyen')
    } catch {
      // Firestore inaccessible : se fier au flag local d’installation
      return localStorage.getItem(BOOTSTRAP_FLAG_KEY) === '1'
    }
  }
}

/** Première visite : aucun compte doyen configuré. */
export async function needsInitialSetup(): Promise<boolean> {
  if (localStorage.getItem(BOOTSTRAP_FLAG_KEY) === '1') {
    const hasDoyen = await hasDoyenProfile()
    if (hasDoyen) return false
    localStorage.removeItem(BOOTSTRAP_FLAG_KEY)
  }
  return !(await hasDoyenProfile())
}

export function markBootstrapComplete() {
  localStorage.setItem(BOOTSTRAP_FLAG_KEY, '1')
}

export async function fetchUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'utilisateurs', uid))
  if (!snap.exists()) return null
  return mapProfile(uid, snap.data() as Record<string, unknown>)
}

export function mapFirebaseAuthError(code: string): string {
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Adresse e-mail invalide.',
    'auth/user-disabled': 'Ce compte a été désactivé dans Firebase.',
    'auth/user-not-found': 'Aucun compte avec cet e-mail.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
    'auth/email-already-in-use': 'Cet e-mail est déjà utilisé.',
    'auth/weak-password': 'Mot de passe trop faible. 8 caractères minimum avec majuscule, minuscule, chiffre et caractère spécial.',
    'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
    'auth/requires-recent-login': 'Reconnectez-vous avant de modifier le mot de passe.',
    'auth/profile-missing': 'Profil introuvable. Contactez l’administrateur (doyen).',
    'auth/profile-inactive': 'Compte désactivé. Contactez l’administrateur.',
    'auth/bootstrap-done': 'Un compte doyen existe déjà. Utilisez la page de connexion.',
    'auth/invalid-name': 'Le nom complet est obligatoire.',
    'auth/no-user': 'Aucun utilisateur connecté.',
    'auth/popup-closed-by-user': 'Connexion Google annulée.',
    'auth/cancelled-popup-request': 'Connexion Google annulée.',
    'auth/popup-blocked': 'La fenêtre Google a été bloquée. Autorisez les pop-ups pour ce site.',
    'auth/account-exists-with-different-credential': 'Cet e-mail est déjà enregistré avec un autre mode de connexion (mot de passe).',
    'auth/operation-not-allowed': 'Connexion Google non activée. Contactez l’administrateur.',
  }
  return messages[code] ?? 'Erreur d’authentification. Réessayez.'
}

/**
 * Associe un profil Firestore existant (recherche par e-mail) au compte Google courant.
 * Permet au doyen de créer un utilisateur par e-mail, puis connexion Google avec le même e-mail.
 */
async function linkOrLoadProfileForOAuthUser(user: User): Promise<AppUser | null> {
  const byUid = await loadActiveProfile(user.uid)
  if (byUid) return byUid

  const email = user.email ? normalizeEmail(user.email) : ''
  if (!email) return null

  try {
    const snap = await getDocs(
      query(usersCol, where('email', '==', email), limit(1)),
    )
    const existing = snap.docs[0]
    if (!existing) return null

    const data = existing.data() as Record<string, unknown>
    if (data.actif === false) return null

    const now = new Date().toISOString()
    const profileData = {
      email,
      nom: String(data.nom ?? user.displayName ?? email),
      role: normalizeRole(data.role),
      actif: true,
      createdAt: String(data.createdAt ?? now),
      updatedAt: now,
      authProvider: 'google',
    }

    await setDoc(doc(db, 'utilisateurs', user.uid), profileData)

    if (existing.id !== user.uid) {
      try {
        await updateDoc(doc(db, 'utilisateurs', existing.id), {
          migratedTo: user.uid,
          actif: false,
          updatedAt: now,
        })
      } catch {
        // Ancien document laissé en place si mise à jour impossible
      }
    }

    return mapProfile(user.uid, profileData)
  } catch {
    return null
  }
}

/** Connexion avec Google (popup). Profil Firestore requis ou e-mail pré-enregistré par le doyen. */
export async function loginWithGoogle(): Promise<AuthSession> {
  let credential
  try {
    credential = await signInWithPopup(auth, createGoogleAuthProvider())
  } catch (err: unknown) {
    throw wrapFirebaseError(err)
  }

  const user = credential.user
  let profile = await loadActiveProfile(user.uid)

  if (!profile) {
    profile = await linkOrLoadProfileForOAuthUser(user)
  }

  if (!profile) {
    await signOut(auth)
    throw new AuthFirebaseError(
      'auth/profile-missing',
      'Compte Google non autorisé. Demandez au doyen de créer votre accès avec cet e-mail.',
    )
  }

  if (user.email && profile.email !== normalizeEmail(user.email)) {
    await updateDoc(doc(db, 'utilisateurs', user.uid), {
      email: normalizeEmail(user.email),
      updatedAt: new Date().toISOString(),
    })
    profile = { ...profile, email: normalizeEmail(user.email) }
  }

  return buildAuthSession(user, profile)
}

/** Synchronise la session à partir de l’utilisateur Firebase courant. */
export async function resolveAuthSessionFromUser(user: User): Promise<AuthSession | null> {
  try {
    let profile = await loadActiveProfile(user.uid)
    if (!profile) {
      profile = await linkOrLoadProfileForOAuthUser(user)
    }
    if (!profile) return null
    return await buildAuthSession(user, profile)
  } catch {
    return null
  }
}

/**
 * Création du tout premier compte doyen (installation initiale).
 */
export async function createBootstrapDoyen(payload: {
  email: string
  password: string
  nom: string
}): Promise<AuthSession> {
  if (await hasDoyenProfile()) {
    throw new AuthFirebaseError(
      'auth/bootstrap-done',
      mapFirebaseAuthError('auth/bootstrap-done'),
    )
  }

  const email = assertValidEmail(payload.email)
  const nom = payload.nom.trim()

  if (!nom) {
    throw new AuthFirebaseError('auth/invalid-name', mapFirebaseAuthError('auth/invalid-name'))
  }

  try {
    assertPasswordPolicy(payload.password)
  } catch (e) {
    throw new AuthFirebaseError('auth/weak-password', (e as Error).message)
  }

  let credential
  try {
    credential = await createUserWithEmailAndPassword(auth, email, payload.password)
  } catch (err: unknown) {
    throw wrapFirebaseError(err)
  }

  const uid = credential.user.uid
  const now = new Date().toISOString()

  try {
    await setDoc(doc(db, 'utilisateurs', uid), {
      email,
      nom,
      role: 'doyen' as AppUserRole,
      actif: true,
      createdAt: now,
      updatedAt: now,
      bootstrap: true,
    })
    await upsertLoginDirectoryEntry({ email, nom, actif: true })
  } catch (err: unknown) {
    await signOut(auth)
    throw wrapFirebaseError(err)
  }

  markBootstrapComplete()

  const profile = mapProfile(uid, {
    email,
    nom,
    role: 'doyen',
    actif: true,
    createdAt: now,
    updatedAt: now,
  })

  return buildAuthSession(credential.user, profile)
}

/** Connexion Firebase Auth + profil Firestore. */
export async function loginWithFirebase(email: string, password: string): Promise<AuthSession> {
  const normalizedEmail = assertValidEmail(email)

  if (!password) {
    throw new AuthFirebaseError('auth/invalid-credential', 'Le mot de passe est obligatoire.')
  }

  let credential
  try {
    credential = await signInWithEmailAndPassword(auth, normalizedEmail, password)
  } catch (err: unknown) {
    throw wrapFirebaseError(err)
  }

  let profile = await fetchUserProfile(credential.user.uid)
  if (!profile && credential.user.email) {
    profile = await linkOrLoadProfileForOAuthUser(credential.user)
  }
  if (!profile) {
    await signOut(auth)
    throw new AuthFirebaseError(
      'auth/profile-missing',
      mapFirebaseAuthError('auth/profile-missing'),
    )
  }
  if (!profile.actif) {
    await signOut(auth)
    throw new AuthFirebaseError(
      'auth/profile-inactive',
      mapFirebaseAuthError('auth/profile-inactive'),
    )
  }

  return buildAuthSession(credential.user, profile)
}

export async function logoutFirebase(): Promise<void> {
  await signOut(auth)
}

/**
 * Restaure la session depuis `auth.currentUser`.
 * Ne déconnecte pas automatiquement (évite les courses avec le listener Auth).
 */
export async function restoreFirebaseSession(options?: { signOutIfInvalid?: boolean }): Promise<AuthSession | null> {
  const user = auth.currentUser
  if (!user) return null

  const session = await resolveAuthSessionFromUser(user)
  if (!session && options?.signOutIfInvalid) {
    await signOut(auth)
  }
  return session
}

export async function createUserAccountAsAdmin(payload: {
  email: string
  password: string
  nom: string
  role: AppUserRole
  actif?: boolean
}): Promise<string> {
  try {
    assertPasswordPolicy(payload.password)
  } catch (e) {
    throw new AuthFirebaseError('auth/weak-password', (e as Error).message)
  }

  const email = assertValidEmail(payload.email)
  const secondaryApp = initializeApp(getFirebaseConfig(), `AdminCreate_${Date.now()}`)
  const secondaryAuth = getAuth(secondaryApp)

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      payload.password,
    )
    const uid = credential.user.uid
    const now = new Date().toISOString()

    const actif = payload.actif !== false
    await setDoc(doc(db, 'utilisateurs', uid), {
      email,
      nom: payload.nom.trim(),
      role: payload.role,
      actif,
      createdAt: now,
      updatedAt: now,
      createdBy: auth.currentUser?.uid ?? '',
    })
    await upsertLoginDirectoryEntry({
      email,
      nom: payload.nom.trim(),
      actif,
    })

    await signOut(secondaryAuth)
    return uid
  } catch (err: unknown) {
    throw wrapFirebaseError(err)
  } finally {
    await deleteApp(secondaryApp)
  }
}

export async function updateUserProfile(
  uid: string,
  data: Partial<Pick<AppUser, 'nom' | 'role' | 'actif' | 'email'>>,
) {
  const existing = await fetchUserProfile(uid)
  const payload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  }
  if (data.nom !== undefined) payload.nom = data.nom.trim()
  if (data.role !== undefined) payload.role = data.role
  if (data.actif !== undefined) payload.actif = data.actif
  if (data.email !== undefined) payload.email = assertValidEmail(data.email)

  await updateDoc(doc(db, 'utilisateurs', uid), payload)

  const profile = await fetchUserProfile(uid)
  if (profile) {
    await upsertLoginDirectoryEntry({
      email: profile.email,
      nom: profile.nom,
      actif: profile.actif,
    })
  }
  if (existing && data.email !== undefined && existing.email !== profile?.email) {
    await removeLoginDirectoryEntry(existing.email)
  }
}

export async function sendUserPasswordReset(email: string) {
  const normalizedEmail = assertValidEmail(email)
  try {
    await sendPasswordResetEmail(auth, normalizedEmail)
  } catch (err: unknown) {
    throw wrapFirebaseError(err)
  }
}

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser
  if (!user?.email) {
    throw new AuthFirebaseError('auth/no-user', mapFirebaseAuthError('auth/no-user'))
  }

  try {
    assertPasswordPolicy(newPassword)
  } catch (e) {
    throw new AuthFirebaseError('auth/weak-password', (e as Error).message)
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, newPassword)
  } catch (err: unknown) {
    throw wrapFirebaseError(err)
  }
}

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser
}
