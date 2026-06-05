<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useDomainClientsStore } from '@/store/modules/domain/clients'
import type { ClientRecord } from '@/types/client'
import { filterDossiersForClient } from '@/services/client-dossier'

defineOptions({
  name: 'ClientsListPage',
})

const OPEN_STATUTS = ['Ouvert', 'En cours']

const clientsStore = useDomainClientsStore()
const search = ref('')
const filterDossiers = ref<'all' | 'with' | 'open'>('all')
const loading = ref(true)

const clientsWithStats = computed(() => {
  return clientsStore.registry
    .filter((client) => !client.id.startsWith('dossier:'))
    .map((client) => {
      const dossiers = filterDossiersForClient(clientsStore.dossiersRaw, client)
      const openCount = dossiers.filter((d) => OPEN_STATUTS.includes(d.statut)).length
      return {
        client,
        dossiersCount: dossiers.length,
        openCount,
        avocatsLabel: clientsStore.getClientAvocatsLabel(client),
      }
    })
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return clientsWithStats.value.filter((row) => {
    const matchSearch = !q
      || row.client.nom.toLowerCase().includes(q)
      || row.client.numTel.toLowerCase().includes(q)
      || row.client.nationalite.toLowerCase().includes(q)

    const matchFilter =
      filterDossiers.value === 'all'
      || (filterDossiers.value === 'with' && row.dossiersCount > 0)
      || (filterDossiers.value === 'open' && row.openCount > 0)

    return matchSearch && matchFilter
  })
})

onMounted(async () => {
  loading.value = true
  try {
    await clientsStore.loadRegistry()
  } finally {
    loading.value = false
  }
})

function canOpenDetail(client: ClientRecord) {
  return client.id && !client.id.startsWith('dossier:')
}
</script>

<template>
  <div class="text-foreground min-h-full p-4 sm:p-6">
    <div class="mx-auto max-w-6xl">
      <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">
            Clients
          </h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Recherche et modification des fiches — création via un nouveau dossier.
          </p>
        </div>
        <RouterLink
          :to="{ name: 'dossiers', query: { open: 'add' } }"
          class="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          + Nouveau dossier
        </RouterLink>
      </header>

      <div class="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          v-model="search"
          type="search"
          placeholder="Rechercher (nom, téléphone, nationalité…)"
          class="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
        >
        <select
          v-model="filterDossiers"
          class="rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
        >
          <option value="all">
            Tous les clients
          </option>
          <option value="with">
            Avec au moins un dossier
          </option>
          <option value="open">
            Avec dossier ouvert / en cours
          </option>
        </select>
      </div>

      <div
        v-if="loading"
        class="rounded-2xl bg-card p-8 text-center text-muted-foreground ring-1 ring-border"
      >
        Chargement…
      </div>

      <div
        v-else-if="filtered.length === 0"
        class="rounded-2xl bg-card p-8 text-center text-muted-foreground ring-1 ring-border"
      >
        Aucun client trouvé.
      </div>

      <div v-else class="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-4 py-3">
                Nom
              </th>
              <th class="hidden px-4 py-3 sm:table-cell">
                Téléphone
              </th>
              <th class="hidden px-4 py-3 md:table-cell">
                Nationalité
              </th>
              <th class="px-4 py-3 text-center">
                Dossiers
              </th>
              <th class="px-4 py-3 text-center">
                Actifs
              </th>
              <th class="hidden px-4 py-3 lg:table-cell">
                Avocat(s) en charge
              </th>
              <th class="px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="row in filtered"
              :key="row.client.id"
              class="hover:bg-accent/40"
            >
              <td class="px-4 py-3 font-medium">
                {{ row.client.nom }}
              </td>
              <td class="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {{ row.client.numTel || '—' }}
              </td>
              <td class="hidden px-4 py-3 text-muted-foreground md:table-cell">
                {{ row.client.nationalite || '—' }}
              </td>
              <td class="px-4 py-3 text-center">
                {{ row.dossiersCount }}
              </td>
              <td class="px-4 py-3 text-center">
                <span
                  class="inline-flex min-w-[1.5rem] justify-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="row.openCount > 0
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                    : 'bg-muted text-muted-foreground'"
                >
                  {{ row.openCount }}
                </span>
              </td>
              <td class="hidden max-w-[14rem] truncate px-4 py-3 text-muted-foreground lg:table-cell" :title="row.avocatsLabel">
                {{ row.avocatsLabel }}
              </td>
              <td class="px-4 py-3 text-right">
                <div v-if="canOpenDetail(row.client)" class="flex flex-wrap justify-end gap-2">
                  <RouterLink
                    :to="{ name: 'clientDetail', params: { clientId: row.client.id } }"
                    class="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
                  >
                    Fiche
                  </RouterLink>
                  <RouterLink
                    :to="{ name: 'dossiers', query: { clientId: row.client.id, open: 'add' } }"
                    class="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
                  >
                    + Dossier
                  </RouterLink>
                  <RouterLink
                    :to="{ name: 'clientDetail', params: { clientId: row.client.id }, query: { edit: '1' } }"
                    class="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                  >
                    Modifier
                  </RouterLink>
                </div>
                <span v-else class="text-muted-foreground text-xs">Fiche à consolider</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
