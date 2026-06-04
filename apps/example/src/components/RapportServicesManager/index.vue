<script setup lang="ts">
import {
  collection,
  getDocs,
} from 'firebase/firestore'
import { computed, onMounted, ref } from 'vue'
import { db } from '@/firebase'
import type { Devise } from '@/utils/currency'
import {
  emptyMontantsParDevise,
  formatMoney,
  formatMoneyPair,
  normalizeDevise,
} from '@/utils/currency'
import rapportDocumentStyles from '@/assets/styles/rapport-document.css?raw'
import { CABINET_PRINT } from '@/constants/cabinet-print'
import { formatDateTimeFr } from '@/utils/date'
import { openPrintFromElement } from '@/utils/print-document'

defineOptions({
  name: 'RapportServicesManager',
})

type IndicateurRow = {
  libelle: string
  valeur: string | number
  remarque?: string
}

type ServiceSection = {
  numero: string
  titre: string
  resume: string
  lignes: IndicateurRow[]
}

const cabinetName = CABINET_PRINT.nom
const cabinetAdresse = CABINET_PRINT.adresse
const cabinetContact = `Maîtres : ${CABINET_PRINT.maitres} · Tél. : ${CABINET_PRINT.telephones}`

const loading = ref(false)
const generatedAt = ref('')
const loadError = ref('')

const stats = ref({
  clients: 0,
  dossiers: 0,
  dossiersOuverts: 0,
  dossiersEnCours: 0,
  dossiersClos: 0,
  dossiersSansAvocat: 0,
  avocats: 0,
  affectations: 0,
  paiements: 0,
  montantAPayer: emptyMontantsParDevise(),
  montantPaye: emptyMontantsParDevise(),
  montantReste: emptyMontantsParDevise(),
  notesHonoraires: 0,
})

const dossiersParJuridiction = ref<{ name: string, count: number }[]>([])
const paiementsParType = ref<{ name: string, count: number, totalUsd: number, totalCdf: number }[]>([])
const rapportDocumentRef = ref<HTMLElement | null>(null)

