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
  set: (value: ClientFormData) => emit('update:modelValue', value),
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
  if (count === 0) return 'Aucun dossier'
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
      class="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
      role="status"
    >
      <p class="font-medium">
        Client existant détecté ({{ matchSourceLabel }})
      </p>
      <p class="mt-0.5 text-xs opacity-90">
        <strong>{{ linkedClient.nom }}</strong>
        · {{ dossiersCountLabel(linkedClient) }}
        <span v-if="linkedClient.numTel"> · {{ linkedClient.numTel }}</span>
        <span v-if="linkedClient.email"> · {{ linkedClient.email }}</span>
      </p>
      <p class="mt-1 text-xs opacity-90">
        Les informations ont été pré-remplies. L’enregistrement créera un <strong>nouveau dossier</strong> lié à ce client, sans modifier sa fiche.
      </p>
      <button
        type="button"
        class="mt-2 text-xs underline opacity-80"
        @click="clearLink"
      >
        Créer un nouveau client à la place
      </button>
    </div>

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
      v-if="ambiguousMatches.length > 0 && !form.clientId"
      class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
    >
      <p class="font-medium">
        Plusieurs clients correspondent
      </p>
      <p class="mt-0.5 text-xs opacity-90">
        Sélectionnez le client concerné pour lier le nouveau dossier.
      </p>
      <ul class="mt-2 space-y-1">
        <li
          v-for="client in ambiguousMatches"
          :key="client.id"
        >
          <button
            type="button"
            class="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-sm hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:hover:bg-amber-900/30"
            @click="onSelect(client)"
          >
            <span class="font-medium">{{ client.nom }}</span>
            <span class="text-muted-foreground ml-2 text-xs">{{ dossiersCountLabel(client) }}</span>
            <span v-if="client.numTel" class="text-muted-foreground ml-2 text-xs">{{ client.numTel }}</span>
            <span v-if="client.email" class="text-muted-foreground ml-2 text-xs">{{ client.email }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div
      v-else-if="showDuplicateNotice"
      class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
    >
      <p class="font-medium">
        Plusieurs clients portent ce nom
      </p>
      <p class="mt-0.5 text-xs opacity-90">
        Sélectionnez le bon client pour créer un <strong>nouveau dossier</strong> lié (les dossiers existants sont conservés).
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
            <span class="text-muted-foreground ml-2 text-xs">{{ dossiersCountLabel(client) }}</span>
            <span v-if="client.numTel" class="text-muted-foreground ml-2 text-xs">{{ client.numTel }}</span>
            <span v-if="client.email" class="text-muted-foreground ml-2 text-xs">{{ client.email }}</span>
          </button>
        </li>
      </ul>
      <button
        type="button"
        class="mt-2 text-xs underline opacity-80"
        @click="dismissDuplicateNotice"
      >
        Continuer avec un nouveau client
      </button>
    </div>

    <ul
      v-else-if="suggestions.length > 0 && form.nom.trim().length >= 2 && !form.clientId"
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
          <span class="text-muted-foreground ml-1 text-xs">· {{ dossiersCountLabel(client) }}</span>
          <span v-if="client.numTel" class="text-muted-foreground ml-1 text-xs">· {{ client.numTel }}</span>
          <span v-if="client.email" class="text-muted-foreground ml-1 text-xs">· {{ client.email }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
