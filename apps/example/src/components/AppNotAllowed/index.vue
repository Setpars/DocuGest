<script setup lang="ts">
import { getDefaultPathForRole } from '@/constants/permissions'

defineOptions({
  name: 'AppNotAllowed',
})

const props = withDefaults(
  defineProps<{
    /** Permission requise non accordée (ex. gestion.dossiers) */
    requiredAuth?: string
  }>(),
  {
    requiredAuth: '',
  },
)

const route = useRoute()
const router = useRouter()

const appSettingsStore = useAppSettingsStore()
const appTabbarStore = useAppTabbarStore()
const appAccountStore = useAppAccountStore()

const pageTitle = computed(() => route.meta.title ?? 'cette page')

const detailMessage = computed(() => {
  if (props.requiredAuth) {
    return `Votre rôle (${appAccountStore.role || 'non défini'}) n’a pas la permission « ${props.requiredAuth} » nécessaire pour « ${pageTitle.value} ».`
  }
  return `Vous n’avez pas l’autorisation d’accéder à « ${pageTitle.value} ».`
})

onMounted(() => {
  if (appSettingsStore.settings.topbar.tabbar) {
    appTabbarStore.remove(route.meta.activeMenu || route.fullPath)
  }
})

function goBack() {
  const rolePath = appAccountStore.role
    ? getDefaultPathForRole(appAccountStore.role)
    : appSettingsStore.settings.app.home.fullPath
  router.push(rolePath)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex h-[5vh] lg:h-[10vh]">
      <div class="w-[5vh] lg:w-[10vh]" />
      <div class="border-inline border-dashed flex-1" />
      <div class="w-[5vh] lg:w-[10vh]" />
    </div>
    <div class="border-block border-dashed flex flex-1">
      <div class="w-[5vh] lg:w-[10vh]" />
      <div class="border-inline border-dashed flex-center flex-1 relative">
        <div class="p-4 flex-col-center gap-4 lg:p-12">
          <h1 class="text-6xl font-bold m-0 lg:text-9xl">
            403
          </h1>
          <div class="text-secondary-foreground/80 mx-auto max-w-md text-center text-sm leading-relaxed">
            {{ detailMessage }}
          </div>
          <p class="text-muted-foreground text-center text-xs">
            Si vous pensez qu’il s’agit d’une erreur, demandez au doyen de vérifier votre rôle dans Gestion → Utilisateurs.
          </p>
          <FaButton variant="link" class="text-unset" @click="goBack">
            Retour à l’accueil
          </FaButton>
        </div>
      </div>
      <div class="w-[5vh] lg:w-[10vh]" />
    </div>
    <div class="flex h-[5vh] lg:h-[10vh]">
      <div class="w-[5vh] lg:w-[10vh]" />
      <div class="border-inline border-dashed flex-1" />
      <div class="w-[5vh] lg:w-[10vh]" />
    </div>
  </div>
</template>
