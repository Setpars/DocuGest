<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { db } from '@/firebase'
import { loadAvocatHistorique } from '@/services/dossier-insight'
import type { AvocatHistoriqueSummary } from '@/types/dossier-insight'
import { formatDateFr } from '@/utils/date'
import { ISSUE_CATEGORY_META, type DossierIssueCategory } from '@/utils/dossier-resultat'

defineOptions({
  name: 'AvocatHistoriquePage',
})

const STATUT_CLASS: Record<string, string> = {
  Ouvert: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  'En cours': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  Suspendu: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  Clos: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
}

const route = useRoute()
const loading = ref(true)
const error = ref('')
const historique = ref<AvocatHistoriqueSummary | null>(null)
const search = ref('')
const filterIssue = ref<'all' | DossierIssueCategory>('all')

const avocatId = computed(() => String(route.params.avocatId ?? ''))

const filteredEntries = computed(() => {
  const list = historique.value?.entries ?? []
  const q = search.value.trim().toLowerCase()
  return list.filter((entry) => {
    const matchIssue = filterIssue.value === 'all' || entry.issueCategory === filterIssue.value
    const matchSearch = !q || [
      entry.motif,
      entry.clientNom,
      entry.partie_en_cause,
      entry.juridiction,
      entry.statut,
    ].some((field) => field.toLowerCase().includes(q))
    return matchIssue && matchSearch
  })
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (!avocatId.value) {
      error.value = 'Avocat introuvable.'
      return
    }
    historique.value = await loadAvocatHistorique(db, avocatId.value)
    if (!historique.value) error.value = 'Cet avocat n’existe pas.'
  } catch {
    error.value = 'Erreur lors du chargement de l’historique.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

watch(avocatId, () => {
  void load()
})
</script>

<template>
  <div class="text-foreground min-h-full p-4 sm:p-6">
    <div class="mx-auto max-w-6xl">
      <header class="mb-6 flex flex-wrap items-center gap-3">
        <RouterLink
          :to="{ name: 'avocats' }"
          class="rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          ← Avocats
        </RouterLink>
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-semibold">
            Historique des dossiers
          </h1>
          <p v-if="historique" class="text-muted-foreground mt-1 text-sm">
            {{ historique.avocatNom }}
            <span v-if="historique.specialite"> · {{ historique.specialite }}</span>
          </p>
        </div>
      </header>

      <div
        v-if="loading"
        class="rounded-2xl bg-card p-10 text-center text-muted-foreground ring-1 ring-border"
      >
        Chargement…
      </div>

      <div
        v-else-if="error"
        class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      >
        {{ error }}
      </div>

      <template v-else-if="historique">
        <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div class="rounded-2xl bg-card p-4 ring-1 ring-border">
            <p class="text-muted-foreground text-xs uppercase">
              Total traités
            </p>
            <p class="mt-1 text-2xl font-semibold">
              {{ historique.total }}
            </p>
          </div>
          <div class="rounded-2xl bg-card p-4 ring-1 ring-border">
            <p class="text-xs uppercase text-amber-700 dark:text-amber-300">
              En cours
            </p>
            <p class="mt-1 text-2xl font-semibold">
              {{ historique.enCours }}
            </p>
          </div>
          <div class="rounded-2xl bg-card p-4 ring-1 ring-border">
            <p class="text-xs uppercase text-emerald-700 dark:text-emerald-300">
              Gagnées
            </p>
            <p class="mt-1 text-2xl font-semibold">
              {{ historique.gagne }}
            </p>
          </div>
          <div class="rounded-2xl bg-card p-4 ring-1 ring-border">
            <p class="text-xs uppercase text-rose-700 dark:text-rose-300">
              Perdues
            </p>
            <p class="mt-1 text-2xl font-semibold">
              {{ historique.perdu }}
            </p>
          </div>
          <div class="rounded-2xl bg-card p-4 ring-1 ring-border">
            <p class="text-muted-foreground text-xs uppercase">
              Clos (sans issue)
            </p>
            <p class="mt-1 text-2xl font-semibold">
              {{ historique.closSansIssue }}
            </p>
          </div>
        </div>

        <div class="mb-6 flex flex-col gap-3 sm:flex-row">
          <input
            v-model="search"
            type="search"
            placeholder="Rechercher (motif, client, juridiction…)"
            class="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
          >
          <select
            v-model="filterIssue"
            class="rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
          >
            <option value="all">
              Tous les dossiers
            </option>
            <option value="encours">
              En cours
            </option>
            <option value="gagne">
              Gagnées
            </option>
            <option value="perdu">
              Perdues
            </option>
            <option value="clos">
              Clos (sans issue)
            </option>
          </select>
        </div>

        <div
          v-if="filteredEntries.length === 0"
          class="rounded-2xl bg-card p-8 text-center text-muted-foreground ring-1 ring-border"
        >
          Aucun dossier ne correspond à vos critères.
        </div>

        <ul v-else class="space-y-4">
          <li
            v-for="entry in filteredEntries"
            :key="entry.dossierId"
            class="rounded-2xl bg-card p-5 ring-1 ring-border"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <h2 class="font-semibold">
                  {{ entry.motif }}
                </h2>
                <p class="text-muted-foreground mt-1 text-sm">
                  Client : {{ entry.clientNom || '—' }}
                  · {{ entry.juridiction || 'Juridiction non renseignée' }}
                </p>
                <p class="text-muted-foreground mt-0.5 text-xs">
                  Ouverture {{ formatDateFr(entry.date_ouverture) }}
                  <template v-if="entry.date_fermeture">
                    · Clôture {{ formatDateFr(entry.date_fermeture) }}
                  </template>
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-full px-3 py-1 text-xs font-medium"
                  :class="STATUT_CLASS[entry.statut] ?? ''"
                >
                  {{ entry.statut }}
                </span>
                <span
                  class="rounded-full px-3 py-1 text-xs font-medium"
                  :class="ISSUE_CATEGORY_META[entry.issueCategory].badgeClass"
                >
                  {{ ISSUE_CATEGORY_META[entry.issueCategory].label }}
                </span>
              </div>
            </div>

            <div
              v-if="entry.affectations.length"
              class="mt-4 rounded-xl bg-muted/30 p-3 text-sm"
            >
              <p class="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                Affectation(s) de cet avocat
              </p>
              <ul class="space-y-1.5">
                <li
                  v-for="aff in entry.affectations"
                  :key="aff.id"
                >
                  <span class="font-medium">{{ aff.role || 'Rôle non précisé' }}</span>
                  <span class="text-muted-foreground">
                    — depuis {{ formatDateFr(aff.date_affectation) }}
                    <template v-if="aff.statut"> · {{ aff.statut }}</template>
                  </span>
                </li>
              </ul>
            </div>

            <div class="mt-4">
              <RouterLink
                :to="{
                  name: 'doyenDossierDetail',
                  params: { dossierId: entry.dossierId },
                  query: { from: 'avocats', avocatId },
                }"
                class="inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Fiche de suivi complète
              </RouterLink>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
