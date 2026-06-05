import { watch } from 'vue'
import { useDomainClientsStore } from '@/store/modules/domain/clients'

/** Démarre les écouteurs Firestore du domaine métier tant que l’utilisateur est connecté. */
export function useDomainRealtime() {
  const accountStore = useAppAccountStore()
  const domainStore = useDomainClientsStore()

  watch(
    () => accountStore.isLogin,
    (loggedIn) => {
      if (loggedIn) domainStore.startRealtime()
      else domainStore.stopRealtime()
    },
    { immediate: true },
  )
}
