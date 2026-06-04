<script setup lang="ts">
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore'
import { computed, onMounted, ref, watch } from 'vue'
import { db } from '@/firebase'
import type { AuditLogEntry, AppUserRole } from '@/types/auth'
import type { AuditUserRef } from '@/utils/audit-log'
import { formatAuditEntityDisplay, formatAuditRole } from '@/utils/audit-log'
import { formatDateTimeFr } from '@/utils/date'

defineOptions({
  name: 'AuditLogViewer',
})

const auditCol = collection(db, 'audit_logs')
const usersCol = collection(db, 'utilisateurs')

const entries = ref<AuditLogEntry[]>([])
const usersById = ref<Map<string, AuditUserRef>>(new Map())
const loading = ref(false)
const search = ref('')
const filterAction = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

const ACTION_LABELS: Record<string, string> = {
  connexion: 'Connexion',
  deconnexion: 'Déconnexion',
  creation: 'Création',
  modification: 'Modification',
  suppression: 'Suppression',
  consultation: 'Consultation',
}

function mapEntry(docSnap: { id: string, data: () => Record<string, unknown> }): AuditLogEntry {
  const d = docSnap.data()
  return {
    id: docSnap.id,
    userId: String(d.userId ?? ''),
    userLogin: String(d.userLogin ?? ''),
    userRole: (d.userRole ?? '') as AppUserRole | '',
    action: String(d.action ?? ''),
    entity: String(d.entity ?? ''),
    entityId: String(d.entityId ?? ''),
    details: String(d.details ?? ''),
    createdAt: String(d.createdAt ?? ''),
  }
}

async function loadUserDirectory() {
  try {
    const snap = await getDocs(usersCol)
    const map = new Map<string, AuditUserRef>()
    for (const d of snap.docs) {
      const data = d.data()
      map.set(d.id, {
        email: String(data.email ?? ''),
        nom: String(data.nom ?? ''),
      })
    }
    usersById.value = map
  } catch {
    usersById.value = new Map()
  }
}

function entityDisplay(e: AuditLogEntry) {
  return formatAuditEntityDisplay(
    {
      entity: e.entity,
      entityId: e.entityId,
      details: e.details,
      userLogin: e.userLogin,
    },
    usersById.value,
  )
}

async function loadLogs() {
  loading.value = true
  try {
    await loadUserDirectory()
    const snap = await getDocs(
      query(auditCol, orderBy('createdAt', 'desc'), limit(500)),
    )
    entries.value = snap.docs.map(mapEntry)
  } catch {
    await loadUserDirectory()
    const snap = await getDocs(auditCol)
    entries.value = snap.docs
      .map(mapEntry)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 500)
  } finally {
    loading.value = false
  }
}

onMounted(loadLogs)

watch([search, filterAction], () => {
  currentPage.value = 1
})

const filtered = computed(() =>
  entries.value.filter((e) => {
    const q = search.value.toLowerCase()
    const matchSearch = !q || [
      e.userLogin,
      e.details,
      e.entity,
      e.entityId,
      e.action,
      entityDisplay(e),
    ].join(' ').toLowerCase().includes(q)
    const matchAction = !filterAction.value || e.action === filterAction.value
    return matchSearch && matchAction
  }),
)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / pageSize.value)),
)

const paginated = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action
}

function actionClass(action: string) {
  if (action === 'suppression') return 'bg-destructive/15 text-destructive'
  if (action === 'creation') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  if (action === 'modification') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  if (action === 'connexion') return 'bg-primary/15 text-primary'
  return 'bg-muted text-muted-foreground'
}
</script>

<template>
  <div class="audit-page text-foreground">
    <div class="mx-auto max-w-7xl p-6">
      <div class="mb-6 rounded-2xl bg-card px-6 py-5 shadow-sm ring-1 ring-border">
        <h1 class="text-2xl font-semibold">
          Journal d’audit
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Historique des actions (connexions, créations, modifications, suppressions).
        </p>
      </div>

      <div class="mb-4 grid gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border md:grid-cols-3">
        <input
          v-model="search"
          placeholder="Rechercher…"
          class="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary md:col-span-2"
        >
        <select
          v-model="filterAction"
          class="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">
            Toutes les actions
          </option>
          <option v-for="(label, key) in ACTION_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
      </div>

      <p class="mb-2 text-sm text-muted-foreground">
        {{ filtered.length }} entrée(s) — page {{ currentPage }} / {{ totalPages }}
      </p>

      <div class="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
        <div v-if="loading" class="p-8 text-center text-muted-foreground">
          Chargement…
        </div>
        <div v-else-if="paginated.length === 0" class="p-12 text-center text-muted-foreground">
          Aucune entrée d’audit.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th class="px-4 py-3 font-medium">
                  Date
                </th>
                <th class="px-4 py-3 font-medium">
                  Utilisateur
                </th>
                <th class="px-4 py-3 font-medium">
                  Rôle
                </th>
                <th class="px-4 py-3 font-medium">
                  Action
                </th>
                <th class="px-4 py-3 font-medium">
                  Entité
                </th>
                <th class="px-4 py-3 font-medium">
                  Détails
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr
                v-for="e in paginated"
                :key="e.id"
                class="transition-colors hover:bg-muted/30"
              >
                <td class="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {{ e.createdAt ? formatDateTimeFr(e.createdAt) : '—' }}
                </td>
                <td class="px-4 py-3 font-medium">
                  {{ e.userLogin || '—' }}
                </td>
                <td class="px-4 py-3">
                  {{ formatAuditRole(e.userRole) }}
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="actionClass(e.action)">
                    {{ actionLabel(e.action) }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  {{ entityDisplay(e) }}
                </td>
                <td
                  class="max-w-xs truncate px-4 py-3 text-muted-foreground"
                  :title="e.details"
                >
                  {{ e.details || '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-if="totalPages > 1"
          class="flex justify-center gap-2 border-t border-border p-4"
        >
          <button
            type="button"
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
            :disabled="currentPage <= 1"
            @click="currentPage--"
          >
            Précédent
          </button>
          <button
            type="button"
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
            :disabled="currentPage >= totalPages"
            @click="currentPage++"
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audit-page {
  /* Hérite du fond de la zone principale de l’app (--g-main-area-bg) */
  min-height: 100%;
}
</style>
