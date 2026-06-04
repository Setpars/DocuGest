import { GoogleAuthProvider } from 'firebase/auth'

/** Fournisseur Google — activer dans Firebase Console → Authentication → Google. */
export function createGoogleAuthProvider() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({
    prompt: 'select_account',
  })
  provider.addScope('email')
  provider.addScope('profile')
  return provider
}
