/** Métadonnées légères en localStorage (pas de données métier volumineuses). */

const KEYS = {
  lastSyncAt: 'cabinet_last_sync_at',
  lastSyncError: 'cabinet_last_sync_error',
  initialPullDone: 'cabinet_initial_pull_done',
} as const

export function getLastSyncAt(): string | null {
  return localStorage.getItem(KEYS.lastSyncAt)
}

export function setLastSyncAt(iso: string = new Date().toISOString()) {
  localStorage.setItem(KEYS.lastSyncAt, iso)
  localStorage.removeItem(KEYS.lastSyncError)
}

export function getLastSyncError(): string | null {
  return localStorage.getItem(KEYS.lastSyncError)
}

export function setLastSyncError(message: string) {
  localStorage.setItem(KEYS.lastSyncError, message)
}

export function clearLastSyncError() {
  localStorage.removeItem(KEYS.lastSyncError)
}

export function isInitialPullDone(): boolean {
  return localStorage.getItem(KEYS.initialPullDone) === '1'
}

export function markInitialPullDone() {
  localStorage.setItem(KEYS.initialPullDone, '1')
}

export function clearSyncMetadata() {
  localStorage.removeItem(KEYS.lastSyncAt)
  localStorage.removeItem(KEYS.lastSyncError)
  localStorage.removeItem(KEYS.initialPullDone)
}
