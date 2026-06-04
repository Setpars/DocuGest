import { hasOfflineSessionCache } from '@/services/offline-session'
import {
  getLastSyncAt,
  getLastSyncError,
} from '@/services/local-metadata'
import { runFirestoreSync } from '@/services/sync-firestore'

export const useAppOfflineStore = defineStore('appOffline', () => {
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const isOfflineSession = ref(false)
  const isSyncing = ref(false)
  const lastSyncAt = ref<string | null>(getLastSyncAt())
  const syncError = ref<string | null>(getLastSyncError())

  const canOfflineLogin = computed(() => hasOfflineSessionCache())

  const statusLabel = computed(() => {
    if (isSyncing.value) return 'Synchronisation en cours…'
    if (syncError.value) return syncError.value
    if (!isOnline.value) {
      return isOfflineSession.value
        ? 'Hors ligne — modifications enregistrées dans IndexedDB, sync à la reconnexion'
        : 'Hors ligne — internet requis pour la première connexion'
    }
    if (isOfflineSession.value) return 'En ligne — resynchronisation de la session…'
    if (lastSyncAt.value) {
      return `En ligne — dernière sync ${formatSyncTime(lastSyncAt.value)}`
    }
    return 'En ligne'
  })

  function formatSyncTime(iso: string) {
    try {
      return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  function refreshSyncMeta() {
    lastSyncAt.value = getLastSyncAt()
    syncError.value = getLastSyncError()
  }

  function setOnline(value: boolean) {
    isOnline.value = value
  }

  function setOfflineSession(active: boolean) {
    isOfflineSession.value = active
  }

  /** Sync complète : push file Firestore + pull collections (cache IndexedDB). */
  async function syncWhenOnline() {
    if (!isOnline.value || isSyncing.value) return

    isSyncing.value = true
    syncError.value = null

    try {
      const appAccountStore = useAppAccountStore()
      const restored = await appAccountStore.tryRestoreSession()

      if (!restored && isOfflineSession.value && hasOfflineSessionCache()) {
        syncError.value = 'Reconnectez-vous en ligne (e-mail ou Google) pour synchroniser.'
        return
      }

      if (restored) {
        isOfflineSession.value = false
      }

      const result = await runFirestoreSync()
      refreshSyncMeta()

      if (!result.ok && result.error) {
        syncError.value = result.error
      }
    } catch (e) {
      syncError.value = (e as Error).message || 'Échec de la synchronisation'
    } finally {
      isSyncing.value = false
    }
  }

  /** Après login : remplit le cache IndexedDB depuis Firestore. */
  async function warmupAfterLogin() {
    if (!isOnline.value) return
    await syncWhenOnline()
  }

  function initNetworkListeners() {
    if (typeof window === 'undefined') return

    window.addEventListener('online', () => {
      setOnline(true)
      syncWhenOnline()
    })
    window.addEventListener('offline', () => {
      setOnline(false)
    })

    refreshSyncMeta()
  }

  return {
    isOnline,
    isOfflineSession,
    isSyncing,
    lastSyncAt,
    syncError,
    canOfflineLogin,
    statusLabel,
    setOnline,
    setOfflineSession,
    syncWhenOnline,
    warmupAfterLogin,
    refreshSyncMeta,
    initNetworkListeners,
  }
})
