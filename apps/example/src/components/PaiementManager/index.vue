<script setup lang="ts">
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { usePaiementsRealtime } from '@/composables/usePaiementsRealtime'
import { db } from '@/firebase'
import {
  MODE_PAIEMENT_OPTIONS,
  NATURE_PAIEMENT_AUTRE_SELECT,
  NATURE_PAIEMENT_OPTIONS,
} from '@/constants/paiement'
import type {
  Paiement,
  PaiementDossierRef,
  PaiementFormData,
  PaiementStatut,
  TypePaiement,
} from '@/types/paiement'
import type { Devise } from '@/utils/currency'
import {
  DEVISE_OPTIONS,
  formatMoney,
  formatMoneyPair,
  sumMontantsParDevise,
} from '@/utils/currency'
import { formatDateFr } from '@/utils/date'
import { getDossierPaiementSummary } from '@/utils/dossier-paiement'
import {
  collectNatureFilterOptions,
  getHonorairesPaiements,
  getNaturePaiementLabel,
  isFormNatureAutre,
  isPaiementHonoraires,
  natureFromFormFields,
  natureToFormFields,
  parseNaturePaiement,
} from '@/utils/paiement-nature'
import {
  collectDossiersSuivisIds,
  isDossierStatutActif,
  isDossierSuivi,
} from '@/utils/dossier-suivi'
import { PERMISSIONS } from '@/constants/permissions'
import { BTN_DISABLED } from '@/utils/action-button'
import { writeAuditLog } from '@/utils/audit-log'

defineOptions({
  name: 'PaiementManager',
})

const props = withDefaults(
  defineProps<{
    /** Pré-sélectionner un dossier (ex. depuis la fiche dossier) */
    initialDossierId?: string
  }>(),
  {
    initialDossierId: '',
  },
)

const route = useRoute()
const { auth: hasAuth } = useAppAuth()

/** Rôle finances : gestion des paiements sans édition des dossiers. */
const isFinanceRole = computed(() =>
  hasAuth(PERMISSIONS.paiements) && !hasAuth(PERMISSIONS.dossiers),
)

const canViewDossierFiche = computed(() =>
  hasAuth(PERMISSIONS.dossiers) || hasAuth(PERMISSIONS.dossiersConsultation),
)

const STATUT_META: Record<PaiementStatut, { label: string, badgeClass: string }> = {
  paye: {
    label: 'Soldé',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  partiel: {
    label: 'Partiel',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  en_attente: {
    label: 'En attente',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  },
}

const paiementsCol = collection(db, 'paiements')

const {
  paiements,
  allDossiers,
  affectations,
  avocatNames,
  loading,
  syncError,
  start: startRealtime,
} = usePaiementsRealtime(db)

const saving = ref(false)

const search = ref('')
const filterDossierId = ref('')
const filterNature = ref('')
const filterMode = ref<'' | TypePaiement>('')
const filterStatut = ref<'' | PaiementStatut>('')
const filterDevise = ref<'' | Devise>('')
const currentPage = ref(1)
const pageSize = ref(15)
const sortKey = ref<'date' | 'dossier' | 'versement' | 'reste'>('date')
const sortDir = ref<'asc' | 'desc'>('desc')
const PAGE_SIZE_OPTIONS = [10, 15, 25, 50] as const

const showForm = ref(false)
const showDetail = ref(false)
const isEdit = ref(false)
const selected = ref<Paiement | null>(null)

const toast = ref({
  show: false,
  type: 'success' as 'success' | 'error',
  message: '',
})

const form = ref<PaiementFormData>({
  id: null,
  dossierId: '',
  nature_select: 'Honoraires',
  nature_paiement_autre: '',
  type_paiement: 'Virement',
  devise: 'CDF',
  montant_payer: '',
  description: '',
  date_paiement: '',
})

const formResolvedNature = computed(() =>
  natureFromFormFields(form.value.nature_select, form.value.nature_paiement_autre),
)

const formIsHonoraires = computed(() => formResolvedNature.value === 'Honoraires')

const formIsNatureAutre = computed(() => isFormNatureAutre(form.value.nature_select))

const natureFilterOptions = computed(() => collectNatureFilterOptions(paiements.value))

const dossiersActifs = computed(() =>
  allDossiers.value.filter((item) => isDossierStatutActif(item.statut)),
)

const dossiersPourFormulaire = computed(() => {
  if (isFinanceRole.value) {
    if (formIsHonoraires.value) {
      const suivisActifs = dossiersSuivis.value.filter((item) => isDossierStatutActif(item.statut))
      if (suivisActifs.length > 0) return suivisActifs
      if (dossiersActifs.value.length > 0) return dossiersActifs.value
      return dossiersSuivis.value
    }
    return dossiersActifs.value.length > 0 ? dossiersActifs.value : allDossiers.value
  }
  return formIsHonoraires.value ? dossiersSuivis.value : allDossiers.value
})

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { show: true, type, message }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

function getDossierRef(dossierId: string) {
  return allDossiers.value.find(item => item.id === dossierId)
}

function isDossierEligiblePaiement(dossier: PaiementDossierRef): boolean {
  return isDossierSuivi(dossier.id, affectations.value, avocatNames.value, dossier.avocatId)
}

const dossiersSuivisIds = computed(() =>
  collectDossiersSuivisIds(allDossiers.value, affectations.value, avocatNames.value),
)

/** Dossiers avec avocat assigné — seuls éligibles à un nouveau paiement d’honoraires. */
const dossiersSuivis = computed(() =>
  allDossiers.value.filter((item) => dossiersSuivisIds.value.has(item.id)),
)

/** Filtre liste : dossiers éligibles + historique des paiements. */
const dossiersPourFiltre = computed(() => {
  const ids = new Set<string>()
  if (isFinanceRole.value) {
    for (const dossier of dossiersActifs.value) ids.add(dossier.id)
  } else {
    for (const id of dossiersSuivisIds.value) ids.add(id)
  }
  for (const paiement of paiements.value) {
    if (paiement.dossierId) ids.add(paiement.dossierId)
  }
  return allDossiers.value.filter((item) => ids.has(item.id))
})

function getPaiementsForDossier(dossierId: string) {
  return paiements.value.filter(item => item.dossierId === dossierId)
}

function getSummaryForDossier(dossierId: string) {
  return getDossierPaiementSummary(getDossierRef(dossierId), getPaiementsForDossier(dossierId))
}

function getDossierLabel(dossierId: string): string {
  const dossier = allDossiers.value.find((item) => item.id === dossierId)
  if (!dossier) return 'Dossier inconnu'
  const client = dossier.clientNom ? ` — ${dossier.clientNom}` : ''
  return `${dossier.motif}${client}`
}

function resolveDossierIdFromRoute() {
  return props.initialDossierId
    || (typeof route.query.dossierId === 'string' ? route.query.dossierId : '')
}

function syncRouteQueryToUi() {
  const dossierId = resolveDossierIdFromRoute()
  if (dossierId) filterDossierId.value = dossierId
  if (dossierId && route.query.open === 'add' && !showForm.value) {
    openAdd(dossierId)
  }
}

onMounted(() => {
  startRealtime()
  syncRouteQueryToUi()
})

watch(syncError, (message) => {
  if (message) showToast('error', message)
})

watch(paiements, () => {
  if (!selected.value) return
  const updated = paiements.value.find((item) => item.id === selected.value?.id)
  if (updated) selected.value = updated
  else closeDetail()
})

watch(
  () => [route.query.dossierId, route.query.open] as const,
  () => {
    syncRouteQueryToUi()
  },
)

watch([search, filterDossierId, filterNature, filterMode, filterStatut, filterDevise, pageSize], () => {
  currentPage.value = 1
})

const hasActiveFilters = computed(() =>
  Boolean(
    search.value.trim()
    || filterDossierId.value
    || filterNature.value
    || filterMode.value
    || filterStatut.value
    || filterDevise.value,
  ),
)

function clearFilters() {
  search.value = ''
  filterDossierId.value = ''
  filterNature.value = ''
  filterMode.value = ''
  filterStatut.value = ''
  filterDevise.value = ''
  currentPage.value = 1
}

function toggleSort(key: typeof sortKey.value) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'date' ? 'desc' : 'asc'
  }
  currentPage.value = 1
}

