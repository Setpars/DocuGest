<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { DossierInsight, DossierInsightDocument } from '@/types/dossier-insight'
import { isAffectationActive, type AffectationRecord } from '@/utils/affectation'
import { formatMoney, normalizeDevise } from '@/utils/currency'
import { formatDateFr } from '@/utils/date'
import {
  ISSUE_CATEGORY_META,
  RESULTAT_ISSUE_META,
  classifyDossierIssue,
  parseDossierResultat,
} from '@/utils/dossier-resultat'
import FicheConsultationDocument from '@/components/FicheConsultationDocument/index.vue'
import {
  PIECES_JURIDIQUES_COMING_SOON,
  PIECES_JURIDIQUES_COMING_SOON_HINT,
} from '@/constants/features'
import { COMING_SOON_CONTROL_CLASS, comingSoonTitle } from '@/utils/coming-soon'
import { DOSSIER_MESSAGES } from '@/constants/dossier-messages'
import { NOTE_HONORAIRE_MESSAGES } from '@/constants/note-honoraire'
import { hasDossierFinancialData } from '@/utils/dossier-paiement'
import { dossierCanCreateNoteHonoraire } from '@/utils/note-honoraire-guards'
import { normalizeNoteHonoraireHtml } from '@/utils/document-html-normalize'
import { printFicheConsultation } from '@/utils/print-document'

const props = defineProps<{
  insight: DossierInsight | null
  loading: boolean
  error: string
  dossierId: string
  canNoteHonoraire?: boolean
  canAgenda?: boolean
  canPaiements?: boolean
  canPieces?: boolean
  canAvocats?: boolean
  canViewClients?: boolean
  /** Affiche l’onglet / section financière (paiements, soldes). */
  canViewFinances?: boolean
  /** Vue centrée finances (rôle finance) : masque le suivi détaillé. */
  financeOnly?: boolean
}>()

const STATUT_CLASS: Record<string, string> = {
  Ouvert: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  'En cours': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  Suspendu: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  Clos: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
}

const expandedNoteId = ref<string | null>(null)
const activeTab = ref<'suivi' | 'finances'>(props.financeOnly ? 'finances' : 'suivi')

const honorairesPaiements = computed(() =>
  props.insight?.paiements.filter((p) => p.nature_paiement === 'Honoraires') ?? [],
)

const autresPaiements = computed(() =>
  props.insight?.paiements.filter((p) => p.nature_paiement !== 'Honoraires') ?? [],
)

const issueCategory = computed(() =>
  props.insight
    ? classifyDossierIssue(props.insight.statut, props.insight.resultat)
    : null,
)

const resultatIssue = computed(() =>
  parseDossierResultat(props.insight?.resultat),
)

const notesHonoraires = computed(() =>
  props.insight?.documents.filter((d) => d.type === 'note_honoraire') ?? [],
)

const createNoteEligibility = computed(() => {
  if (!props.insight) return { ok: true as const }
  return dossierCanCreateNoteHonoraire({
    montantHonorairesTotal: props.insight.montantHonorairesTotal,
    existingNotesCount: notesHonoraires.value.length,
  })
})

const hasNoteHonoraire = computed(() => notesHonoraires.value.length > 0)

const noteAlreadyExists = computed(() =>
  !createNoteEligibility.value.ok
  && createNoteEligibility.value.reason === NOTE_HONORAIRE_MESSAGES.alreadyExists,
)

const noteHonoraireLinkQuery = computed(() => {
  const query: Record<string, string> = { dossierId: props.dossierId }
  const existing = notesHonoraires.value[0]
  if (existing) query.documentId = existing.id
  return query
})

const piecesJuridiques = computed(() =>
  props.insight?.documents.filter((d) => d.type === 'piece_juridique') ?? [],
)

