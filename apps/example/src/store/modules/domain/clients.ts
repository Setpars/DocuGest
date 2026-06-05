import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { COLLECTIONS } from '@/constants/collections'
import { mapAffectationFromFirestore, mapAvocatFromFirestore, mapClientFromFirestore } from '@/domain/mappers'
import { db } from '@/firebase'
import {
  buildClientRegistry,
  filterDossiersForClient,
  findExactClientInRegistry,
  getClientById,
  searchClientsInRegistry,
  syncClientForDossier,
  updateClientById,
  type DossierRawRecord,
} from '@/services/client-dossier'
import type { ClientFormData, ClientRecord, ClientWithDossiers } from '@/types/client'
import { collectFromRecords, collectUniqueStrings } from '@/utils/collect-field-suggestions'
import {
  collectUniqueAvocatNames,
  formatAvocatsLabel,
  resolveDossierAvocats,
  type AffectationRecord,
} from '@/utils/affectation'

const DEFAULT_GENRES = ['Masculin', 'Féminin', 'Autre']

export const useDomainClientsStore = defineStore('domainClients', () => {
  const clientsRaw = ref<ClientRecord[]>([])
  const dossiersRaw = ref<DossierRawRecord[]>([])
  const affectationsRaw = ref<AffectationRecord[]>([])
  const avocatsRaw = ref<Array<{ id: string, nom: string }>>([])
  const avocatNames = ref<Record<string, string>>({})
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const realtimeActive = ref(false)

  const registry = computed(() => buildClientRegistry(clientsRaw.value, dossiersRaw.value))

  let unsubs: Unsubscribe[] = []

  function rebuildAvocatNames() {
    const map: Record<string, string> = {}
    for (const avocat of avocatsRaw.value) {
      map[avocat.id] = avocat.nom
    }
    avocatNames.value = map
  }

  function startRealtime() {
    if (realtimeActive.value) return
    realtimeActive.value = true
    loading.value = true
    error.value = ''

    let pending = 4
    const markReady = () => {
      pending -= 1
      if (pending <= 0) loading.value = false
    }

    unsubs = [
      onSnapshot(
        collection(db, COLLECTIONS.client),
        (snap) => {
          clientsRaw.value = snap.docs.map((item) =>
            mapClientFromFirestore(item.id, item.data() as Record<string, unknown>),
          )
          loaded.value = true
          markReady()
        },
        (err) => {
          error.value = err.message || 'Erreur synchronisation clients'
          markReady()
        },
      ),
      onSnapshot(
        collection(db, COLLECTIONS.dossier),
        (snap) => {
          dossiersRaw.value = snap.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Record<string, unknown>),
          }))
          loaded.value = true
          markReady()
        },
        (err) => {
          error.value = err.message || 'Erreur synchronisation dossiers'
          markReady()
        },
      ),
      onSnapshot(
        collection(db, COLLECTIONS.affectation),
        (snap) => {
          affectationsRaw.value = snap.docs.map((item) =>
            mapAffectationFromFirestore(item.id, item.data() as Record<string, unknown>),
          )
          markReady()
        },
        (err) => {
          error.value = err.message || 'Erreur synchronisation affectations'
          markReady()
        },
      ),
      onSnapshot(
        collection(db, COLLECTIONS.avocat),
        (snap) => {
          avocatsRaw.value = snap.docs.map((item) => {
            const entity = mapAvocatFromFirestore(item.id, item.data() as Record<string, unknown>)
            return { id: entity.id, nom: entity.nom }
          })
          rebuildAvocatNames()
          markReady()
        },
        (err) => {
          error.value = err.message || 'Erreur synchronisation avocats'
          markReady()
        },
      ),
    ]
  }

  function stopRealtime() {
    for (const unsub of unsubs) unsub()
    unsubs = []
    realtimeActive.value = false
    clientsRaw.value = []
    dossiersRaw.value = []
    affectationsRaw.value = []
    avocatsRaw.value = []
    avocatNames.value = {}
    loaded.value = false
    loading.value = false
  }

  async function loadRegistry(force = false) {
    if (!realtimeActive.value) startRealtime()
    else if (force) loading.value = !loaded.value
    while (loading.value && !loaded.value) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  function searchByName(query: string, limit = 8) {
    return searchClientsInRegistry(registry.value, query, limit)
  }

  function findExactByName(nom: string) {
    return findExactClientInRegistry(registry.value, nom)
  }

  async function syncForDossier(form: ClientFormData) {
    return syncClientForDossier(db, form, registry.value)
  }

  async function updateClient(form: ClientFormData) {
    const id = form.clientId?.trim()
    if (!id) throw new Error('Client introuvable.')
    return updateClientById(db, id, form, registry.value)
  }

  function getClientDetail(clientId: string): ClientWithDossiers | null {
    const record =
      clientsRaw.value.find((item) => item.id === clientId)
      ?? registry.value.find((item) => item.id === clientId)
    if (!record) return null

    const dossiers = filterDossiersForClient(
      dossiersRaw.value,
      record,
      affectationsRaw.value,
      avocatNames.value,
    )
    return {
      ...record,
      dossiers,
      dossiersCount: dossiers.length,
    }
  }

  async function fetchClientDetail(clientId: string): Promise<ClientWithDossiers | null> {
    await loadRegistry()
    return getClientDetail(clientId)
  }

  function getDossierAvocats(dossierId: string, legacyAvocatId?: string) {
    return resolveDossierAvocats(
      dossierId,
      affectationsRaw.value,
      avocatNames.value,
      legacyAvocatId,
    )
  }

  function getClientAvocatsLabel(client: ClientRecord): string {
    const dossiers = filterDossiersForClient(
      dossiersRaw.value,
      client,
      affectationsRaw.value,
      avocatNames.value,
    )
    const names = new Set<string>()
    for (const dossier of dossiers) {
      for (const nom of collectUniqueAvocatNames(dossier.avocats)) {
        names.add(nom)
      }
    }
    return names.size > 0 ? [...names].join(', ') : '—'
  }

  function formatDossierAvocatsLabel(dossierId: string, legacyAvocatId?: string) {
    return formatAvocatsLabel(getDossierAvocats(dossierId, legacyAvocatId))
  }

  async function fetchClientRecord(clientId: string) {
    await loadRegistry()
    const cached = clientsRaw.value.find((item) => item.id === clientId)
    if (cached) return cached
    return getClientById(db, clientId)
  }

  const genreSuggestions = computed(() => {
    const fromData = registry.value.map((c) => c.genre)
    return collectUniqueStrings([...DEFAULT_GENRES, ...fromData])
  })

  const nationaliteSuggestions = computed(() =>
    collectUniqueStrings(registry.value.map((c) => c.nationalite)),
  )

  const adresseSuggestions = computed(() =>
    collectUniqueStrings(registry.value.map((c) => c.adresse)),
  )

  const numTelSuggestions = computed(() =>
    collectUniqueStrings(registry.value.map((c) => c.numTel)),
  )

  const juridictionSuggestions = computed(() =>
    collectFromRecords(dossiersRaw.value, ['juridiction']),
  )

  const motifSuggestions = computed(() =>
    collectFromRecords(dossiersRaw.value, ['motif', 'titre']),
  )

  const partieEnCauseSuggestions = computed(() =>
    collectFromRecords(dossiersRaw.value, ['partie_en_cause']),
  )

  const deviseSuggestions = computed(() =>
    collectFromRecords(dossiersRaw.value, ['deviseHonoraires']),
  )

  return {
    clientsRaw,
    registry,
    dossiersRaw,
    affectationsRaw,
    avocatsRaw,
    avocatNames,
    loading,
    loaded,
    error,
    realtimeActive,
    startRealtime,
    stopRealtime,
    loadRegistry,
    searchByName,
    findExactByName,
    syncForDossier,
    updateClient,
    getClientDetail,
    fetchClientDetail,
    fetchClientRecord,
    getDossierAvocats,
    getClientAvocatsLabel,
    formatDossierAvocatsLabel,
    genreSuggestions,
    nationaliteSuggestions,
    adresseSuggestions,
    numTelSuggestions,
    juridictionSuggestions,
    motifSuggestions,
    partieEnCauseSuggestions,
    deviseSuggestions,
  }
})
