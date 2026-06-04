<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import DossierFicheConsultation from '@/components/DossierFicheConsultation/index.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { db } from '@/firebase'
import { subscribeDossierInsight } from '@/services/dossier-insight-realtime'
import type { DossierInsight } from '@/types/dossier-insight'
import { printFicheConsultation } from '@/utils/print-document'

defineOptions({
  name: 'DossierFichePage',
})

const route = useRoute()
const { auth: hasAuth } = useAppAuth()

const loading = ref(true)
const error = ref('')
const insight = ref<DossierInsight | null>(null)

let unsubscribe: (() => void) | null = null

const dossierId = computed(() => String(route.params.dossierId ?? ''))

const canNoteHonoraire = computed(() => hasAuth(PERMISSIONS.noteHonoraire))
const canAgenda = computed(() => hasAuth(PERMISSIONS.agenda))
const canPaiements = computed(() => hasAuth(PERMISSIONS.paiements))
const canPieces = computed(() => hasAuth(PERMISSIONS.piecesJuridiques))
const canAvocats = computed(() => hasAuth(PERMISSIONS.avocats))

const backLink = computed(() => {
  const from = typeof route.query.from === 'string' ? route.query.from : ''
  const avocatId = typeof route.query.avocatId === 'string' ? route.query.avocatId : ''
  const clientId = typeof route.query.clientId === 'string' ? route.query.clientId : ''

  if (from === 'avocats' || route.name === 'doyenDossierDetail') {
    if (avocatId) {
      return {
        to: { name: 'avocatHistorique', params: { avocatId } },
        label: '← Historique avocat',
      }
    }
    return { to: { name: 'avocats' }, label: '← Gestion des avocats' }
  }
  if (from === 'client' && clientId) {
    return {
      to: { name: 'clientDetail', params: { clientId } },
      label: '← Fiche client',
    }
  }
  if (from === 'enCours') {
    return { to: { name: 'enCours' }, label: '← Dossiers en cours' }
  }
  return { to: { name: 'dossiers' }, label: '← Tous les dossiers' }
})

function startRealtimeSync(id: string) {
  unsubscribe?.()
  loading.value = true
  error.value = ''

  unsubscribe = subscribeDossierInsight(db, id, {
    onData: (data) => {
      insight.value = data
      if (!data && !error.value) {
        error.value = 'Ce dossier n’existe pas ou a été supprimé.'
      }
    },
    onError: (message) => {
      error.value = message
    },
    onReady: () => {
      loading.value = false
    },
  })
}

watch(dossierId, (id) => {
  if (!id) {
    error.value = 'Identifiant de dossier manquant.'
    insight.value = null
    loading.value = false
    unsubscribe?.()
    unsubscribe = null
    return
  }
  startRealtimeSync(id)
}, { immediate: true })

onUnmounted(() => {
  unsubscribe?.()
  unsubscribe = null
})

function imprimerFiche() {
  if (!insight.value) return
  printFicheConsultation(insight.value)
}
</script>

<template>
  <div class="text-foreground min-h-full p-4 sm:p-6">
    <div class="mx-auto max-w-6xl">
      <header class="fiche-consultation-no-print mb-6 flex flex-wrap items-center gap-3">
        <RouterLink
          :to="backLink.to"
          class="rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          {{ backLink.label }}
        </RouterLink>
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-semibold">
            Fiche de consultation — suivi du dossier
          </h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Formulaire officiel EMK&C imprimable, puis synthèse du suivi (avocats, notes, paiements).
            Les données se mettent à jour automatiquement.
          </p>
        </div>
        <button
          v-if="insight"
          type="button"
          class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          @click="imprimerFiche"
        >
          Imprimer la fiche
        </button>
      </header>

      <DossierFicheConsultation
        :insight="insight"
        :loading="loading"
        :error="error"
        :dossier-id="dossierId"
        :can-note-honoraire="canNoteHonoraire"
        :can-agenda="canAgenda"
        :can-paiements="canPaiements"
        :can-pieces="canPieces"
        :can-avocats="canAvocats"
      />
    </div>
  </div>
</template>
