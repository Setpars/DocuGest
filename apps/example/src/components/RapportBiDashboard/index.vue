<script setup lang="ts">
import * as Echarts from 'echarts'
import { collection, getDocs } from 'firebase/firestore'
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { db } from '@/firebase'
import { formatMoney, normalizeDevise, sumMontantsParDevise } from '@/utils/currency'

defineOptions({
  name: 'RapportBiDashboard',
})

const chartStatutRef = useTemplateRef('chartStatutRef')
const chartPaiementsRef = useTemplateRef('chartPaiementsRef')
const chartDossiersRef = useTemplateRef('chartDossiersRef')
const chartAvocatsRef = useTemplateRef('chartAvocatsRef')

let chartStatut: Echarts.ECharts | null = null
let chartPaiements: Echarts.ECharts | null = null
let chartDossiers: Echarts.ECharts | null = null
let chartAvocats: Echarts.ECharts | null = null

const loading = ref(true)
const stats = ref({
  clients: 0,
  dossiers: 0,
  dossiersOuverts: 0,
  avocats: 0,
  paiements: 0,
  agenda: 0,
  montantsUsd: 0,
  montantsCdf: 0,
})

const dossiersParStatut = ref<Record<string, number>>({})
const paiementsParMois = ref<Record<string, number>>({})
const dossiersParMois = ref<Record<string, number>>({})
const affectationsParAvocat = ref<Record<string, number>>({})

function monthKey(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  return `${months[Number(m) - 1] ?? m} ${y?.slice(2) ?? ''}`
}

async function loadData() {
  loading.value = true
  try {
    const [clientsSnap, dossiersSnap, avocatsSnap, paiementsSnap, agendaSnap, affectSnap] = await Promise.all([
      getDocs(collection(db, 'clients')),
      getDocs(collection(db, 'dossiers')),
      getDocs(collection(db, 'avocats')),
      getDocs(collection(db, 'paiements')),
      getDocs(collection(db, 'agenda')),
      getDocs(collection(db, 'affectations')),
    ])

    const statutCount: Record<string, number> = {}
    const dossMois: Record<string, number> = {}
    let ouverts = 0

    dossiersSnap.docs.forEach((d) => {
      const data = d.data() as Record<string, unknown>
      const statut = String(data.statut ?? 'En cours')
      statutCount[statut] = (statutCount[statut] ?? 0) + 1
      if (!data.date_fermeture) ouverts++
      const mk = monthKey(String(data.date_ouverture ?? ''))
      if (mk) dossMois[mk] = (dossMois[mk] ?? 0) + 1
    })

    const paiMois: Record<string, number> = {}
    const montants = paiementsSnap.docs.map(d => {
      const data = d.data() as Record<string, unknown>
      const mk = monthKey(String(data.date_paiement ?? ''))
      const paye = Number(data.montant_payer) || 0
      if (mk) paiMois[mk] = (paiMois[mk] ?? 0) + paye
      return {
        devise: normalizeDevise(String(data.devise ?? 'USD')),
        montant: paye,
      }
    })
    const sums = sumMontantsParDevise(montants, m => m.montant)

    const avocatNames: Record<string, string> = {}
    avocatsSnap.docs.forEach((d) => {
      const data = d.data() as Record<string, unknown>
      avocatNames[d.id] = String(data.nom ?? d.id.slice(0, 6))
    })
    const affParAvocat: Record<string, number> = {}
    affectSnap.docs.forEach((d) => {
      const data = d.data() as Record<string, unknown>
      const avId = String(data.avocatId ?? data.idAvocat ?? '')
      const label = avocatNames[avId] ?? 'Non assigné'
      affParAvocat[label] = (affParAvocat[label] ?? 0) + 1
    })

    stats.value = {
      clients: clientsSnap.size,
      dossiers: dossiersSnap.size,
      dossiersOuverts: ouverts,
      avocats: avocatsSnap.size,
      paiements: paiementsSnap.size,
      agenda: agendaSnap.size,
      montantsUsd: sums.USD ?? 0,
      montantsCdf: sums.CDF ?? 0,
    }
    dossiersParStatut.value = statutCount
    paiementsParMois.value = paiMois
    dossiersParMois.value = dossMois
    affectationsParAvocat.value = affParAvocat
  } finally {
    loading.value = false
  }
}

function sortedMonthKeys(obj: Record<string, number>) {
  return Object.keys(obj).sort().slice(-8)
}

