<script setup lang="ts">
import type { DossierStatut } from '@/utils/dossier-view-map'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { PIECES_JURIDIQUES_COMING_SOON } from '@/constants/features'
import { AUTH_DOSSIERS, PERMISSIONS } from '@/constants/permissions'
import { useDomainClientsStore } from '@/store/modules/domain/clients'
import {
  formatAvocatsLabel,
  resolveDossierAvocats,
} from '@/utils/affectation'
import { collectUniqueStrings } from '@/utils/collect-field-suggestions'
import { COMING_SOON_CONTROL_CLASS, comingSoonTitle } from '@/utils/coming-soon'
import { mapDossierDocFromRaw } from '@/utils/dossier-view-map'

defineOptions({
  name: 'DossiersEnCours',
})

interface Dossier {
  id: string
  motif: string
  partie_en_cause: string
  date_ouverture: string
  resume_affaire: string
  statut: DossierStatut
  juridiction: string
  clientNom: string
  clientTelephone: string
  montantHonorairesTotal: number
  noteHonoraireId?: string
  avocatId?: string
}

const STATUT_META: Record<'Ouvert' | 'En cours', { label: string, badgeClass: string }> = {
  'Ouvert': {
    label: 'Ouvert',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  },
  'En cours': {
    label: 'En cours',
    badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
  },
}

const router = useRouter()
const clientsStore = useDomainClientsStore()
const { auth: hasAuth } = useAppAuth()

const canViewDossiers = computed(() => hasAuth([...AUTH_DOSSIERS]))
const canManagePaiements = computed(() => hasAuth(PERMISSIONS.paiements))
const canNoteHonoraire = computed(() => hasAuth(PERMISSIONS.noteHonoraire))
const canPieces = computed(() => hasAuth(PERMISSIONS.piecesJuridiques))

const dossiers = computed(() =>
  clientsStore.dossiersRaw
    .map(item => mapDossierDocFromRaw(item))
    .filter(item => item.statut === 'En cours' || item.statut === 'Ouvert')
    .map(item => ({
      id: item.id,
      motif: item.motif,
      partie_en_cause: item.partie_en_cause,
      date_ouverture: item.date_ouverture,
      resume_affaire: item.resume_affaire,
      statut: item.statut === 'En cours' ? 'En cours' as const : 'Ouvert' as const,
      juridiction: item.juridiction,
      clientNom: item.clientNom,
      clientTelephone: item.clientTelephone,
      montantHonorairesTotal: item.montantHonorairesTotal,
      noteHonoraireId: item.noteHonoraireId,
      avocatId: item.avocatId,
    })),
)

function noteHonoraireQueryForDossier(dossier: Dossier) {
  const query: Record<string, string> = { dossierId: dossier.id }
  if (dossier.noteHonoraireId) {
    query.documentId = dossier.noteHonoraireId
  }
  return query
}
const affectations = computed(() => clientsStore.affectationsRaw)
const avocats = computed(() => clientsStore.avocatsRaw)
const loading = computed(() => clientsStore.loading && !clientsStore.loaded)
const search = ref('')
const filterStatut = ref<'' | 'Ouvert' | 'En cours'>('')
const selectedJurisdiction = ref<string | null>(null)

function formatDate(value?: string) {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const avocatNameMap = computed(() => {
  const map: Record<string, string> = {}
  for (const item of avocats.value) {
    map[item.id] = item.nom
  }
  return map
})

function getSuiviLabel(dossier: Dossier) {
  return formatAvocatsLabel(
    resolveDossierAvocats(
      dossier.id,
      affectations.value,
      avocatNameMap.value,
      dossier.avocatId,
    ),
  )
}

onMounted(() => {
  void clientsStore.loadRegistry()
})

watch([search, filterStatut, selectedJurisdiction], () => {})

const jurisdictions = computed(() =>
  collectUniqueStrings([
    ...dossiers.value.map(d => d.juridiction),
    ...clientsStore.juridictionSuggestions,
  ]),
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return dossiers.value.filter((d) => {
    const matchStatut = !filterStatut.value || d.statut === filterStatut.value
    const matchJur = !selectedJurisdiction.value || d.juridiction === selectedJurisdiction.value
    const matchSearch = !q || [
      d.motif,
      d.clientNom,
      d.partie_en_cause,
      d.juridiction,
      getSuiviLabel(d),
    ].some(field => field.toLowerCase().includes(q))
    return matchStatut && matchJur && matchSearch
  })
})

const totals = computed(() => ({
  total: dossiers.value.length,
  ouvert: dossiers.value.filter(d => d.statut === 'Ouvert').length,
  enCours: dossiers.value.filter(d => d.statut === 'En cours').length,
  sansAvocat: dossiers.value.filter(d => getSuiviLabel(d) === 'En attente d’avocat').length,
}))

