import { FirebaseError } from 'firebase/app'

export type FirestoreErrorKind =
  | 'permission-denied'
  | 'unavailable'
  | 'not-found'
  | 'already-exists'
  | 'unauthenticated'
  | 'resource-exhausted'
  | 'unknown'

export class FirestoreAppError extends Error {
  kind: FirestoreErrorKind
  code: string
  httpStatus?: number

  constructor(err: unknown, context?: string) {
    const parsed = parseFirestoreError(err)
    const prefix = context ? `${context} : ` : ''
    super(`${prefix}${parsed.message}`)
    this.name = 'FirestoreAppError'
    this.kind = parsed.kind
    this.code = parsed.code
    this.httpStatus = parsed.httpStatus
  }
}

export function getFirebaseErrorCode(err: unknown): string {
  if (err instanceof FirebaseError) return err.code
  if (err instanceof FirestoreAppError) return err.code
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code: string }).code)
  }
  return 'unknown'
}

export function parseFirestoreError(err: unknown): {
  kind: FirestoreErrorKind
  code: string
  message: string
  httpStatus?: number
} {
  const code = getFirebaseErrorCode(err)

  const map: Record<string, { kind: FirestoreErrorKind, message: string, httpStatus?: number }> = {
    'permission-denied': {
      kind: 'permission-denied',
      httpStatus: 403,
      message:
        'Accès refusé (403). Vérifiez vos droits ou les règles Firestore de la collection concernée.',
    },
    unauthenticated: {
      kind: 'unauthenticated',
      httpStatus: 401,
      message: 'Session expirée ou non connecté. Reconnectez-vous.',
    },
    unavailable: {
      kind: 'unavailable',
      message: 'Service temporairement indisponible. Réessayez dans quelques instants.',
    },
    'not-found': {
      kind: 'not-found',
      httpStatus: 404,
      message: 'Document ou collection introuvable.',
    },
    'already-exists': {
      kind: 'already-exists',
      message: 'Ce document existe déjà.',
    },
    'resource-exhausted': {
      kind: 'resource-exhausted',
      message: 'Quota Firestore dépassé. Réessayez plus tard.',
    },
    cancelled: {
      kind: 'unknown',
      message: 'Opération annulée.',
    },
    'failed-precondition': {
      kind: 'unknown',
      message: 'Condition Firestore non remplie (index ou règles).',
    },
  }

  const hit = map[code]
  if (hit) {
    return { code, ...hit }
  }

  const fallback = err instanceof Error ? err.message : 'Erreur inconnue'
  return {
    kind: 'unknown',
    code,
    message: fallback || 'Une erreur est survenue.',
  }
}

/** Message utilisateur pour toasts / bannières. */
export function getFirestoreErrorMessage(err: unknown, context?: string): string {
  if (err instanceof FirestoreAppError) return err.message
  const parsed = parseFirestoreError(err)
  const prefix = context ? `${context} — ` : ''
  return `${prefix}${parsed.message}`
}

export function isFirestorePermissionError(err: unknown): boolean {
  return parseFirestoreError(err).kind === 'permission-denied'
}

export async function runFirestore<T>(
  operation: () => Promise<T>,
  context?: string,
): Promise<T> {
  try {
    return await operation()
  } catch (err) {
    throw new FirestoreAppError(err, context)
  }
}
