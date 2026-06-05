import type { AppUserRole } from '@/types/auth'

/** Permissions granulaires (routes / actions). */
export const PERMISSIONS = {
  clients: 'gestion.clients',
  dossiers: 'gestion.dossiers',
  /** Consultation des dossiers (lecture seule, sans création / édition). */
  dossiersConsultation: 'gestion.dossiers.consultation',
  agenda: 'gestion.agenda',
  noteHonoraire: 'gestion.note_honoraire',
  piecesJuridiques: 'gestion.pieces_juridiques',
  paiements: 'gestion.paiements',
  avocats: 'gestion.avocats',
  rapports: 'gestion.rapports',
  rapportsBi: 'gestion.rapports.bi',
  utilisateurs: 'gestion.utilisateurs',
  audit: 'gestion.audit',
} as const

export const ROLE_PERMISSIONS: Record<AppUserRole, string[]> = {
  secretaire: [
    PERMISSIONS.clients,
    PERMISSIONS.dossiers,
    PERMISSIONS.agenda,
    PERMISSIONS.noteHonoraire,
    PERMISSIONS.piecesJuridiques,
  ],
  doyen: [
    PERMISSIONS.dossiersConsultation,
    PERMISSIONS.avocats,
    PERMISSIONS.rapports,
    PERMISSIONS.rapportsBi,
    PERMISSIONS.utilisateurs,
    PERMISSIONS.audit,
  ],
  finance: [
    PERMISSIONS.paiements,
    PERMISSIONS.dossiersConsultation,
  ],
}

/** Accès au module dossiers (gestion complète ou consultation). */
export const AUTH_DOSSIERS = [
  PERMISSIONS.dossiers,
  PERMISSIONS.dossiersConsultation,
] as const

export function getPermissionsForRole(role: AppUserRole): string[] {
  return [...ROLE_PERMISSIONS[role]]
}

export function getDefaultPathForRole(role: AppUserRole): string {
  switch (role) {
    case 'secretaire':
      return '/gestion/clients'
    case 'doyen':
      return '/gestion/tableau-de-bord'
    case 'finance':
      return '/gestion/paiement'
    default:
      return '/gestion/dossiers'
  }
}
