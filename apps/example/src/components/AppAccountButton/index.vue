<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import UserAvatar from '@/components/UserAvatar/index.vue'
import { ROLE_LABELS, type AppUserRole } from '@/types/auth'
import { cn } from '@/utils'
import eventBus from '@/utils/eventBus'
import Profile from './profile.vue'

defineOptions({
  name: 'AppAccountButton',
})

const props = withDefaults(defineProps<{
  onlyAvatar?: boolean
  dropdownAlign?: 'start' | 'center' | 'end'
  dropdownSide?: 'left' | 'right' | 'top' | 'bottom'
  buttonVariant?: 'secondary' | 'ghost'
  class?: HTMLAttributes['class']
}>(), {
  dropdownAlign: 'end',
  dropdownSide: 'right',
  buttonVariant: 'ghost',
})

const router = useRouter()

const appSettingsStore = useAppSettingsStore()
const appAccountStore = useAppAccountStore()

const { generateTitle } = useAppMenu()

const displayLabel = computed(() =>
  appAccountStore.displayName?.trim() || appAccountStore.account || 'Utilisateur',
)

const roleLabel = computed(() => {
  const role = appAccountStore.role as AppUserRole
  return role && ROLE_LABELS[role] ? ROLE_LABELS[role] : ''
})

const profileModal = useFaModal().create({
  alignCenter: true,
  header: false,
  footer: false,
  closeOnClickOverlay: false,
  closeOnPressEscape: false,
  class: 'flex max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden sm:max-w-xl',
  contentClass: 'min-h-full p-0 flex',
  content: () => h(Profile),
})
</script>

<template>
  <FaDropdown
    :align="dropdownAlign" :side="dropdownSide" :items="[
      [
        ...(appSettingsStore.settings.app.home.enable
          ? [{ label: generateTitle(appSettingsStore.settings.app.home.title), icon: 'i-mdi:home', handle: () => router.push({ path: appSettingsStore.settings.app.home.fullPath }) }]
          : []),
        { label: 'Paramètres du profil', icon: 'i-carbon:user-profile', handle: () => profileModal.open() },
      ],
      [
        ...(appSettingsStore.mode === 'pc'
          ? [{ label: 'Raccourcis clavier', icon: 'i-mdi:keyboard', handle: () => eventBus.emit('global-hotkeys-intro-toggle') }]
          : []),
      ],
      [
        {
          label: 'Déconnexion',
          icon: 'i-mdi:logout',
          handle: () => appAccountStore.logout(appSettingsStore.settings.app.home.fullPath),
        },
      ],
    ]" class="flex-center"
  >
    <template #header>
      <div class="flex-center-start gap-3">
        <UserAvatar
          :src="appAccountStore.avatar"
          :name="displayLabel"
          size="md"
        />
        <div class="min-w-0 space-y-0.5">
          <div class="text-base lh-none truncate font-medium">
            {{ displayLabel }}
          </div>
          <div class="text-xs text-secondary-foreground/70 truncate font-normal">
            {{ appAccountStore.account }}
          </div>
          <div
            v-if="roleLabel"
            class="text-xs text-primary/80 font-medium"
          >
            {{ roleLabel }}
          </div>
        </div>
      </div>
    </template>
    <FaButton
      :variant="buttonVariant" size="icon-sm" :class="cn('flex-center gap-2 px-2 py-1.5', {
        'p-1': onlyAvatar,
      }, props.class)"
    >
      <UserAvatar
        :src="appAccountStore.avatar"
        :name="displayLabel"
        :size="onlyAvatar ? 'sm' : 'sm'"
        :class="onlyAvatar ? 'size-8' : undefined"
      />
      <div v-if="!onlyAvatar" class="flex-center-between flex-1 gap-2 min-w-0">
        <div class="text-start flex-1 truncate text-sm font-medium">
          {{ displayLabel }}
        </div>
        <FaIcon name="i-material-symbols:expand-all-rounded" class="text-secondary-foreground/50 size-4 shrink-0" />
      </div>
    </FaButton>
  </FaDropdown>
</template>
