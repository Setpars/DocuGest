/**
 * État réseau / hors ligne (Pinia `appOffline`).
 */
export function useOffline() {
  const appOfflineStore = useAppOfflineStore()

  return {
    isOnline: computed(() => appOfflineStore.isOnline),
    isOfflineSession: computed(() => appOfflineStore.isOfflineSession),
    isSyncing: computed(() => appOfflineStore.isSyncing),
    canOfflineLogin: computed(() => appOfflineStore.canOfflineLogin),
    statusLabel: computed(() => appOfflineStore.statusLabel),
    syncWhenOnline: () => appOfflineStore.syncWhenOnline(),
  }
}
