import {
  FirestoreAppError,
  getFirestoreErrorMessage,
  isFirestorePermissionError,
  runFirestore,
} from '@/utils/firestore-errors'

type ToastFn = (type: 'success' | 'error', message: string) => void

export function useFirestoreAction(showToast?: ToastFn) {
  const lastError = ref<FirestoreAppError | null>(null)
  const permissionDenied = ref(false)

  function reportError(err: unknown, context?: string) {
    const message = getFirestoreErrorMessage(err, context)
    lastError.value = err instanceof FirestoreAppError ? err : new FirestoreAppError(err, context)
    permissionDenied.value = isFirestorePermissionError(err)
    showToast?.('error', message)
    if (import.meta.env.DEV) {
      console.error(`[Firestore] ${context ?? 'operation'}`, err)
    }
    return message
  }

  async function run<T>(operation: () => Promise<T>, context?: string): Promise<T | null> {
    try {
      lastError.value = null
      permissionDenied.value = false
      return await runFirestore(operation, context)
    } catch (err) {
      reportError(err, context)
      return null
    }
  }

  function clearError() {
    lastError.value = null
    permissionDenied.value = false
  }

  return {
    lastError,
    permissionDenied,
    run,
    reportError,
    clearError,
  }
}
