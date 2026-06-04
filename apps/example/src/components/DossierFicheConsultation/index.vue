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
import { printFicheConsultation } from '@/utils/print-document'

const props = defineProps<{
  insight: DossierInsight | null
  loading: boolean
  error: string
  dossierId: string
  canNoteHonoraire?: boolean
  canPaiements?: boolean
  canPieces?: boolean
  canAvocats?: boolean
}>()

const STATUT_CLASS: Record<string, string> = {
  Ouvert: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  'En cours': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  Suspendu: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  Clos: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
}

const expandedNoteId = ref<string | null>(null)

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

const dossierEstSuivi = computed(() =>
  affectationsActives.value.length > 0 || (props.insight?.avocats.length ?? 0) > 0,
)

function toggleNotePreview(note: DossierInsightDocument) {
  expandedNoteId.value = expandedNoteId.value === note.id ? null : note.id
}

function imprimerFicheConsultation() {
  if (!props.insight) return
  printFicheConsultation(props.insight)
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
      <!-- Actions rapides -->
      <div class="fiche-consultation-no-print mb-6 flex flex-wrap gap-2">
        <RouterLink
          v-if="canNoteHonoraire"
          :to="{ name: 'noteHonoraire', query: { dossierId } }"
          class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Note d’honoraires
        </RouterLink>
        <RouterLink
          v-if="canPaiements && dossierEstSuivi"
          :to="{ name: 'paiement', query: { dossierId, open: 'add' } }"
          class="rounded-xl bg-violet-100 px-4 py-2 text-sm font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
        >
          Paiements
        </RouterLink>
        <span
          v-if="canPieces && PIECES_JURIDIQUES_COMING_SOON"
          :class="['rounded-xl border border-border px-4 py-2 text-sm', COMING_SOON_CONTROL_CLASS]"
          :title="comingSoonTitle()"
        >
          Pièces juridiques
          <ComingSoonBadge />
        </span>
        <RouterLink
          v-else-if="canPieces"
          :to="{ name: 'piecesJuridiques', query: { dossierId } }"
          class="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Pièces juridiques
        </RouterLink>
        <RouterLink
          v-if="canAvocats"
          :to="{ name: 'avocats' }"
          class="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Gérer les avocats
        </RouterLink>
        <RouterLink
          v-if="insight.clientId"
          :to="{ name: 'clientDetail', params: { clientId: insight.clientId }, query: { from: 'dossier' } }"
          class="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Fiche client
        </RouterLink>
        <button
          type="button"
          class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          @click="imprimerFicheConsultation"
        >
          Imprimer la fiche
        </button>
      </div>

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

      <div class="fiche-consultation-no-print grid gap-6 lg:grid-cols-2">
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
        <section class="fiche-consultation-no-print rounded-2xl bg-card p-6 ring-1 ring-border">
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
      <section class="fiche-consultation-no-print mt-6 rounded-2xl bg-card p-6 ring-1 ring-border">
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
            v-if="canNoteHonoraire"
            :to="{ name: 'noteHonoraire', query: { dossierId } }"
            class="text-sm font-medium text-primary hover:underline"
          >
            + Nouvelle note
          </RouterLink>
        </div>

        <div
          v-if="notesHonoraires.length === 0"
          class="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          Aucune note d’honoraires pour ce dossier.
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
                class="note-honoraire-preview max-h-96 overflow-y-auto rounded-lg border border-border bg-white p-4 text-sm dark:bg-slate-900"
                v-html="note.contenuHtml"
              />
              <p v-else class="text-sm text-muted-foreground">
                Contenu non disponible.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <div class="fiche-consultation-no-print mt-6 grid gap-6 lg:grid-cols-2">
        <!-- Paiements -->
        <section class="rounded-2xl bg-card p-6 ring-1 ring-border">
          <h3 class="mb-4 font-semibold">
            Paiements ({{ insight.paiements.length }})
          </h3>
          <p class="text-muted-foreground mb-3 text-sm">
            Total versé :
            <span class="font-medium text-foreground">
              {{ formatMoney(insight.totalPaye, normalizeDevise(insight.deviseHonoraires)) }}
            </span>
          </p>
          <ul
            v-if="insight.paiements.length"
            class="max-h-72 space-y-2 overflow-y-auto text-sm"
          >
            <li
              v-for="p in insight.paiements"
              :key="p.id"
              class="flex justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <span>{{ formatDateFr(p.date_paiement) }} · {{ p.natureLabel }} · {{ p.mode || '—' }}</span>
              <span class="font-medium">{{ formatMoney(p.montant, normalizeDevise(p.devise)) }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-muted-foreground">Aucun paiement enregistré.</p>
        </section>

        <!-- Pièces juridiques -->
        <section class="rounded-2xl bg-card p-6 ring-1 ring-border">
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
      </div>
    </template>
  </div>
</template>

<style scoped>
.note-honoraire-preview :deep(p) {
  margin-bottom: 0.5rem;
}

.note-honoraire-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
</style>

