<script setup lang="ts">
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { buildPieceTemplate, PIECE_KIND_META } from '@/constants/pieces-juridiques'
import { useFirestoreAction } from '@/composables/useFirestoreAction'
import { db } from '@/firebase'
import type { DossierDocument, DossierDocumentForm, PieceJuridiqueKind } from '@/types/dossier-document'
import { BTN_DISABLED } from '@/utils/action-button'
import { getFirestoreErrorMessage } from '@/utils/firestore-errors'
import { normalizePieceJuridiqueHtml } from '@/utils/document-html-normalize'
import { printEditorDocument } from '@/utils/print-document'

defineOptions({
  name: 'PiecesJuridiquesEditor',
})

const props = withDefaults(
  defineProps<{
    initialDossierId?: string
    initialDocumentId?: string
  }>(),
  {
    initialDossierId: '',
    initialDocumentId: '',
  },
)

const route = useRoute()

type DossierRef = {
  id: string
  motif: string
  clientNom: string
  partie_en_cause: string
  juridiction: string
  statut: string
}

const documentsCol = collection(db, 'dossier_documents')
const dossiersCol = collection(db, 'dossiers')

const dossiers = ref<DossierRef[]>([])
const documents = ref<DossierDocument[]>([])
const loading = ref(false)
const saving = ref(false)
const editorRef = ref<HTMLElement | null>(null)

const toast = ref({
  show: false,
  type: 'success' as 'success' | 'error',
  message: '',
})

const form = ref<DossierDocumentForm>({
  id: null,
  dossierId: '',
  pieceKind: 'assignation',
  titre: '',
  contenuHtml: '',
})

const formDossierId = computed(() => form.value?.dossierId ?? '')

const DEFAULT_PIECE_KIND: PieceJuridiqueKind = 'assignation'

const formPieceKind = computed(() => form.value?.pieceKind ?? DEFAULT_PIECE_KIND)

const pieceKinds = Object.keys(PIECE_KIND_META) as PieceJuridiqueKind[]

const loadError = ref('')

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { show: true, type, message }
  setTimeout(() => {
    toast.value.show = false
  }, 4000)
}

const firestore = useFirestoreAction(showToast)

function mapDossier(currentDoc: { id: string, data: () => Record<string, unknown> | object }): DossierRef {
  const data = currentDoc.data() as Record<string, unknown>
  return {
    id: currentDoc.id,
    motif: String(data.motif ?? data.titre ?? 'Sans intitulé'),
    clientNom: String(data.clientNom ?? data.nom_client ?? ''),
    partie_en_cause: String(data.partie_en_cause ?? data.reference ?? ''),
    juridiction: String(data.juridiction ?? ''),
    statut: String(data.statut ?? ''),
  }
}

function mapDocument(currentDoc: { id: string, data: () => Record<string, unknown> | object }): DossierDocument {
  const data = currentDoc.data() as Record<string, unknown>
  return {
    id: currentDoc.id,
    dossierId: String(data.dossierId ?? ''),
    type: 'piece_juridique',
    pieceKind: (data.pieceKind as PieceJuridiqueKind) || 'libre',
    titre: String(data.titre ?? 'Pièce juridique'),
    contenuHtml: String(data.contenuHtml ?? ''),
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  }
}

