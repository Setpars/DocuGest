<script setup lang="ts">
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { db } from '@/firebase'
import ClientFormFields from '@/components/ClientFormFields/index.vue'
import DynamicSelect from '@/components/DynamicSelect/index.vue'
import { useDomainClientsStore } from '@/store/modules/domain/clients'
import { collectUniqueStrings } from '@/utils/collect-field-suggestions'
import { PERMISSIONS } from '@/constants/permissions'
import { DEVISE_OPTIONS, normalizeDevise, formatMoney, type Devise } from '@/utils/currency'
import {
  clientFormFromDossierFields,
  clientFormFromRecord,
  emptyClientForm,
  type ClientFormData,
} from '@/types/client'
import {
  formatAvocatsLabel,
  getAffectationsForDossier,
  resolveDossierAvocats,
  type AffectationRecord,
  type DossierAvocatSummary,
} from '@/utils/affectation'
import { parseDossierResultat, RESULTAT_ISSUE_META } from '@/utils/dossier-resultat'

type DossierStatut = 'Ouvert' | 'En cours' | 'Suspendu' | 'Clos'

type Dossier = {
  id: string
  motif: string
  partie_en_cause: string
  date_ouverture: string
  date_fermeture: string | null
  resume_affaire: string
  statut: DossierStatut
  juridiction: string
  clientId?: string
  clientNom: string
  clientGenre?: string
  clientNationalite?: string
  clientAdresse?: string
  clientTelephone: string
  montantHonorairesTotal: number
  deviseHonoraires: Devise
  avocatId?: string
  resultat?: string
}

type Avocat = {
  id: string
  nom: string
}

type Affectation = AffectationRecord & {
  date_affectation?: string
  statut?: string
}

