import { useDebounceFn } from '@vueuse/core'
import type { Ref } from 'vue'
import { useDomainClientsStore } from '@/store/modules/domain/clients'
import type { ClientFormData, ClientRecord } from '@/types/client'
import { clientFormFromRecord } from '@/types/client'
import {
  criteriaFromForm,
  findAmbiguousClients,
  findClientsByName,
  findExistingClientInList,
  isValidEmail,
  normalizePhone,
  clientFormMatchesRecord,
} from '@/utils/client-identity'
import { clientNamesMatch } from '@/utils/client-name'

export type ClientMatchSource = 'nom' | 'tel' | 'email' | 'manual' | null

/**
 * Détection de clients existants (nom, téléphone, e-mail) et pré-remplissage du formulaire dossier.
 */
export function useClientNameLookup(clientForm: Ref<ClientFormData>) {
  const clientsStore = useDomainClientsStore()

  const suggestions = ref<ClientRecord[]>([])
  const exactMatches = ref<ClientRecord[]>([])
  const ambiguousMatches = ref<ClientRecord[]>([])
  const showDuplicateNotice = ref(false)
  const linkedClient = ref<ClientRecord | null>(null)
  const matchSource = ref<ClientMatchSource>(null)

  async function ensureRegistry(): Promise<boolean> {
    try {
      if (!clientsStore.loaded) {
        await clientsStore.loadRegistry()
      }
      return true
    } catch {
      return false
    }
  }

  function syncLinkedClientFromForm() {
    const id = clientForm.value.clientId?.trim()
    if (!id || id.startsWith('dossier:')) {
      linkedClient.value = null
      if (matchSource.value !== 'manual') matchSource.value = null
      return
    }
    const found = clientsStore.registry.find((client) => client.id === id)
    linkedClient.value = found ?? linkedClient.value
  }

  function applyLinkedClient(client: ClientRecord, source: ClientMatchSource) {
    if (client.id.startsWith('dossier:')) return
    clientForm.value = clientFormFromRecord(client)
    linkedClient.value = client
    matchSource.value = source
    showDuplicateNotice.value = false
    exactMatches.value = []
    ambiguousMatches.value = []
    suggestions.value = []
  }

  function clearLink() {
    linkedClient.value = null
    matchSource.value = null
    clientForm.value = { ...clientForm.value, clientId: null }
    void runNameSearch()
    void runIdentityLookup()
  }

  function selectExistingClient(client: ClientRecord) {
    applyLinkedClient(client, 'manual')
  }

  function dismissDuplicateNotice() {
    showDuplicateNotice.value = false
  }

  const runNameSearch = useDebounceFn(async () => {
    const nom = clientForm.value.nom.trim()
    if (nom.length < 2) {
      suggestions.value = []
      exactMatches.value = []
      showDuplicateNotice.value = false
      return
    }

    if (!(await ensureRegistry())) {
      suggestions.value = []
      exactMatches.value = []
      return
    }

    exactMatches.value = findClientsByName(clientsStore.registry, nom)
    suggestions.value = clientsStore.searchByName(nom, 8)

    if (clientForm.value.clientId) {
      showDuplicateNotice.value = false
      return
    }

    if (exactMatches.value.length === 1) {
      applyLinkedClient(exactMatches.value[0], 'nom')
      return
    }

    showDuplicateNotice.value = exactMatches.value.length > 1
  }, 350)

  const runIdentityLookup = useDebounceFn(async () => {
    if (clientForm.value.clientId) {
      syncLinkedClientFromForm()
      ambiguousMatches.value = []
      return
    }

    if (!(await ensureRegistry())) return

    const criteria = criteriaFromForm(clientForm.value)
    const tel = criteria.numTel?.trim() ?? ''
    const email = criteria.email?.trim() ?? ''

    const hasPhone = normalizePhone(tel).length >= 8
    const hasEmail = isValidEmail(email)

    if (!hasPhone && !hasEmail) {
      ambiguousMatches.value = []
      return
    }

    const existing = findExistingClientInList(clientsStore.registry, {
      email: hasEmail ? email : undefined,
      numTel: hasPhone ? tel : undefined,
    })

    if (existing) {
      applyLinkedClient(existing, hasEmail ? 'email' : 'tel')
      return
    }

    const ambiguous = findAmbiguousClients(clientsStore.registry, {
      email: hasEmail ? email : undefined,
      numTel: hasPhone ? tel : undefined,
    })
    ambiguousMatches.value = ambiguous.length > 1 ? ambiguous : []
  }, 250)

  watch(
    () => clientForm.value.nom,
    () => {
      if (clientForm.value.clientId) {
        const selected = clientsStore.registry.find((c) => c.id === clientForm.value.clientId)
        if (selected && !clientNamesMatch(selected.nom, clientForm.value.nom)) {
          linkedClient.value = null
          matchSource.value = null
          clientForm.value.clientId = null
        }
      }
      void runNameSearch()
    },
  )

  watch(
    () => clientForm.value.numTel,
    () => {
      void runIdentityLookup()
    },
  )

  watch(
    () => clientForm.value.email,
    () => {
      void runIdentityLookup()
    },
  )

  watch(
    () => clientForm.value.clientId,
    () => {
      syncLinkedClientFromForm()
    },
    { immediate: true },
  )

  watch(
    () => [clientForm.value.nom, clientForm.value.numTel, clientForm.value.email] as const,
    () => {
      const id = clientForm.value.clientId?.trim()
      if (!id || id.startsWith('dossier:')) return
      const record = clientsStore.registry.find((client) => client.id === id)
      if (record && !clientFormMatchesRecord(clientForm.value, record)) {
        linkedClient.value = null
        matchSource.value = null
        clientForm.value.clientId = null
      }
    },
  )

  return {
    suggestions,
    exactMatches,
    ambiguousMatches,
    showDuplicateNotice,
    linkedClient,
    matchSource,
    selectExistingClient,
    dismissDuplicateNotice,
    clearLink,
    refreshSearch: runNameSearch,
  }
}
