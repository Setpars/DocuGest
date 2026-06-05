<script setup lang="ts">
import type { ClientFormData, ClientRecord } from '@/types/client'
import { useDomainClientsStore } from '@/store/modules/domain/clients'

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
  set: (value: ClientFormData) => {
    emit('update:modelValue', value)
  },
})

const clientsStore = useDomainClientsStore()

const {
  suggestions,
  exactMatches,
  ambiguousMatches,
  showDuplicateNotice,
  linkedClient,
  matchSource,
  selectExistingClient,
  dismissDuplicateNotice,
  clearLink,
} = useClientNameLookup(form)

const matchSourceLabel = computed(() => {
  switch (matchSource.value) {
    case 'nom':
      return 'nom identique'
    case 'tel':
      return 'numéro de téléphone'
    case 'email':
      return 'adresse e-mail'
    case 'manual':
      return 'sélection manuelle'
    default:
      return 'correspondance trouvée'
  }
})

function dossiersCountLabel(client: ClientRecord) {
  const count = clientsStore.getClientDossiersCount(client)
  if (count === 0) {
    return 'Aucun dossier'
  }
  return count === 1 ? '1 dossier' : `${count} dossiers`
}

function onSelect(client: ClientRecord) {
  selectExistingClient(client)
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-if="linkedClient && form.clientId"
      class="text-sm text-emerald-900 px-3 py-2.5 border border-emerald-300 rounded-lg bg-emerald-50 dark:text-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40"
      role="status"
    >
      <p class="font-medium">
        Client existant détecté ({{ matchSourceLabel }})
      </p>
      <p class="text-xs mt-0.5 opacity-90">
        <strong>{{ linkedClient.nom }}</strong>
        · {{ dossiersCountLabel(linkedClient) }}
        <span v-if="linkedClient.numTel"> · {{ linkedClient.numTel }}</span>
        <span v-if="linkedClient.email"> · {{ linkedClient.email }}</span>
      </p>
      <p class="text-xs mt-1 opacity-90">
        Les informations ont été pré-remplies. L’enregistrement créera un <strong>nouveau dossier</strong> lié à ce client, sans modifier sa fiche.
      </p>
      <button
        type="button"
        class="text-xs mt-2 opacity-80 underline"
        @click="clearLink"
      >
        Créer un nouveau client à la place
      </button>
    </div>

    <label class="text-sm font-medium mb-1.5 block">
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
      v-if="ambiguousMatches.length > 0 && !form.clientId"
      class="text-sm text-amber-900 px-3 py-2.5 border border-amber-300 rounded-lg bg-amber-50 dark:text-amber-100 dark:border-amber-800 dark:bg-amber-950/40"
      role="status"
    >
      <p class="font-medium">
        Plusieurs clients correspondent
      </p>
      <p class="text-xs mt-0.5 opacity-90">
        Sélectionnez le client concerné pour lier le nouveau dossier.
      </p>
      <ul class="mt-2 space-y-1">
        <li
          v-for="client in ambiguousMatches"
          :key="client.id"
        >
          <button
            type="button"
            class="text-sm px-3 py-2 text-left border border-amber-200 rounded-lg bg-white w-full dark:border-amber-800 dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            @click="onSelect(client)"
          >
            <span class="font-medium">{{ client.nom }}</span>
            <span class="text-xs text-muted-foreground ml-2">{{ dossiersCountLabel(client) }}</span>
            <span v-if="client.numTel" class="text-xs text-muted-foreground ml-2">{{ client.numTel }}</span>
            <span v-if="client.email" class="text-xs text-muted-foreground ml-2">{{ client.email }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div
      v-else-if="showDuplicateNotice"
      class="text-sm text-amber-900 px-3 py-2.5 border border-amber-300 rounded-lg bg-amber-50 dark:text-amber-100 dark:border-amber-800 dark:bg-amber-950/40"
      role="status"
    >
      <p class="font-medium">
        Plusieurs clients portent ce nom
      </p>
      <p class="text-xs mt-0.5 opacity-90">
        Sélectionnez le bon client pour créer un <strong>nouveau dossier</strong> lié (les dossiers existants sont conservés).
      </p>
      <ul class="mt-2 space-y-1">
        <li
          v-for="client in exactMatches"
          :key="client.id"
        >
          <button
            type="button"
            class="text-sm px-3 py-2 text-left border border-amber-200 rounded-lg bg-white w-full dark:border-amber-800 dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            @click="onSelect(client)"
          >
            <span class="font-medium">{{ client.nom }}</span>
            <span class="text-xs text-muted-foreground ml-2">{{ dossiersCountLabel(client) }}</span>
            <span v-if="client.numTel" class="text-xs text-muted-foreground ml-2">{{ client.numTel }}</span>
            <span v-if="client.email" class="text-xs text-muted-foreground ml-2">{{ client.email }}</span>
          </button>
        </li>
      </ul>
      <button
        type="button"
        class="text-xs mt-2 opacity-80 underline"
        @click="dismissDuplicateNotice"
      >
        Continuer avec un nouveau client
      </button>
    </div>

    <ul
      v-else-if="suggestions.length > 0 && form.nom.trim().length >= 2 && !form.clientId"
      class="text-sm border border-border rounded-lg bg-card max-h-40 shadow-sm overflow-y-auto"
    >
      <li
        v-for="client in suggestions"
        :key="client.id"
        class="border-b border-border last:border-b-0"
      >
        <button
          type="button"
          class="px-3 py-2 text-left w-full hover:bg-accent"
          @click="onSelect(client)"
        >
          {{ client.nom }}
          <span class="text-xs text-muted-foreground ml-1">· {{ dossiersCountLabel(client) }}</span>
          <span v-if="client.numTel" class="text-xs text-muted-foreground ml-1">· {{ client.numTel }}</span>
          <span v-if="client.email" class="text-xs text-muted-foreground ml-1">· {{ client.email }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
