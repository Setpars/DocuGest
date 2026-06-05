/** Messages utilisateur liés au statut d’un dossier. */
export const DOSSIER_MESSAGES = {
  /** Identifiant absent dans l’URL. */
  missingId: 'Identifiant de dossier manquant.',
  /** Document Firestore introuvable (jamais créé ou supprimé). */
  notFound: 'Ce dossier est introuvable. Il n’existe pas ou a été supprimé du cabinet.',
  /** Échec technique après confirmation de l’existence du dossier. */
  loadFailed: 'Impossible de charger les informations du dossier. Réessayez dans un instant.',
  /** Dossier présent mais sans affectation active ni document. */
  unassignedNoDocuments:
    'Aucun responsable n’est actuellement affecté à ce dossier ou pas de document disponible.',
  /** Dossier présent sans responsable actif. */
  unassigned:
    'Aucun responsable n’est actuellement affecté à ce dossier. Assignez un avocat depuis le menu Avocats.',
} as const