function renderCharts() {
  const isDark = document.documentElement.classList.contains('dark')
  const textColor = isDark ? '#94a3b8' : '#64748b'

  if (chartStatutRef.value) {
    chartStatut ??= Echarts.init(chartStatutRef.value)
    const entries = Object.entries(dossiersParStatut.value)
    chartStatut.setOption({
      color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'],
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: textColor } },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: entries.length ? entries.map(([name, value]) => ({ name, value })) : [{ name: 'Aucune donnée', value: 1 }],
        label: { color: textColor },
      }],
    })
  }

  if (chartPaiementsRef.value) {
    chartPaiements ??= Echarts.init(chartPaiementsRef.value)
    const keys = sortedMonthKeys(paiementsParMois.value)
    chartPaiements.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: keys.map(monthLabel),
        axisLabel: { color: textColor },
      },
      yAxis: { type: 'value', axisLabel: { color: textColor } },
      series: [{
        name: 'Montants encaissés',
        type: 'bar',
        data: keys.map(k => paiementsParMois.value[k] ?? 0),
        itemStyle: { color: '#10b981' },
      }],
    })
  }

  if (chartDossiersRef.value) {
    chartDossiers ??= Echarts.init(chartDossiersRef.value)
    const keys = sortedMonthKeys(dossiersParMois.value)
    chartDossiers.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: keys.map(monthLabel),
        axisLabel: { color: textColor },
      },
      yAxis: { type: 'value', axisLabel: { color: textColor } },
      series: [{
        name: 'Nouveaux dossiers',
        type: 'line',
        smooth: true,
        data: keys.map(k => dossiersParMois.value[k] ?? 0),
        areaStyle: { color: 'rgba(59, 130, 246, 0.2)' },
        lineStyle: { color: '#3b82f6' },
      }],
    })
  }

  if (chartAvocatsRef.value) {
    chartAvocats ??= Echarts.init(chartAvocatsRef.value)
    const entries = Object.entries(affectationsParAvocat.value).slice(0, 10)
    chartAvocats.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: textColor },
      },
      yAxis: {
        type: 'category',
        data: entries.map(([name]) => name),
        axisLabel: { color: textColor },
      },
      series: [{
        name: 'Affectations',
        type: 'bar',
        data: entries.map(([, v]) => v),
        itemStyle: { color: '#8b5cf6' },
      }],
    })
  }
}

function onResize() {
  chartStatut?.resize()
  chartPaiements?.resize()
  chartDossiers?.resize()
  chartAvocats?.resize()
}

onMounted(async () => {
  await loadData()
  await nextTick()
  renderCharts()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  chartStatut?.dispose()
  chartPaiements?.dispose()
  chartDossiers?.dispose()
  chartAvocats?.dispose()
})

watch([dossiersParStatut, paiementsParMois, dossiersParMois, affectationsParAvocat], () => {
  nextTick(() => renderCharts())
})

const kpiCards = computed(() => [
  { label: 'Clients', value: stats.value.clients, icon: 'i-carbon:user-multiple', color: 'text-blue-600' },
  { label: 'Dossiers', value: stats.value.dossiers, sub: `${stats.value.dossiersOuverts} en cours`, icon: 'i-carbon:folder', color: 'text-indigo-600' },
  { label: 'Avocats', value: stats.value.avocats, icon: 'i-carbon:user-certification', color: 'text-violet-600' },
  { label: 'Paiements', value: stats.value.paiements, icon: 'i-carbon:wallet', color: 'text-emerald-600' },
  { label: 'Agenda', value: stats.value.agenda, icon: 'i-carbon:calendar', color: 'text-amber-600' },
])
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6 rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Tableau de bord — Cabinet
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Vue consolidée (style BI) : dossiers, finances, affectations avocats.
        </p>
      </div>

      <div v-if="loading" class="py-20 text-center text-slate-500">
        Chargement des indicateurs…
      </div>

      <template v-else>
        <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div
            v-for="card in kpiCards"
            :key="card.label"
            class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm text-slate-500 dark:text-slate-400">{{ card.label }}</span>
              <span :class="[card.icon, card.color, 'text-xl']" />
            </div>
            <p class="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {{ card.value }}
            </p>
            <p v-if="card.sub" class="mt-1 text-xs text-slate-500">
              {{ card.sub }}
            </p>
          </div>
        </div>

        <div class="mb-6 grid gap-4 md:grid-cols-2">
          <div class="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-800">
            <p class="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Encaissements (USD)
            </p>
            <p class="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              {{ formatMoney(stats.montantsUsd, 'USD') }}
            </p>
          </div>
          <div class="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-800">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
              Encaissements (CDF)
            </p>
            <p class="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-100">
              {{ formatMoney(stats.montantsCdf, 'CDF') }}
            </p>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Dossiers par statut
            </h2>
            <div ref="chartStatutRef" class="h-72 w-full" />
          </div>
          <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Affectations par avocat
            </h2>
            <div ref="chartAvocatsRef" class="h-72 w-full" />
          </div>
          <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Encaissements mensuels
            </h2>
            <div ref="chartPaiementsRef" class="h-72 w-full" />
          </div>
          <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Ouvertures de dossiers
            </h2>
            <div ref="chartDossiersRef" class="h-72 w-full" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
