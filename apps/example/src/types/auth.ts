/** Rôles métier de l’application (cabinet d’avocats). */
export type AppUserRole = 'secretaire' | 'doyen' | 'finance'

/** Profil Firestore `utilisateurs/{uid}` — uid = Firebase Auth. */
export type AppUser = {
  id: string
  email: string
  nom: string
  role: AppUserRole
  actif: boolean
  createdAt: string
  updatedAt: string
}

export type AppUserForm = {
  id: string | null
  email: string
  nom: string
  role: AppUserRole
  password: string
  actif: boolean
}

/** Session applicative après connexion Firebase. */
export type AuthSession = {
  token: string
  account: string
  avatar: string
  user: AppUser
  permissions: string[]
}

export type AuditLogEntry = {
  id: string
  userId: string
  userLogin: string
  userRole: AppUserRole | ''
  action: string
  entity: string
  entityId: string
  details: string
  createdAt: string
}

export const ROLE_LABELS: Record<AppUserRole, string> = {
  secretaire: 'Secrétaire',
  doyen: 'Doyen (administration)',
  finance: 'Chargé des finances',
}