function sortIndicator(key: typeof sortKey.value) {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ↑' : ' ↓'
}

function resetForm(dossierId = '', natureStockee = 'Honoraires') {
  const id = dossierId || filterDossierId.value || ''
  const dossier = id ? getDossierRef(id) : undefined
  const natureFields = natureToFormFields(natureStockee)
  form.value = {
    id: null,
    dossierId: id,
    ...natureFields,
    type_paiement: 'Virement',
    devise: dossier?.deviseHonoraires ?? 'CDF',
    montant_payer: '',
    description: '',
    date_paiement: new Date().toISOString().slice(0, 10),
  }
}

function openAdd(dossierId?: string, natureStockee = 'Honoraires') {
  if (dossierId && parseNaturePaiement(natureStockee) === 'Honoraires') {
    const dossier = getDossierRef(dossierId)
    if (dossier && !isDossierEligiblePaiement(dossier)) {
      showToast('error', 'Les honoraires concernent uniquement les dossiers suivis par un avocat.')
      return
    }
  }
  isEdit.value = false
  selected.value = null
  resetForm(dossierId, natureStockee)
  showForm.value = true
}

function openEdit(paiement: Paiement) {
  isEdit.value = true
  selected.value = paiement
  const dossier = getDossierRef(paiement.dossierId)
  form.value = {
    id: paiement.id,
    dossierId: paiement.dossierId,
    ...natureToFormFields(paiement.nature_paiement),
    type_paiement: paiement.type_paiement,
    devise: dossier?.deviseHonoraires ?? paiement.devise,
    montant_payer: String(paiement.montant_payer),
    description: paiement.description,
    date_paiement: paiement.date_paiement,
  }
  showForm.value = true
}

function openDetail(paiement: Paiement) {
  selected.value = paiement
  showDetail.value = true
}

function closeForm() {
  showForm.value = false
}

function closeDetail() {
  showDetail.value = false
}

function editFromDetail() {
  if (!selected.value) return
  const paiement = selected.value
  closeDetail()
  openEdit(paiement)
}

function openAddForSelectedDossier() {
  if (!selected.value?.dossierId) return
  const nature = selected.value.nature_paiement
  closeDetail()
  openAdd(selected.value.dossierId, nature)
}

