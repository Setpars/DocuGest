import { addDoc, collection } from 'firebase/firestore'
import { db } from '@/firebase'
import type { AppUserRole } from '@/types/auth'

const auditCol = collection(db, 'audit_logs')

export type AuditAction =
  | 'connexion'
  | 'deconnexion'
  | 'creation'
  | 'modification'
  | 'suppression'
  | 'consultation'

export async function writeAuditLog(payload: {
  action: AuditAction | string
  entity: string
  entityId?: string
  details?: string
}) {
  const accountStore = useAppAccountStore()
  if (!accountStore.userId) return

  try {
    // Firestore en mode hors ligne : écriture mise en file (sync auto au retour réseau)
    await addDoc(auditCol, {
      userId: accountStore.userId,
      userLogin: accountStore.account,
      userRole: accountStore.role ?? '',
      action: payload.action,
      entity: payload.entity,
      entityId: payload.entityId ?? '',
      details: payload.details ?? '',
      createdAt: new Date().toISOString(),
    })
  } catch {
    // Ne pas bloquer l’action métier si l’audit échoue
  }
}

export function auditEntityLabel(entity: string) {
  const labels: Record<string, string> = {
    client: 'Client',
    dossier: 'Dossier',
    avocat: 'Avocat',
    paiement: 'Paiement',
    agenda: 'Agenda',
    utilisateur: 'Utilisateur',
    affectation: 'Affectation',
    note_honoraire: 'Note honoraire',
  }
  return labels[entity] ?? entity
}

export function formatAuditRole(role: AppUserRole | '' | string) {
  if (role === 'secretaire') return 'Secrétaire'
  if (role === 'doyen') return 'Doyen'
  if (role === 'finance') return 'Finances'
  return role || '—'
}

export type AuditUserRef = { email: string, nom: string }

export type AuditEntityDisplayInput = {
  entity: string
  entityId?: string
  details?: string
  userLogin?: string
}

const EMAIL_IN_TEXT = /[\w.%+-]+@[\w.-]+\.\w+/

/** Libellé lisible pour la colonne « Entité » du journal d’audit (sans identifiant technique). */
export function formatAuditEntityDisplay(
  input: AuditEntityDisplayInput,
  usersById?: Map<string, AuditUserRef>,
): string {
  const typeLabel = auditEntityLabel(input.entity)
  const ref = resolveAuditEntityReference(input, usersById)
  return ref ? `${typeLabel} — ${ref}` : typeLabel
}

function resolveAuditEntityReference(
  input: AuditEntityDisplayInput,
  usersById?: Map<string, AuditUserRef>,
): string | null {
  const details = (input.details ?? '').trim()

  if (input.entity === 'utilisateur') {
    const emailFromDetails = details.match(EMAIL_IN_TEXT)?.[0]
    if (emailFromDetails) return emailFromDetails

    if (input.entityId && usersById?.has(input.entityId)) {
      const u = usersById.get(input.entityId)!
      if (u.nom && u.nom !== u.email) return `${u.nom} (${u.email})`
      return u.email || u.nom || null
    }

    if (input.userLogin) return input.userLogin

    if (/doyen|installation/i.test(details)) return 'Compte doyen (installation initiale)'
    if (details) return details
    return null
  }

  if (input.entity === 'client') {
    const name = details.replace(/^Client\s+/i, '').trim()
    if (name) return name
  }

  if (details && details.length <= 120) return details

  return null
}
