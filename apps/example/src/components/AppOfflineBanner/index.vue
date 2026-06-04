<script setup lang="ts">
defineOptions({
  name: 'AppOfflineBanner',
})

const appOfflineStore = useAppOfflineStore()
const appAccountStore = useAppAccountStore()

const visible = computed(() =>
  !appOfflineStore.isOnline
  || appOfflineStore.isOfflineSession
  || appOfflineStore.isSyncing
  || Boolean(appOfflineStore.syncError),
)

const variant = computed(() => {
  if (appOfflineStore.syncError) return 'error'
  if (appOfflineStore.isSyncing) return 'sync'
  if (!appOfflineStore.isOnline) return 'offline'
  return 'online'
})

async function forceSync() {
  await appOfflineStore.syncWhenOnline()
}
</script>

<template>
  <Transition name="slide-down">
    <div
      v-if="visible"
      class="offline-banner"
      :class="`offline-banner--${variant}`"
      role="status"
    >
      <div class="offline-banner__inner">
        <FaIcon
          :name="{
            offline: 'i-carbon:wifi-off',
            sync: 'i-carbon:renew',
            online: 'i-carbon:cloud-upload',
            error: 'i-carbon:warning',
          }[variant]"
          class="size-4 shrink-0"
          :class="{ 'animate-spin': variant === 'sync' }"
        />
        <p class="text-sm font-medium">
          {{ appOfflineStore.statusLabel || appOfflineStore.syncError }}
        </p>
        <button
          v-if="appOfflineStore.isOnline && (appOfflineStore.isOfflineSession || appOfflineStore.syncError)"
          type="button"
          class="offline-banner__btn"
          :disabled="appOfflineStore.isSyncing"
          @click="forceSync"
        >
          Synchroniser
        </button>
        <span v-if="appOfflineStore.isOfflineSession && appAccountStore.displayName" class="text-xs opacity-80">
          {{ appAccountStore.displayName }}
        </span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.offline-banner {
  position: sticky;
  top: 0;
  z-index: 2000;
  width: 100%;
  padding: 0.5rem 1rem;
}

.offline-banner--offline {
  background: oklch(0.55 0.15 55 / 0.95);
  color: #1c1917;
}

.offline-banner--sync {
  background: oklch(0.55 0.12 250 / 0.95);
  color: #fff;
}

.offline-banner--online {
  background: oklch(0.5 0.14 155 / 0.95);
  color: #fff;
}

.offline-banner--error {
  background: oklch(0.5 0.2 25 / 0.95);
  color: #fff;
}

.offline-banner__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 1rem;
  max-width: 80rem;
  margin: 0 auto;
}

.offline-banner__btn {
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 0.25);
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.offline-banner__btn:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.4);
}

.offline-banner__btn:disabled {
  opacity: 0.6;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
