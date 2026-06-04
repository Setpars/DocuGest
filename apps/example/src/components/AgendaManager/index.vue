<script setup lang="ts">
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore'
import { computed, onMounted, ref } from 'vue'
import { db } from '@/firebase'
import type { AgendaEntry, AgendaFormData, AgendaType } from '@/types/agenda'
import { writeAuditLog } from '@/utils/audit-log'

defineOptions({
  name: 'AgendaManager',
})

const JOURS_SEMAINE = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
] as const

const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const

const MOIS_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const

const TYPE_META: Record<AgendaType, { label: string, badge: string, dot: string }> = {
  'rendez-vous': {
    label: 'Rendez-vous',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    dot: 'bg-blue-500',
  },
  audience: {
    label: 'Audience',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
    dot: 'bg-violet-500',
  },
}

const agendaCol = collection(db, 'agenda')

const entries = ref<AgendaEntry[]>([])
const loading = ref(false)
const saving = ref(false)
const viewDate = ref(new Date())
const selectedDate = ref(toDateKey(new Date()))
const showForm = ref(false)
const showDetail = ref(false)
const isEdit = ref(false)
const selected = ref<AgendaEntry | null>(null)

const toast = ref({
  show: false,
  type: 'success' as 'success' | 'error',
  message: '',
})

const form = ref<AgendaFormData>({
  id: null,
  date: toDateKey(new Date()),
  type: 'rendez-vous',
  heure: '09:00',
  jour: jourFromDate(toDateKey(new Date())),
  description: '',
})

function toDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function jourFromDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return JOURS_SEMAINE[date.getDay()]
}

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { show: true, type, message }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

function mapEntry(currentDoc: { id: string, data: () => Record<string, unknown> | object }): AgendaEntry {
  const data = currentDoc.data() as Record<string, unknown>
  const date = String(data.date ?? '')
  return {
    id: currentDoc.id,
    date,
    type: (data.type === 'audience' ? 'audience' : 'rendez-vous') as AgendaType,
    heure: String(data.heure ?? ''),
    jour: String(data.jour ?? jourFromDate(date)),
    description: String(data.description ?? ''),
  }
}

async function loadEntries() {
  loading.value = true
  try {
    const snap = await getDocs(agendaCol)
    entries.value = snap.docs
      .map((currentDoc) => mapEntry(currentDoc))
      .sort((a, b) => {
        const cmpDate = a.date.localeCompare(b.date)
        if (cmpDate !== 0) return cmpDate
        return a.heure.localeCompare(b.heure)
      })
  } catch {
    showToast('error', 'Impossible de charger l’agenda')
  } finally {
    loading.value = false
  }
}

onMounted(loadEntries)

const calendarYear = computed(() => viewDate.value.getFullYear())
const calendarMonth = computed(() => viewDate.value.getMonth())
const monthLabel = computed(() => `${MOIS_LABELS[calendarMonth.value]} ${calendarYear.value}`)

