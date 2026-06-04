<script setup lang="ts">
import type { ClientFormData } from '@/types/client'
import { useDomainClientsStore } from '@/store/modules/domain/clients'
import ClientNameAssist from '@/components/ClientNameAssist/index.vue'
import DynamicSelect from '@/components/DynamicSelect/index.vue'

defineOptions({
  name: 'ClientFormFields',
})

const props = withDefaults(
  defineProps<{
    modelValue: ClientFormData
    inputClass?: string
  }>(),
  {
    inputClass:
      'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: ClientFormData]
}>()

const clientsStore = useDomainClientsStore()

const form = computed({
  get: () => props.modelValue,
  set: (value: ClientFormData) => emit('update:modelValue', value),
})

onMounted(() => {
  void clientsStore.loadRegistry()
})
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <div class="sm:col-span-2">
      <ClientNameAssist
        v-model="form"
        :input-class="inputClass"
      />
      <p class="mt-1 text-xs text-slate-500">
        La fiche client est créée ou mise à jour à l’enregistrement du dossier.
      </p>
    </div>

    <div>
      <label class="mb-1.5 block text-sm font-medium">Genre</label>
      <select v-model="form.genre" :class="inputClass">
        <option value="">
          — Sélectionner —
        </option>
        <option
          v-for="g in clientsStore.genreSuggestions"
          :key="g"
          :value="g"
        >
          {{ g }}
        </option>
      </select>
    </div>

    <div>
      <label class="mb-1.5 block text-sm font-medium">Nationalité</label>
      <DynamicSelect
        v-model="form.nationalite"
        list-id="client-nationalite"
        :options="clientsStore.nationaliteSuggestions"
        :input-class="inputClass"
        placeholder="Ex. Congolaise"
      />
    </div>

    <div class="sm:col-span-2">
      <label class="mb-1.5 block text-sm font-medium">Adresse</label>
      <DynamicSelect
        v-model="form.adresse"
        list-id="client-adresse"
        :options="clientsStore.adresseSuggestions"
        :input-class="inputClass"
        placeholder="Ex. Av. Kasa-Vubu, Lubumbashi"
      />
    </div>

    <div class="sm:col-span-2">
      <label class="mb-1.5 block text-sm font-medium">Téléphone</label>
      <DynamicSelect
        v-model="form.numTel"
        list-id="client-tel"
        type="tel"
        autocomplete="tel"
        :options="clientsStore.numTelSuggestions"
        :input-class="inputClass"
        placeholder="Ex. +243 99 000 00 00"
      />
    </div>
  </div>
</template>