async function save() {
  if (saving.value) return
  saving.value = true

  try {
    const montantVersement = Number(form.value.montant_payer)
    const dossierId = form.value.dossierId
    const dossier = getDossierRef(dossierId)
    const isHonoraires = formIsHonoraires.value
    const summary = isHonoraires ? getSummaryForDossier(dossierId) : null
    const honorairesDossier = getHonorairesPaiements(getPaiementsForDossier(dossierId))
    const autresHonoraires = isEdit.value && form.value.id
      ? honorairesDossier.filter((p) => p.id !== form.value.id)
      : honorairesDossier
    const dejaVerseHonoraires = autresHonoraires.reduce((s, p) => s + (Number(p.montant_payer) || 0), 0)

    if (!dossierId) {
      showToast('error', 'Veuillez sélectionner un dossier')
      return
    }
    if (isHonoraires && !isEdit.value && dossier && !isDossierEligiblePaiement(dossier)) {
      showToast('error', 'Ce dossier n’est pas suivi par un avocat — assignez un avocat avant d’encaisser les honoraires.')
      return
    }
    if (!form.value.date_paiement) {
      showToast('error', 'La date de paiement est obligatoire')
      return
    }
    if (isHonoraires && (!summary || !summary.montantDu || summary.montantDu <= 0)) {
      showToast('error', 'Définissez d’abord le montant total des honoraires sur la fiche dossier')
      return
    }
    const natureStockee = natureFromFormFields(
      form.value.nature_select,
      form.value.nature_paiement_autre,
    )
    if (!natureStockee) {
      showToast('error', 'Précisez la nature du paiement')
      return
    }
    if (Number.isNaN(montantVersement) || montantVersement <= 0) {
      showToast('error', 'Le montant doit être supérieur à 0')
      return
    }
    if (isHonoraires && summary && dejaVerseHonoraires + montantVersement > summary.montantDu) {
      showToast('error', `Ce versement dépasse le reste dû (${formatMoney(summary.montantDu - dejaVerseHonoraires, summary.devise)})`)
      return
    }

    const payload = {
      dossierId,
      nature_paiement: natureStockee,
      type_paiement: form.value.type_paiement,
      devise: isHonoraires
        ? (dossier?.deviseHonoraires ?? form.value.devise)
        : form.value.devise,
      montant_a_payer: isHonoraires ? (summary?.montantDu ?? 0) : montantVersement,
      montant_payer: montantVersement,
      description: form.value.description.trim(),
      date_paiement: form.value.date_paiement,
    }

    const natureLabel = getNaturePaiementLabel(natureStockee)

    if (isEdit.value && form.value.id) {
      await updateDoc(doc(db, 'paiements', form.value.id), payload)
      await writeAuditLog({
        action: 'modification',
        entity: 'paiement',
        entityId: form.value.id,
        details: `${natureLabel} ${formatMoney(montantVersement, payload.devise)}`,
      })
      showToast('success', 'Paiement modifié')
    } else {
      const ref = await addDoc(paiementsCol, payload)
      await writeAuditLog({
        action: 'creation',
        entity: 'paiement',
        entityId: ref.id,
        details: `${natureLabel} ${formatMoney(montantVersement, payload.devise)}`,
      })
      showToast('success', 'Paiement enregistré')
    }

    closeForm()
  } catch {
    showToast('error', 'Erreur lors de l’enregistrement')
  } finally {
    saving.value = false
  }
}

async function remove(id: string) {
  const paiement = paiements.value.find((item) => item.id === id)
  if (!paiement) return

  if (!window.confirm(
    `Supprimer ce paiement du ${formatDateFr(paiement.date_paiement)} (${formatMoney(paiement.montant_payer, paiement.devise)}) ?`,
  )) {
    return
  }

  try {
    await deleteDoc(doc(db, 'paiements', id))
    await writeAuditLog({ action: 'suppression', entity: 'paiement', entityId: id })
    showToast('success', 'Paiement supprimé')
    if (selected.value?.id === id) closeDetail()
  } catch {
    showToast('error', 'Erreur lors de la suppression')
  }
}

const paiementsParDossier = computed(() => {
  const map = new Map<string, Paiement[]>()
  for (const paiement of paiements.value) {
    if (!paiement.dossierId) continue
    const list = map.get(paiement.dossierId) ?? []
    list.push(paiement)
    map.set(paiement.dossierId, list)
  }
  return map
})

const filteredPaiements = computed(() => {
  const q = search.value.toLowerCase().trim()

  return paiements.value.filter((paiement) => {
    const dossierLabel = getDossierLabel(paiement.dossierId).toLowerCase()
    const statut = getSummaryForDossier(paiement.dossierId).statut

    const matchSearch = !q || [
      dossierLabel,
      getNaturePaiementLabel(paiement.nature_paiement),
      paiement.type_paiement,
      paiement.description,
      paiement.date_paiement,
      String(paiement.montant_a_payer),
      String(paiement.montant_payer),
    ].some((value) => value.toLowerCase().includes(q))

    const matchDossier = !filterDossierId.value || paiement.dossierId === filterDossierId.value
    const matchNature = !filterNature.value
      || parseNaturePaiement(paiement.nature_paiement) === filterNature.value
    const matchMode = !filterMode.value || paiement.type_paiement === filterMode.value
    const matchStatut = !filterStatut.value
      || (isPaiementHonoraires(paiement) && statut === filterStatut.value)
    const matchDevise = !filterDevise.value || paiement.devise === filterDevise.value

    return matchSearch && matchDossier && matchNature && matchMode && matchStatut && matchDevise
  })
})

const sortedFilteredPaiements = computed(() => {
  const list = [...filteredPaiements.value]
  const dir = sortDir.value === 'asc' ? 1 : -1

  list.sort((a, b) => {
    if (sortKey.value === 'date') {
      return dir * String(a.date_paiement).localeCompare(String(b.date_paiement))
    }
    if (sortKey.value === 'dossier') {
      return dir * getDossierLabel(a.dossierId).localeCompare(getDossierLabel(b.dossierId), 'fr')
    }
    if (sortKey.value === 'versement') {
      return dir * ((Number(a.montant_payer) || 0) - (Number(b.montant_payer) || 0))
    }
    const resteA = getSummaryForDossier(a.dossierId).reste
    const resteB = getSummaryForDossier(b.dossierId).reste
    return dir * (resteA - resteB)
  })

  return list
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedFilteredPaiements.value.length / pageSize.value)),
)

const paginationRange = computed(() => {
  const total = sortedFilteredPaiements.value.length
  if (total === 0) return { from: 0, to: 0, total: 0 }
  const from = (currentPage.value - 1) * pageSize.value + 1
  const to = Math.min(currentPage.value * pageSize.value, total)
  return { from, to, total }
})

const paginatedPaiements = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return sortedFilteredPaiements.value.slice(start, start + pageSize.value)
})

type PaiementRowView = {
  paiement: Paiement
  dossierLabel: string
  dossierCount: number
  nature: string
  honoraires: boolean
  summary: ReturnType<typeof getDossierPaiementSummary>
}

const paginatedRows = computed((): PaiementRowView[] =>
  paginatedPaiements.value.map((paiement) => ({
    paiement,
    dossierLabel: getDossierLabel(paiement.dossierId),
    dossierCount: (paiementsParDossier.value.get(paiement.dossierId) ?? []).length,
    nature: getNaturePaiementLabel(paiement.nature_paiement),
    honoraires: isPaiementHonoraires(paiement),
    summary: getSummaryForDossier(paiement.dossierId),
  })),
)