const STATUT_META: Record<DossierStatut, { label: string, badgeClass: string }> = {
  Ouvert: {
    label: 'Ouvert',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  },
  'En cours': {
    label: 'En cours',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  Suspendu: {
    label: 'Suspendu',
    badgeClass: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
  Clos: {
    label: 'Clos',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
}

const dossiersCol = collection(db, 'dossiers')
const affectationsCol = collection(db, 'affectations')
const avocatsCol = collection(db, 'avocats')
const route = useRoute()
const router = useRouter()
const clientsStore = useDomainClientsStore()
const { auth: hasAuth } = useAppAuth()
const canManagePaiements = computed(() => hasAuth(PERMISSIONS.paiements))
const dossiers = ref<Dossier[]>([])
const shouldOpenFromClientQuery = ref(
  typeof route.query.clientId === 'string' && route.query.clientId.length > 0,
)
const affectations = ref<Affectation[]>([])
const avocats = ref<Avocat[]>([])
const search = ref('')
const filterStatut = ref<'' | DossierStatut>('')
const loading = ref(false)
const saving = ref(false)
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
const selectedJurisdiction = ref<string | null>(null)

const showForm = ref(false)
const showDetail = ref(false)
const isEdit = ref(false)
const selected = ref<Dossier | null>(null)

const toast = ref({
  show: false,
  type: 'success' as 'success' | 'error',
  message: '',
})

const form = ref({
  id: null as string | null,
  motif: '',
  partie_en_cause: '',
  date_ouverture: '',
  date_fermeture: null as string | null,
  resume_affaire: '',
  statut: 'Ouvert' as DossierStatut,
  juridiction: '',
  montantHonorairesTotal: '',
  deviseHonoraires: 'CDF' as Devise,
})

const clientForm = ref<ClientFormData>(emptyClientForm())

const sortKey = ref<keyof Dossier>('date_ouverture')
const sortOrder = ref<'asc' | 'desc'>('desc')
const currentPage = ref(1)
const itemsPerPage = ref(12)

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { show: true, type, message }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const avocatNameMap = computed(() => {
  const map: Record<string, string> = {}
  for (const item of avocats.value) {
    map[item.id] = item.nom
  }
  return map
})

function getDossierAvocats(dossier: Dossier): DossierAvocatSummary[] {
  return resolveDossierAvocats(
    dossier.id,
    affectations.value,
    avocatNameMap.value,
    dossier.avocatId,
  )
}

function isDossierAssigne(dossier: Dossier): boolean {
  return getDossierAvocats(dossier).length > 0
}

function mapDossierDoc(currentDoc: { id: string, data: () => Record<string, unknown> | object }): Dossier {
  const data = currentDoc.data() as Record<string, unknown>
  return {
    id: currentDoc.id,
    motif: String(data.motif ?? data.titre ?? ''),
    partie_en_cause: String(data.partie_en_cause ?? data.reference ?? ''),
    date_ouverture: String(data.date_ouverture ?? data.createdAt ?? ''),
    date_fermeture: data.date_fermeture ? String(data.date_fermeture) : null,
    resume_affaire: String(data.resume_affaire ?? data.description ?? ''),
    statut: (String(data.statut ?? 'Ouvert') as DossierStatut) || 'Ouvert',
    juridiction: String(data.juridiction ?? ''),
    clientId: data.clientId ? String(data.clientId) : undefined,
    clientNom: String(data.clientNom ?? data.nom_client ?? data.client ?? ''),
    clientGenre: String(data.clientGenre ?? ''),
    clientNationalite: String(data.clientNationalite ?? ''),
    clientAdresse: String(data.clientAdresse ?? ''),
    clientTelephone: String(data.clientTelephone ?? data.telephone ?? ''),
    montantHonorairesTotal: Number(data.montantHonorairesTotal ?? 0),
    deviseHonoraires: normalizeDevise(data.deviseHonoraires),
    avocatId: String(data.avocatId ?? ''),
    resultat: String(data.resultat ?? ''),
  }
}

function updateOnlineStatus() {
  isOnline.value = typeof navigator !== 'undefined' ? navigator.onLine : true
}

async function loadData() {
  loading.value = true
  try {
    const [dSnap, affSnap, aSnap] = await Promise.all([
      getDocs(dossiersCol),
      getDocs(affectationsCol),
      getDocs(avocatsCol),
    ])
    try {
      await clientsStore.loadRegistry(true)
    } catch {
      // Registre client : rechargé à l’enregistrement du dossier
    }

    avocats.value = aSnap.docs.map((currentDoc) => ({
      id: currentDoc.id,
      nom: String((currentDoc.data() as Record<string, unknown>).nom ?? ''),
    }))

    affectations.value = affSnap.docs.map((currentDoc) => ({
      id: currentDoc.id,
      ...(currentDoc.data() as Omit<Affectation, 'id'>),
    }))

    dossiers.value = dSnap.docs.map((currentDoc) => mapDossierDoc(currentDoc))

    if (shouldOpenFromClientQuery.value) {
      shouldOpenFromClientQuery.value = false
      await openAdd()
    }
  } catch {
    showToast('error', 'Erreur lors du chargement des dossiers')
  } finally {
    loading.value = false
  }
}

function openDossierFromQuery() {
  const dossierId = typeof route.query.dossierId === 'string' ? route.query.dossierId : ''
  if (!dossierId) return
  const dossier = dossiers.value.find((item) => item.id === dossierId)
  if (dossier) view(dossier)
}

onMounted(() => {
  loadData().then(() => openDossierFromQuery())
  updateOnlineStatus()
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})

watch([search, filterStatut, selectedJurisdiction], () => {
  currentPage.value = 1
})

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

const inputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800'

watch(() => form.value.statut, (statut) => {
  if (statut === 'Clos') {
    if (!form.value.date_fermeture) form.value.date_fermeture = todayIsoDate()
  } else {
    form.value.date_fermeture = null
  }
})

function getFormValidationErrors(): string[] {
  const missing: string[] = []
  if (!clientForm.value.nom.trim()) missing.push('Nom du client')
  if (!form.value.motif.trim()) missing.push('Intitulé de l’affaire')
  if (!form.value.partie_en_cause.trim()) missing.push('Partie adverse')
  if (!form.value.juridiction.trim()) missing.push('Juridiction')
  if (!form.value.date_ouverture) missing.push('Date d’ouverture')
  return missing
}

const formValidationErrors = computed(() => getFormValidationErrors())

const juridictionOptions = computed(() =>
  collectUniqueStrings([
    ...dossiers.value.map((item) => item.juridiction),
    ...clientsStore.juridictionSuggestions,
  ]),
)

const motifOptions = computed(() => clientsStore.motifSuggestions)

const partieEnCauseOptions = computed(() => clientsStore.partieEnCauseSuggestions)

const deviseFormOptions = computed(() => {
  const codes = collectUniqueStrings([
    ...DEVISE_OPTIONS.map((o) => o.value),
    ...clientsStore.deviseSuggestions,
  ])
  return codes.map((code) => {
    const known = DEVISE_OPTIONS.find((o) => o.value === code)
    return { value: code as Devise, label: known?.label ?? code }
  })
})

const {
  suggestion: juridictionSuggestion,
  onJuridictionManualInput,
  applySuggestion: applyJuridictionSuggestion,
  dismissSuggestion: dismissJuridictionSuggestion,
  resetJuridictionDetection,
  lockJuridictionManual,
  flushJuridictionForSave,
} = useJuridictionFromMotif(
  computed(() => form.value.motif),
  computed({
    get: () => form.value.juridiction,
    set: (value: string) => {
      form.value.juridiction = value
    },
  }),
  juridictionOptions,
)

function clearClientIdQuery() {
  if (!route.query.clientId) return
  const nextQuery = { ...route.query }
  delete nextQuery.clientId
  router.replace({ query: nextQuery })
}

function resetForm() {
  form.value = {
    id: null,
    motif: '',
    partie_en_cause: '',
    date_ouverture: todayIsoDate(),
    date_fermeture: null,
    resume_affaire: '',
    statut: 'Ouvert',
    juridiction: '',
    montantHonorairesTotal: '',
    deviseHonoraires: 'CDF',
  }
}

async function prefillClientFromRoute() {
  const queryClientId = typeof route.query.clientId === 'string' ? route.query.clientId : ''
  if (!queryClientId || queryClientId.startsWith('dossier:')) return
  await clientsStore.loadRegistry()
  const record = await clientsStore.fetchClientRecord(queryClientId)
  if (record) clientForm.value = clientFormFromRecord(record)
}

async function openAdd() {
  closeDetail()
  isEdit.value = false
  resetForm()
  clientForm.value = emptyClientForm()
  resetJuridictionDetection()
  if (selectedJurisdiction.value) {
    form.value.juridiction = selectedJurisdiction.value
    lockJuridictionManual()
  }
  await prefillClientFromRoute()
  showForm.value = true
}

function edit(dossier: Dossier) {
  isEdit.value = true
  form.value = {
    id: dossier.id,
    motif: dossier.motif || '',
    partie_en_cause: dossier.partie_en_cause || '',
    date_ouverture: dossier.date_ouverture || '',
    date_fermeture: dossier.date_fermeture,
    resume_affaire: dossier.resume_affaire || '',
    statut: dossier.statut || 'Ouvert',
    juridiction: dossier.juridiction || '',
    montantHonorairesTotal: dossier.montantHonorairesTotal ? String(dossier.montantHonorairesTotal) : '',
    deviseHonoraires: dossier.deviseHonoraires || 'CDF',
  }
  resetJuridictionDetection()
  clientForm.value = clientFormFromDossierFields(dossier)
  if (dossier.juridiction?.trim()) lockJuridictionManual()
  showForm.value = true
}

function view(dossier: Dossier) {
  selected.value = dossier
  showDetail.value = true
}

function closeForm() {
  showForm.value = false
  shouldOpenFromClientQuery.value = false
  clearClientIdQuery()
}

function closeDetail() {
  showDetail.value = false
}

const selectedAvocats = computed(() => {
  if (!selected.value) return []
  return getDossierAvocats(selected.value)
})

const selectedResultatIssue = computed(() =>
  parseDossierResultat(selected.value?.resultat),
)

async function save() {
  if (saving.value) return
  saving.value = true

  try {
    flushJuridictionForSave()

    const missing = getFormValidationErrors()
    if (missing.length > 0) {
      showToast('error', `Champs obligatoires : ${missing.join(', ')}`)
      return
    }

    if (!isOnline.value) {
      showToast('error', 'Connexion indisponible. Vérifiez votre réseau.')
      return
    }

    await clientsStore.loadRegistry()
    const clientSnapshot = await clientsStore.syncForDossier(clientForm.value)
    if (!clientSnapshot) {
      showToast('error', 'Le nom du client est obligatoire.')
      return
    }

    const payload = {
      motif: form.value.motif,
      partie_en_cause: form.value.partie_en_cause,
      date_ouverture: form.value.date_ouverture,
      date_fermeture: form.value.statut === 'Clos' ? form.value.date_fermeture : null,
      resume_affaire: form.value.resume_affaire,
      statut: form.value.statut,
      juridiction: form.value.juridiction.trim(),
      clientId: clientSnapshot.clientId,
      clientNom: clientSnapshot.clientNom,
      clientGenre: clientSnapshot.clientGenre,
      clientNationalite: clientSnapshot.clientNationalite,
      clientAdresse: clientSnapshot.clientAdresse,
      clientTelephone: clientSnapshot.clientTelephone,
      montantHonorairesTotal: Number(form.value.montantHonorairesTotal) || 0,
      deviseHonoraires: form.value.deviseHonoraires,
    }

    if (isEdit.value && form.value.id) {
      await updateDoc(doc(db, 'dossiers', form.value.id), payload)
      showToast('success', 'Dossier modifié avec succès')
    } else {
      await addDoc(dossiersCol, payload)
      showToast('success', 'Dossier créé avec succès')
    }

    closeForm()
    await loadData()
  } catch (error: unknown) {
    const code = String((error as { code?: string })?.code || '')
    if (code.includes('unavailable') || code.includes('failed-precondition')) {
      showToast('error', 'Service indisponible. Réessayez dans quelques instants.')
    } else {
      showToast('error', 'Erreur lors de l’enregistrement')
    }
  } finally {
    saving.value = false
  }
}

async function remove(id: string) {
  const dossier = dossiers.value.find((item) => item.id === id)
  const affs = getAffectationsForDossier(affectations.value, id)
  const avocatNoms = dossier
    ? getDossierAvocats(dossier).map((item) => item.nom).join(', ')
    : ''

  const message = avocatNoms
    ? `Supprimer le dossier « ${dossier?.motif ?? ''} » ?\n\nLe suivi par ${avocatNoms} sera également annulé.`
    : `Supprimer définitivement le dossier « ${dossier?.motif ?? ''} » ?`

  if (!window.confirm(message)) return

  try {
    await Promise.all(
      affs.map((item) => deleteDoc(doc(db, 'affectations', item.id))),
    )
    await deleteDoc(doc(db, 'dossiers', id))
    showToast('success', 'Dossier supprimé')
    await loadData()
    if (selected.value?.id === id) showDetail.value = false
  } catch {
    showToast('error', 'Erreur lors de la suppression')
  }
}

const totals = computed(() => {
  const list = dossiers.value
  const assignes = list.filter((item) => isDossierAssigne(item)).length
  return {
    total: list.length,
    ouvert: list.filter((item) => item.statut === 'Ouvert').length,
    enCours: list.filter((item) => item.statut === 'En cours').length,
    assignes,
    sansAvocat: list.length - assignes,
  }
})

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  return dossiers.value.filter((dossier) => {
    const avocatNoms = getDossierAvocats(dossier).map((item) => item.nom).join(' ')

    const matchSearch = !q || [
      dossier.motif,
      dossier.partie_en_cause,
      dossier.resume_affaire,
      dossier.juridiction,
      dossier.statut,
      dossier.clientNom,
      avocatNoms,
    ].some((value) => String(value).toLowerCase().includes(q))

    const matchJurisdiction = !selectedJurisdiction.value || dossier.juridiction === selectedJurisdiction.value
    const matchStatut = !filterStatut.value || dossier.statut === filterStatut.value
    return matchSearch && matchJurisdiction && matchStatut
  })
})

const sorted = computed(() => {
  const data = [...filtered.value]
  data.sort((a, b) => {
    const aVal = a[sortKey.value] ?? ''
    const bVal = b[sortKey.value] ?? ''
    return sortOrder.value === 'asc'
      ? String(aVal).localeCompare(String(bVal), 'fr', { sensitivity: 'base' })
      : String(bVal).localeCompare(String(aVal), 'fr', { sensitivity: 'base' })
  })
  return data
})

const totalPages = computed(() => Math.max(1, Math.ceil(sorted.value.length / itemsPerPage.value)))

const paginated = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return sorted.value.slice(start, start + itemsPerPage.value)
})

