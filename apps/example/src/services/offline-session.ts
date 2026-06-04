import type { AppUserRole } from '@/types/auth'

const OFFLINE_SESSION_KEY = 'cabinet_offline_session'

export type OfflineSessionSnapshot = {
  token: string
  account: string
  avatar: string
  userId: string
  role: AppUserRole
  displayName: string
  permissions: string[]
  cachedAt: string
}

export function cacheOfflineSession(data: Omit<OfflineSessionSnapshot, 'cachedAt'>) {
  const snapshot: OfflineSessionSnapshot = {
    ...data,
    cachedAt: new Date().toISOString(),
  }
  localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(snapshot))
}

export function getCachedOfflineSession(): OfflineSessionSnapshot | null {
  try {
    const raw = localStorage.getItem(OFFLINE_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OfflineSessionSnapshot
    if (!parsed.userId || !parsed.role || !parsed.token) return null
    return parsed
  } catch {
    return null
  }
}

export function clearOfflineSessionCache() {
  localStorage.removeItem(OFFLINE_SESSION_KEY)
}

export function hasOfflineSessionCache(): boolean {
  return getCachedOfflineSession() !== null
}