const totals = computed(() => {
  const list = filteredPaiements.value.length ? filteredPaiements.value : paiements.value
  const honoraires = getHonorairesPaiements(list)
  const dossierIds = [...new Set(honoraires.map((item) => item.dossierId).filter(Boolean))]
  const aPayer = { USD: 0, CDF: 0 }
  const paye = sumMontantsParDevise(honoraires, (item) => item.montant_payer)
  for (const dossierId of dossierIds) {
    const s = getSummaryForDossier(dossierId)
    aPayer[s.devise] += s.montantDu
  }
  const reste = {
    USD: Math.max(0, aPayer.USD - paye.USD),
    CDF: Math.max(0, aPayer.CDF - paye.CDF),
  }
  const autres = list.filter((p) => !isPaiementHonoraires(p))
  return {
    count: list.length,
    aPayer,
    paye,
    reste,
    autresCount: autres.length,
    dossiersConcernes: dossierIds.length,
  }
})

const formDossierSummary = computed(() => {
  if (!formIsHonoraires.value || !form.value.dossierId) return null
  const honoraires = getHonorairesPaiements(getPaiementsForDossier(form.value.dossierId))
  const autres = isEdit.value && form.value.id
    ? honoraires.filter((p) => p.id !== form.value.id)
    : honoraires
  const dejaVerse = autres.reduce((s, p) => s + (Number(p.montant_payer) || 0), 0)
  const summary = getSummaryForDossier(form.value.dossierId)
  const versement = Number(form.value.montant_payer) || 0
  const resteApres = Math.max(0, summary.montantDu - dejaVerse - versement)
  return { ...summary, dejaVerse, resteApres }
})

watch(() => form.value.dossierId, (dossierId) => {
  if (!dossierId || isEdit.value) return
  const dossier = getDossierRef(dossierId)
  if (formIsHonoraires.value && dossier?.deviseHonoraires) {
    form.value.devise = dossier.deviseHonoraires
  }
})

watch(formResolvedNature, (nature) => {
  if (nature !== 'Honoraires' || !form.value.dossierId) return
  const dossier = getDossierRef(form.value.dossierId)
  if (dossier && !isDossierEligiblePaiement(dossier)) {
    form.value.dossierId = ''
  }
})

const selectedDossierPaiements = computed(() => {
  if (!selected.value?.dossierId) return []
  return paiements.value
    .filter((item) => item.dossierId === selected.value?.dossierId)
    .sort((a, b) => String(b.date_paiement).localeCompare(String(a.date_paiement)))
})

const selectedDossierTotaux = computed(() => {
  if (!selected.value?.dossierId) {
    return { count: 0, summary: getDossierPaiementSummary(undefined, []) }
  }
  const list = selectedDossierPaiements.value
  const summary = getSummaryForDossier(selected.value.dossierId)
  return { count: list.length, summary }
})

const addPaymentBlockedReason = computed(() => {
  if (loading.value) return 'Chargement en cours…'
  if (allDossiers.value.length === 0) return 'Créez d’abord un dossier'
  return ''
})

const formSaveBlockedReason = computed(() => {
  if (saving.value) return ''
  if (!form.value.dossierId) return 'Sélectionnez un dossier'
  if (!form.value.date_paiement) return 'Indiquez la date de paiement'
  if (formIsNatureAutre.value && !form.value.nature_paiement_autre.trim()) {
    return 'Précisez la nature du paiement'
  }
  if (!formResolvedNature.value) return 'Indiquez la nature du paiement'
  if (formIsHonoraires.value) {
    const dossier = getDossierRef(form.value.dossierId)
    if (dossier && !isDossierEligiblePaiement(dossier)) {
      return 'Dossier non suivi — assignez un avocat pour les honoraires'
    }
    const summary = formDossierSummary.value
    if (!summary || summary.montantDu <= 0) {
      return 'Définissez le montant total des honoraires sur la fiche dossier'
    }
    const versement = Number(form.value.montant_payer)
    if (Number.isNaN(versement) || versement <= 0) {
      return 'Saisissez un montant supérieur à 0'
    }
    const resteDu = summary.montantDu - summary.dejaVerse
    if (versement > resteDu) {
      return `Ce versement dépasse le reste dû (${formatMoney(resteDu, summary.devise)})`
    }
    return ''
  }
  const versement = Number(form.value.montant_payer)
  if (Number.isNaN(versement) || versement <= 0) {
    return 'Saisissez un montant supérieur à 0'
  }
  return ''
})

const canAddPayment = computed(() => !addPaymentBlockedReason.value)
const canFormSave = computed(() => !saving.value && !formSaveBlockedReason.value)

const detailAddPaymentBlockedReason = computed(() => {
  if (!selected.value?.dossierId) return ''
  if (!isPaiementHonoraires(selected.value)) return ''
  const summary = getSummaryForDossier(selected.value.dossierId)
  if (summary.montantDu <= 0) return 'Définissez le montant total des honoraires sur la fiche dossier'
  return ''
})

function natureLabel(paiement: Paiement) {
  return getNaturePaiementLabel(paiement.nature_paiement)
}

