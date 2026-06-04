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
import { db } from '@/firebase'
import { cloturerDossierApresNoteHonoraire } from '@/services/note-honoraire-cloture'
import type { DossierDocument, DossierDocumentForm } from '@/types/dossier-document'
import { normalizeDevise } from '@/utils/currency'
import { BTN_DISABLED } from '@/utils/action-button'
import { useDomainClientsStore } from '@/store/modules/domain/clients'
import {
  buildNoteHonoraireHtml,
  formatDestinataireNoteHonoraire,
  patchDestinataireInNoteHtml,
  resolveClientForNoteHonoraire,
} from '@/utils/note-honoraire-template'
import {
  parseDossierResultat,
  type DossierResultatIssue,
} from '@/utils/dossier-resultat'
import { printEditorDocument } from '@/utils/print-document'

defineOptions({
  name: 'NoteHonoraireEditor',
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
const clientsStore = useDomainClientsStore()

type DossierRef = {
  id: string
  motif: string
  clientId: string
  clientNom: string
  clientGenre: string
  partieEnCause: string
  juridiction: string
  resumeAffaire: string
  montantHonorairesTotal: number
  deviseHonoraires: string
  statut: string
  dateFermeture: string | null
  resultat: string
}

const documentsCol = collection(db, 'dossier_documents')
const dossiersCol = collection(db, 'dossiers')

const DEFAULT_CONTENT = buildNoteHonoraireHtml({
  motif: '…',
  clientNom: '…',
})

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
  titre: 'Note d\'honoraires',
  contenuHtml: DEFAULT_CONTENT,
})

/** Obligatoire à la création d’une nouvelle note (clôture du dossier). */
const resultatCloture = ref<'' | DossierResultatIssue>('')

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { show: true, type, message }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function syncResultatFromDossier(dossierId: string) {
  if (form.value.id) return
  const dossier = dossiers.value.find((item) => item.id === dossierId)
  resultatCloture.value = parseDossierResultat(dossier?.resultat) ?? ''
}

function mapDossier(currentDoc: { id: string, data: () => Record<string, unknown> | object }): DossierRef {
  const data = currentDoc.data() as Record<string, unknown>
  return {
    id: currentDoc.id,
    motif: String(data.motif ?? data.titre ?? 'Sans intitulé'),
    clientId: String(data.clientId ?? ''),
    clientNom: String(data.clientNom ?? data.nom_client ?? data.client ?? ''),
    clientGenre: String(data.clientGenre ?? ''),
    partieEnCause: String(data.partie_en_cause ?? data.reference ?? ''),
    juridiction: String(data.juridiction ?? ''),
    resumeAffaire: String(data.resume_affaire ?? data.description ?? ''),
    montantHonorairesTotal: Number(data.montantHonorairesTotal ?? 0),
    deviseHonoraires: normalizeDevise(data.deviseHonoraires),
    statut: String(data.statut ?? 'Ouvert'),
    dateFermeture: data.date_fermeture ? String(data.date_fermeture) : null,
    resultat: String(data.resultat ?? ''),
  }
}

