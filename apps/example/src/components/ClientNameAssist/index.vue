<script setup lang="ts">
import type { ClientFormData, ClientRecord } from '@/types/client'

defineOptions({
  name: 'ClientNameAssist',
})

const props = defineProps<{
  modelValue: ClientFormData
  inputClass?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ClientFormData]
}>()

const form = computed({
  get: () => props.modelValue,
  set: (value: ClientFormData) => emit('update:modelValue', value),
})

const {
  suggestions,
  exactMatches,
  showDuplicateNotice,
  selectExistingClient,
  dismissDuplicateNotice,
} = useClientNameLookup(form)

function onSelect(client: ClientRecord) {
  selectExistingClient(client)
}
</script>

<template>
  <div class="space-y-2">
    <label class="mb-1.5 block text-sm font-medium">
      Nom complet <span class="text-rose-500">*</span>
    </label>
    <input
      v-model="form.nom"
      type="text"
      :class="inputClass"
      placeholder="Ex. KABONGO Jean-Pierre"
      autocomplete="name"
    >

    <div
      v-if="showDuplicateNotice"
      class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
    >
      <p class="font-medium">
        Un client avec ce nom existe déjà
      </p>
      <p class="mt-0.5 text-xs opacity-90">
        Sélectionnez-le ci-dessous pour réutiliser ses informations et éviter un doublon.
      </p>
      <ul class="mt-2 space-y-1">
        <li
          v-for="client in exactMatches"
          :key="client.id"
        >
          <button
            type="button"
            class="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-sm hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:hover:bg-amber-900/30"
            @click="onSelect(client)"
          >
            <span class="font-medium">{{ client.nom }}</span>
            <span v-if="client.numTel" class="text-muted-foreground ml-2 text-xs">{{ client.numTel }}</span>
          </button>
        </li>
      </ul>
      <button
        type="button"
        class="mt-2 text-xs underline opacity-80"
        @click="dismissDuplicateNotice"
      >
        Continuer avec un nouveau nom
      </button>
    </div>

    <ul
      v-else-if="suggestions.length > 0 && form.nom.trim().length >= 2"
      class="max-h-40 overflow-y-auto rounded-lg border border-border bg-card text-sm shadow-sm"
    >
      <li
        v-for="client in suggestions"
        :key="client.id"
        class="border-b border-border last:border-b-0"
      >
        <button
          type="button"
          class="w-full px-3 py-2 text-left hover:bg-accent"
          @click="onSelect(client)"
        >
          {{ client.nom }}
          <span v-if="client.numTel" class="text-muted-foreground ml-1 text-xs">· {{ client.numTel }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
