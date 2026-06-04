<script setup lang="ts">
/**
 * Champ texte avec suggestions issues des données déjà saisies (datalist).
 * Permet aussi une valeur nouvelle non présente dans la liste.
 */
defineOptions({
  name: 'DynamicSelect',
})

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: string[]
    listId: string
    placeholder?: string
    inputClass?: string
    type?: string
    autocomplete?: string
  }>(),
  {
    placeholder: '',
    inputClass:
      'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800',
    type: 'text',
    autocomplete: 'off',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: []
}>()

const value = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v),
})

const datalistId = computed(() => `dynamic-select-${props.listId}`)
</script>

<template>
  <div>
    <input
      v-model="value"
      :type="type"
      :list="options.length > 0 ? datalistId : undefined"
      :class="inputClass"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      @input="emit('input')"
    >
    <datalist v-if="options.length > 0" :id="datalistId">
      <option
        v-for="opt in options"
        :key="opt"
        :value="opt"
      />
    </datalist>
    <p
      v-if="options.length > 0"
      class="mt-1 text-xs text-slate-500"
    >
      {{ options.length }} valeur{{ options.length > 1 ? 's' : '' }} déjà utilisée{{ options.length > 1 ? 's' : '' }} — saisie libre possible
    </p>
  </div>
</template>