const calendarDays = computed(() => {
  const year = calendarYear.value
  const month = calendarMonth.value
  const first = new Date(year, month, 1)
  const cursor = new Date(year, month, 1 - first.getDay())
  const cells: Array<{
    dateKey: string
    day: number
    inMonth: boolean
    isToday: boolean
    isSelected: boolean
    count: number
  }> = []
  const todayKey = toDateKey(new Date())

  for (let i = 0; i < 42; i++) {
    const dateKey = toDateKey(cursor)
    cells.push({
      dateKey,
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === month,
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDate.value,
      count: countForDate(dateKey),
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return cells
})

function countForDate(dateKey: string) {
  return entries.value.filter((item) => item.date === dateKey).length
}

const selectedDayEntries = computed(() =>
  entries.value
    .filter((item) => item.date === selectedDate.value)
    .sort((a, b) => a.heure.localeCompare(b.heure)),
)

const monthStats = computed(() => {
  const prefix = `${calendarYear.value}-${String(calendarMonth.value + 1).padStart(2, '0')}`
  const monthEntries = entries.value.filter((item) => item.date.startsWith(prefix))
  return {
    total: monthEntries.length,
    rdv: monthEntries.filter((item) => item.type === 'rendez-vous').length,
    audiences: monthEntries.filter((item) => item.type === 'audience').length,
  }
})

function prevMonth() {
  viewDate.value = new Date(calendarYear.value, calendarMonth.value - 1, 1)
}

function nextMonth() {
  viewDate.value = new Date(calendarYear.value, calendarMonth.value + 1, 1)
}

function goToday() {
  const today = new Date()
  viewDate.value = new Date(today.getFullYear(), today.getMonth(), 1)
  selectedDate.value = toDateKey(today)
}

function selectDay(dateKey: string) {
  selectedDate.value = dateKey
}

function formatDisplayDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function openCreate() {
  isEdit.value = false
  form.value = {
    id: null,
    date: selectedDate.value,
    type: 'rendez-vous',
    heure: '09:00',
    jour: jourFromDate(selectedDate.value),
    description: '',
  }
  showForm.value = true
}

function openEdit(entry: AgendaEntry) {
  isEdit.value = true
  form.value = {
    id: entry.id,
    date: entry.date,
    type: entry.type,
    heure: entry.heure,
    jour: entry.jour,
    description: entry.description,
  }
  showForm.value = true
  showDetail.value = false
}

function openDetail(entry: AgendaEntry) {
  selected.value = entry
  showDetail.value = true
}

function closeForm() {
  showForm.value = false
}

function closeDetail() {
  showDetail.value = false
  selected.value = null
}

function onFormDateChange() {
  form.value.jour = jourFromDate(form.value.date)
}

async function saveEntry() {
  if (saving.value) return
  if (!form.value.date) {
    showToast('error', 'La date est obligatoire')
    return
  }
  if (!form.value.heure) {
    showToast('error', 'L’heure est obligatoire')
    return
  }

  saving.value = true
  try {
    const payload = {
      date: form.value.date,
      type: form.value.type,
      heure: form.value.heure,
      jour: jourFromDate(form.value.date),
      description: form.value.description.trim(),
    }

    if (form.value.id) {
      await updateDoc(doc(db, 'agenda', form.value.id), payload)
      await writeAuditLog({
        action: 'modification',
        entity: 'agenda',
        entityId: form.value.id,
        details: `${payload.type} ${payload.date} ${payload.heure}`,
      })
      showToast('success', 'Événement mis à jour')
    } else {
      const ref = await addDoc(agendaCol, payload)
      await writeAuditLog({
        action: 'creation',
        entity: 'agenda',
        entityId: ref.id,
        details: `${payload.type} ${payload.date}`,
      })
      showToast('success', 'Événement ajouté à l’agenda')
    }

    closeForm()
    await loadEntries()
    selectedDate.value = form.value.date
    viewDate.value = new Date(`${form.value.date}T12:00:00`)
  } catch {
    showToast('error', 'Erreur lors de l’enregistrement')
  } finally {
    saving.value = false
  }
}

async function removeEntry(id: string) {
  if (!window.confirm('Supprimer cet événement de l’agenda ?')) return
  try {
    await deleteDoc(doc(db, 'agenda', id))
    await writeAuditLog({ action: 'suppression', entity: 'agenda', entityId: id })
    showToast('success', 'Événement supprimé')
    closeDetail()
    await loadEntries()
  } catch {
    showToast('error', 'Erreur lors de la suppression')
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div
      v-if="toast.show"
      class="fixed right-6 top-6 z-[2100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg"
      :class="toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'"
    >
      {{ toast.message }}
    </div>

    <div class="mx-auto max-w-[1400px] p-6">
      <header class="mb-6 flex flex-col gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Agenda</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Consultez rendez-vous et audiences sur un calendrier mensuel.
          </p>
        </div>
        <button
          type="button"
          class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
          @click="openCreate"
        >
          Nouvel événement
        </button>
      </header>

      <div v-if="loading" class="rounded-2xl bg-white p-12 text-center text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        Chargement de l’agenda…
      </div>

      <div v-else class="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 dark:bg-slate-900 dark:ring-slate-700">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <button type="button" class="rounded-lg border px-3 py-1.5 text-sm dark:border-slate-700" @click="prevMonth">
                ‹
              </button>
              <h2 class="min-w-[180px] text-center text-lg font-semibold capitalize">
                {{ monthLabel }}
              </h2>
              <button type="button" class="rounded-lg border px-3 py-1.5 text-sm dark:border-slate-700" @click="nextMonth">
                ›
              </button>
            </div>
            <button type="button" class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm dark:bg-slate-800" @click="goToday">
              Aujourd’hui
            </button>
          </div>

          <div class="mb-4 flex flex-wrap gap-3 text-xs">
            <span class="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{{ monthStats.total }} événement(s)</span>
            <span class="rounded-full bg-blue-100 px-3 py-1 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">{{ monthStats.rdv }} RDV</span>
            <span class="rounded-full bg-violet-100 px-3 py-1 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">{{ monthStats.audiences }} audiences</span>
          </div>

          <div class="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
            <div v-for="label in JOURS_COURTS" :key="label">
              {{ label }}
            </div>
          </div>

          <div class="grid grid-cols-7 gap-1">
            <button
              v-for="cell in calendarDays"
              :key="cell.dateKey"
              type="button"
              class="relative flex min-h-[72px] flex-col rounded-xl border p-2 text-left text-sm transition-colors sm:min-h-[88px]"
              :class="[
                cell.inMonth ? 'border-slate-200 dark:border-slate-700' : 'border-transparent opacity-40',
                cell.isSelected ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200 dark:border-blue-700 dark:bg-blue-900/30 dark:ring-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                cell.isToday && !cell.isSelected ? 'ring-1 ring-emerald-400' : '',
              ]"
              @click="selectDay(cell.dateKey)"
            >
              <span class="font-medium" :class="cell.isToday ? 'text-emerald-600' : ''">{{ cell.day }}</span>
              <div v-if="cell.count > 0" class="mt-auto flex flex-wrap gap-0.5">
                <span
                  v-for="n in Math.min(cell.count, 3)"
                  :key="n"
                  class="h-1.5 w-1.5 rounded-full bg-blue-500"
                />
                <span v-if="cell.count > 3" class="text-[10px] text-slate-500">+{{ cell.count - 3 }}</span>
              </div>
            </button>
          </div>
        </section>

        <aside class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 dark:bg-slate-900 dark:ring-slate-700">
          <h2 class="text-lg font-semibold capitalize">
            {{ formatDisplayDate(selectedDate) }}
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            {{ selectedDayEntries.length }} événement(s)
          </p>

          <p v-if="selectedDayEntries.length === 0" class="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">
            Aucun rendez-vous ni audience ce jour.
          </p>

          <ul v-else class="mt-4 max-h-[520px] space-y-3 overflow-y-auto">
            <li
              v-for="entry in selectedDayEntries"
              :key="entry.id"
              class="cursor-pointer rounded-xl border border-slate-200 p-3 transition-colors hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-700"
              @click="openDetail(entry)"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="text-sm font-semibold tabular-nums">{{ entry.heure }}</span>
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="TYPE_META[entry.type].badge">
                  {{ TYPE_META[entry.type].label }}
                </span>
              </div>
              <p class="mt-1 text-xs text-slate-500">{{ entry.jour }}</p>
              <p v-if="entry.description" class="mt-2 line-clamp-2 text-sm text-slate-700 dark:text-slate-300">
                {{ entry.description }}
              </p>
            </li>
          </ul>
        </aside>
      </div>
    </div>

    <AppModalOverlay :open="showForm" max-width="max-w-lg" @close="closeForm">
      <div class="app-modal-overlay__header">
        <h2 class="text-xl font-semibold">{{ isEdit ? 'Modifier l’événement' : 'Nouvel événement' }}</h2>
      </div>
      <div class="app-modal-overlay__body space-y-4 p-6">
            <div>
              <label class="mb-1 block text-sm font-medium">Date</label>
              <input
                v-model="form.date"
                type="date"
                class="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                @change="onFormDateChange"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Jour</label>
              <input
                v-model="form.jour"
                type="text"
                readonly
                class="w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Heure</label>
              <input
                v-model="form.heure"
                type="time"
                class="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Type</label>
              <select v-model="form.type" class="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                <option value="rendez-vous">Rendez-vous</option>
                <option value="audience">Audience</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Description</label>
              <textarea
                v-model="form.description"
                rows="4"
                class="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                placeholder="Lieu, parties, objet…"
              />
            </div>
      </div>
      <div class="app-modal-overlay__footer flex justify-end gap-2">
        <button type="button" class="rounded-xl border px-4 py-2 text-sm border-border" @click="closeForm">
          Annuler
        </button>
        <button
          type="button"
          class="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          :disabled="saving"
          @click="saveEntry"
        >
          {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </div>
    </AppModalOverlay>

    <AppModalOverlay :open="!!(showDetail && selected)" max-width="max-w-md" @close="closeDetail">
      <template v-if="selected">
        <div class="app-modal-overlay__header">
          <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="TYPE_META[selected.type].badge">
            {{ TYPE_META[selected.type].label }}
          </span>
          <h2 class="mt-2 text-xl font-semibold">{{ selected.heure }} — {{ selected.jour }}</h2>
          <p class="text-sm text-muted-foreground capitalize">{{ formatDisplayDate(selected.date) }}</p>
        </div>
        <div class="app-modal-overlay__body p-6">
          <p class="text-sm text-muted-foreground whitespace-pre-wrap">
            {{ selected.description || 'Aucune description.' }}
          </p>
        </div>
        <div class="app-modal-overlay__footer flex flex-wrap justify-end gap-2">
          <button type="button" class="rounded-xl text-sm text-destructive" @click="removeEntry(selected.id)">
            Supprimer
          </button>
          <button type="button" class="rounded-xl border px-4 py-2 text-sm border-border" @click="closeDetail">
            Fermer
          </button>
          <button type="button" class="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground" @click="openEdit(selected)">
            Modifier
          </button>
        </div>
      </template>
    </AppModalOverlay>
  </div>
</template>
