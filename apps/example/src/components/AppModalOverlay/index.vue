<script setup lang="ts">
defineOptions({
  name: 'AppModalOverlay',
})

const props = withDefaults(
  defineProps<{
    open: boolean
    /** largeur max du panneau (classe tailwind, ex. max-w-2xl) */
    maxWidth?: string
    /** centrer verticalement le panneau */
    centered?: boolean
  }>(),
  {
    maxWidth: 'max-w-2xl',
    centered: true,
  },
)

const emit = defineEmits<{
  close: []
}>()

function onBackdropClick() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="app-modal-overlay"
      role="dialog"
      aria-modal="true"
      @click="onBackdropClick"
    >
      <div
        class="app-modal-overlay__wrap"
        :class="props.centered ? 'app-modal-overlay__wrap--center' : 'app-modal-overlay__wrap--start'"
      >
        <div
          class="app-modal-overlay__dialog"
          :class="props.maxWidth"
          @click.stop
        >
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
