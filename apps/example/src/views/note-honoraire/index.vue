<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NoteHonoraireEditor from '@/components/NoteHonoraireEditor/index.vue'

defineOptions({
  name: 'NoteHonorairePage',
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
  <NoteHonoraireEditor
    :initial-dossier-id="initialDossierId"
    :initial-document-id="initialDocumentId"
  />
</template>
