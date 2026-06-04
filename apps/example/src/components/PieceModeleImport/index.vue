<script setup lang="ts">
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { computed, onMounted, ref } from 'vue'
import { PIECE_KIND_META } from '@/constants/pieces-juridiques'
import { db } from '@/firebase'
import type { PieceJuridiqueKind } from '@/types/dossier-document'
import type { PieceModele } from '@/types/piece-modele'
import {
  importModeleFromFile,
  isAcceptedModeleFile,
  mergeDossierIntoHtml,
  type ImportModeleResult,
} from '@/utils/import-modele-piece'
import { BTN_DISABLED } from '@/utils/action-button'

defineOptions({
  name: 'PieceModeleImport',
})

const props = defineProps<{
  dossierId: string
  pieceKind: PieceJuridiqueKind
  dossierContext: {
    motif: string
    client: string
    partie: string
    juridiction: string
  }
}>()

const emit = defineEmits<{
  apply: [payload: { html: string, titre?: string, mode: 'replace' | 'append' }]
}>()

const modelesCol = collection(db, 'piece_modeles')

const importing = ref(false)
const progressLabel = ref('')
const progressPct = ref(0)
const preview = ref<ImportModeleResult | null>(null)
const importMode = ref<'replace' | 'append'>('replace')
const saveAsModele = ref(true)
const modeleName = ref('')

const savedModeles = ref<PieceModele[]>([])
const loadingModeles = ref(false)

const fileInputRef = ref<HTMLInputElement | null>(null)

function mapModele(currentDoc: { id: string, data: () => Record<string, unknown> | object }): PieceModele {
  const data = currentDoc.data() as Record<string, unknown>
  return {
    id: currentDoc.id,
    nom: String(data.nom ?? 'Modèle'),
    sourceType: (data.sourceType === 'image' ? 'image' : 'pdf') as PieceModele['sourceType'],
    fileName: String(data.fileName ?? ''),
    contenuHtml: String(data.contenuHtml ?? ''),
    pieceKind: data.pieceKind as PieceJuridiqueKind | undefined,
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  }
}

async function loadSavedModeles() {
  loadingModeles.value = true
  try {
    const snap = await getDocs(query(modelesCol, orderBy('updatedAt', 'desc')))
    savedModeles.value = snap.docs.map((d) => mapModele(d))
  } catch {
    savedModeles.value = []
  } finally {
    loadingModeles.value = false
  }
}

onMounted(loadSavedModeles)

const canImport = computed(() => !!props.dossierId && !importing.value)

const importBlockedReason = computed(() => {
  if (importing.value) return 'Traitement du fichier en cours…'
  if (!props.dossierId) return 'Sélectionnez d’abord un dossier'
  return ''
})

const applyBlockedReason = computed(() => {
  if (importing.value) return 'Traitement en cours…'
  if (!props.dossierId) return 'Sélectionnez un dossier'
  if (!preview.value) return 'Importez d’abord un PDF ou une photo'
  return ''
})

const useModeleBlockedReason = computed(() => {
  if (!props.dossierId) return 'Sélectionnez un dossier'
  return ''
})

const canApply = computed(() => !applyBlockedReason.value)
const canUseSavedModele = computed(() => !useModeleBlockedReason.value)

function openFilePicker() {
  fileInputRef.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!isAcceptedModeleFile(file)) {
    window.alert('Choisissez un PDF ou une image (JPG, PNG, WEBP).')
    return
  }

  importing.value = true
  progressPct.value = 0
  preview.value = null

  try {
    const result = await importModeleFromFile(file, (message, pct) => {
      progressLabel.value = message
      progressPct.value = pct
    })
    preview.value = result
    modeleName.value = file.name.replace(/\.[^.]+$/, '')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import impossible'
    window.alert(msg)
  } finally {
    importing.value = false
    progressLabel.value = ''
  }
}

function getMergedHtml(result: ImportModeleResult): string {
  return mergeDossierIntoHtml(result.html, props.dossierContext)
}

function applyToEditor() {
  if (!preview.value) return
  const html = getMergedHtml(preview.value)
  const baseName = modeleName.value.trim() || preview.value.fileName.replace(/\.[^.]+$/, '')
  const titre = `${PIECE_KIND_META[props.pieceKind].label} — ${baseName}`

  emit('apply', {
    html,
    titre,
    mode: importMode.value,
  })

  if (saveAsModele.value) {
    void saveModeleToFirestore(baseName, preview.value)
  }

  preview.value = null
}

async function saveModeleToFirestore(nom: string, result: ImportModeleResult) {
  try {
    const now = new Date().toISOString()
    const html = getMergedHtml(result)
    const existing = savedModeles.value.find(
      (m) => m.nom === nom && m.fileName === result.fileName,
    )
    const payload = {
      nom,
      sourceType: result.sourceType,
      fileName: result.fileName,
      contenuHtml: html,
      pieceKind: props.pieceKind,
      updatedAt: now,
    }
    if (existing) {
      await updateDoc(doc(db, 'piece_modeles', existing.id), payload)
    } else {
      await addDoc(modelesCol, { ...payload, createdAt: now })
    }
    await loadSavedModeles()
  } catch {
    // non bloquant
  }
}

function useSavedModele(modele: PieceModele) {
  emit('apply', {
    html: modele.contenuHtml,
    titre: modele.nom,
    mode: 'replace',
  })
}