function getDossierLabel(dossierId: string): string {
  const dossier = dossiers.value.find((item) => item.id === dossierId)
  if (!dossier) return 'Dossier inconnu'
  return `${dossier.motif}${dossier.clientNom ? ` — ${dossier.clientNom}` : ''}`
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isActiveDossier(statut: string) {
  const s = statut.trim().toLowerCase()
  return s === 'en cours' || s === 'ouvert'
}

async function loadDossiers() {
  const snap = await firestore.run(
    () => getDocs(dossiersCol),
    'Chargement des dossiers',
  )
  if (!snap) {
    dossiers.value = []
    return false
  }
  dossiers.value = snap.docs
    .map((currentDoc) => mapDossier(currentDoc))
    .filter((item) => isActiveDossier(item.statut))
    .sort((a, b) => a.motif.localeCompare(b.motif, 'fr'))
  return true
}

async function loadDocumentsForDossier(dossierId: string) {
  if (!dossierId) {
    documents.value = []
    return true
  }
  const snap = await firestore.run(
    () => getDocs(query(documentsCol, where('dossierId', '==', dossierId))),
    'Chargement des pièces du dossier',
  )
  if (!snap) {
    documents.value = []
    return false
  }
  documents.value = snap.docs
    .map((currentDoc) => mapDocument(currentDoc))
    .filter((item) => item.type === 'piece_juridique')
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  return true
}

function getDossierContextForTemplate(dossierId: string) {
  const d = dossiers.value.find((item) => item.id === dossierId)
  return {
    motif: d?.motif ?? '',
    client: d?.clientNom ?? '',
    partie: d?.partie_en_cause ?? '',
    juridiction: d?.juridiction ?? '',
  }
}

function applyTemplate(kind: PieceJuridiqueKind, resetId = false) {
  const dossierId = formDossierId.value
  if (!dossierId) return
  const { titre, html } = buildPieceTemplate(kind, getDossierContextForTemplate(dossierId))
  form.value.pieceKind = kind
  form.value.titre = titre
  form.value.contenuHtml = html
  if (resetId) form.value.id = null
  syncEditorContent(html)
}

async function loadData() {
  loading.value = true
  loadError.value = ''
  firestore.clearError()
  try {
    const dossiersOk = await loadDossiers()
    if (!dossiersOk) {
      loadError.value = firestore.lastError.value?.message
        ?? 'Impossible de charger les dossiers.'
      return
    }

    const dossierId = props.initialDossierId
      || (typeof route.query.dossierId === 'string' ? route.query.dossierId : '')
    if (dossierId) form.value.dossierId = dossierId

    if (formDossierId.value) {
      const docsOk = await loadDocumentsForDossier(formDossierId.value)
      if (!docsOk) {
        loadError.value = firestore.lastError.value?.message
          ?? 'Impossible de charger les pièces.'
      } else if (!form.value.id) {
        applyTemplate(formPieceKind.value)
      }
    }

    const documentId = props.initialDocumentId
      || (typeof route.query.documentId === 'string' ? route.query.documentId : '')
    if (documentId) {
      const found = documents.value.find((item) => item.id === documentId)
      if (found) await loadDocument(found)
    }
  } catch (err) {
    loadError.value = getFirestoreErrorMessage(err, 'Chargement')
    showToast('error', loadError.value)
  } finally {
    loading.value = false
  }
}

watch(formDossierId, async (dossierId) => {
  if (!dossierId) {
    documents.value = []
    return
  }
  const ok = await loadDocumentsForDossier(dossierId)
  if (!ok) {
    loadError.value = firestore.lastError.value?.message ?? 'Erreur Firestore.'
    return
  }
  loadError.value = ''
  if (!form.value?.id) applyTemplate(formPieceKind.value, true)
})

watch(formPieceKind, (kind) => {
  if (!form.value?.id && formDossierId.value) applyTemplate(kind, true)
})

function syncEditorContent(html: string) {
  nextTick(() => {
    if (editorRef.value) editorRef.value.innerHTML = html
  })
}

function syncFromEditor() {
  if (editorRef.value) form.value.contenuHtml = editorRef.value.innerHTML
}

function execCmd(command: string, value?: string) {
  document.execCommand(command, false, value)
  editorRef.value?.focus()
  syncFromEditor()
}

function newDocument() {
  form.value = {
    id: null,
    dossierId: form.value.dossierId,
    pieceKind: 'assignation',
    titre: '',
    contenuHtml: '',
  }
  if (form.value.dossierId) applyTemplate('assignation', true)
  else syncEditorContent('')
}

async function loadDocument(document: DossierDocument) {
  const contenuHtml = normalizePieceJuridiqueHtml(document.contenuHtml)
  form.value = {
    id: document.id,
    dossierId: document.dossierId,
    pieceKind: document.pieceKind ?? 'libre',
    titre: document.titre,
    contenuHtml,
  }
  syncEditorContent(contenuHtml)
}

async function saveDocument() {
  if (saving.value) return
  syncFromEditor()

  if (!formDossierId.value) {
    showToast('error', 'Sélectionnez un dossier en cours')
    return
  }
  if (!form.value?.titre?.trim()) {
    showToast('error', 'Le titre de la pièce est obligatoire')
    return
  }

  const contenuHtml = normalizePieceJuridiqueHtml(form.value.contenuHtml)
  form.value.contenuHtml = contenuHtml

  saving.value = true
  try {
    const now = new Date().toISOString()
    const payload = {
      dossierId: formDossierId.value,
      type: 'piece_juridique' as const,
      pieceKind: form.value.pieceKind,
      titre: form.value.titre.trim(),
      contenuHtml,
      updatedAt: now,
    }

    if (form.value.id) {
      const ok = await firestore.run(
        () => updateDoc(doc(db, 'dossier_documents', form.value.id!), payload),
        'Mise à jour de la pièce',
      )
      if (!ok) return
      showToast('success', 'Pièce juridique mise à jour')
    } else {
      const ref = await firestore.run(
        () => addDoc(documentsCol, { ...payload, createdAt: now }),
        'Enregistrement de la pièce',
      )
      if (!ref) return
      form.value.id = ref.id
      showToast('success', 'Pièce enregistrée dans le dossier')
    }

    await loadDocumentsForDossier(formDossierId.value)
  } catch (err) {
    showToast('error', getFirestoreErrorMessage(err, 'Enregistrement'))
  } finally {
    saving.value = false
  }
}

async function removeDocument(id: string) {
  if (!window.confirm('Supprimer cette pièce du dossier ?')) return
  const ok = await firestore.run(
    () => deleteDoc(doc(db, 'dossier_documents', id)),
    'Suppression de la pièce',
  )
  if (!ok) return
  showToast('success', 'Pièce supprimée')
  if (form.value?.id === id) newDocument()
  await loadDocumentsForDossier(formDossierId.value)
}

function printDocument() {
  syncFromEditor()
  printEditorDocument({
    title: form.value.titre,
    dossierMeta: getDossierLabel(form.value.dossierId),
    contenuHtml: form.value.contenuHtml,
    documentKind: 'piece_juridique',
  })
}

const dossierDocuments = computed(() =>
  documents.value.filter((item) => item.dossierId === formDossierId.value),
)

const selectedDossier = computed(() => {
  const id = formDossierId.value
  if (!id) return undefined
  return dossiers.value.find((item) => item.id === id)
})

const dossierContext = computed(() => ({
  motif: selectedDossier.value?.motif ?? '',
  client: selectedDossier.value?.clientNom ?? '',
  partie: selectedDossier.value?.partie_en_cause ?? '',
  juridiction: selectedDossier.value?.juridiction ?? '',
}))

function onModeleApplied(payload: { html: string, titre?: string, mode: 'replace' | 'append' }) {
  if (payload.titre) form.value.titre = payload.titre
  const nextHtml = payload.mode === 'append'
    ? `${form.value.contenuHtml}<hr>${payload.html}`
    : payload.html
  form.value.contenuHtml = nextHtml
  form.value.id = null
  syncEditorContent(nextHtml)
  showToast('success', 'Modèle importé dans l’éditeur')
}

const newPieceBlockedReason = computed(() => {
  if (loading.value) return 'Chargement en cours…'
  if (loadError.value) return 'Corrigez l’erreur de chargement avant de continuer'
  if (dossiers.value.length === 0) return 'Aucun dossier disponible — créez un dossier d’abord'
  return ''
})

const printBlockedReason = computed(() => {
  if (loading.value) return 'Chargement en cours…'
  if (loadError.value) return 'Corrigez l’erreur de chargement'
  if (!formDossierId.value) return 'Sélectionnez un dossier pour imprimer'
  if (!form.value.titre?.trim()) return 'Renseignez le titre de la pièce'
  return ''
})

const saveBlockedReason = computed(() => {
  if (saving.value) return ''
  if (loading.value) return 'Chargement en cours…'
  if (loadError.value) return 'Corrigez l’erreur de chargement'
  if (!formDossierId.value) return 'Sélectionnez un dossier en cours'
  if (!form.value.titre?.trim()) return 'Le titre de la pièce est obligatoire'
  return ''
})

const canNewPiece = computed(() => !newPieceBlockedReason.value)
const canPrint = computed(() => !printBlockedReason.value)
const canSave = computed(() => !saving.value && !saveBlockedReason.value)

onMounted(async () => {
  await loadData()
  nextTick(() => {
    if (form.value.contenuHtml) syncEditorContent(form.value.contenuHtml)
  })
})
</script>

<template>
  <div class="min-h-full bg-white text-foreground">
    <div
      v-if="toast.show"
      class="fixed right-6 top-6 z-[2100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg"
      :class="toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'"
    >
      {{ toast.message }}
    </div>

    <div class="mx-auto max-w-[1600px] p-4 sm:p-6">
      <header class="piece-no-print mb-6 flex flex-col gap-4 rounded-2xl bg-card px-6 py-5 shadow-sm ring-1 ring-border lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-primary text-xs font-semibold tracking-wide uppercase">
            Espace secrétariat
          </p>
          <h1 class="text-2xl font-semibold">
            Rédaction des pièces juridiques
          </h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Modèles préremplis, mise en forme type acte, enregistrement dans le dossier.
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <AppButtonGuard :blocked="!canNewPiece" :reason="newPieceBlockedReason">
            <button
              type="button"
              class="rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-accent"
              :class="BTN_DISABLED"
              :disabled="!canNewPiece"
              @click="newDocument"
            >
              Nouvelle pièce
            </button>
          </AppButtonGuard>
          <AppButtonGuard :blocked="!canPrint" :reason="printBlockedReason">
            <button
              type="button"
              class="rounded-xl bg-secondary px-4 py-2.5 text-sm"
              :class="BTN_DISABLED"
              :disabled="!canPrint"
              @click="printDocument"
            >
              Imprimer
            </button>
          </AppButtonGuard>
          <AppButtonGuard :blocked="!canSave" :reason="saveBlockedReason || (saving ? 'Enregistrement en cours…' : '')">
            <button
              type="button"
              class="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
              :class="BTN_DISABLED"
              :disabled="!canSave"
              @click="saveDocument"
            >
              {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          </AppButtonGuard>
        </div>
      </header>

      <div
        v-if="loadError"
        class="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      >
        <p class="font-medium">
          {{ firestore.permissionDenied ? 'Accès Firestore refusé (403)' : 'Erreur de chargement' }}
        </p>
        <p class="mt-1">
          {{ loadError }}
        </p>
        <p v-if="firestore.permissionDenied" class="mt-2 text-xs opacity-90">
          Vérifiez les règles Firestore pour <code>dossiers</code> et <code>dossier_documents</code>
          (voir <code>apps/example/FIREBASE_AUTH.md</code>).
        </p>
        <button type="button" class="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs text-white" @click="loadData">
          Réessayer
        </button>
      </div>

      <div v-if="loading" class="rounded-2xl bg-card p-10 text-center text-muted-foreground shadow-sm ring-1 ring-border">
        Chargement…
      </div>

      <div v-else-if="!loadError" class="grid gap-6 xl:grid-cols-[340px_1fr]">
        <aside class="piece-no-print space-y-4">
          <div class="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <label class="mb-2 block text-sm font-medium">Dossier en cours <span class="text-destructive">*</span></label>
            <select
              v-model="form.dossierId"
              class="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">Choisir un dossier actif</option>
              <option v-for="dossier in dossiers" :key="dossier.id" :value="dossier.id">
                {{ dossier.motif }} — {{ dossier.clientNom || 'Sans client' }}
              </option>
            </select>
            <p v-if="dossiers.length === 0" class="text-muted-foreground mt-2 text-xs">
              Aucun dossier ouvert ou en cours. Créez-en un dans « Tous les dossiers ».
            </p>
            <p v-else-if="selectedDossier" class="text-muted-foreground mt-2 text-xs">
              {{ selectedDossier.juridiction }} · {{ selectedDossier.statut }}
            </p>
          </div>

          <div class="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <label class="mb-2 block text-sm font-medium">Type de pièce</label>
            <p v-if="!formDossierId" class="text-muted-foreground mb-2 text-xs">
              Sélectionnez un dossier pour choisir un modèle de pièce.
            </p>
            <div class="space-y-2">
              <button
                v-for="kind in pieceKinds"
                :key="kind"
                type="button"
                class="w-full rounded-xl border px-3 py-2.5 text-left text-sm transition"
                :class="[
                  form.pieceKind === kind ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent',
                  !formDossierId ? 'cursor-not-allowed opacity-50' : '',
                ]"
                :disabled="!formDossierId"
                :title="!formDossierId ? 'Sélectionnez un dossier' : undefined"
                @click="form.pieceKind = kind"
              >
                <div class="font-medium">{{ PIECE_KIND_META[kind].label }}</div>
                <div class="text-muted-foreground text-xs">{{ PIECE_KIND_META[kind].description }}</div>
              </button>
            </div>
          </div>

          <PieceModeleImport
            :dossier-id="form.dossierId"
            :piece-kind="formPieceKind"
            :dossier-context="dossierContext"
            @apply="onModeleApplied"
          />

          <div class="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <label class="mb-2 block text-sm font-medium">Titre</label>
            <input
              v-model="form.titre"
              class="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              placeholder="Intitulé de la pièce"
            />
          </div>

          <div class="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <h2 class="mb-3 text-sm font-semibold">Pièces du dossier</h2>
            <p v-if="!form.dossierId" class="text-muted-foreground text-xs">Sélectionnez un dossier.</p>
            <p v-else-if="dossierDocuments.length === 0" class="text-muted-foreground text-xs">
              Aucune pièce enregistrée.
            </p>
            <ul v-else class="max-h-52 space-y-2 overflow-y-auto">
              <li
                v-for="item in dossierDocuments"
                :key="item.id"
                class="rounded-xl border px-3 py-2 text-sm"
                :class="form.id === item.id ? 'border-primary bg-primary/10' : 'border-border'"
              >
                <button type="button" class="w-full text-left" @click="loadDocument(item)">
                  <div class="font-medium">{{ item.titre }}</div>
                  <div class="text-muted-foreground text-xs">
                    {{ PIECE_KIND_META[item.pieceKind ?? 'libre'].label }} · {{ formatDate(item.updatedAt) }}
                  </div>
                </button>
                <button type="button" class="text-destructive mt-2 text-xs" @click="removeDocument(item.id)">
                  Supprimer
                </button>
              </li>
            </ul>
          </div>
        </aside>

        <section class="piece-print-area rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div class="piece-no-print flex flex-wrap gap-1 border-b border-border p-2">
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm font-bold hover:bg-accent" @click="execCmd('bold')">G</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm italic hover:bg-accent" @click="execCmd('italic')">I</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm underline hover:bg-accent" @click="execCmd('underline')">S</button>
            <span class="bg-border mx-1 w-px" />
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent" @click="execCmd('formatBlock', 'h1')">Titre</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent" @click="execCmd('formatBlock', 'p')">Paragraphe</button>
            <span class="bg-border mx-1 w-px" />
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent" @click="execCmd('insertUnorderedList')">• Liste</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent" @click="execCmd('insertOrderedList')">1. Liste</button>
            <span class="bg-border mx-1 w-px" />
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent" @click="execCmd('justifyLeft')">←</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent" @click="execCmd('justifyCenter')">↔</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent" @click="execCmd('justifyRight')">→</button>
            <span class="bg-border mx-1 w-px" />
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent" @click="execCmd('undo')">Annuler</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent" @click="execCmd('redo')">Rétablir</button>
          </div>

          <div class="min-h-[620px] bg-white p-8 text-slate-900">
            <div
              ref="editorRef"
              contenteditable="true"
              class="piece-editor min-h-[580px] max-w-none bg-white outline-none text-slate-900"
              @input="syncFromEditor"
              @blur="syncFromEditor"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.piece-editor {
  background: #fff;
  color: #0f172a;
}

.piece-editor :deep(table),
.piece-editor :deep(thead),
.piece-editor :deep(tr),
.piece-editor :deep(th),
.piece-editor :deep(td) {
  background-color: #fff !important;
}

.piece-editor :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.piece-editor :deep(th),
.piece-editor :deep(td) {
  border: 1px solid #cbd5e1;
  padding: 0.5rem;
}

@media print {
  .piece-no-print {
    display: none !important;
  }

  .piece-print-area {
    margin: 0 !important;
    padding: 0 !important;
    max-width: none !important;
  }

  .piece-editor {
    overflow: visible !important;
    max-height: none !important;
  }
}
</style>
