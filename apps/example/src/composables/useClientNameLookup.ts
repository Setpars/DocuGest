import { useDebounceFn } from '@vueuse/core'
import type { Ref } from 'vue'
import { useDomainClientsStore } from '@/store/modules/domain/clients'
import type { ClientFormData, ClientRecord } from '@/types/client'
import { clientFormFromRecord } from '@/types/client'
import { clientNamesMatch } from '@/utils/client-name'

/**
 * Détection de doublons et suggestions lors de la saisie du nom client (formulaire dossier).
 */
export function useClientNameLookup(clientForm: Ref<ClientFormData>) {
  const clientsStore = useDomainClientsStore()

  const suggestions = ref<ClientRecord[]>([])
  const exactMatches = ref<ClientRecord[]>([])
  const showDuplicateNotice = ref(false)

  const runSearch = useDebounceFn(async () => {
    const nom = clientForm.value.nom.trim()
    if (nom.length < 2) {
      suggestions.value = []
      exactMatches.value = []
      showDuplicateNotice.value = false
      return
    }

    try {
      if (!clientsStore.loaded) {
        await clientsStore.loadRegistry()
      }
    } catch {
      suggestions.value = []
      exactMatches.value = []
      return
    }

    exactMatches.value = clientsStore.registry.filter((client) =>
      clientNamesMatch(client.nom, nom),
    )
    suggestions.value = clientsStore.searchByName(nom, 8)
    showDuplicateNotice.value = exactMatches.value.length > 0 && !clientForm.value.clientId
  }, 350)

  watch(
    () => clientForm.value.nom,
    () => {
      if (clientForm.value.clientId) {
        const selected = clientsStore.registry.find((c) => c.id === clientForm.value.clientId)
        if (selected && !clientNamesMatch(selected.nom, clientForm.value.nom)) {
          clientForm.value.clientId = null
        }
      }
      void runSearch()
    },
  )

  function selectExistingClient(client: ClientRecord) {
    const next = clientFormFromRecord(client)
    if (!client.id.startsWith('dossier:')) {
      clientForm.value = next
    } else {
      clientForm.value = {
        ...next,
        clientId: null,
      }
    }
    showDuplicateNotice.value = false
    exactMatches.value = []
    suggestions.value = []
  }

  function dismissDuplicateNotice() {
    showDuplicateNotice.value = false
  }

  return {
    suggestions,
    exactMatches,
    showDuplicateNotice,
    selectExistingClient,
    dismissDuplicateNotice,
    refreshSearch: runSearch,
  }
}
