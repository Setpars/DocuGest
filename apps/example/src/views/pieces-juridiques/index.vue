<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  PIECES_JURIDIQUES_COMING_SOON,
  PIECES_JURIDIQUES_COMING_SOON_HINT,
} from '@/constants/features'
import PiecesJuridiquesEditor from '@/components/PiecesJuridiquesEditor/index.vue'

defineOptions({
  name: 'PiecesJuridiquesPage',
})

const route = useRoute()

const initialDossierId = computed(() => {
  const id = route.query.dossierId
  return typeof id === 'string' ? id : ''
})

const initialDocumentId = computed(() => {
  const id = route.query.documentId
  return typeof id === 'string' ? id : ''
})
</script>

<template>
  <div v-if="PIECES_JURIDIQUES_COMING_SOON" class="text-foreground flex min-h-full items-center justify-center p-6">
    <div class="max-w-md rounded-2xl bg-card p-8 text-center shadow-sm ring-1 ring-border">
      <div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <span class="i-carbon:document-add text-2xl text-slate-400" />
      </div>
      <h1 class="text-xl font-semibold">
        Pièces juridiques
      </h1>
      <p class="text-muted-foreground mt-2 text-sm">
        {{ PIECES_JURIDIQUES_COMING_SOON_HINT }}
      </p>
      <p class="text-muted-foreground mt-4 text-xs">
        La rédaction assistée (modèles, import PDF, impression) sera activée dans une prochaine version.
      </p>
      <RouterLink
        :to="{ name: 'enCours' }"
        class="mt-6 inline-block rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Retour aux dossiers en cours
      </RouterLink>
    </div>
  </div>
  <PiecesJuridiquesEditor
    v-else
    :initial-dossier-id="initialDossierId"
    :initial-document-id="initialDocumentId"
  />
</template>