const affectationsActives = computed(() => {
  if (!props.insight) return []
  return props.insight.affectations.filter((aff) =>
    isAffectationActive({
      id: aff.id,
      avocatId: aff.avocatId,
      dossierId: props.dossierId,
      statut: aff.statut,
      date_fin: aff.date_fin,
    } as AffectationRecord),
  )
})

const deviseHonoraires = computed(() =>
  normalizeDevise(props.insight?.deviseHonoraires),
)

const hasFinancialInfo = computed(() => {
  if (!props.insight) return false
  return hasDossierFinancialData(
    props.insight.montantHonorairesTotal,
    props.insight.paiements.length,
  )
})

const hasDocuments = computed(() => (props.insight?.documents.length ?? 0) > 0)

const isDossierClos = computed(() => props.insight?.statut === 'Clos')

const showAssignmentSections = computed(() => !isDossierClos.value)

const isUnassigned = computed(() => affectationsActives.value.length === 0)

const showUnassignedNoDocumentsNotice = computed(() =>
  Boolean(props.insight)
  && showAssignmentSections.value
  && isUnassigned.value
  && !hasDocuments.value,
)

const showUnassignedNotice = computed(() =>
  Boolean(props.insight)
  && showAssignmentSections.value
  && isUnassigned.value
  && hasDocuments.value,
)

function toggleNotePreview(note: DossierInsightDocument) {
  expandedNoteId.value = expandedNoteId.value === note.id ? null : note.id
}

function imprimerFicheConsultation() {
  if (!props.insight) return
  printFicheConsultation(props.insight)
}

function notePreviewHtml(html: string) {
  return normalizeNoteHonoraireHtml(html)
}

function stripHtmlPreview(html: string, max = 280): string {
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}
</script>