const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = new Set([1, total, current, current - 1, current + 1])
  return [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
})

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

function selectJurisdiction(jurisdiction: string | null) {
  selectedJurisdiction.value = jurisdiction
  currentPage.value = 1
}

function getSuiviLabel(dossier: Dossier): string {
  return formatAvocatsLabel(getDossierAvocats(dossier))
}

function editFromDetail() {
  if (!selected.value) return
  const dossier = selected.value
  closeDetail()
  edit(dossier)
}
</script>

<template>
  <div class="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div
      v-if="toast.show"
      class="fixed left-4 right-4 top-4 z-[2100] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg sm:left-auto sm:right-6 sm:top-6 sm:max-w-md"
      :class="toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'"
    >
      {{ toast.message }}
    </div>

    <div v-if="!isOnline" class="mx-auto max-w-[1600px] px-6 pt-6">
      <div class="rounded-xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
        Connexion perdue. Les enregistrements peuvent être retardés.
      </div>
    </div>

    <div class="mx-auto max-w-[1600px] p-4 sm:p-6">
      <div class="mb-6 flex flex-col gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Gestion des dossiers</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Créez et suivez les affaires. Un dossier n’est pris en charge que lorsqu’un avocat lui est assigné.
          </p>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            <span class="font-medium">{{ totals.assignes }}</span> assigné(s)
            · <span class="font-medium">{{ totals.sansAvocat }}</span> en attente d’avocat
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
            @click="openAdd"
          >
            + Nouveau dossier
          </button>
        </div>
      </div>

      <div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <div class="text-sm text-slate-500">Total</div>
          <div class="mt-2 text-2xl font-semibold">{{ totals.total }}</div>
          <p class="mt-1 text-xs text-slate-500">Dossiers enregistrés</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <div class="text-sm text-slate-500">Ouverts / En cours</div>
          <div class="mt-2 text-2xl font-semibold text-blue-600">{{ totals.ouvert + totals.enCours }}</div>
          <p class="mt-1 text-xs text-slate-500">Affaires actives</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <div class="text-sm text-slate-500">Assignés</div>
          <div class="mt-2 text-2xl font-semibold text-emerald-600">{{ totals.assignes }}</div>
          <p class="mt-1 text-xs text-slate-500">Suivis par un avocat</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <div class="text-sm text-slate-500">Sans avocat</div>
          <div class="mt-2 text-2xl font-semibold text-amber-600">{{ totals.sansAvocat }}</div>
          <p class="mt-1 text-xs text-slate-500">Disponibles à l’assignation</p>
        </div>
      </div>

      <div class="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div class="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
          <input
            v-model="search"
            placeholder="Rechercher (motif, client, juridiction, avocat…)"
            class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            v-model="filterStatut"
            class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">Tous les statuts</option>
            <option value="Ouvert">Ouvert</option>
            <option value="En cours">En cours</option>
            <option value="Suspendu">Suspendu</option>
            <option value="Clos">Clos</option>
          </select>
          <div class="text-sm text-slate-500">
            {{ sorted.length }} résultat(s)
          </div>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Juridictions
            </h2>
          </div>

          <div class="max-h-[60vh] overflow-y-auto p-4">
            <button
              type="button"
              class="mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition"
              :class="!selectedJurisdiction ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'"
              @click="selectJurisdiction(null)"
            >
              <span>Tous les dossiers</span>
              <span class="text-xs font-medium">{{ dossiers.length }}</span>
            </button>

            <button
              v-for="jurisdiction in juridictionOptions"
              :key="jurisdiction"
              type="button"
              class="mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition"
              :class="selectedJurisdiction === jurisdiction ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'"
              @click="selectJurisdiction(jurisdiction)"
            >
              <span class="truncate pr-2">{{ jurisdiction }}</span>
              <span class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                {{ dossiers.filter((item) => item.juridiction === jurisdiction).length }}
              </span>
            </button>
          </div>
        </aside>

        <main>
          <div v-if="loading" class="rounded-2xl bg-white p-8 text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            Chargement des dossiers…
          </div>

          <div v-else-if="paginated.length === 0" class="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <p class="text-slate-500">Aucun dossier ne correspond à vos critères.</p>
            <button class="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white" @click="openAdd">
              Créer un dossier
            </button>
          </div>

          <div v-else class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <article
                v-for="dossier in paginated"
                :key="dossier.id"
                class="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800"
              >
                <button type="button" class="flex w-full flex-col items-start gap-3 text-left" @click="view(dossier)">
                  <div class="flex w-full items-start justify-between gap-2">
                    <span
                      class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                      :class="STATUT_META[dossier.statut]?.badgeClass ?? STATUT_META.Ouvert.badgeClass"
                    >
                      {{ dossier.statut }}
                    </span>
                    <span
                      class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                      :class="isDossierAssigne(dossier)
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'"
                    >
                      {{ isDossierAssigne(dossier) ? 'Assigné' : 'Sans avocat' }}
                    </span>
                  </div>

                  <h3 class="line-clamp-2 font-semibold text-slate-900 dark:text-slate-100">
                    {{ dossier.motif }}
                  </h3>
                  <p class="text-xs text-slate-500">{{ dossier.juridiction }}</p>
                  <p class="text-sm text-slate-600 dark:text-slate-300">
                    <span class="text-slate-500">Client :</span>
                    <RouterLink
                      v-if="dossier.clientId"
                      :to="{ name: 'clientDetail', params: { clientId: dossier.clientId } }"
                      class="text-primary font-medium hover:underline"
                      @click.stop
                    >
                      {{ dossier.clientNom || '—' }}
                    </RouterLink>
                    <span v-else>{{ dossier.clientNom || '—' }}</span>
                  </p>
                  <p class="text-xs text-slate-500">
                    <span class="font-medium text-slate-600 dark:text-slate-400">Suivi :</span>
                    {{ getSuiviLabel(dossier) }}
                  </p>
                </button>

                <div class="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                  <RouterLink
                    :to="{ name: 'dossierFiche', params: { dossierId: dossier.id } }"
                    class="rounded-lg bg-violet-100 px-2.5 py-1.5 text-xs font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                  >
                    Fiche suivi
                  </RouterLink>
                  <button class="rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-medium dark:bg-slate-700" @click="view(dossier)">
                    Détail
                  </button>
                  <button class="rounded-lg bg-blue-100 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40" @click="edit(dossier)">
                    Modifier
                  </button>
                  <button class="rounded-lg bg-rose-100 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-900/40" @click="remove(dossier.id)">
                    Supprimer
                  </button>
                </div>
              </article>
            </div>

            <div v-if="totalPages > 1" class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <p class="text-sm text-slate-500">Page {{ currentPage }} / {{ totalPages }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700"
                  :disabled="currentPage === 1"
                  @click="goToPage(currentPage - 1)"
                >
                  Précédent
                </button>
                <button
                  v-for="page in visiblePages"
                  :key="page"
                  type="button"
                  class="rounded-xl px-3 py-2 text-sm"
                  :class="page === currentPage ? 'bg-blue-600 text-white' : 'border border-slate-300 dark:border-slate-700'"
                  @click="goToPage(page)"
                >
                  {{ page }}
                </button>
                <button
                  type="button"
                  class="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700"
                  :disabled="currentPage === totalPages"
                  @click="goToPage(currentPage + 1)"
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showDetail"
        class="app-modal-overlay"
        @click="closeDetail"
      >
        <div class="app-modal-overlay__wrap app-modal-overlay__wrap--center">
          <div class="app-modal-overlay__dialog max-w-4xl" @click.stop>
            <div class="shrink-0 flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-700">
              <div class="min-w-0">
                <h2 class="truncate text-xl font-semibold">{{ selected?.motif }}</h2>
                <p class="text-sm text-slate-500">{{ selected?.juridiction }}</p>
              </div>
              <button type="button" class="shrink-0 rounded-xl border px-3 py-2 text-sm" @click="closeDetail">
                Fermer
              </button>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div class="grid gap-0 lg:grid-cols-[1.3fr_1fr]">
                <div class="space-y-4 border-b border-slate-200 p-4 sm:p-6 lg:border-b-0 lg:border-r dark:border-slate-700">
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-if="selected"
                      class="rounded-full px-3 py-1 text-xs font-medium"
                      :class="STATUT_META[selected.statut]?.badgeClass"
                    >
                      {{ selected.statut }}
                    </span>
                    <span
                      class="rounded-full px-3 py-1 text-xs font-medium"
                      :class="selectedAvocats.length
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'"
                    >
                      {{ selectedAvocats.length ? `${selectedAvocats.length} avocat(s) assigné(s)` : 'En attente d’assignation' }}
                    </span>
                    <span
                      v-if="selectedResultatIssue"
                      class="rounded-full px-3 py-1 text-xs font-medium"
                      :class="RESULTAT_ISSUE_META[selectedResultatIssue].badgeClass"
                    >
                      {{ RESULTAT_ISSUE_META[selectedResultatIssue].label }}
                    </span>
                  </div>

                  <div
                    v-if="selectedAvocats.length"
                    class="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
                  >
                    <div class="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-200">
                      Avocat(s) en charge
                    </div>
                    <ul class="mt-2 space-y-1.5 text-sm">
                      <li
                        v-for="avocat in selectedAvocats"
                        :key="avocat.id"
                        class="font-medium text-emerald-900 dark:text-emerald-100"
                      >
                        {{ avocat.nom }}
                        <span v-if="avocat.role" class="font-normal text-emerald-700 dark:text-emerald-300">
                          — {{ avocat.role }}
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div class="grid gap-3 sm:grid-cols-2">
                    <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                      <div class="text-xs uppercase text-slate-500">Ouverture</div>
                      <div class="mt-1 font-medium">{{ formatDate(selected?.date_ouverture) }}</div>
                    </div>
                    <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                      <div class="text-xs uppercase text-slate-500">Fermeture</div>
                      <div class="mt-1 font-medium">{{ formatDate(selected?.date_fermeture) }}</div>
                    </div>
                    <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800 sm:col-span-2">
                      <div class="text-xs uppercase text-slate-500">Partie en cause</div>
                      <div class="mt-1 font-medium">{{ selected?.partie_en_cause }}</div>
                    </div>
                  </div>

                  <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                    <div class="mb-2 text-xs uppercase text-slate-500">Résumé de l’affaire</div>
                    <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {{ selected?.resume_affaire || 'Aucun résumé renseigné.' }}
                    </p>
                  </div>
                </div>

                <div class="space-y-4 p-4 sm:p-6">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Informations client
                    </div>
                    <RouterLink
                      v-if="selected?.clientId"
                      :to="{ name: 'clientDetail', params: { clientId: selected.clientId } }"
                      class="text-primary text-xs font-medium hover:underline"
                      @click="closeDetail"
                    >
                      Fiche client complète →
                    </RouterLink>
                  </div>

                  <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div class="text-xs text-slate-500">Nom</div>
                    <div class="mt-1 font-medium">{{ selected?.clientNom || '—' }}</div>
                  </div>

                  <div class="grid gap-3 sm:grid-cols-2">
                    <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <div class="text-xs text-slate-500">Genre</div>
                      <div class="mt-1 font-medium">{{ selected?.clientGenre || '—' }}</div>
                    </div>
                    <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <div class="text-xs text-slate-500">Nationalité</div>
                      <div class="mt-1 font-medium">{{ selected?.clientNationalite || '—' }}</div>
                    </div>
                  </div>

                  <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div class="text-xs text-slate-500">Adresse</div>
                    <div class="mt-1 font-medium">{{ selected?.clientAdresse || '—' }}</div>
                  </div>

                  <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div class="text-xs text-slate-500">Téléphone</div>
                    <div class="mt-1 font-medium">{{ selected?.clientTelephone || '—' }}</div>
                  </div>

                  <div class="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-900/20">
                    <div class="text-xs text-slate-500">Honoraires — montant total à payer</div>
                    <div class="mt-1 font-semibold text-violet-900 dark:text-violet-200">
                      <template v-if="selected && selected.montantHonorairesTotal > 0">
                        {{ formatMoney(selected.montantHonorairesTotal, selected.deviseHonoraires) }}
                      </template>
                      <span v-else class="font-normal text-amber-700 dark:text-amber-300">Non défini — à renseigner dans Modifier</span>
                    </div>
                    <p class="mt-2 text-xs text-slate-500">
                      Les versements et la note d’honoraires s’appuient sur ce montant.
                    </p>
                  </div>

                  <p v-if="!selectedAvocats.length" class="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    Ce dossier n’a pas encore d’avocat assigné. Rendez-vous dans la page Avocats pour créer une affectation.
                  </p>
                </div>
              </div>
            </div>

            <div class="shrink-0 flex flex-col gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:px-6 dark:border-slate-700">
              <RouterLink
                v-if="selected"
                :to="{ name: 'dossierFiche', params: { dossierId: selected.id } }"
                class="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-center text-sm font-medium text-white sm:w-auto hover:bg-violet-700"
                @click="closeDetail"
              >
                Fiche de suivi complète
              </RouterLink>
              <RouterLink
                v-if="selected && canManagePaiements && isDossierAssigne(selected)"
                :to="{ name: 'paiement', query: { dossierId: selected.id, open: 'add' } }"
                class="w-full rounded-xl bg-violet-100 px-4 py-2.5 text-center text-sm font-medium text-violet-800 sm:w-auto dark:bg-violet-900/40 dark:text-violet-200"
                @click="closeDetail"
              >
                Gérer les paiements
              </RouterLink>
              <RouterLink
                v-if="selected"
                :to="{ name: 'noteHonoraire', query: { dossierId: selected.id } }"
                class="w-full rounded-xl bg-emerald-100 px-4 py-2.5 text-center text-sm font-medium text-emerald-800 sm:w-auto dark:bg-emerald-900/40 dark:text-emerald-200"
                @click="closeDetail"
              >
                Établir note honoraire
              </RouterLink>
              <button
                v-if="selected"
                type="button"
                class="w-full rounded-xl bg-blue-100 px-4 py-2.5 text-sm font-medium text-blue-700 sm:w-auto dark:bg-blue-900/40"
                @click="editFromDetail"
              >
                Modifier
              </button>
              <button type="button" class="w-full rounded-xl border px-4 py-2.5 text-sm sm:w-auto" @click="closeDetail">
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showForm"
        class="app-modal-overlay"
        @click="closeForm"
      >
        <div class="app-modal-overlay__wrap app-modal-overlay__wrap--center">
          <div class="app-modal-overlay__dialog max-w-3xl" @click.stop>
            <div class="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-700">
              <h2 class="text-xl font-semibold">{{ isEdit ? 'Modifier le dossier' : 'Nouveau dossier' }}</h2>
              <p class="mt-1 text-sm text-slate-500">
                {{ isEdit ? 'Mettez à jour les informations ci-dessous.' : 'Renseignez les sections dans l’ordre. L’assignation de l’avocat se fait ensuite dans Avocats.' }}
              </p>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
              <div class="space-y-8">
                <!-- 1. Client -->
                <section class="space-y-4">
                  <header class="flex items-center gap-3 border-b border-slate-200 pb-2 dark:border-slate-700">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">1</span>
                    <div>
                      <h3 class="text-sm font-semibold">Client</h3>
                      <p class="text-xs text-slate-500">
                        Le client n’est géré que via le dossier : création, mise à jour et détection des doublons à l’enregistrement.
                      </p>
                    </div>
                  </header>
                  <ClientFormFields
                    v-model="clientForm"
                    :input-class="inputClass"
                  />
                </section>

                <!-- 2. Affaire -->
                <section class="space-y-4">
                  <header class="flex items-center gap-3 border-b border-slate-200 pb-2 dark:border-slate-700">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">2</span>
                    <div>
                      <h3 class="text-sm font-semibold">L’affaire</h3>
                      <p class="text-xs text-slate-500">Objet du litige et partie adverse</p>
                    </div>
                  </header>
                  <div class="space-y-4">
                    <div>
                      <label class="mb-1.5 block text-sm font-medium">
                        Intitulé / motif <span class="text-rose-500">*</span>
                      </label>
                      <SpellCheckAssist
                        v-model="form.motif"
                        field-label="Intitulé de l’affaire"
                        list-id="dossier-motif"
                        :suggestions="motifOptions"
                        placeholder="Ex. Recouvrement créance — Tribunal de commerce de Lubumbashi"
                        :input-class="inputClass"
                      />
                      <p class="mt-1 text-xs text-slate-500">
                        Mentionnez le tribunal ou la ville pour la détection automatique de la juridiction.
                      </p>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-sm font-medium">
                        Partie adverse <span class="text-rose-500">*</span>
                      </label>
                      <SpellCheckAssist
                        v-model="form.partie_en_cause"
                        field-label="Partie adverse"
                        list-id="partie-en-cause"
                        :suggestions="partieEnCauseOptions"
                        placeholder="Ex. Société XYZ SARL"
                        :input-class="inputClass"
                      />
                    </div>
                    <div>
                      <label class="mb-1.5 block text-sm font-medium">Résumé des faits</label>
                      <SpellCheckAssist
                        v-model="form.resume_affaire"
                        field-label="Résumé des faits"
                        multiline
                        :rows="3"
                        placeholder="Contexte, demandes du client, éléments utiles pour l’avocat (facultatif)"
                        :input-class="inputClass"
                      />
                    </div>
                  </div>
                </section>

                <!-- 3. Suivi -->
                <section class="space-y-4">
                  <header class="flex items-center gap-3 border-b border-slate-200 pb-2 dark:border-slate-700">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">3</span>
                    <div>
                      <h3 class="text-sm font-semibold">Cadre &amp; suivi</h3>
                      <p class="text-xs text-slate-500">Juridiction, statut et dates</p>
                    </div>
                  </header>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div class="sm:col-span-2">
                      <label class="mb-1.5 block text-sm font-medium">
                        Juridiction <span class="text-rose-500">*</span>
                      </label>
                      <DynamicSelect
                        v-model="form.juridiction"
                        list-id="dossier-juridiction"
                        :options="juridictionOptions"
                        :input-class="inputClass"
                        placeholder="Ex. Tribunal de commerce de Lubumbashi"
                        @input="onJuridictionManualInput"
                      />
                      <div
                        v-if="juridictionSuggestion && form.juridiction.trim() !== juridictionSuggestion.juridiction.trim()"
                        class="mt-2 flex flex-wrap items-start justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs dark:border-blue-900 dark:bg-blue-950/40"
                      >
                        <div class="min-w-0 flex-1">
                          <p class="font-medium text-blue-900 dark:text-blue-200">
                            Juridiction détectée
                            <span class="font-normal text-blue-700/80 dark:text-blue-300/80">
                              ({{ juridictionSuggestion.confidence === 'high' ? 'fiabilité élevée' : juridictionSuggestion.confidence === 'medium' ? 'fiabilité moyenne' : 'à vérifier' }})
                            </span>
                          </p>
                          <p class="mt-0.5 text-blue-800 dark:text-blue-300">
                            {{ juridictionSuggestion.juridiction }}
                          </p>
                          <p class="mt-0.5 text-blue-600/90 dark:text-blue-400/90">
                            {{ juridictionSuggestion.reason }}
                          </p>
                        </div>
                        <div class="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            class="rounded-lg bg-blue-600 px-2.5 py-1 text-white hover:bg-blue-700"
                            @click="applyJuridictionSuggestion"
                          >
                            Appliquer
                          </button>
                          <button
                            type="button"
                            class="rounded-lg border border-blue-300 px-2.5 py-1 text-blue-800 dark:border-blue-700 dark:text-blue-200"
                            @click="dismissJuridictionSuggestion"
                          >
                            Ignorer
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-sm font-medium">Statut</label>
                      <select v-model="form.statut" :class="inputClass">
                        <option value="Ouvert">Ouvert</option>
                        <option value="En cours">En cours</option>
                        <option value="Suspendu">Suspendu</option>
                        <option value="Clos">Clos</option>
                      </select>
                      <p class="mt-1 text-xs text-slate-500">
                        Par défaut « Ouvert » à la création.
                      </p>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-sm font-medium">
                        Date d’ouverture <span class="text-rose-500">*</span>
                      </label>
                      <input v-model="form.date_ouverture" type="date" :class="inputClass" />
                    </div>
                    <div v-if="form.statut === 'Clos'" class="sm:col-span-2">
                      <label class="mb-1.5 block text-sm font-medium">Date de clôture</label>
                      <input v-model="form.date_fermeture" type="date" :class="inputClass" />
                    </div>
                  </div>
                </section>

                <!-- 4. Honoraires -->
                <section class="space-y-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900 dark:bg-violet-900/10">
                  <header class="flex items-center gap-3">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-200 text-sm font-semibold text-violet-900 dark:bg-violet-800 dark:text-violet-100">4</span>
                    <div>
                      <h3 class="text-sm font-semibold text-violet-900 dark:text-violet-200">Honoraires</h3>
                      <p class="text-xs text-slate-600 dark:text-slate-400">
                        Facultatif à la création — requis avant les paiements et la note d’honoraires.
                      </p>
                    </div>
                  </header>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label class="mb-1.5 block text-sm font-medium">Montant total convenu</label>
                      <input
                        v-model="form.montantHonorairesTotal"
                        type="number"
                        min="0"
                        step="1"
                        :class="inputClass"
                        placeholder="Ex. 9 750 000"
                      />
                    </div>
                    <div>
                      <label class="mb-1.5 block text-sm font-medium">Devise</label>
                      <select v-model="form.deviseHonoraires" :class="inputClass">
                        <option
                          v-for="opt in deviseFormOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div class="shrink-0 border-t border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-700">
              <p
                v-if="formValidationErrors.length > 0"
                class="mb-3 text-xs text-amber-700 dark:text-amber-300"
                role="status"
              >
                À compléter : {{ formValidationErrors.join(' · ') }}
              </p>
              <div class="flex flex-wrap justify-end gap-3">
                <button type="button" class="rounded-xl border px-4 py-2.5 dark:border-slate-700" @click="closeForm">
                  Annuler
                </button>
                <button
                  type="button"
                  class="rounded-xl bg-blue-600 px-4 py-2.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="saving"
                  @click="save"
                >
                  {{ saving ? 'Enregistrement…' : (isEdit ? 'Enregistrer les modifications' : 'Créer le dossier') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
