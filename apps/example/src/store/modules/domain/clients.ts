import { db } from '@/firebase'
import { fetchAllAffectations, fetchAvocatNameMap } from '@/services/affectation'
import {
  buildClientRegistry,
  fetchAllClients,
  fetchAllDossiersRaw,
  filterDossiersForClient,
  findExactClientInRegistry,
  getClientById,
  loadClientWithDossiers,
  searchClientsInRegistry,
  syncClientForDossier,
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
  const registry = ref<ClientRecord[]>([])
  const dossiersRaw = ref<Record<string, unknown>[]>([])
  const affectationsRaw = ref<AffectationRecord[]>([])
  const avocatNames = ref<Record<string, string>>({})
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')

  async function loadRegistry(force = false) {
    if (loaded.value && !force) return
    loading.value = true
    error.value = ''
    try {
      const [clients, dossiers, affectations, avocats] = await Promise.all([
        fetchAllClients(db),
        fetchAllDossiersRaw(db),
        fetchAllAffectations(db),
        fetchAvocatNameMap(db),
      ])
      dossiersRaw.value = dossiers
      affectationsRaw.value = affectations
      avocatNames.value = avocats
      registry.value = buildClientRegistry(clients, dossiers)
      loaded.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur chargement clients'
      throw err
    } finally {
      loading.value = false
    }
  }

  function searchByName(query: string, limit = 8) {
    return searchClientsInRegistry(registry.value, query, limit)
  }

  function findExactByName(nom: string) {
    return findExactClientInRegistry(registry.value, nom)
  }

  async function syncForDossier(form: ClientFormData) {
    const result = await syncClientForDossier(db, form, registry.value)
    await loadRegistry(true)
    return result
  }

  async function fetchClientDetail(clientId: string): Promise<ClientWithDossiers | null> {
    await loadRegistry()
    const fromDb = await loadClientWithDossiers(db, clientId)
    if (fromDb) return fromDb

    const fallback = registry.value.find((item) => item.id === clientId)
    if (!fallback) return null

    const dossiers = filterDossiersForClient(
      dossiersRaw.value,
      fallback,
      affectationsRaw.value,
      avocatNames.value,
    )
    return {
      ...fallback,
      dossiers,
      dossiersCount: dossiers.length,
    }
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
    registry,
    dossiersRaw,
    affectationsRaw,
    avocatNames,
    loading,
    loaded,
    error,
    loadRegistry,
    searchByName,
    findExactByName,
    syncForDossier,
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
