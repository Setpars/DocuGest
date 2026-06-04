<script setup lang="ts">
import { getDefaultPathForRole } from '@/constants/permissions'

defineOptions({
  name: 'Home',
})

const router = useRouter()
const appAccountStore = useAppAccountStore()

onMounted(() => {
  const path = appAccountStore.role
    ? getDefaultPathForRole(appAccountStore.role)
    : '/gestion/dossiers'
  router.replace(path)
})
</script>

<template>
  <div class="text-muted-foreground flex-center h-full">
    Redirection…
  </div>
</template>
