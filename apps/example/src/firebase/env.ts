import type { FirebaseOptions } from 'firebase/app'

function requireEnv(key: keyof ImportMetaEnv, label: string): string {
  const value = import.meta.env[key]
  if (!value || String(value).trim() === '') {
    throw new Error(
      `[Firebase] Variable manquante : ${label} (${key}). `
      + 'Copiez apps/example/.env.example vers apps/example/.env.local et renseignez vos identifiants.',
    )
  }
  return String(value).trim()
}

/** Configuration Firebase lue depuis `.env.local` (non versionné). */
export function getFirebaseConfig(): FirebaseOptions {
  return {
    apiKey: requireEnv('VITE_FIREBASE_API_KEY', 'API Key'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN', 'Auth Domain'),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID', 'Project ID'),
    storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET', 'Storage Bucket'),
    messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', 'Messaging Sender ID'),
    appId: requireEnv('VITE_FIREBASE_APP_ID', 'App ID'),
  }
}
