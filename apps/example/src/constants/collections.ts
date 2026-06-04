/**
 * Collections Firestore — une table par entité métier.
 * @see domain/entities.ts pour le schéma des champs
 */
export const COLLECTIONS = {
  client: 'clients',
  dossier: 'dossiers',
  paiement: 'paiements',
  agenda: 'agenda',
  avocat: 'avocats',
  affectation: 'affectations',
  dossierDocument: 'dossier_documents',
  utilisateur: 'utilisateurs',
  auditLog: 'audit_logs',
} as const

export type CollectionKey = keyof typeof COLLECTIONS
