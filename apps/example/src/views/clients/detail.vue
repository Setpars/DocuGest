<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ClientFormFields from '@/components/ClientFormFields/index.vue'
import { useDomainClientsStore } from '@/store/modules/domain/clients'
import {
  clientFormFromRecord,
  type ClientFormData,
  type ClientWithDossiers,
} from '@/types/client'
import { writeAuditLog } from '@/utils/audit-log'
import { formatDateFr } from '@/utils/date'
import { formatAvocatsLabel } from '@/utils/affectation'
import { parseDossierResultat, RESULTAT_ISSUE_META } from '@/utils/dossier-resultat'

defineOptions({
  name: 'ClientDetailPage',
})

const route = useRoute()
const clientsStore = useDomainClientsStore()

const loading = ref(true)
const error = ref('')
const saveError = ref('')
const client = ref<ClientWithDossiers | null>(null)
const isEditing = ref(false)
const saving = ref(false)
const clientForm = ref<ClientFormData>({
  clientId: null,
  nom: '',
  genre: '',
  nationalite: '',
  adresse: '',
  numTel: '',
})

const clientId = computed(() => String(route.params.clientId ?? ''))

const canEditClient = computed(() =>
  Boolean(clientId.value && !clientId.value.startsWith('dossier:')),
)

const saveBlockedReason = computed(() => {
  if (!clientForm.value.nom.trim()) return 'Le nom est obligatoire.'
  return ''
})

const openDossiers = computed(() =>
  (client.value?.dossiers ?? []).filter((d) => d.statut === 'Ouvert' || d.statut === 'En cours'),
)

const clientAvocatsSummary = computed(() => {
  const names = new Set<string>()
  for (const dossier of client.value?.dossiers ?? []) {
    for (const avocat of dossier.avocats) {
      if (avocat.nom && avocat.nom !== 'Avocat inconnu') names.add(avocat.nom)
    }
  }
  return names.size > 0 ? [...names].join(', ') : 'Aucun avocat assigné'
})

function dossierResultatIssue(resultat?: string) {
  return parseDossierResultat(resultat)
}

const statutClass: Record<string, string> = {
  Ouvert: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  'En cours': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  Suspendu: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  Clos: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
}

function applyClientToForm() {
  if (!client.value) return
  clientForm.value = clientFormFromRecord(client.value)
}

function startEdit() {
  if (!canEditClient.value || !client.value) return
  applyClientToForm()
  saveError.value = ''
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  saveError.value = ''
  applyClientToForm()
}

async function load() {
  loading.value = true
  error.value = ''
  isEditing.value = false
  try {
    if (!clientId.value) {
      error.value = 'Client introuvable.'
      return
    }
    client.value = await clientsStore.fetchClientDetail(clientId.value)
    if (!client.value) error.value = 'Ce client n’existe pas ou a été supprimé.'
    else applyClientToForm()
  } catch {
    error.value = 'Erreur lors du chargement de la fiche client.'
  } finally {
    loading.value = false
  }
}

async function saveClient() {
  if (saving.value || saveBlockedReason.value) return
  saving.value = true
  saveError.value = ''
  try {
    clientForm.value.clientId = clientId.value
    await clientsStore.updateClient(clientForm.value)
    await writeAuditLog({
      action: 'modification',
      entity: 'client',
      entityId: clientId.value,
      details: clientForm.value.nom,
    })
    isEditing.value = false
    await load()
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.'
  } finally {
    saving.value = false
  }
}

