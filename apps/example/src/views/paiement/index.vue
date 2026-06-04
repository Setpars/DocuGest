<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PaiementManager from '@/components/PaiementManager/index.vue'

defineOptions({
  name: 'PaiementPage',
})

const route = useRoute()

const initialDossierId = computed(() => {
  const id = route.query.dossierId
  return typeof id === 'string' ? id : ''
})
</script>

<template>
  <PaiementManager :initial-dossier-id="initialDossierId" />
</template>