function mapDocument(currentDoc: { id: string, data: () => Record<string, unknown> | object }): DossierDocument {
  const data = currentDoc.data() as Record<string, unknown>
  return {
    id: currentDoc.id,
    dossierId: String(data.dossierId ?? ''),
    type: (data.type === 'piece_juridique' ? 'piece_juridique' : 'note_honoraire') as DossierDocument['type'],
    pieceKind: data.pieceKind as DossierDocument['pieceKind'],
    titre: String(data.titre ?? 'Note d\'honoraires'),
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

async function loadDossiers() {
  const snap = await getDocs(dossiersCol)
  dossiers.value = snap.docs.map((currentDoc) => mapDossier(currentDoc))
}

async function loadDocumentsForDossier(dossierId: string) {
  if (!dossierId) {
    documents.value = []
    return
  }
  const snap = await getDocs(
    query(documentsCol, where('dossierId', '==', dossierId)),
  )
  documents.value = snap.docs
    .map((currentDoc) => mapDocument(currentDoc))
    .filter((item) => item.type === 'note_honoraire')
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

function getClientRegistryForDossier(dossier: DossierRef) {
  if (!dossier.clientId) return null
  const client = clientsStore.registry.find((item) => item.id === dossier.clientId)
  if (!client?.nom.trim()) return null
  return { nom: client.nom.trim(), genre: client.genre }
}

function buildNoteHtmlForDossier(dossier: DossierRef) {
  return buildNoteHonoraireHtml({
    motif: dossier.motif,
    clientNom: dossier.clientNom,
    clientGenre: dossier.clientGenre,
    clientFromRegistry: getClientRegistryForDossier(dossier),
    partieEnCause: dossier.partieEnCause,
    juridiction: dossier.juridiction,
    resumeAffaire: dossier.resumeAffaire,
    referenceAffaire: dossier.motif,
    montantTotal: dossier.montantHonorairesTotal,
    devise: dossier.deviseHonoraires,
  })
}

function resolveDestinataireForDossier(dossier: DossierRef) {
  const client = resolveClientForNoteHonoraire({
    clientNom: dossier.clientNom,
    clientGenre: dossier.clientGenre,
    partieEnCause: dossier.partieEnCause,
    clientFromRegistry: getClientRegistryForDossier(dossier),
  })
  return formatDestinataireNoteHonoraire(client.nom, {
    genre: client.genre,
    partieEnCause: dossier.partieEnCause,
  })
}

async function loadData() {
  loading.value = true
  try {
    await clientsStore.loadRegistry()
    await loadDossiers()
    const dossierId = props.initialDossierId
      || (typeof route.query.dossierId === 'string' ? route.query.dossierId : '')
    if (dossierId) form.value.dossierId = dossierId

    if (form.value.dossierId) {
      await loadDocumentsForDossier(form.value.dossierId)
    }

    const documentId = props.initialDocumentId
      || (typeof route.query.documentId === 'string' ? route.query.documentId : '')
    if (documentId) {
      const found = documents.value.find((item) => item.id === documentId)
      if (found) await loadDocument(found)
    }
  } catch {
    showToast('error', 'Erreur lors du chargement')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

watch(() => form.value.dossierId, async (dossierId) => {
  await loadDocumentsForDossier(dossierId)
  applyDossierTemplate(dossierId)
  syncResultatFromDossier(dossierId)
})

function applyDossierTemplate(dossierId: string, force = false) {
  if (!dossierId) return
  const dossier = dossiers.value.find((item) => item.id === dossierId)
  if (!dossier) return

  const client = resolveClientForNoteHonoraire({
    clientNom: dossier.clientNom,
    clientGenre: dossier.clientGenre,
    partieEnCause: dossier.partieEnCause,
    clientFromRegistry: getClientRegistryForDossier(dossier),
  })

  if (!client.nom) {
    showToast('error', 'Renseignez le client du dossier avant d’établir la note (pas la partie adverse).')
    return
  }

  form.value.titre = `Note d'honoraires — ${dossier.motif}`
  const html = buildNoteHtmlForDossier(dossier)
  form.value.contenuHtml = html
  syncEditorContent(html)
  if (force && form.value.id) {
    showToast('success', `Note régénérée — adressée à ${resolveDestinataireForDossier(dossier)}`)
  }
}

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
    titre: 'Note d\'honoraires',
    contenuHtml: DEFAULT_CONTENT,
  }
  if (form.value.dossierId) {
    applyDossierTemplate(form.value.dossierId)
    syncResultatFromDossier(form.value.dossierId)
  } else {
    resultatCloture.value = ''
    syncEditorContent(DEFAULT_CONTENT)
  }
}

async function loadDocument(document: DossierDocument) {
  form.value = {
    id: document.id,
    dossierId: document.dossierId,
    titre: document.titre,
    contenuHtml: document.contenuHtml,
  }
  syncEditorContent(document.contenuHtml)
}

async function saveDocument() {
  if (saving.value) return
  syncFromEditor()

  if (!form.value.dossierId) {
    showToast('error', 'Sélectionnez un dossier')
    return
  }
  if (!form.value.titre.trim()) {
    showToast('error', 'Le titre du document est obligatoire')
    return
  }
  if (!form.value.id && !resultatCloture.value) {
    showToast('error', 'Indiquez si l’affaire est gagnée ou perdue')
    return
  }

  saving.value = true
  try {
    const now = new Date().toISOString()
    const payload = {
      dossierId: form.value.dossierId,
      type: 'note_honoraire' as const,
      titre: form.value.titre.trim(),
      contenuHtml: form.value.contenuHtml,
      updatedAt: now,
    }

    if (form.value.id) {
      await updateDoc(doc(db, 'dossier_documents', form.value.id), payload)
      showToast('success', 'Note honoraire mise à jour dans le dossier')
    } else {
      const issue = resultatCloture.value as DossierResultatIssue
      const ref = await addDoc(documentsCol, { ...payload, createdAt: now })
      form.value.id = ref.id
      const { affectationsCloturees } = await cloturerDossierApresNoteHonoraire(
        db,
        form.value.dossierId,
        issue,
      )
      const dossier = dossiers.value.find((item) => item.id === form.value.dossierId)
      if (dossier) {
        dossier.statut = 'Clos'
        dossier.resultat = issue
        if (!dossier.dateFermeture) dossier.dateFermeture = todayIsoDate()
      }
      const issueLabel = resultatCloture.value === 'gagné' ? 'gagnée' : 'perdue'
      const affHint = affectationsCloturees > 0
        ? ` — ${affectationsCloturees} affectation(s) clôturée(s)`
        : ''
      showToast('success', `Note enregistrée — dossier ${issueLabel}${affHint}`)
    }

    await loadDocumentsForDossier(form.value.dossierId)
  } catch {
    showToast('error', 'Erreur lors de l’enregistrement')
  } finally {
    saving.value = false
  }
}

async function removeDocument(id: string) {
  if (!window.confirm('Supprimer cette note honoraire du dossier ?')) return
  try {
    await deleteDoc(doc(db, 'dossier_documents', id))
    showToast('success', 'Document supprimé')
    if (form.value.id === id) newDocument()
    await loadDocumentsForDossier(form.value.dossierId)
  } catch {
    showToast('error', 'Erreur lors de la suppression')
  }
}

function printDocument() {
  syncFromEditor()
  const dossier = selectedDossierForNote.value
  if (dossier) {
    const destinataire = resolveDestinataireForDossier(dossier)
    const patched = patchDestinataireInNoteHtml(form.value.contenuHtml, destinataire)
    if (patched !== form.value.contenuHtml) {
      form.value.contenuHtml = patched
      syncEditorContent(patched)
    }
  }
  printEditorDocument({
    title: form.value.titre,
    dossierMeta: getDossierLabel(form.value.dossierId),
    contenuHtml: form.value.contenuHtml,
    documentKind: 'note_honoraire',
  })
}

const dossierDocuments = computed(() =>
  documents.value.filter((item) => item.dossierId === form.value.dossierId),
)

const newDocBlockedReason = computed(() => {
  if (loading.value) return 'Chargement en cours…'
  if (dossiers.value.length === 0) return 'Aucun dossier disponible'
  return ''
})

const printBlockedReason = computed(() => {
  if (loading.value) return 'Chargement en cours…'
  if (!form.value.dossierId) return 'Sélectionnez un dossier pour imprimer'
  if (!form.value.titre.trim()) return 'Renseignez le titre du document'
  return ''
})

const isNewNote = computed(() => !form.value.id)

const selectedDossierForNote = computed(() =>
  dossiers.value.find((item) => item.id === form.value.dossierId),
)

const destinatairePreview = computed(() => {
  const d = selectedDossierForNote.value
  if (!d) return ''
  const client = resolveClientForNoteHonoraire({
    clientNom: d.clientNom,
    clientGenre: d.clientGenre,
    partieEnCause: d.partieEnCause,
    clientFromRegistry: getClientRegistryForDossier(d),
  })
  if (!client.nom) return ''
  return formatDestinataireNoteHonoraire(client.nom, {
    genre: client.genre,
    partieEnCause: d.partieEnCause,
  })
})

const saveBlockedReason = computed(() => {
  if (saving.value) return ''
  if (loading.value) return 'Chargement en cours…'
  if (!form.value.dossierId) return 'Sélectionnez un dossier'
  if (!form.value.titre.trim()) return 'Le titre du document est obligatoire'
  if (isNewNote.value && !resultatCloture.value) {
    return 'Indiquez si l’affaire est gagnée ou perdue'
  }
  return ''
})

const canNewDoc = computed(() => !newDocBlockedReason.value)
const canPrint = computed(() => !printBlockedReason.value)
const canSave = computed(() => !saving.value && !saveBlockedReason.value)

onMounted(() => {
  nextTick(() => syncEditorContent(form.value.contenuHtml))
})
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

    <div class="mx-auto max-w-[1600px] p-6">
      <header class="note-no-print mb-6 flex flex-col gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Note honoraire</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Modèle cabinet CCEAJ (Likasi). La note est toujours adressée au client du dossier (payeur des honoraires), jamais à la partie adverse.
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <AppButtonGuard :blocked="!canNewDoc" :reason="newDocBlockedReason">
            <button
              type="button"
              class="rounded-xl border px-4 py-2.5 text-sm dark:border-slate-700"
              :class="BTN_DISABLED"
              :disabled="!canNewDoc"
              @click="newDocument"
            >
              Nouveau
            </button>
          </AppButtonGuard>
          <AppButtonGuard :blocked="!canPrint" :reason="printBlockedReason">
            <button
              type="button"
              class="rounded-xl bg-slate-200 px-4 py-2.5 text-sm dark:bg-slate-700"
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
              class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
              :class="BTN_DISABLED"
              :disabled="!canSave"
              @click="saveDocument"
            >
              {{ saving ? 'Enregistrement…' : 'Enregistrer dans le dossier' }}
            </button>
          </AppButtonGuard>
        </div>
      </header>

      <div v-if="loading" class="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        Chargement…
      </div>

      <div v-else class="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside class="note-no-print space-y-4">
          <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <label class="mb-2 block text-sm font-medium">Dossier concerné <span class="text-rose-500">*</span></label>
            <select
              v-model="form.dossierId"
              class="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Choisir un dossier</option>
              <option v-for="dossier in dossiers" :key="dossier.id" :value="dossier.id">
                {{ dossier.motif }} — {{ dossier.clientNom || 'Sans client' }}
              </option>
            </select>
            <p
              v-if="destinatairePreview"
              class="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
            >
              Adressée à : <strong>{{ destinatairePreview }}</strong>
              <span v-if="selectedDossierForNote?.partieEnCause" class="text-blue-700/80 dark:text-blue-300/80">
                (partie adverse : {{ selectedDossierForNote.partieEnCause }})
              </span>
            </p>
            <button
              v-if="form.dossierId"
              type="button"
              class="mt-2 text-xs font-medium text-primary hover:underline"
              @click="applyDossierTemplate(form.dossierId, true)"
            >
              {{ isNewNote ? 'Actualiser le modèle' : 'Corriger le destinataire (client)' }}
            </button>
          </div>

          <div
            v-if="isNewNote && form.dossierId"
            class="rounded-2xl border border-violet-200 bg-violet-50/80 p-4 shadow-sm dark:border-violet-900 dark:bg-violet-950/30"
          >
            <p class="mb-2 text-sm font-semibold text-violet-900 dark:text-violet-200">
              Issue de l’affaire <span class="text-rose-500">*</span>
            </p>
            <p class="mb-3 text-xs text-violet-800/90 dark:text-violet-300/90">
              À l’enregistrement, le dossier sera clôturé, les affectations en cours prendront fin et les compteurs gagnées / perdues des avocats seront mis à jour.
            </p>
            <div class="flex flex-col gap-2">
              <label class="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm dark:border-emerald-900 dark:bg-slate-900">
                <input
                  v-model="resultatCloture"
                  type="radio"
                  value="gagné"
                  class="text-emerald-600"
                >
                <span class="font-medium text-emerald-800 dark:text-emerald-200">Gagnée</span>
                <span class="text-xs text-slate-500">— décision favorable au client</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm dark:border-rose-900 dark:bg-slate-900">
                <input
                  v-model="resultatCloture"
                  type="radio"
                  value="perdu"
                  class="text-rose-600"
                >
                <span class="font-medium text-rose-800 dark:text-rose-200">Perdue</span>
                <span class="text-xs text-slate-500">— décision défavorable</span>
              </label>
            </div>
          </div>

          <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <label class="mb-2 block text-sm font-medium">Titre du document</label>
            <input
              v-model="form.titre"
              class="w-full rounded-xl border px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              placeholder="Note d'honoraires — …"
            />
          </div>

          <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <h2 class="mb-3 text-sm font-semibold">Documents du dossier</h2>
            <p v-if="!form.dossierId" class="text-xs text-slate-500">Sélectionnez un dossier.</p>
            <p v-else-if="dossierDocuments.length === 0" class="text-xs text-slate-500">
              Aucune note enregistrée pour ce dossier.
            </p>
            <ul v-else class="max-h-64 space-y-2 overflow-y-auto">
              <li
                v-for="item in dossierDocuments"
                :key="item.id"
                class="rounded-xl border px-3 py-2 text-sm"
                :class="form.id === item.id ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30' : 'border-slate-200 dark:border-slate-700'"
              >
                <button type="button" class="w-full text-left" @click="loadDocument(item)">
                  <div class="font-medium">{{ item.titre }}</div>
                  <div class="text-xs text-slate-500">{{ formatDate(item.updatedAt) }}</div>
                </button>
                <button
                  type="button"
                  class="mt-2 text-xs text-rose-600"
                  @click="removeDocument(item.id)"
                >
                  Supprimer
                </button>
              </li>
            </ul>
          </div>
        </aside>

        <section class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <div class="note-no-print flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-700">
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('bold')">G</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm italic hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('italic')">I</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm underline hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('underline')">S</button>
            <span class="mx-1 w-px bg-slate-200 dark:bg-slate-700" />
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('formatBlock', 'h1')">Titre</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('formatBlock', 'p')">Paragraphe</button>
            <span class="mx-1 w-px bg-slate-200 dark:bg-slate-700" />
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('insertUnorderedList')">• Liste</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('insertOrderedList')">1. Liste</button>
            <span class="mx-1 w-px bg-slate-200 dark:bg-slate-700" />
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('justifyLeft')">←</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('justifyCenter')">↔</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('justifyRight')">→</button>
            <span class="mx-1 w-px bg-slate-200 dark:bg-slate-700" />
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('undo')">Annuler</button>
            <button type="button" class="rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" @click="execCmd('redo')">Rétablir</button>
          </div>

          <div
            id="note-honoraire-print-area"
            class="min-h-[600px] bg-white p-8 text-slate-900 dark:bg-white dark:text-slate-900"
          >
            <div
              ref="editorRef"
              contenteditable="true"
              class="note-editor min-h-[560px] max-w-none outline-none prose prose-slate"
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
.note-editor :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.note-editor :deep(th),
.note-editor :deep(td) {
  border: 1px solid #cbd5e1;
  padding: 0.5rem;
}

@media print {
  .note-no-print {
    display: none !important;
  }
}
</style>