async function loadRapport() {
  loading.value = true
  loadError.value = ''
  try {
    const [
      clientsSnap,
      dossiersSnap,
      avocatsSnap,
      affectationsSnap,
      paiementsSnap,
      documentsSnap,
    ] = await Promise.all([
      getDocs(collection(db, 'clients')),
      getDocs(collection(db, 'dossiers')),
      getDocs(collection(db, 'avocats')),
      getDocs(collection(db, 'affectations')),
      getDocs(collection(db, 'paiements')),
      getDocs(collection(db, 'dossier_documents')),
    ])

    const dossierIdsAffectes = new Set<string>()
    affectationsSnap.docs.forEach((currentDoc) => {
      const data = currentDoc.data() as Record<string, unknown>
      const id = String(data.dossierId ?? data.dossier_id ?? '')
      if (id) dossierIdsAffectes.add(id)
    })

    const juridictionMap = new Map<string, number>()
    let ouverts = 0
    let enCours = 0
    let clos = 0
    let sansAvocat = 0

    dossiersSnap.docs.forEach((currentDoc) => {
      const data = currentDoc.data() as Record<string, unknown>
      const statut = String(data.statut ?? 'Ouvert')
      const juridiction = String(data.juridiction ?? 'Non renseignée')
      const avocatId = String(data.avocatId ?? '')

      juridictionMap.set(juridiction, (juridictionMap.get(juridiction) ?? 0) + 1)

      if (statut === 'Ouvert') ouverts++
      else if (statut === 'En cours') enCours++
      else if (statut === 'Clos') clos++

      const affecte = dossierIdsAffectes.has(currentDoc.id) || !!avocatId
      if (!affecte) sansAvocat++
    })

    const montantAPayer = emptyMontantsParDevise()
    const montantPaye = emptyMontantsParDevise()
    const typeMap = new Map<string, { count: number, totalUsd: number, totalCdf: number }>()

    paiementsSnap.docs.forEach((currentDoc) => {
      const data = currentDoc.data() as Record<string, unknown>
      const aPayer = Number(data.montant_a_payer ?? 0)
      const paye = Number(data.montant_payer ?? 0)
      const type = String(data.type_paiement ?? 'Autre')
      const devise = normalizeDevise(data.devise) as Devise

      montantAPayer[devise] += aPayer
      montantPaye[devise] += paye

      const entry = typeMap.get(type) ?? { count: 0, totalUsd: 0, totalCdf: 0 }
      entry.count++
      if (devise === 'CDF') entry.totalCdf += paye
      else entry.totalUsd += paye
      typeMap.set(type, entry)
    })

    const montantReste = emptyMontantsParDevise()
    montantReste.USD = Math.max(0, montantAPayer.USD - montantPaye.USD)
    montantReste.CDF = Math.max(0, montantAPayer.CDF - montantPaye.CDF)

    stats.value = {
      clients: clientsSnap.size,
      dossiers: dossiersSnap.size,
      dossiersOuverts: ouverts,
      dossiersEnCours: enCours,
      dossiersClos: clos,
      dossiersSansAvocat: sansAvocat,
      avocats: avocatsSnap.size,
      affectations: affectationsSnap.size,
      paiements: paiementsSnap.size,
      montantAPayer,
      montantPaye,
      montantReste,
      notesHonoraires: documentsSnap.docs.filter(
        (d) => String((d.data() as Record<string, unknown>).type ?? '') === 'note_honoraire',
      ).length,
    }

    dossiersParJuridiction.value = [...juridictionMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    paiementsParType.value = [...typeMap.entries()]
      .map(([name, data]) => ({ name, count: data.count, totalUsd: data.totalUsd, totalCdf: data.totalCdf }))
      .sort((a, b) => (b.totalUsd + b.totalCdf) - (a.totalUsd + a.totalCdf))

    generatedAt.value = new Date().toISOString()
  } catch {
    loadError.value = 'Impossible de générer le rapport. Vérifiez votre connexion et réessayez.'
  } finally {
    loading.value = false
  }
}

onMounted(loadRapport)

const dateRapportLong = computed(() => {
  if (!generatedAt.value) return '—'
  return new Date(generatedAt.value).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const serviceSections = computed<ServiceSection[]>(() => {
  const s = stats.value
  const creances = s.montantReste.USD > 0 || s.montantReste.CDF > 0
  return [
    {
      numero: '1',
      titre: 'Clients',
      resume: 'Personnes et sociétés enregistrées dans le cabinet.',
      lignes: [
        { libelle: 'Combien de clients au total ?', valeur: s.clients },
      ],
    },
    {
      numero: '2',
      titre: 'Dossiers',
      resume: 'Affaires suivies par le cabinet, selon leur statut.',
      lignes: [
        { libelle: 'Nombre total de dossiers', valeur: s.dossiers },
        { libelle: '↳ Ouverts (nouveaux)', valeur: s.dossiersOuverts },
        { libelle: '↳ En cours de traitement', valeur: s.dossiersEnCours },
        { libelle: '↳ Clos (terminés)', valeur: s.dossiersClos },
        {
          libelle: '↳ Sans avocat assigné',
          valeur: s.dossiersSansAvocat,
          remarque: s.dossiersSansAvocat > 0 ? 'Attention : à assigner' : 'Tous assignés',
        },
      ],
    },
    {
      numero: '3',
      titre: 'Avocats',
      resume: 'Effectif des avocats et liens avec les dossiers.',
      lignes: [
        { libelle: 'Avocats inscrits', valeur: s.avocats },
        { libelle: 'Dossiers liés à un avocat (affectations)', valeur: s.affectations },
      ],
    },
    {
      numero: '4',
      titre: 'Paiements',
      resume: 'Montants facturés, encaissés et encore dus.',
      lignes: [
        { libelle: 'Nombre de paiements enregistrés', valeur: s.paiements },
        { libelle: 'Total à payer (USD)', valeur: formatMoney(s.montantAPayer.USD, 'USD') },
        { libelle: 'Total à payer (CDF)', valeur: formatMoney(s.montantAPayer.CDF, 'CDF') },
        { libelle: 'Total encaissé (USD)', valeur: formatMoney(s.montantPaye.USD, 'USD') },
        { libelle: 'Total encaissé (CDF)', valeur: formatMoney(s.montantPaye.CDF, 'CDF') },
        {
          libelle: 'Reste à encaisser (USD)',
          valeur: formatMoney(s.montantReste.USD, 'USD'),
        },
        {
          libelle: 'Reste à encaisser (CDF)',
          valeur: formatMoney(s.montantReste.CDF, 'CDF'),
          remarque: creances ? 'Créances en cours' : undefined,
        },
      ],
    },
    {
      numero: '5',
      titre: 'Notes d’honoraires',
      resume: 'Documents rédigés pour facturer les honoraires.',
      lignes: [
        { libelle: 'Notes d’honoraires créées', valeur: s.notesHonoraires },
      ],
    },
  ]
})

const SERVICE_ICONS: Record<string, string> = {
  '1': 'i-lucide:users',
  '2': 'i-lucide:folder-open',
  '3': 'i-lucide:scale',
  '4': 'i-lucide:wallet',
  '5': 'i-lucide:file-text',
}

const kpiCards = computed(() => {
  const s = stats.value
  return [
    { label: 'Clients', value: String(s.clients), hint: 'enregistrés', tone: 'blue' as const },
    { label: 'Dossiers actifs', value: String(s.dossiersOuverts + s.dossiersEnCours), hint: `${s.dossiers} au total`, tone: 'indigo' as const },
    { label: 'Avocats', value: String(s.avocats), hint: `${s.affectations} affectations`, tone: 'violet' as const },
    { label: 'Encaissements', value: formatMoneyPair(s.montantPaye.USD, s.montantPaye.CDF), hint: `Reste ${formatMoneyPair(s.montantReste.USD, s.montantReste.CDF)}`, tone: 'emerald' as const },
  ]
})

function printRapport() {
  openPrintFromElement(rapportDocumentRef.value, {
    title: 'Rapport synthétique des services',
    extraCss: rapportDocumentStyles,
  })
}

function partJuridiction(count: number) {
  if (stats.value.dossiers <= 0) return '—'
  return `${Math.round((count / stats.value.dossiers) * 100)} %`
}
</script>

<template>
  <div class="rapport-page">
    <!-- ——— Barre d’actions (écran uniquement) ——— -->
    <header class="rapport-toolbar rapport-screen-only">
      <div class="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">
            Rapport synthétique des services
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Consultation en tableaux et cartes — l’impression s’ouvre dans une nouvelle fenêtre (format document officiel).
          </p>
          <p v-if="generatedAt" class="mt-2 text-xs text-muted-foreground">
            Données du {{ formatDateTimeFr(generatedAt) }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium"
            :disabled="loading"
            @click="loadRapport"
          >
            {{ loading ? 'Actualisation…' : 'Actualiser' }}
          </button>
          <button
            type="button"
            class="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            :disabled="loading"
            @click="printRapport"
          >
            Imprimer le rapport
          </button>
        </div>
      </div>
    </header>

    <div v-if="loadError" class="rapport-screen-only mx-auto mb-4 max-w-6xl rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ loadError }}
    </div>

    <div v-if="loading" class="rapport-screen-only mx-auto max-w-6xl rounded-2xl bg-card p-12 text-center text-muted-foreground ring-1 ring-border">
      Construction du rapport…
    </div>

    <!-- ——— AFFICHAGE ÉCRAN : cartes + tableaux ——— -->
    <div v-else-if="!loading" class="rapport-screen-only mx-auto max-w-6xl space-y-6 px-4 pb-8">
      <!-- Cartes indicateurs -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="card in kpiCards"
          :key="card.label"
          class="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border"
        >
          <p class="text-sm text-muted-foreground">
            {{ card.label }}
          </p>
          <p
            class="mt-2 text-2xl font-semibold leading-tight"
            :class="{
              'text-blue-600': card.tone === 'blue',
              'text-indigo-600': card.tone === 'indigo',
              'text-violet-600': card.tone === 'violet',
              'text-emerald-600': card.tone === 'emerald',
            }"
          >
            {{ card.value }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ card.hint }}
          </p>
        </div>
      </div>

      <!-- Tableau récapitulatif : un bloc lisible par domaine -->
      <section class="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
        <div class="border-b border-border bg-muted/20 px-6 py-5">
          <h2 class="text-lg font-semibold">
            Tableau récapitulatif par service
          </h2>
          <p class="mt-2 text-sm text-muted-foreground leading-relaxed">
            Chaque bloc correspond à un domaine du cabinet. La colonne de gauche pose la question ;
            la colonne de droite donne le chiffre à la date du rapport.
          </p>
        </div>

        <div class="divide-y divide-border">
          <article
            v-for="section in serviceSections"
            :key="section.numero"
            class="recap-bloc"
          >
            <header class="recap-bloc__head">
              <div class="recap-bloc__icon bg-primary/10 text-primary">
                <FaIcon :name="SERVICE_ICONS[section.numero] ?? 'i-lucide:layout-grid'" class="size-5" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-semibold text-primary">
                  Domaine {{ section.numero }}
                </p>
                <h3 class="text-base font-semibold">
                  {{ section.titre }}
                </h3>
                <p class="mt-0.5 text-sm text-muted-foreground">
                  {{ section.resume }}
                </p>
              </div>
            </header>

            <div class="overflow-x-auto px-4 pb-5 sm:px-6">
              <table class="recap-bloc__table w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-muted-foreground">
                    <th class="pb-2 pr-4 font-medium">
                      Ce que l’on mesure
                    </th>
                    <th class="pb-2 text-right font-medium">
                      Résultat
                    </th>
                    <th class="hidden pb-2 pl-4 font-medium sm:table-cell sm:w-[28%]">
                      Commentaire
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(ligne, idx) in section.lignes"
                    :key="idx"
                    class="border-t border-border/80"
                    :class="{ 'bg-muted/15': ligne.libelle.startsWith('↳') }"
                  >
                    <td
                      class="py-3 pr-4 align-middle"
                      :class="ligne.libelle.startsWith('↳') ? 'pl-4 text-muted-foreground' : 'font-medium'"
                    >
                      {{ ligne.libelle }}
                    </td>
                    <td class="py-3 text-right align-middle text-base font-semibold tabular-nums">
                      {{ ligne.valeur }}
                    </td>
                    <td class="hidden py-3 pl-4 align-middle sm:table-cell">
                      <span
                        v-if="ligne.remarque"
                        class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium"
                        :class="ligne.remarque.includes('Attention')
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'"
                      >
                        {{ ligne.remarque }}
                      </span>
                      <span v-else class="text-muted-foreground">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <!-- Commentaire visible sur mobile -->
              <div class="mt-2 space-y-1 sm:hidden">
                <p
                  v-for="(ligne, idx) in section.lignes.filter(l => l.remarque)"
                  :key="`m-${idx}`"
                  class="text-xs text-muted-foreground"
                >
                  <span class="font-medium text-foreground">{{ ligne.libelle }} :</span>
                  {{ ligne.remarque }}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- Annexes en cartes -->
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
          <div class="border-b border-border px-5 py-4">
            <h3 class="font-semibold">
              Dossiers par juridiction
            </h3>
          </div>
          <div v-if="dossiersParJuridiction.length === 0" class="p-5 text-sm text-muted-foreground">
            Aucune donnée.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th class="px-4 py-2 text-left font-medium">
                    Juridiction
                  </th>
                  <th class="px-4 py-2 text-right font-medium">
                    Dossiers
                  </th>
                  <th class="px-4 py-2 text-right font-medium">
                    Part
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="item in dossiersParJuridiction" :key="item.name">
                  <td class="px-4 py-2.5">
                    {{ item.name }}
                  </td>
                  <td class="px-4 py-2.5 text-right font-semibold">
                    {{ item.count }}
                  </td>
                  <td class="px-4 py-2.5 text-right text-muted-foreground">
                    {{ partJuridiction(item.count) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
          <div class="border-b border-border px-5 py-4">
            <h3 class="font-semibold">
              Paiements par type
            </h3>
          </div>
          <div v-if="paiementsParType.length === 0" class="p-5 text-sm text-muted-foreground">
            Aucun paiement enregistré.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th class="px-4 py-2 text-left font-medium">
                    Type
                  </th>
                  <th class="px-4 py-2 text-right font-medium">
                    Opérations
                  </th>
                  <th class="px-4 py-2 text-right font-medium">
                    Encaissé
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="item in paiementsParType" :key="item.name">
                  <td class="px-4 py-2.5">
                    {{ item.name }}
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    {{ item.count }}
                  </td>
                  <td class="px-4 py-2.5 text-right font-semibold text-emerald-600">
                    {{ formatMoneyPair(item.totalUsd, item.totalCdf) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>

    <!-- ——— IMPRESSION UNIQUEMENT : document type Word ——— -->
    <article
      v-if="!loading"
      ref="rapportDocumentRef"
      class="rapport-document rapport-print-only"
    >
      <header class="doc-header">
        <div class="doc-header__scale" aria-hidden="true">
          ⚖
        </div>
        <div class="doc-header__org">
          <p class="doc-header__sigle">
            {{ CABINET_PRINT.sigle }}
          </p>
          <p class="doc-header__cabinet">
            {{ cabinetName }}
          </p>
          <p class="doc-header__adresse">
            {{ cabinetAdresse }}
          </p>
          <p class="doc-header__contact">
            {{ cabinetContact }}
          </p>
          <p class="doc-header__tagline">
            Rapport d'activité — synthèse par service
          </p>
        </div>
        <div class="doc-header__scale" aria-hidden="true">
          ⚖
        </div>
        <div class="doc-header__meta">
          <table class="doc-meta-table">
            <tbody>
              <tr>
                <th>Référence</th>
                <td>RAP-SERV-{{ generatedAt ? new Date(generatedAt).getFullYear() : '—' }}</td>
              </tr>
              <tr>
                <th>Date du rapport</th>
                <td>{{ dateRapportLong }}</td>
              </tr>
              <tr>
                <th>Heure de génération</th>
                <td>{{ generatedAt ? formatDateTimeFr(generatedAt) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </header>

      <h1 class="doc-title">
        TABLEAU RÉCAPITULATIF PAR SERVICE
      </h1>

      <p class="doc-intro">
        Le présent document présente une synthèse chiffrée de l'activité du cabinet,
        organisée par domaine fonctionnel. Les montants sont exprimés en dollars américains (USD)
        et en francs congolais (CDF) lorsque applicable.
      </p>

      <section
        v-for="section in serviceSections"
        :key="section.numero"
        class="doc-section"
      >
        <h2 class="doc-section__title">
          <span class="doc-section__num">{{ section.numero }}.</span>
          {{ section.titre }}
        </h2>
        <p class="doc-section__resume">
          {{ section.resume }}
        </p>

        <table class="doc-table">
          <thead>
            <tr>
              <th class="doc-table__th doc-table__th--libelle">
                Libellé de l'indicateur
              </th>
              <th class="doc-table__th doc-table__th--valeur">
                Valeur
              </th>
              <th class="doc-table__th doc-table__th--remarque">
                Observations
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(ligne, idx) in section.lignes"
              :key="`${section.numero}-${idx}`"
              class="doc-table__row"
            >
              <td class="doc-table__td">
                {{ ligne.libelle }}
              </td>
              <td class="doc-table__td doc-table__td--valeur">
                {{ ligne.valeur }}
              </td>
              <td class="doc-table__td doc-table__td--remarque">
                {{ ligne.remarque ?? '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="doc-section doc-section--annexe">
        <h2 class="doc-section__title">
          <span class="doc-section__num">VI.</span>
          Annexe A — Répartition des dossiers par juridiction
        </h2>
        <table v-if="dossiersParJuridiction.length > 0" class="doc-table">
          <thead>
            <tr>
              <th class="doc-table__th doc-table__th--libelle">
                Juridiction / tribunal
              </th>
              <th class="doc-table__th doc-table__th--valeur">
                Nombre de dossiers
              </th>
              <th class="doc-table__th doc-table__th--remarque">
                Part du total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in dossiersParJuridiction"
              :key="item.name"
              class="doc-table__row"
            >
              <td class="doc-table__td">
                {{ item.name }}
              </td>
              <td class="doc-table__td doc-table__td--valeur">
                {{ item.count }}
              </td>
              <td class="doc-table__td doc-table__td--remarque">
                {{ partJuridiction(item.count) }}
              </td>
            </tr>
            <tr class="doc-table__row doc-table__row--total">
              <td class="doc-table__td">
                <strong>Total</strong>
              </td>
              <td class="doc-table__td doc-table__td--valeur">
                <strong>{{ stats.dossiers }}</strong>
              </td>
              <td class="doc-table__td doc-table__td--remarque">
                <strong>100 %</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="doc-empty">
          Aucun dossier enregistré à ce jour.
        </p>
      </section>

      <section class="doc-section doc-section--annexe">
        <h2 class="doc-section__title">
          <span class="doc-section__num">VII.</span>
          Annexe B — Paiements par mode de règlement
        </h2>
        <table v-if="paiementsParType.length > 0" class="doc-table">
          <thead>
            <tr>
              <th class="doc-table__th doc-table__th--libelle">
                Type de paiement
              </th>
              <th class="doc-table__th doc-table__th--valeur">
                Nombre d'opérations
              </th>
              <th class="doc-table__th doc-table__th--remarque">
                Montant encaissé (USD / CDF)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in paiementsParType"
              :key="item.name"
              class="doc-table__row"
            >
              <td class="doc-table__td">
                {{ item.name }}
              </td>
              <td class="doc-table__td doc-table__td--valeur">
                {{ item.count }}
              </td>
              <td class="doc-table__td doc-table__td--remarque">
                {{ formatMoneyPair(item.totalUsd, item.totalCdf) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="doc-empty">
          Aucun paiement enregistré à ce jour.
        </p>
      </section>

      <footer class="doc-footer">
        <p class="doc-footer__line doc-footer__ville">
          {{ CABINET_PRINT.ville }}, le {{ dateRapportLong }}
        </p>
        <p class="doc-footer__line">
          {{ CABINET_PRINT.adresseFooter }}
        </p>
        <p class="doc-footer__line">
          Document généré automatiquement — {{ cabinetName }}.
        </p>
        <p class="doc-footer__line doc-footer__sign">
          Signature et cachet : _______________________________________________
        </p>
      </footer>
    </article>
  </div>
</template>

<style scoped>
.rapport-page {
  min-height: 100vh;
}

.rapport-toolbar {
  border-bottom: 1px solid var(--border);
  background: var(--card);
  margin-bottom: 1.5rem;
  padding: 1.25rem 1rem;
}

.recap-bloc__head {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1rem 0.75rem;
}

@media (min-width: 640px) {
  .recap-bloc__head {
    padding: 1.25rem 1.5rem 0.75rem;
  }
}

.recap-bloc__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  border-radius: 0.75rem;
}

.recap-bloc__table {
  border-collapse: collapse;
}

/* Aperçu écran : document source pour la fenêtre d’impression */
.rapport-print-only {
  display: none;
}
</style>

<style src="@/assets/styles/rapport-document.css"></style>