watch(clientId, () => {
  void load()
})

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="text-foreground min-h-full p-4 sm:p-6">
    <div class="mx-auto max-w-5xl">
      <header class="mb-6 flex flex-wrap items-center gap-3">
        <RouterLink
          :to="{ name: 'Clients' }"
          class="rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          ← Liste clients
        </RouterLink>
        <h1 class="text-2xl font-semibold">
          Fiche client
        </h1>
      </header>

      <div v-if="loading" class="rounded-2xl bg-card p-8 text-center text-muted-foreground ring-1 ring-border">
        Chargement…
      </div>

      <div
        v-else-if="error"
        class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      >
        {{ error }}
      </div>

      <template v-else-if="client">
        <section class="mb-6 rounded-2xl bg-card p-6 ring-1 ring-border">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-primary text-xs font-semibold tracking-wide uppercase">
                Informations personnelles
              </p>
              <h2 v-if="!isEditing" class="mt-1 text-xl font-semibold">
                {{ client.nom }}
              </h2>
              <h2 v-else class="mt-1 text-xl font-semibold">
                Modifier le client
              </h2>
            </div>
            <div v-if="canEditClient && !isEditing" class="flex gap-2">
              <button
                type="button"
                class="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                @click="startEdit"
              >
                Modifier
              </button>
            </div>
          </div>

          <p
            v-if="!canEditClient"
            class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          >
            Fiche déduite d’un dossier sans enregistrement client dédié. Ouvrez le dossier pour mettre à jour le client.
          </p>

          <form
            v-if="isEditing"
            class="mt-4"
            @submit.prevent="saveClient"
          >
            <ClientFormFields
              v-model="clientForm"
              edit-existing
              hint="Les dossiers liés à ce client seront mis à jour automatiquement."
              input-class="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
            />
            <p v-if="saveError" class="mt-3 text-sm text-rose-600 dark:text-rose-400">
              {{ saveError }}
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                class="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                :disabled="saving || Boolean(saveBlockedReason)"
                :title="saveBlockedReason"
              >
                {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
              </button>
              <button
                type="button"
                class="rounded-xl border border-border px-4 py-2 text-sm"
                :disabled="saving"
                @click="cancelEdit"
              >
                Annuler
              </button>
            </div>
          </form>

          <dl v-else class="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt class="text-muted-foreground text-xs uppercase">
                Genre
              </dt>
              <dd class="mt-0.5 font-medium">
                {{ client.genre || '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs uppercase">
                Nationalité
              </dt>
              <dd class="mt-0.5 font-medium">
                {{ client.nationalite || '—' }}
              </dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-muted-foreground text-xs uppercase">
                Adresse
              </dt>
              <dd class="mt-0.5 font-medium">
                {{ client.adresse || '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs uppercase">
                Téléphone
              </dt>
              <dd class="mt-0.5 font-medium">
                {{ client.numTel || '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs uppercase">
                Total dossiers
              </dt>
              <dd class="mt-0.5 text-2xl font-semibold text-primary">
                {{ client.dossiersCount }}
              </dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-muted-foreground text-xs uppercase">
                Avocat(s) en charge
              </dt>
              <dd class="mt-0.5 font-medium">
                {{ clientAvocatsSummary }}
              </dd>
            </div>
          </dl>
        </section>

        <section
          v-if="openDossiers.length > 0"
          class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900 dark:bg-amber-950/30"
        >
          <p class="text-sm text-amber-900 dark:text-amber-100">
            <span class="font-semibold">{{ openDossiers.length }}</span>
            dossier{{ openDossiers.length > 1 ? 's' : '' }} ouvert(s) ou en cours
          </p>
          <RouterLink
            :to="{ name: 'enCours' }"
            class="rounded-xl bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Voir les dossiers actifs
          </RouterLink>
        </section>

        <section class="rounded-2xl bg-card ring-1 ring-border">
          <div class="border-b border-border px-6 py-4">
            <h3 class="font-semibold">
              Tous les dossiers du client
            </h3>
            <p class="text-muted-foreground mt-1 text-sm">
              Cliquez sur un dossier pour l’ouvrir dans la gestion des dossiers.
            </p>
          </div>

          <div v-if="client.dossiers.length === 0" class="p-8 text-center text-muted-foreground text-sm">
            Aucun dossier lié pour le moment.
          </div>

          <ul v-else class="divide-y divide-border">
            <li
              v-for="dossier in client.dossiers"
              :key="dossier.id"
              class="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
            >
              <div class="min-w-0 flex-1">
                <p class="font-medium">
                  {{ dossier.motif }}
                </p>
                <p class="text-muted-foreground mt-0.5 text-sm">
                  {{ dossier.juridiction || 'Juridiction non renseignée' }}
                  · Ouverture : {{ formatDateFr(dossier.date_ouverture) }}
                </p>
                <p class="mt-1 text-sm">
                  <span class="text-muted-foreground">Avocat(s) :</span>
                  {{ formatAvocatsLabel(dossier.avocats) }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-full px-3 py-1 text-xs font-medium"
                  :class="statutClass[dossier.statut] ?? 'bg-slate-100 text-slate-700'"
                >
                  {{ dossier.statut }}
                </span>
                <span
                  v-if="dossierResultatIssue(dossier.resultat)"
                  class="rounded-full px-3 py-1 text-xs font-medium"
                  :class="RESULTAT_ISSUE_META[dossierResultatIssue(dossier.resultat)!].badgeClass"
                >
                  {{ RESULTAT_ISSUE_META[dossierResultatIssue(dossier.resultat)!].label }}
                </span>
              </div>
              <RouterLink
                :to="{
                  name: 'dossierFiche',
                  params: { dossierId: dossier.id },
                  query: { from: 'client', clientId },
                }"
                class="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                Fiche de suivi
              </RouterLink>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>