function openRedaction(_dossierId: string) {
  if (PIECES_JURIDIQUES_COMING_SOON) {
    return
  }
  router.push({
    name: 'piecesJuridiques',
    query: { dossierId: _dossierId },
  })
}
</script>

<template>
  <div class="text-foreground min-h-full">
    <div class="mx-auto p-4 max-w-[1600px] sm:p-6">
      <header class="mb-6 px-6 py-5 rounded-2xl bg-card flex flex-col gap-4 ring-1 ring-border shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs text-primary tracking-wide font-semibold uppercase">
            Secrétariat · Suivi actif
          </p>
          <h1 class="text-2xl font-semibold">
            Dossiers en cours
          </h1>
          <p class="text-sm text-muted-foreground mt-1">
            Affaires ouvertes ou en traitement — accès rapide à la rédaction des pièces juridiques.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <RouterLink
            v-if="canViewDossiers"
            :to="{ name: 'dossiers' }"
            class="text-sm px-4 py-2.5 border border-border rounded-xl hover:bg-accent"
          >
            Tous les dossiers
          </RouterLink>
          <template v-if="canPieces">
            <span
              v-if="PIECES_JURIDIQUES_COMING_SOON"
              class="text-sm text-muted-foreground font-medium px-4 py-2.5 border border-border rounded-xl bg-muted" :class="[COMING_SOON_CONTROL_CLASS]"
              :title="comingSoonTitle()"
            >
              Rédiger une pièce
              <ComingSoonBadge />
            </span>
            <RouterLink
              v-else
              :to="{ name: 'piecesJuridiques' }"
              class="text-sm text-primary-foreground font-medium px-4 py-2.5 rounded-xl bg-primary"
            >
              Rédiger une pièce
            </RouterLink>
          </template>
        </div>
      </header>

      <div class="mb-6 gap-4 grid sm:grid-cols-2 xl:grid-cols-4">
        <div class="p-4 rounded-2xl bg-card ring-1 ring-border">
          <div class="text-sm text-muted-foreground">
            Actifs
          </div>
          <div class="text-2xl font-semibold mt-2">
            {{ totals.total }}
          </div>
        </div>
        <div class="p-4 rounded-2xl bg-card ring-1 ring-border">
          <div class="text-sm text-muted-foreground">
            Ouverts
          </div>
          <div class="text-2xl text-blue-600 font-semibold mt-2">
            {{ totals.ouvert }}
          </div>
        </div>
        <div class="p-4 rounded-2xl bg-card ring-1 ring-border">
          <div class="text-sm text-muted-foreground">
            En cours
          </div>
          <div class="text-2xl text-amber-600 font-semibold mt-2">
            {{ totals.enCours }}
          </div>
        </div>
        <div class="p-4 rounded-2xl bg-card ring-1 ring-border">
          <div class="text-sm text-muted-foreground">
            Sans avocat
          </div>
          <div class="text-2xl text-amber-600 font-semibold mt-2">
            {{ totals.sansAvocat }}
          </div>
        </div>
      </div>

      <div class="mb-6 p-4 rounded-2xl bg-card ring-1 ring-border">
        <div class="gap-3 grid md:grid-cols-[1fr_auto_auto] md:items-center">
          <input
            v-model="search"
            placeholder="Rechercher motif, client, juridiction, avocat…"
            class="text-sm px-4 py-2.5 outline-none border border-border rounded-xl bg-background w-full focus:ring-2 focus:ring-ring"
          >
          <select v-model="filterStatut" class="text-sm px-4 py-2.5 border border-border rounded-xl bg-background">
            <option value="">
              Tous (ouverts + en cours)
            </option>
            <option value="Ouvert">
              Ouvert uniquement
            </option>
            <option value="En cours">
              En cours uniquement
            </option>
          </select>
          <span class="text-sm text-muted-foreground">{{ filtered.length }} dossier(s)</span>
        </div>
      </div>

      <div class="gap-6 grid lg:grid-cols-[260px_1fr]">
        <aside class="rounded-2xl bg-card ring-1 ring-border">
          <div class="px-4 py-3 border-b border-border">
            <h2 class="text-xs text-muted-foreground tracking-wide font-semibold uppercase">
              Juridictions
            </h2>
          </div>
          <div class="p-3 max-h-[55vh] overflow-y-auto">
            <button
              type="button"
              class="text-sm mb-1 px-3 py-2 text-left rounded-xl flex w-full transition items-center justify-between"
              :class="!selectedJurisdiction ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
              @click="selectedJurisdiction = null"
            >
              <span>Toutes</span>
              <span class="text-xs font-medium">{{ dossiers.length }}</span>
            </button>
            <button
              v-for="j in jurisdictions"
              :key="j"
              type="button"
              class="text-sm mb-1 px-3 py-2 text-left rounded-xl flex w-full transition items-center justify-between"
              :class="selectedJurisdiction === j ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
              @click="selectedJurisdiction = j"
            >
              <span class="pr-2 truncate">{{ j }}</span>
              <span class="text-xs shrink-0">{{ dossiers.filter((d) => d.juridiction === j).length }}</span>
            </button>
          </div>
        </aside>

        <main>
          <div v-if="loading" class="text-muted-foreground p-10 text-center rounded-2xl bg-card ring-1 ring-border">
            Chargement…
          </div>

          <div v-else-if="filtered.length === 0" class="p-12 text-center rounded-2xl bg-card ring-1 ring-border">
            <p class="text-muted-foreground">
              Aucun dossier en cours ne correspond à vos critères.
            </p>
            <RouterLink
              v-if="canViewDossiers"
              :to="{ name: 'dossiers' }"
              class="text-sm text-primary font-medium mt-4 inline-block"
            >
              Voir tous les dossiers
            </RouterLink>
          </div>

          <div v-else class="gap-4 grid sm:grid-cols-2 xl:grid-cols-3">
            <article
              v-for="dossier in filtered"
              :key="dossier.id"
              class="p-5 rounded-2xl bg-card flex flex-col ring-1 ring-border transition hover:ring-primary/40"
            >
              <div class="mb-3 flex gap-2 items-start justify-between">
                <span
                  class="text-xs font-medium px-2.5 py-0.5 rounded-full"
                  :class="STATUT_META[dossier.statut as 'Ouvert' | 'En cours']?.badgeClass ?? STATUT_META.Ouvert.badgeClass"
                >
                  {{ dossier.statut }}
                </span>
                <span class="text-xs text-muted-foreground">{{ formatDate(dossier.date_ouverture) }}</span>
              </div>

              <h3 class="text-lg leading-snug font-semibold line-clamp-2">
                {{ dossier.motif }}
              </h3>
              <p class="text-sm text-muted-foreground mt-1">
                {{ dossier.clientNom || 'Client non renseigné' }}
              </p>
              <p class="text-xs text-muted-foreground mt-2 line-clamp-2">
                {{ dossier.juridiction }} · {{ getSuiviLabel(dossier) }}
              </p>
              <p v-if="dossier.resume_affaire" class="text-xs text-muted-foreground mt-2 line-clamp-2">
                {{ dossier.resume_affaire }}
              </p>

              <div class="mt-auto pt-4 flex flex-wrap gap-2">
                <RouterLink
                  v-if="canViewDossiers"
                  :to="{
                    name: 'dossierFiche',
                    params: { dossierId: dossier.id },
                    query: { from: 'enCours' },
                  }"
                  class="text-xs text-violet-800 font-medium px-3 py-2 rounded-xl bg-violet-100 dark:text-violet-200 dark:bg-violet-900/40"
                >
                  Fiche de suivi
                </RouterLink>
                <RouterLink
                  v-if="canManagePaiements"
                  :to="{ name: 'paiement', query: { dossierId: dossier.id, open: 'add' } }"
                  class="text-xs text-emerald-800 font-medium px-3 py-2 rounded-xl bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-900/40"
                >
                  Paiement
                </RouterLink>
                <template v-if="canPieces">
                  <span
                    v-if="PIECES_JURIDIQUES_COMING_SOON"
                    class="text-xs text-muted-foreground font-medium px-3 py-2 border border-border rounded-xl bg-muted" :class="[COMING_SOON_CONTROL_CLASS]"
                    :title="comingSoonTitle()"
                  >
                    Rédiger une pièce
                  </span>
                  <button
                    v-else
                    type="button"
                    class="text-xs text-primary-foreground font-medium px-3 py-2 rounded-xl bg-primary"
                    @click="openRedaction(dossier.id)"
                  >
                    Rédiger une pièce
                  </button>
                </template>
                <RouterLink
                  v-if="canNoteHonoraire && !dossier.noteHonoraireId"
                  :to="{ name: 'noteHonoraire', query: { dossierId: dossier.id } }"
                  class="text-xs px-3 py-2 border border-border rounded-xl hover:bg-accent"
                >
                  Note honoraire
                </RouterLink>
                <RouterLink
                  v-else-if="canNoteHonoraire && dossier.noteHonoraireId"
                  :to="{ name: 'noteHonoraire', query: noteHonoraireQueryForDossier(dossier) }"
                  class="text-xs px-3 py-2 border border-border rounded-xl hover:bg-accent"
                >
                  Ouvrir note
                </RouterLink>
              </div>
            </article>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