async function removeSavedModele(id: string) {
  if (!window.confirm('Supprimer ce modèle enregistré ?')) return
  try {
    await deleteDoc(doc(db, 'piece_modeles', id))
    await loadSavedModeles()
  } catch {
    window.alert('Suppression impossible')
  }
}
</script>

<template>
  <div class="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
    <h2 class="mb-1 text-sm font-semibold">
      Créer depuis un modèle
    </h2>
    <p class="text-muted-foreground mb-3 text-xs">
      Importez une photo ou un PDF : le texte est extrait (OCR pour les images) puis placé dans l’éditeur.
    </p>

    <input
      ref="fileInputRef"
      type="file"
      accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
      class="hidden"
      @change="onFileSelected"
    >

    <AppButtonGuard
      :blocked="!canImport"
      :reason="importBlockedReason"
      :inline="false"
      class="w-full"
    >
      <button
        type="button"
        class="w-full rounded-xl border border-dashed border-primary/50 bg-primary/5 px-3 py-3 text-sm font-medium text-primary transition hover:bg-primary/10"
        :class="BTN_DISABLED"
        :disabled="!canImport"
        @click="openFilePicker"
      >
        <span v-if="importing">Traitement… {{ progressPct }}%</span>
        <span v-else>Importer PDF ou photo</span>
      </button>
    </AppButtonGuard>

    <p v-if="importing && progressLabel" class="text-muted-foreground mt-2 text-xs">
      {{ progressLabel }}
    </p>

    <div v-if="preview" class="mt-4 space-y-3 border-t border-border pt-4">
      <p class="text-xs font-medium">
        Aperçu : {{ preview.fileName }}
        <span class="text-muted-foreground">({{ preview.sourceType === 'pdf' ? 'PDF' : 'Image' }})</span>
      </p>

      <div
        v-if="preview.previewDataUrl"
        class="max-h-32 overflow-hidden rounded-lg border border-border bg-muted/30"
      >
        <img :src="preview.previewDataUrl" alt="Aperçu modèle" class="max-h-32 w-full object-contain">
      </div>

      <p class="text-muted-foreground line-clamp-4 text-xs whitespace-pre-wrap">
        {{ preview.plainText.slice(0, 400) }}{{ preview.plainText.length > 400 ? '…' : '' }}
      </p>

      <div>
        <label class="mb-1 block text-xs font-medium">Nom du modèle / titre</label>
        <input
          v-model="modeleName"
          class="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        >
      </div>

      <div class="flex gap-2 text-xs">
        <label class="flex items-center gap-1">
          <input v-model="importMode" type="radio" value="replace">
          Remplacer
        </label>
        <label class="flex items-center gap-1">
          <input v-model="importMode" type="radio" value="append">
          Ajouter à la fin
        </label>
      </div>

      <label class="flex items-center gap-2 text-xs">
        <input v-model="saveAsModele" type="checkbox" class="rounded">
        Enregistrer comme modèle réutilisable
      </label>

      <AppButtonGuard
        :blocked="!canApply"
        :reason="applyBlockedReason"
        show-hint
        :inline="false"
        class="w-full"
      >
        <button
          type="button"
          class="w-full rounded-xl bg-primary py-2 text-sm font-medium text-primary-foreground"
          :class="BTN_DISABLED"
          :disabled="!canApply"
          @click="applyToEditor"
        >
          Appliquer à l’éditeur
        </button>
      </AppButtonGuard>
    </div>

    <div class="mt-4 border-t border-border pt-4">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Modèles enregistrés
      </h3>
      <p v-if="loadingModeles" class="text-muted-foreground text-xs">Chargement…</p>
      <p v-else-if="savedModeles.length === 0" class="text-muted-foreground text-xs">
        Aucun modèle sauvegardé pour l’instant.
      </p>
      <ul v-else class="max-h-40 space-y-2 overflow-y-auto">
        <li
          v-for="modele in savedModeles"
          :key="modele.id"
          class="rounded-lg border border-border px-2 py-2 text-xs"
        >
          <div class="font-medium">{{ modele.nom }}</div>
          <div class="text-muted-foreground">{{ modele.fileName }}</div>
          <div class="mt-2 flex gap-2">
            <AppButtonGuard :blocked="!canUseSavedModele" :reason="useModeleBlockedReason">
              <button
                type="button"
                class="text-primary font-medium"
                :class="canUseSavedModele ? '' : 'opacity-50'"
                :disabled="!canUseSavedModele"
                @click="useSavedModele(modele)"
              >
                Utiliser
              </button>
            </AppButtonGuard>
            <button type="button" class="text-destructive" @click="removeSavedModele(modele.id)">
              Supprimer
            </button>
          </div>
        </li>
      </ul>
    </div>

    <p class="text-muted-foreground mt-3 text-[10px] leading-relaxed">
      Astuce : dans votre modèle Word/PDF, vous pouvez utiliser
      <code v-pre class="text-primary">{{client}}</code>,
      <code v-pre class="text-primary">{{dossier}}</code>,
      <code v-pre class="text-primary">{{partie}}</code>,
      <code v-pre class="text-primary">{{juridiction}}</code>,
      <code v-pre class="text-primary">{{date}}</code>.
    </p>
  </div>
</template>
