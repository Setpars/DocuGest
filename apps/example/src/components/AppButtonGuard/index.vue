<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'AppButtonGuard',
})

const props = withDefaults(
  defineProps<{
    /** Action indisponible (données manquantes, erreur, etc.) */
    blocked?: boolean
    /** Message affiché au survol et sous le bouton si showHint */
    reason?: string
    loading?: boolean
    /** Affiche le motif sous le bouton (utile dans les modales) */
    showHint?: boolean
    inline?: boolean
  }>(),
  {
    blocked: false,
    reason: '',
    loading: false,
    showHint: false,
    inline: true,
  },
)

const isBlocked = computed(() => props.blocked || props.loading)

const hint = computed(() => {
  if (props.loading) return 'Chargement en cours…'
  if (props.reason) return props.reason
  return 'Action indisponible'
})
</script>

<template>
  <div
    class="flex flex-col gap-1"
    :class="inline ? 'inline-flex max-w-full' : 'w-full'"
  >
    <span
      class="inline-flex max-w-full"
      :class="isBlocked ? 'cursor-not-allowed' : ''"
      :title="isBlocked ? hint : undefined"
    >
      <slot :blocked="isBlocked" :hint="hint" />
    </span>
    <p
      v-if="isBlocked && showHint && hint"
      class="text-muted-foreground max-w-sm text-[11px] leading-snug"
      role="status"
    >
      {{ hint }}
    </p>
  </div>
</template>
