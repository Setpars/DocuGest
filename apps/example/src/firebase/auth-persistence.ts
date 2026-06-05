import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from 'firebase/auth'
import { auth } from './index'

/** Préférence « Se souvenir de moi » (1 = local, 0 = session navigateur). */
export const AUTH_REMEMBER_KEY = 'auth_remember_me'

export function getRememberMePreference(): boolean {
  const stored = localStorage.getItem(AUTH_REMEMBER_KEY)
  if (stored === '0') return false
  if (stored === '1') return true
  return true
}

export function setRememberMePreference(remember: boolean): void {
  localStorage.setItem(AUTH_REMEMBER_KEY, remember ? '1' : '0')
}

/**
 * Applique la persistance Firebase Auth avant connexion ou au démarrage.
 * - local : session conservée après fermeture du navigateur
 * - session : session limitée à l’onglet / fenêtre courante
 */
export async function applyAuthPersistence(remember?: boolean): Promise<void> {
  const useLocal = remember ?? getRememberMePreference()
  await setPersistence(
    auth,
    useLocal ? browserLocalPersistence : browserSessionPersistence,
  )
}