<template>
  <div>
    <div
      v-if="loading"
      class="rounded-2xl bg-card p-10 text-center text-muted-foreground ring-1 ring-border"
    >
      Chargement de la fiche…
    </div>

    <div
      v-else-if="error"
      class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
    >
      {{ error }}
    </div>

    <template v-else-if="insight">
      <div
        v-if="showUnassignedNoDocumentsNotice"
        class="fiche-consultation-no-print mb-6 rounded-2xl border border-amber-200 bg-amber-50/90 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <p class="font-medium">
          {{ DOSSIER_MESSAGES.unassignedNoDocuments }}
        </p>
        <p v-if="canAvocats" class="mt-2 text-amber-800/90 dark:text-amber-200/90">
          Rendez-vous dans
          <RouterLink :to="{ name: 'avocats' }" class="font-medium underline">
            Gestion des avocats
          </RouterLink>
          pour affecter un responsable à ce dossier.
        </p>
      </div>

      <div
        v-else-if="showUnassignedNotice"
        class="fiche-consultation-no-print mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      >
        {{ DOSSIER_MESSAGES.unassigned }}
      </div>

      <!-- Onglets suivi / finances -->
      <div
        v-if="canViewFinances && !financeOnly"
        class="fiche-consultation-no-print mb-6 flex gap-2 rounded-xl bg-muted/40 p-1"
      >
        <button
          type="button"
          class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition"
          :class="activeTab === 'suivi' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'suivi'"
        >
          Suivi du dossier
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition"
          :class="activeTab === 'finances' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'finances'"
        >
          Finances
        </button>
      </div>

      <!-- Actions rapides -->
      <div
        v-if="!financeOnly || activeTab === 'finances'"
        class="fiche-consultation-no-print mb-6 flex flex-wrap gap-2"
      >
        <RouterLink
          v-if="canNoteHonoraire && !financeOnly && !hasNoteHonoraire"
          :to="{ name: 'noteHonoraire', query: { dossierId } }"
          class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Note d’honoraires
        </RouterLink>
        <RouterLink
          v-else-if="canNoteHonoraire && !financeOnly && hasNoteHonoraire"
          :to="{ name: 'noteHonoraire', query: noteHonoraireLinkQuery }"
          class="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          Ouvrir la note d’honoraires
        </RouterLink>
        <RouterLink
          v-if="canAgenda && !financeOnly"
          :to="{ name: 'agenda', query: { dossierId } }"
          class="rounded-xl bg-sky-100 px-4 py-2 text-sm font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
        >
          Agenda
        </RouterLink>
        <RouterLink
          v-if="canPaiements"
          :to="{ name: 'paiement', query: { dossierId, open: 'add' } }"
          class="rounded-xl bg-violet-100 px-4 py-2 text-sm font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
        >
          Enregistrer un paiement
        </RouterLink>
        <span
          v-if="canPieces && !financeOnly && PIECES_JURIDIQUES_COMING_SOON"
          :class="['rounded-xl border border-border px-4 py-2 text-sm', COMING_SOON_CONTROL_CLASS]"
          :title="comingSoonTitle()"
        >
          Pièces juridiques
          <ComingSoonBadge />
        </span>
        <RouterLink
          v-else-if="canPieces && !financeOnly"
          :to="{ name: 'piecesJuridiques', query: { dossierId } }"
          class="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Pièces juridiques
        </RouterLink>
        <RouterLink
          v-if="canAvocats && !financeOnly && showAssignmentSections"
          :to="{ name: 'avocats' }"
          class="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Gérer les avocats
        </RouterLink>
        <RouterLink
          v-if="insight.clientId && canViewClients && !financeOnly"
          :to="{ name: 'clientDetail', params: { clientId: insight.clientId }, query: { from: 'dossier' } }"
          class="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Fiche client
        </RouterLink>
        <button
          v-if="!financeOnly"
          type="button"
          class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          @click="imprimerFicheConsultation"
        >
          Imprimer la fiche
        </button>
      </div>

      <!-- En-tête minimal (vue finances) -->
      <section
        v-if="financeOnly"
        class="fiche-consultation-no-print mb-6 rounded-2xl bg-card p-6 ring-1 ring-border"
      >
        <p class="text-primary text-xs font-semibold tracking-wide uppercase">
          Dossier · {{ insight.id.slice(0, 8) }}…
        </p>
        <h2 class="mt-1 text-xl font-semibold">
          {{ insight.motif }}
        </h2>
        <p class="text-muted-foreground mt-1 text-sm">
          {{ insight.clientNom || 'Client non renseigné' }}
          · {{ insight.juridiction || 'Juridiction non renseignée' }}
        </p>
        <span
          class="mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium"
          :class="STATUT_CLASS[insight.statut] ?? STATUT_CLASS.Ouvert"
        >
          {{ insight.statut }}
        </span>
      </section>

      <!-- Section financière -->
      <section
        v-if="canViewFinances && (financeOnly || activeTab === 'finances')"
        id="finances"
        class="fiche-consultation-no-print mb-8 rounded-2xl bg-card p-6 ring-1 ring-border"
      >
        <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold">
              Situation financière
            </h3>
            <p class="text-muted-foreground mt-1 text-sm">
              Honoraires, versements et solde restant — tri du plus récent au plus ancien.
            </p>
          </div>
          <RouterLink
            v-if="canPaiements"
            :to="{ name: 'paiement', query: { dossierId } }"
            class="text-sm font-medium text-primary hover:underline"
          >
            Tous les paiements →
          </RouterLink>
        </div>

        <div
          v-if="!hasFinancialInfo"
          class="mb-6 rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <p class="font-medium">
            Aucune information financière disponible pour ce dossier.
          </p>
          <p class="mt-2 text-amber-800/90 dark:text-amber-200/90">
            Aucun montant d’honoraires ni paiement n’a encore été enregistré.
            <template v-if="canPaiements">
              Vous pouvez définir les honoraires ou enregistrer un premier versement.
            </template>
          </p>
        </div>

        <template v-else>
          <div class="mb-6 grid gap-4 sm:grid-cols-3">
            <div class="rounded-xl border border-border bg-muted/20 p-4">
              <p class="text-muted-foreground text-xs uppercase">Montant dû (honoraires)</p>
              <p class="mt-1 text-xl font-semibold">
                {{ formatMoney(insight.montantHonorairesTotal, deviseHonoraires) }}
              </p>
            </div>
            <div class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p class="text-xs uppercase text-emerald-800 dark:text-emerald-300">Total versé</p>
              <p class="mt-1 text-xl font-semibold text-emerald-900 dark:text-emerald-100">
                {{ formatMoney(insight.totalPaye, deviseHonoraires) }}
              </p>
            </div>
            <div class="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <p class="text-xs uppercase text-amber-800 dark:text-amber-300">Solde restant</p>
              <p class="mt-1 text-xl font-semibold text-amber-900 dark:text-amber-100">
                {{ formatMoney(insight.soldeRestant, deviseHonoraires) }}
              </p>
            </div>
          </div>

          <h4 class="mb-3 text-sm font-semibold">
            Historique des paiements ({{ insight.paiements.length }})
          </h4>

          <div
            v-if="insight.paiements.length === 0"
            class="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground"
          >
            Montant dû renseigné, mais aucun versement enregistré pour l’instant.
          </div>

          <div v-else class="overflow-x-auto rounded-xl border border-border">
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th class="px-4 py-3 font-medium">Date</th>
                <th class="px-4 py-3 font-medium">Montant</th>
                <th class="px-4 py-3 font-medium">Mode</th>
                <th class="px-4 py-3 font-medium">Référence</th>
                <th class="px-4 py-3 font-medium">Nature</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in insight.paiements"
                :key="p.id"
                class="border-b border-border last:border-0"
              >
                <td class="px-4 py-3 whitespace-nowrap">{{ formatDateFr(p.date_paiement) }}</td>
                <td class="px-4 py-3 font-medium whitespace-nowrap">
                  {{ formatMoney(p.montant, normalizeDevise(p.devise)) }}
                </td>
                <td class="px-4 py-3">{{ p.mode || '—' }}</td>
                <td class="px-4 py-3 max-w-[200px] truncate" :title="p.reference || undefined">
                  {{ p.reference || '—' }}
                </td>
                <td class="px-4 py-3 text-muted-foreground">{{ p.natureLabel }}</td>
              </tr>
            </tbody>
          </table>
          </div>

          <p
            v-if="autresPaiements.length > 0"
            class="text-muted-foreground mt-4 text-xs"
          >
            {{ honorairesPaiements.length }} versement(s) d’honoraires
            · {{ autresPaiements.length }} autre(s) paiement(s) (consultation, frais…)
          </p>
        </template>
      </section>

      <template v-if="!financeOnly && activeTab === 'suivi'">
      <!-- Formulaire officiel EMK&C (aperçu + impression) -->
      <section id="fiche-consultation-officielle" class="fiche-consultation-print-root mb-8">
        <div class="fiche-consultation-no-print mb-3">
          <h3 class="text-lg font-semibold">
            Fiche de consultation
          </h3>
          <p class="text-muted-foreground text-sm">
            Modèle officiel du cabinet — l’impression s’ouvre dans une nouvelle fenêtre.
          </p>
        </div>
        <FicheConsultationDocument :insight="insight" />
      </section>

      <!-- En-tête dossier -->
      <section class="fiche-consultation-no-print mb-6 rounded-2xl bg-card p-6 ring-1 ring-border">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-primary text-xs font-semibold tracking-wide uppercase">
              Réf. dossier · {{ insight.id.slice(0, 8) }}…
            </p>
            <h2 class="mt-1 text-xl font-semibold">
              {{ insight.motif }}
            </h2>
            <p class="text-muted-foreground mt-1 text-sm">
              {{ insight.juridiction || 'Juridiction non renseignée' }}
              · Partie adverse : {{ insight.partie_en_cause || '—' }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              class="rounded-full px-3 py-1 text-xs font-medium"
              :class="STATUT_CLASS[insight.statut] ?? STATUT_CLASS.Ouvert"
            >
              {{ insight.statut }}
            </span>
            <span
              v-if="resultatIssue"
              class="rounded-full px-3 py-1 text-xs font-medium"
              :class="RESULTAT_ISSUE_META[resultatIssue].badgeClass"
            >
              {{ RESULTAT_ISSUE_META[resultatIssue].label }}
            </span>
            <span
              v-else-if="issueCategory"
              class="rounded-full px-3 py-1 text-xs font-medium"
              :class="ISSUE_CATEGORY_META[issueCategory].badgeClass"
            >
              {{ ISSUE_CATEGORY_META[issueCategory].label }}
            </span>
          </div>
        </div>
      </section>

      <section
        v-if="isDossierClos"
        class="fiche-consultation-no-print mb-6 rounded-2xl bg-card p-6 ring-1 ring-border"
      >
        <h3 class="mb-4 font-semibold">
          Synthèse de clôture
        </h3>
        <dl class="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-muted-foreground text-xs uppercase">Date de clôture</dt>
            <dd class="mt-0.5 font-medium">
              {{ insight.date_fermeture ? formatDateFr(insight.date_fermeture) : '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs uppercase">Résultat</dt>
            <dd class="mt-0.5 font-medium">
              <span
                v-if="resultatIssue"
                class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="RESULTAT_ISSUE_META[resultatIssue].badgeClass"
              >
                {{ RESULTAT_ISSUE_META[resultatIssue].label }}
              </span>
              <span v-else>—</span>
            </dd>
          </div>
          <div v-if="insight.resume_affaire" class="sm:col-span-2">
            <dt class="text-muted-foreground text-xs uppercase">Résumé de l’affaire</dt>
            <dd class="mt-0.5 whitespace-pre-wrap font-medium">{{ insight.resume_affaire }}</dd>
          </div>
          <div v-if="insight.avocats.length" class="sm:col-span-2">
            <dt class="text-muted-foreground text-xs uppercase">Avocats ayant suivi le dossier</dt>
            <dd class="mt-2 flex flex-wrap gap-2">
              <span
                v-for="av in insight.avocats"
                :key="av.id"
                class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {{ av.nom }}{{ av.role ? ` (${av.role})` : '' }}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <div
        class="fiche-consultation-no-print grid gap-6"
        :class="showAssignmentSections ? 'lg:grid-cols-2' : ''"
      >
        <!-- Client -->
        <section class="fiche-consultation-no-print rounded-2xl bg-card p-6 ring-1 ring-border">
          <h3 class="mb-4 font-semibold">
            Client
          </h3>
          <dl class="grid gap-3 text-sm">
            <div>
              <dt class="text-muted-foreground text-xs uppercase">Nom</dt>
              <dd class="mt-0.5 font-medium">{{ insight.clientNom || '—' }}</dd>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <dt class="text-muted-foreground text-xs uppercase">Genre</dt>
                <dd class="mt-0.5 font-medium">{{ insight.clientGenre || '—' }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground text-xs uppercase">Nationalité</dt>
                <dd class="mt-0.5 font-medium">{{ insight.clientNationalite || '—' }}</dd>
              </div>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs uppercase">Adresse</dt>
              <dd class="mt-0.5 font-medium">{{ insight.clientAdresse || '—' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs uppercase">Téléphone</dt>
              <dd class="mt-0.5 font-medium">{{ insight.clientTelephone || '—' }}</dd>
            </div>
          </dl>
        </section>

        <!-- Avocats en charge -->
        <section
          v-if="showAssignmentSections"
          class="fiche-consultation-no-print rounded-2xl bg-card p-6 ring-1 ring-border"
        >
          <h3 class="mb-1 font-semibold">
            Avocat(s) en charge
          </h3>
          <p class="text-muted-foreground mb-4 text-sm">
            {{ affectationsActives.length }} actif(s) · {{ insight.avocats.length }} au total sur le dossier
          </p>

          <div
            v-if="affectationsActives.length === 0"
            class="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            Aucune affectation active. Les avocats listés ci-dessous ont terminé leur suivi ou le dossier attend une assignation.
          </div>

          <ul v-else class="mb-4 space-y-2">
            <li
              v-for="aff in affectationsActives"
              :key="aff.id"
              class="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30"
            >
              <p class="font-medium text-emerald-900 dark:text-emerald-100">
                {{ aff.avocatNom }}
              </p>
              <p v-if="aff.role" class="text-sm text-emerald-800 dark:text-emerald-300">
                {{ aff.role }}
              </p>
              <p class="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Depuis le {{ formatDateFr(aff.date_affectation) }}
              </p>
            </li>
          </ul>

          <div v-if="insight.avocats.length" class="flex flex-wrap gap-2">
            <span
              v-for="av in insight.avocats"
              :key="av.id"
              class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {{ av.nom }}{{ av.role ? ` (${av.role})` : '' }}
            </span>
          </div>
        </section>
      </div>

      <!-- Historique affectations -->
      <section
        v-if="showAssignmentSections"
        class="fiche-consultation-no-print mt-6 rounded-2xl bg-card p-6 ring-1 ring-border"
      >
        <h3 class="mb-4 font-semibold">
          Historique des affectations
        </h3>
        <div
          v-if="insight.affectations.length === 0"
          class="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          Aucune ligne d’affectation. Assignez un avocat depuis la page Avocats.
        </div>
        <ul v-else class="space-y-3">
          <li
            v-for="aff in insight.affectations"
            :key="aff.id"
            class="rounded-xl border border-border bg-muted/20 p-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <p class="font-medium">{{ aff.avocatNom }}</p>
              <span class="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium dark:bg-slate-700">
                {{ aff.statut || '—' }}
              </span>
            </div>
            <dl class="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              <div v-if="aff.date_affectation">
                Début : {{ formatDateFr(aff.date_affectation) }}
              </div>
              <div v-if="aff.date_fin">
                Fin : {{ formatDateFr(aff.date_fin) }}
              </div>
              <div v-if="aff.role" class="sm:col-span-2">Rôle : {{ aff.role }}</div>
              <div v-if="aff.observation" class="sm:col-span-2">Observation : {{ aff.observation }}</div>
            </dl>
            <RouterLink
              v-if="canAvocats"
              :to="{ name: 'avocatHistorique', params: { avocatId: aff.avocatId } }"
              class="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              Historique de cet avocat →
            </RouterLink>
          </li>
        </ul>
      </section>

      <!-- Notes d'honoraires -->
      <section class="fiche-consultation-no-print mt-6 rounded-2xl bg-card p-6 ring-1 ring-border">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-semibold">
              Notes d’honoraires ({{ notesHonoraires.length }})
            </h3>
            <p class="text-muted-foreground text-sm">
              Documents établis pour ce dossier.
            </p>
          </div>
          <RouterLink
            v-if="canNoteHonoraire && !hasNoteHonoraire"
            :to="{ name: 'noteHonoraire', query: { dossierId } }"
            class="text-sm font-medium text-primary hover:underline"
          >
            + Nouvelle note
          </RouterLink>
          <span
            v-else-if="canNoteHonoraire && noteAlreadyExists"
            class="cursor-not-allowed text-sm text-amber-700 dark:text-amber-300"
            :title="NOTE_HONORAIRE_MESSAGES.alreadyExists"
          >
            {{ NOTE_HONORAIRE_MESSAGES.alreadyExists }}
          </span>
        </div>

        <div
          v-if="notesHonoraires.length === 0"
          class="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          Aucune note d’honoraires pour ce dossier.
          <RouterLink
            v-if="canNoteHonoraire"
            :to="{ name: 'noteHonoraire', query: { dossierId } }"
            class="ml-1 font-medium text-primary hover:underline"
          >
            Créer la note
          </RouterLink>
        </div>

        <ul v-else class="space-y-4">
          <li
            v-for="note in notesHonoraires"
            :key="note.id"
            class="rounded-xl border border-border overflow-hidden"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
              <div>
                <p class="font-medium">{{ note.titre || 'Note d’honoraires' }}</p>
                <p class="text-muted-foreground text-xs">
                  Créée le {{ formatDateFr(note.createdAt) }}
                  · Modifiée le {{ formatDateFr(note.updatedAt) }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
                  @click="toggleNotePreview(note)"
                >
                  {{ expandedNoteId === note.id ? 'Masquer' : 'Aperçu' }}
                </button>
                <RouterLink
                  v-if="canNoteHonoraire"
                  :to="{ name: 'noteHonoraire', query: { dossierId, documentId: note.id } }"
                  class="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40"
                >
                  Ouvrir / modifier
                </RouterLink>
              </div>
            </div>
            <div
              v-if="expandedNoteId === note.id"
              class="p-4"
            >
              <p
                v-if="note.contenuHtml"
                class="text-muted-foreground mb-3 text-xs"
              >
                {{ stripHtmlPreview(note.contenuHtml) }}
              </p>
              <div
                v-if="note.contenuHtml"
                class="note-honoraire-preview max-h-96 overflow-y-auto rounded-lg border border-border bg-white p-4 text-sm text-slate-900"
                v-html="notePreviewHtml(note.contenuHtml)"
              />
              <p v-else class="text-sm text-muted-foreground">
                Contenu non disponible.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <!-- Pièces juridiques -->
        <section class="fiche-consultation-no-print mt-6 rounded-2xl bg-card p-6 ring-1 ring-border">
          <h3 class="mb-4 flex flex-wrap items-center gap-2 font-semibold">
            <span>Pièces juridiques ({{ piecesJuridiques.length }})</span>
            <ComingSoonBadge v-if="PIECES_JURIDIQUES_COMING_SOON" />
          </h3>
          <p
            v-if="PIECES_JURIDIQUES_COMING_SOON"
            class="text-muted-foreground mb-3 text-xs"
          >
            {{ PIECES_JURIDIQUES_COMING_SOON_HINT }}
          </p>
          <ul
            v-if="piecesJuridiques.length"
            class="max-h-72 space-y-2 overflow-y-auto text-sm"
          >
            <li
              v-for="doc in piecesJuridiques"
              :key="doc.id"
              class="rounded-lg border border-border px-3 py-2"
            >
              <p class="font-medium">{{ doc.titre }}</p>
              <p class="text-xs text-muted-foreground">
                {{ formatDateFr(doc.updatedAt) }}
              </p>
            </li>
          </ul>
          <p v-else class="text-sm text-muted-foreground">Aucune pièce enregistrée.</p>
          <span
            v-if="canPieces && PIECES_JURIDIQUES_COMING_SOON && piecesJuridiques.length === 0"
            :class="['mt-3 inline-block text-sm font-medium text-muted-foreground', COMING_SOON_CONTROL_CLASS]"
            :title="comingSoonTitle()"
          >
            Ajouter une pièce →
          </span>
          <RouterLink
            v-else-if="canPieces && piecesJuridiques.length === 0"
            :to="{ name: 'piecesJuridiques', query: { dossierId } }"
            class="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            Ajouter une pièce →
          </RouterLink>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.note-honoraire-preview {
  background: #fff;
  color: #0f172a;
}

.note-honoraire-preview :deep(p) {
  margin-bottom: 0.5rem;
}

.note-honoraire-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  background: #fff;
}

.note-honoraire-preview :deep(thead),
.note-honoraire-preview :deep(tr),
.note-honoraire-preview :deep(th),
.note-honoraire-preview :deep(td) {
  background-color: #fff !important;
}
</style>