const canDetailAddPayment = computed(() => !detailAddPaymentBlockedReason.value)
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

    <div class="mx-auto max-w-[1600px] p-4 sm:p-6">
      <header class="mb-6 flex flex-col gap-4 rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200 sm:px-6 sm:py-5 dark:bg-slate-900 dark:ring-slate-700 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Gestion des paiements</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Honoraires, frais de consultation et frais de visite. Les honoraires sont plafonnés au montant du dossier ; les mises à jour sont instantanées.
          </p>
        </div>
        <AppButtonGuard :blocked="!canAddPayment" :reason="addPaymentBlockedReason">
          <button
            type="button"
            class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
            :class="BTN_DISABLED"
            :disabled="!canAddPayment"
            @click="openAdd()"
          >
            + Nouveau paiement
          </button>
        </AppButtonGuard>
      </header>

      <section v-if="allDossiers.length === 0 && !loading" class="mb-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
        Aucun dossier enregistré dans le cabinet. Créez d’abord un dossier avant d’enregistrer un paiement.
      </section>
      <section
        v-else-if="!isFinanceRole && dossiersSuivis.length === 0 && !loading"
        class="mb-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
      >
        Aucun dossier n’a de responsable assigné pour l’instant. Les dossiers existants restent consultables dans
        <RouterLink :to="{ name: 'dossiers' }" class="font-medium underline">Gestion des dossiers</RouterLink>.
        Les paiements d’honoraires nécessitent une affectation (menu Avocats).
      </section>
      <section
        v-else-if="isFinanceRole && dossiersActifs.length === 0 && !loading"
        class="mb-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
      >
        Aucun dossier ouvert ou en cours pour le moment.
      </section>

      <section class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <p class="text-sm text-slate-500">Paiements</p>
          <p class="mt-2 text-2xl font-semibold">{{ totals.count }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ totals.dossiersConcernes }} dossier(s) concerné(s)</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <p class="text-sm text-slate-500">Total dû (dossiers)</p>
          <p class="mt-2 text-base font-semibold leading-snug">{{ formatMoneyPair(totals.aPayer.USD, totals.aPayer.CDF) }}</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <p class="text-sm text-slate-500">Montant encaissé</p>
          <p class="mt-2 text-base font-semibold leading-snug text-emerald-600">{{ formatMoneyPair(totals.paye.USD, totals.paye.CDF) }}</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <p class="text-sm text-slate-500">Reste à encaisser</p>
          <p class="mt-2 text-base font-semibold leading-snug text-amber-600">{{ formatMoneyPair(totals.reste.USD, totals.reste.CDF) }}</p>
        </div>
      </section>

      <section class="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Filtres</p>
          <button
            v-if="hasActiveFilters"
            type="button"
            class="rounded-lg px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30"
            @click="clearFilters"
          >
            Réinitialiser
          </button>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div class="relative sm:col-span-2 xl:col-span-3">
            <span class="pointer-events-none absolute left-3 top-1/2 text-slate-400 -translate-y-1/2 i-carbon:search" />
            <input
              v-model="search"
              class="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800"
              placeholder="Rechercher dossier, nature, description, montant…"
            />
          </div>
          <select v-model="filterDevise" class="w-full rounded-xl border px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="">Toutes les devises</option>
            <option v-for="opt in DEVISE_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <select v-model="filterDossierId" class="w-full rounded-xl border px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 xl:col-span-2">
            <option value="">Tous les dossiers</option>
            <option v-for="dossier in dossiersPourFiltre" :key="dossier.id" :value="dossier.id">
              {{ dossier.motif }} — {{ dossier.clientNom || 'Sans client' }}
            </option>
          </select>
          <select v-model="filterNature" class="w-full rounded-xl border px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="">Toutes les natures</option>
            <option v-for="nature in natureFilterOptions" :key="nature" :value="nature">
              {{ getNaturePaiementLabel(nature) }}
            </option>
          </select>
          <select v-model="filterMode" class="w-full rounded-xl border px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="">Tous les modes</option>
            <option v-for="mode in MODE_PAIEMENT_OPTIONS" :key="mode" :value="mode">{{ mode }}</option>
          </select>
          <select v-model="filterStatut" class="w-full rounded-xl border px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="">Tous les états</option>
            <option value="paye">Soldé</option>
            <option value="partiel">Partiel</option>
            <option value="en_attente">En attente</option>
          </select>
          <p class="flex flex-wrap items-center gap-2 text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
            <span class="font-medium text-slate-700 dark:text-slate-300">{{ sortedFilteredPaiements.length }}</span>
            paiement(s) · tri {{ sortKey === 'date' ? 'date' : sortKey === 'dossier' ? 'dossier' : sortKey === 'versement' ? 'versement' : 'reste' }}
            {{ sortDir === 'desc' ? '↓' : '↑' }}
          </p>
        </div>
      </section>

      <section v-if="loading" class="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        Chargement…
      </section>

      <section v-else-if="paginatedPaiements.length === 0" class="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <p class="text-slate-500">{{ hasActiveFilters ? 'Aucun paiement ne correspond aux filtres.' : 'Aucun paiement enregistré.' }}</p>
        <button
          v-if="hasActiveFilters"
          type="button"
          class="mt-3 text-sm text-blue-600 hover:underline dark:text-blue-400"
          @click="clearFilters"
        >
          Effacer les filtres
        </button>
        <AppButtonGuard class="mt-4" :blocked="!canAddPayment" :reason="addPaymentBlockedReason">
          <button
            type="button"
            class="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white"
            :class="BTN_DISABLED"
            :disabled="!canAddPayment"
            @click="openAdd()"
          >
            Ajouter un paiement
          </button>
        </AppButtonGuard>
      </section>

      <section v-else class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div class="space-y-3 p-4 md:hidden">
          <article
            v-for="row in paginatedRows"
            :key="`card-${row.paiement.id}`"
            class="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors active:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:active:bg-slate-700"
            @click="openDetail(row.paiement)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-xs text-slate-500">
                  {{ formatDateFr(row.paiement.date_paiement) }} · {{ row.nature }} · {{ row.paiement.type_paiement }}
                </p>
                <p class="mt-1 font-medium leading-snug">
                  {{ row.dossierLabel }}
                </p>
                <p v-if="row.paiement.description" class="mt-1 line-clamp-1 text-xs text-slate-500">
                  {{ row.paiement.description }}
                </p>
              </div>
              <span
                v-if="row.honoraires"
                class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="STATUT_META[row.summary.statut].badgeClass"
              >
                {{ STATUT_META[row.summary.statut].label }}
              </span>
            </div>
            <dl class="mt-3 grid grid-cols-2 gap-2 text-sm tabular-nums">
              <div>
                <dt class="text-xs text-slate-500">Versement</dt>
                <dd class="font-semibold text-emerald-600">
                  {{ formatMoney(row.paiement.montant_payer, row.paiement.devise) }}
                </dd>
              </div>
              <div v-if="row.honoraires">
                <dt class="text-xs text-slate-500">Reste dossier</dt>
                <dd class="font-semibold text-amber-600">
                  {{ formatMoney(row.summary.reste, row.summary.devise) }}
                </dd>
              </div>
            </dl>
            <div class="mt-3 flex flex-wrap gap-2" @click.stop>
              <button type="button" class="rounded-lg bg-blue-100 px-2.5 py-1.5 text-xs text-blue-700 dark:bg-blue-900/40" @click="openEdit(row.paiement)">
                Modifier
              </button>
              <button type="button" class="rounded-lg bg-rose-100 px-2.5 py-1.5 text-xs text-rose-700 dark:bg-rose-900/40" @click="remove(row.paiement.id)">
                Supprimer
              </button>
            </div>
          </article>
        </div>

        <div class="hidden max-h-[min(70vh,720px)] overflow-auto md:block">
          <table class="w-full min-w-[960px] text-left text-sm">
            <thead class="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
              <tr>
                <th class="px-4 py-3 font-medium">
                  <button type="button" class="hover:text-blue-600" @click="toggleSort('date')">
                    Date{{ sortIndicator('date') }}
                  </button>
                </th>
                <th class="min-w-[200px] px-4 py-3 font-medium">
                  <button type="button" class="hover:text-blue-600" @click="toggleSort('dossier')">
                    Dossier{{ sortIndicator('dossier') }}
                  </button>
                </th>
                <th class="px-4 py-3 font-medium">Nature · Mode</th>
                <th class="px-4 py-3 text-right font-medium">
                  <button type="button" class="hover:text-blue-600" @click="toggleSort('versement')">
                    Versement{{ sortIndicator('versement') }}
                  </button>
                </th>
                <th class="px-4 py-3 text-right font-medium">Total dû</th>
                <th class="px-4 py-3 text-right font-medium">
                  <button type="button" class="hover:text-blue-600" @click="toggleSort('reste')">
                    Reste{{ sortIndicator('reste') }}
                  </button>
                </th>
                <th class="px-4 py-3 font-medium">État</th>
                <th class="sticky right-0 z-10 bg-slate-50/95 px-3 py-3 text-right font-medium backdrop-blur dark:bg-slate-800/95">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in paginatedRows"
                :key="row.paiement.id"
                class="group cursor-pointer border-b border-slate-100 transition-colors hover:bg-blue-50/60 dark:border-slate-800 dark:hover:bg-blue-950/20"
                :class="index % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''"
                @click="openDetail(row.paiement)"
              >
                <td class="px-4 py-3 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-400">
                  {{ formatDateFr(row.paiement.date_paiement) }}
                </td>
                <td class="max-w-[280px] px-4 py-3">
                  <div class="truncate font-medium" :title="row.dossierLabel">
                    {{ row.dossierLabel }}
                  </div>
                  <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span>{{ row.dossierCount }} paiement(s)</span>
                    <span v-if="row.paiement.description" class="truncate max-w-[12rem]" :title="row.paiement.description">
                      · {{ row.paiement.description }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-block rounded-md px-2 py-0.5 text-xs font-medium"
                    :class="row.honoraires ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'"
                  >
                    {{ row.nature }}
                  </span>
                  <span class="mt-1 block text-xs text-slate-500">{{ row.paiement.type_paiement }} · {{ row.paiement.devise }}</span>
                </td>
                <td class="px-4 py-3 text-right font-semibold whitespace-nowrap text-emerald-600 tabular-nums">
                  {{ formatMoney(row.paiement.montant_payer, row.paiement.devise) }}
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-400">
                  <template v-if="row.honoraires">
                    {{ formatMoney(row.summary.montantDu, row.summary.devise) }}
                  </template>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                  <template v-if="row.honoraires">
                    <span :class="row.summary.reste > 0 ? 'font-medium text-amber-600' : 'text-emerald-600'">
                      {{ formatMoney(row.summary.reste, row.summary.devise) }}
                    </span>
                  </template>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td class="px-4 py-3">
                  <span
                    v-if="row.honoraires"
                    class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    :class="STATUT_META[row.summary.statut].badgeClass"
                  >
                    {{ STATUT_META[row.summary.statut].label }}
                  </span>
                  <span v-else class="text-xs text-slate-400">Frais</span>
                </td>
                <td
                  class="sticky right-0 px-2 py-2 text-right transition-colors group-hover:bg-blue-50/60 dark:group-hover:bg-blue-950/20"
                  :class="index % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-900'"
                  @click.stop
                >
                  <div class="inline-flex gap-0.5">
                    <button
                      type="button"
                      class="rounded-lg p-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                      title="Voir le détail"
                      @click="openDetail(row.paiement)"
                    >
                      <span class="i-carbon:view text-base" />
                    </button>
                    <button
                      type="button"
                      class="rounded-lg p-2 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40"
                      title="Modifier"
                      @click="openEdit(row.paiement)"
                    >
                      <span class="i-carbon:edit text-base" />
                    </button>
                    <button
                      type="button"
                      class="rounded-lg p-2 text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40"
                      title="Supprimer"
                      @click="remove(row.paiement.id)"
                    >
                      <span class="i-carbon:trash-can text-base" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          class="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700"
        >
          <div class="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span v-if="paginationRange.total > 0">
              {{ paginationRange.from }}–{{ paginationRange.to }} sur {{ paginationRange.total }}
            </span>
            <label class="inline-flex items-center gap-2">
              <span class="text-xs">Par page</span>
              <select
                v-model.number="pageSize"
                class="rounded-lg border px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">
                  {{ size }}
                </option>
              </select>
            </label>
          </div>
          <div v-if="totalPages > 1" class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700"
              :disabled="currentPage === 1"
              @click="currentPage = 1"
            >
              Début
            </button>
            <button
              type="button"
              class="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700"
              :disabled="currentPage === 1"
              @click="currentPage -= 1"
            >
              Précédent
            </button>
            <span class="px-2 text-sm tabular-nums">{{ currentPage }} / {{ totalPages }}</span>
            <button
              type="button"
              class="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700"
              :disabled="currentPage === totalPages"
              @click="currentPage += 1"
            >
              Suivant
            </button>
            <button
              type="button"
              class="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700"
              :disabled="currentPage === totalPages"
              @click="currentPage = totalPages"
            >
              Fin
            </button>
          </div>
        </div>
      </section>
    </div>

    <Teleport to="body">
      <div
        v-if="showForm"
        class="app-modal-overlay"
        @click="closeForm"
      >
        <div class="app-modal-overlay__wrap app-modal-overlay__wrap--center">
          <div class="app-modal-overlay__dialog max-w-2xl" @click.stop>
            <div class="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-700">
              <h2 class="text-xl font-semibold">{{ isEdit ? 'Modifier le paiement' : 'Nouveau paiement' }}</h2>
              <p class="mt-1 text-sm text-slate-500">
                Choisissez la nature du paiement. Les honoraires sont limités au montant défini sur la fiche dossier.
              </p>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div class="space-y-4 px-4 py-5 sm:px-6">
                <div>
                  <label class="mb-2 block text-sm font-medium">Nature du paiement <span class="text-rose-500">*</span></label>
                  <select
                    v-model="form.nature_select"
                    class="w-full rounded-xl border px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800"
                    :disabled="isEdit"
                  >
                    <option v-for="nature in NATURE_PAIEMENT_OPTIONS" :key="nature" :value="nature">
                      {{ nature }}
                    </option>
                    <option :value="NATURE_PAIEMENT_AUTRE_SELECT">
                      Autre (à préciser)
                    </option>
                  </select>
                  <div v-if="formIsNatureAutre" class="mt-3">
                    <label class="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400">
                      Précisez la nature <span class="text-rose-500">*</span>
                    </label>
                    <input
                      v-model="form.nature_paiement_autre"
                      type="text"
                      maxlength="120"
                      class="w-full rounded-xl border px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800"
                      placeholder="Ex. Frais de dossier, débours, vacation…"
                      :disabled="isEdit"
                    />
                  </div>
                </div>

                <div>
                  <label class="mb-2 block text-sm font-medium">
                    Dossier lié <span class="text-rose-500">*</span>
                  </label>
                  <select
                    v-model="form.dossierId"
                    class="w-full rounded-xl border px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800"
                    :disabled="isEdit"
                  >
                    <option value="">Choisir un dossier</option>
                    <option v-for="dossier in dossiersPourFormulaire" :key="dossier.id" :value="dossier.id">
                      {{ dossier.motif }} — {{ dossier.clientNom || 'Sans client' }}
                    </option>
                  </select>
                  <p
                    v-if="formIsHonoraires && dossiersSuivis.length === 0 && !isFinanceRole"
                    class="mt-2 text-xs text-amber-700 dark:text-amber-300"
                  >
                    Aucun dossier avec responsable assigné. Le dossier existe peut-être déjà sans affectation — consultez la liste des dossiers.
                  </p>
                  <p
                    v-else-if="formIsHonoraires && isFinanceRole && dossiersSuivis.length === 0"
                    class="mt-2 text-xs text-amber-700 dark:text-amber-300"
                  >
                    Honoraires : un responsable doit être affecté au dossier. Les autres natures de paiement restent disponibles sur les dossiers actifs.
                  </p>
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="mb-2 block text-sm font-medium">Mode de règlement <span class="text-rose-500">*</span></label>
                    <select v-model="form.type_paiement" class="w-full rounded-xl border px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                      <option v-for="mode in MODE_PAIEMENT_OPTIONS" :key="mode" :value="mode">{{ mode }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="mb-2 block text-sm font-medium">Date de paiement <span class="text-rose-500">*</span></label>
                    <input v-model="form.date_paiement" type="date" class="w-full rounded-xl border px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800" />
                  </div>
                  <div v-if="!formIsHonoraires">
                    <label class="mb-2 block text-sm font-medium">Devise <span class="text-rose-500">*</span></label>
                    <select v-model="form.devise" class="w-full rounded-xl border px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                      <option v-for="opt in DEVISE_OPTIONS" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                  <div :class="formIsHonoraires ? 'sm:col-span-2' : ''">
                    <label class="mb-2 block text-sm font-medium">Montant <span class="text-rose-500">*</span></label>
                    <input v-model="form.montant_payer" type="number" min="0" step="1" class="w-full rounded-xl border px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800" />
                  </div>
                </div>

                <div
                  v-if="formDossierSummary"
                  class="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800"
                >
                  <p v-if="formDossierSummary.montantDu <= 0" class="text-amber-700 dark:text-amber-300">
                    Aucun montant total défini sur ce dossier. Renseignez-le dans <strong>Gestion → Dossiers</strong> avant d’enregistrer un versement.
                  </p>
                  <template v-else>
                    <p>
                      <span class="text-slate-500">Total à payer (dossier) :</span>
                      <span class="font-semibold">{{ formatMoney(formDossierSummary.montantDu, formDossierSummary.devise) }}</span>
                    </p>
                    <p class="mt-1">
                      <span class="text-slate-500">Déjà encaissé :</span>
                      {{ formatMoney(formDossierSummary.dejaVerse, formDossierSummary.devise) }}
                      · <span class="text-slate-500">Reste après ce versement :</span>
                      <span class="font-semibold text-amber-600">{{ formatMoney(formDossierSummary.resteApres, formDossierSummary.devise) }}</span>
                    </p>
                  </template>
                </div>

                <div>
                  <label class="mb-2 block text-sm font-medium">Description</label>
                  <textarea
                    v-model="form.description"
                    rows="3"
                    class="w-full rounded-xl border px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800"
                    placeholder="Référence facture, échéance, note…"
                  />
                </div>
              </div>
            </div>

            <div class="shrink-0 border-t border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-700">
              <div class="flex flex-col items-stretch gap-2 sm:items-end">
                <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  <button type="button" class="rounded-xl border px-4 py-2.5 dark:border-slate-700" @click="closeForm">
                    Annuler
                  </button>
                  <AppButtonGuard
                    :blocked="!canFormSave"
                    :reason="formSaveBlockedReason || (saving ? 'Enregistrement en cours…' : '')"
                    show-hint
                    :inline="false"
                  >
                    <button
                      type="button"
                      class="rounded-xl bg-blue-600 px-4 py-2.5 text-white"
                      :class="BTN_DISABLED"
                      :disabled="!canFormSave"
                      @click="save"
                    >
                      {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
                    </button>
                  </AppButtonGuard>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showDetail && selected"
        class="app-modal-overlay"
        @click="closeDetail"
      >
        <div class="app-modal-overlay__wrap app-modal-overlay__wrap--center">
          <div class="app-modal-overlay__dialog max-w-3xl" @click.stop>
            <div class="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-700">
              <h2 class="text-xl font-semibold">Détail du paiement</h2>
              <p class="mt-1 text-sm text-slate-500">{{ getDossierLabel(selected.dossierId) }}</p>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
              <div class="mb-6 grid gap-3 sm:grid-cols-2">
                <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <div class="text-xs uppercase text-slate-500">Nature</div>
                  <div class="mt-1 font-medium">{{ natureLabel(selected) }}</div>
                </div>
                <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <div class="text-xs uppercase text-slate-500">Mode</div>
                  <div class="mt-1 font-medium">{{ selected.type_paiement }}</div>
                </div>
                <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <div class="text-xs uppercase text-slate-500">Date</div>
                  <div class="mt-1 font-medium">{{ formatDateFr(selected.date_paiement) }}</div>
                </div>
                <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <div class="text-xs uppercase text-slate-500">Devise</div>
                  <div class="mt-1 font-medium">{{ selected.devise }}</div>
                </div>
                <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <div class="text-xs uppercase text-slate-500">Versement (cette ligne)</div>
                  <div class="mt-1 font-medium text-emerald-600">{{ formatMoney(selected.montant_payer, selected.devise) }}</div>
                </div>
                <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <div class="text-xs uppercase text-slate-500">Total dossier</div>
                  <div class="mt-1 font-medium">{{ formatMoney(selectedDossierTotaux.summary.montantDu, selectedDossierTotaux.summary.devise) }}</div>
                </div>
                <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <div class="text-xs uppercase text-slate-500">Reste sur le dossier</div>
                  <div class="mt-1 font-medium text-amber-600">{{ formatMoney(selectedDossierTotaux.summary.reste, selectedDossierTotaux.summary.devise) }}</div>
                </div>
                <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <div class="text-xs uppercase text-slate-500">État du dossier</div>
                  <div class="mt-2">
                    <span class="rounded-full px-3 py-1 text-xs font-medium" :class="STATUT_META[selectedDossierTotaux.summary.statut].badgeClass">
                      {{ STATUT_META[selectedDossierTotaux.summary.statut].label }}
                    </span>
                  </div>
                </div>
                <div class="sm:col-span-2 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <div class="text-xs uppercase text-slate-500">Description</div>
                  <div class="mt-1 text-sm">{{ selected.description || '—' }}</div>
                </div>
              </div>

              <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 class="text-sm font-semibold">Tous les paiements de ce dossier</h3>
                  <span class="text-xs text-slate-500">
                    {{ selectedDossierTotaux.count }} versement(s) · Encaissé {{ formatMoney(selectedDossierTotaux.summary.montantVerse, selectedDossierTotaux.summary.devise) }} / {{ formatMoney(selectedDossierTotaux.summary.montantDu, selectedDossierTotaux.summary.devise) }}
                  </span>
                </div>
                <p class="mb-3 text-xs text-slate-500">
                  Reste sur le dossier : <span class="font-medium text-amber-600">{{ formatMoney(selectedDossierTotaux.summary.reste, selectedDossierTotaux.summary.devise) }}</span>
                </p>
                <div v-if="selectedDossierPaiements.length === 0" class="text-sm text-slate-500">
                  Aucun paiement pour ce dossier.
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="item in selectedDossierPaiements"
                    :key="item.id"
                    class="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm"
                    :class="item.id === selected.id ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:ring-blue-800' : 'bg-slate-50 dark:bg-slate-800'"
                  >
                    <span>{{ formatDateFr(item.date_paiement) }} — {{ natureLabel(item) }} · {{ item.type_paiement }} ({{ item.devise }})</span>
                    <span class="font-medium">{{ formatMoney(item.montant_payer, item.devise) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="shrink-0 flex flex-col gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:px-6 dark:border-slate-700">
              <RouterLink
                v-if="selected?.dossierId && canViewDossierFiche"
                :to="{ name: 'dossierFiche', params: { dossierId: selected.dossierId } }"
                class="w-full rounded-xl bg-violet-100 px-4 py-2.5 text-center text-sm font-medium text-violet-800 sm:w-auto dark:bg-violet-900/40 dark:text-violet-200"
                @click="closeDetail"
              >
                {{ isFinanceRole ? 'Situation financière du dossier' : 'Fiche de suivi' }}
              </RouterLink>
              <AppButtonGuard :blocked="!canDetailAddPayment" :reason="detailAddPaymentBlockedReason">
                <button
                  type="button"
                  class="w-full rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-medium text-emerald-800 sm:w-auto dark:bg-emerald-900/40 dark:text-emerald-200"
                  :class="BTN_DISABLED"
                  :disabled="!canDetailAddPayment"
                  @click="openAddForSelectedDossier"
                >
                  + Paiement sur ce dossier
                </button>
              </AppButtonGuard>
              <button type="button" class="w-full rounded-xl bg-blue-100 px-4 py-2.5 text-sm font-medium text-blue-700 sm:w-auto dark:bg-blue-900/40" @click="editFromDetail">
                Modifier
              </button>
              <button type="button" class="w-full rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-medium text-rose-700 sm:w-auto dark:bg-rose-900/40" @click="remove(selected.id)">
                Supprimer
              </button>
              <button type="button" class="w-full rounded-xl border px-4 py-2.5 text-sm sm:w-auto dark:border-slate-700" @click="closeDetail">
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
