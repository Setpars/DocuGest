<script setup lang="ts">
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore'
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import UserAvatar from '@/components/UserAvatar/index.vue'
import { db } from '@/firebase'
import { isAffectationActive, type AffectationRecord } from '@/utils/affectation'
import { computeAvocatResultCountsFromData } from '@/utils/avocat-stats'
import { parseDossierResultat } from '@/utils/dossier-resultat'

type Avocat = {
  id: string
  nom: string
  specialite: string
  adresse: string
  num_tel: string
  genre: string
  createdAt?: string
}

type Dossier = {
  id: string
  titre: string
  reference: string
  avocatId: string
  statut: string
  resultat?: string
  createdAt?: string
  createdAtLabel?: string
}

type Affectation = {
  id: string
  avocatId: string
  avocat_id?: string
  dossierId?: string
  dossier_id?: string
  date_affectation: string
  date_fin: string | null
  role: string
  statut: string
  observation: string
}

type ResultCategory = 'gagne' | 'perdu' | 'encours'

type AvocatStats = Avocat & {
  gagne: number
  perdu: number
  enCours: number
  dossiersSuivis: number
  totalAssignes: number
  affairesPlaidees: number
  ancienneteScore: number
}

const avocatsCol = collection(db, 'avocats')
const dossiersCol = collection(db, 'dossiers')
const affectationsCol = collection(db, 'affectations')

const avocats = ref<Avocat[]>([])
const allDossiers = ref<Dossier[]>([])
const dossiersDisponibles = ref<Dossier[]>([])
const affectations = ref<Affectation[]>([])

const loading = ref(false)
const saving = ref(false)
const savingAffectation = ref(false)
const withdrawingAffectationId = ref<string | null>(null)

const showForm = ref(false)
const showAffectationModal = ref(false)
const showDetail = ref(false)
const isEdit = ref(false)
const selected = ref<Avocat | null>(null)

const search = ref('')
const filterSpecialite = ref('')
const filterGenre = ref('')
const perfFilter = ref<'all' | 'gagne' | 'perdu' | 'encours'>('all')
const sortMode = ref<'az' | 'za' | 'anciennete' | 'specialite'>('az')
const viewMode = ref<'grid' | 'list'>('grid')
const currentPage = ref(1)
const pageSize = ref(9)

const toast = ref({
  show: false,
  type: 'success' as 'success' | 'error',
  message: '',
})

const form = ref({
  id: null as string | null,
  nom: '',
  specialite: '',
  adresse: '',
  num_tel: '',
  genre: '',
})

const affectationForm = ref({
  avocatId: '',
  dossierId: '',
  date_affectation: '',
  date_fin: '',
  role: '',
  statut: 'en cours',
  observation: '',
})

function showToast(type: 'success' | 'error', message: string) {
  toast.value = { show: true, type, message }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getAffectationDossierId(affectation: Affectation): string {
  return affectation.dossierId || affectation.dossier_id || ''
}

function getAffectationAvocatId(affectation: Affectation): string {
  return affectation.avocatId || affectation.avocat_id || ''
}

function normalizeStatut(statut?: string): string {
  return (statut ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function classifyResult(statut?: string): ResultCategory | null {
  const s = normalizeStatut(statut)
  if (!s) return null
  if (s.includes('gagn') || s === 'gagne') return 'gagne'
  if (s.includes('perd') || s === 'perdu') return 'perdu'
  if (s.includes('cours') || s === 'ouvert' || s.includes('attente') || s === 'affecte') return 'encours'
  return null
}

function dossiersForStats() {
  return allDossiers.value.map((item) => ({
    id: item.id,
    resultat: item.resultat,
    statut: item.statut,
    avocatId: item.avocatId,
  }))
}

const RESULT_META: Record<ResultCategory, { label: string, badgeClass: string }> = {
  gagne: {
    label: 'Gagnées',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  perdu: {
    label: 'Perdues',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  },
  encours: {
    label: 'En traitement',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  },
}

function getDossierLabel(dossierId: string): string {
  const dossier = allDossiers.value.find((item) => item.id === dossierId)
  if (!dossier) return 'Dossier non trouvé'
  const titre = dossier.titre || 'Sans intitulé'
  const ref = dossier.reference ? ` (${dossier.reference})` : ''
  return `${titre}${ref}`
}

function formatStatutLabel(statut?: string): string {
  const category = classifyResult(statut)
  if (category) return RESULT_META[category].label
  return statut?.trim() || 'Non renseigné'
}

function getAvocatResume(avocat: Pick<AvocatStats, 'totalAssignes' | 'gagne' | 'perdu' | 'enCours'>): string {
  if (avocat.totalAssignes === 0) {
    return 'Aucun dossier ne lui est assigné pour le moment.'
  }

  const details: string[] = []
  if (avocat.enCours > 0) {
    details.push(`${avocat.enCours} en traitement`)
  }
  if (avocat.gagne > 0) {
    details.push(`${avocat.gagne} gagnée${avocat.gagne > 1 ? 's' : ''}`)
  }
  if (avocat.perdu > 0) {
    details.push(`${avocat.perdu} perdue${avocat.perdu > 1 ? 's' : ''}`)
  }

  const total = `${avocat.totalAssignes} dossier${avocat.totalAssignes > 1 ? 's' : ''} au total`
  return details.length ? `${total} — dont ${details.join(', ')}.` : total
}

/** Un dossier est suivi uniquement s’il existe une affectation active pour cet avocat. */
function getAffectationsForAvocat(avocatId: string) {
  return affectations.value.filter((item) => getAffectationAvocatId(item) === avocatId)
}

function getAffectationsForDossier(dossierId: string) {
  return affectations.value.filter((item) => getAffectationDossierId(item) === dossierId)
}

async function clearDossierSuivi(dossierId: string) {
  await updateDoc(doc(db, 'dossiers', dossierId), {
    avocatId: '',
    resultat: '',
    statut: 'Ouvert',
  })
}

async function cancelAllSuiviForAvocat(avocatId: string) {
  const affsToRemove = getAffectationsForAvocat(avocatId)
  const dossierIds = new Set<string>()

  for (const aff of affsToRemove) {
    const dossierId = getAffectationDossierId(aff)
    if (dossierId) dossierIds.add(dossierId)
  }

  for (const dossier of allDossiers.value) {
    if (dossier.avocatId === avocatId) dossierIds.add(dossier.id)
  }

  await Promise.all(
    affsToRemove.map((aff) => deleteDoc(doc(db, 'affectations', aff.id))),
  )

  for (const dossierId of dossierIds) {
    const stillSuivi = affectations.value.some(
      (item) =>
        getAffectationDossierId(item) === dossierId
        && !affsToRemove.some((removed) => removed.id === item.id),
    )
    if (!stillSuivi) await clearDossierSuivi(dossierId)
  }
}

function isAffActive(aff: Affectation): boolean {
  return isAffectationActive(aff as AffectationRecord)
}

function computeAvocatResultCounts(avocatId: string) {
  return computeAvocatResultCountsFromData(
    avocatId,
    affectations.value as AffectationRecord[],
    dossiersForStats(),
  )
}

function mapDossierDoc(currentDoc: { id: string, data: () => Record<string, unknown> | object }): Dossier {
  const data = currentDoc.data() as Record<string, unknown>
  const createdAt = String(data.createdAt ?? data.date_ouverture ?? '')
  return {
    id: currentDoc.id,
    titre: String(data.titre ?? data.motif ?? ''),
    reference: String(data.reference ?? data.partie_en_cause ?? ''),
    avocatId: String(data.avocatId ?? ''),
    statut: String(data.statut ?? ''),
    resultat: String(data.resultat ?? data.issue ?? data.result ?? ''),
    createdAt,
    createdAtLabel: formatDate(createdAt),
  }
}

function computeDossiersDisponibles(dossiers: Dossier[], affs: Affectation[]): Dossier[] {
  const suivisIds = new Set(
    affs.filter(isAffActive).map(getAffectationDossierId).filter(Boolean),
  )
  return dossiers.filter((dossier) => {
    if (suivisIds.has(dossier.id)) return false
    const statut = normalizeStatut(dossier.statut)
    return statut === 'ouvert' || statut === 'en cours' || statut === 'suspendu'
  })
}

async function loadData() {
  loading.value = true
  try {
    const [aSnap, affSnap, dossiersSnap] = await Promise.all([
      getDocs(avocatsCol),
      getDocs(affectationsCol),
      getDocs(dossiersCol),
    ])

    avocats.value = aSnap.docs.map((currentDoc) => ({
      id: currentDoc.id,
      ...(currentDoc.data() as Omit<Avocat, 'id'>),
    }))

    affectations.value = affSnap.docs.map((currentDoc) => ({
      id: currentDoc.id,
      ...(currentDoc.data() as Omit<Affectation, 'id'>),
    }))

    allDossiers.value = dossiersSnap.docs.map((currentDoc) => mapDossierDoc(currentDoc))

    await syncInconsistentSuivi()
    await repairClosedAffectationStatuts()

    dossiersDisponibles.value = computeDossiersDisponibles(
      allDossiers.value,
      affectations.value,
    )
  } catch {
    showToast('error', 'Erreur lors du chargement')
  } finally {
    loading.value = false
  }
}

function isDossierClosAvecIssue(dossier: Dossier): boolean {
  return dossier.statut === 'Clos' || Boolean(parseDossierResultat(dossier.resultat))
}

/** Aligne les affectations sur le résultat du dossier (note d’honoraires déjà enregistrée). */
async function repairClosedAffectationStatuts() {
  const today = new Date().toISOString().slice(0, 10)
  const patches: Promise<void>[] = []

  for (const dossier of allDossiers.value) {
    const issue = parseDossierResultat(dossier.resultat)
    if (!issue || dossier.statut !== 'Clos') continue

    for (const aff of getAffectationsForDossier(dossier.id)) {
      const s = String(aff.statut ?? '').toLowerCase()
      if (s.includes('gagn') || s.includes('perd')) continue

      patches.push(
        updateDoc(doc(db, 'affectations', aff.id), {
          statut: issue,
          date_fin: aff.date_fin || today,
        }).then(() => {
          aff.statut = issue
          if (!aff.date_fin) aff.date_fin = today
        }),
      )
    }
  }

  await Promise.all(patches)
}

/** Aligne Firestore : pas de suivi sans affectation, pas d’affectation sans avocat valide. */
async function syncInconsistentSuivi() {
  const avocatIds = new Set(avocats.value.map((item) => item.id))

  for (const dossier of allDossiers.value) {
    if (dossier.avocatId && !getAffectationsForDossier(dossier.id).length) {
      if (isDossierClosAvecIssue(dossier)) {
        continue
      }
      await clearDossierSuivi(dossier.id)
      dossier.avocatId = ''
      dossier.resultat = ''
      dossier.statut = 'Ouvert'
    }
  }

  const affectationsOrphelines = affectations.value.filter(
    (item) => !avocatIds.has(getAffectationAvocatId(item)),
  )

  for (const aff of affectationsOrphelines) {
    const dossierId = getAffectationDossierId(aff)
    await deleteDoc(doc(db, 'affectations', aff.id))
    affectations.value = affectations.value.filter((item) => item.id !== aff.id)
    if (dossierId && !getAffectationsForDossier(dossierId).length) {
      const dossier = allDossiers.value.find((item) => item.id === dossierId)
      if (dossier && !isDossierClosAvecIssue(dossier)) {
        await clearDossierSuivi(dossierId)
        dossier.avocatId = ''
        dossier.resultat = ''
        dossier.statut = 'Ouvert'
      }
    }
  }

  for (const dossier of allDossiers.value) {
    const affs = getAffectationsForDossier(dossier.id)
    if (!affs.length) continue
    const primaryId = getAffectationAvocatId(affs[0])
    if (!primaryId) continue
    const assignedIds = affs.map((item) => getAffectationAvocatId(item)).filter(Boolean)
    if (!dossier.avocatId || !assignedIds.includes(dossier.avocatId)) {
      await updateDoc(doc(db, 'dossiers', dossier.id), { avocatId: primaryId })
      dossier.avocatId = primaryId
    }
  }
}

onMounted(loadData)
onActivated(loadData)

watch([search, filterSpecialite, filterGenre, perfFilter, sortMode], () => {
  currentPage.value = 1
})

function resetForm() {
  form.value = {
    id: null,
    nom: '',
    specialite: '',
    adresse: '',
    num_tel: '',
    genre: '',
  }
}

function resetAffectationForm() {
  affectationForm.value = {
    avocatId: selected.value?.id || '',
    dossierId: '',
    date_affectation: '',
    date_fin: '',
    role: '',
    statut: 'en cours',
    observation: '',
  }
}

function openAdd() {
  isEdit.value = false
  resetForm()
  showForm.value = true
}

function openEdit(avocat: Avocat) {
  isEdit.value = true
  form.value = {
    id: avocat.id,
    nom: avocat.nom,
    specialite: avocat.specialite,
    adresse: avocat.adresse,
    num_tel: avocat.num_tel,
    genre: avocat.genre,
  }
  showForm.value = true
}

function openDetail(avocat: Avocat) {
  selected.value = avocat
  showDetail.value = true
}

function closeForm() {
  showForm.value = false
}

function closeDetail() {
  showDetail.value = false
}

function openAffectationModal(avocat?: Avocat) {
  if (avocat) selected.value = avocat
  resetAffectationForm()
  if (selected.value) affectationForm.value.avocatId = selected.value.id
  showAffectationModal.value = true
}

function closeAffectationModal() {
  showAffectationModal.value = false
}

const dossiersAffectesIds = computed(() =>
  new Set(
    affectations.value.filter(isAffActive).map(getAffectationDossierId).filter(Boolean),
  ),
)

const activeAffectationsForSelected = computed(() => {
  if (!selected.value) return []
  return getAffectationsForAvocat(selected.value.id).filter(isAffActive)
})

const avocatStats = computed<AvocatStats[]>(() => {
  return avocats.value.map((avocat) => {
    const affAvocat = affectations.value.filter((item) => getAffectationAvocatId(item) === avocat.id)
    const { gagne, perdu, enCours, dossiersSuivis, totalAssignes } = computeAvocatResultCounts(avocat.id)

    const affairesPlaidees = affAvocat.filter((item) => {
      const role = normalizeStatut(item.role)
      const statut = normalizeStatut(item.statut)
      return role.includes('avocat') || statut.includes('plaid')
    }).length

    const ancienneteScore = new Date(avocat.createdAt || Date.now()).getTime()

    return {
      ...avocat,
      gagne,
      perdu,
      enCours,
      dossiersSuivis,
      totalAssignes,
      affairesPlaidees,
      ancienneteScore,
    }
  })
})

const filteredSorted = computed(() => {
  const q = search.value.toLowerCase().trim()
  let data = [...avocatStats.value].filter((avocat) => {
    const matchSearch =
      !q ||
      [avocat.nom, avocat.specialite, avocat.adresse, avocat.num_tel, avocat.genre].some((value) =>
        String(value).toLowerCase().includes(q),
      )
    const matchSpecialite = !filterSpecialite.value || avocat.specialite === filterSpecialite.value
    const matchGenre = !filterGenre.value || avocat.genre === filterGenre.value
    return matchSearch && matchSpecialite && matchGenre
  })

  if (perfFilter.value === 'gagne') {
    data = data.filter((avocat) => avocat.gagne > avocat.perdu && avocat.gagne > 0)
  } else if (perfFilter.value === 'perdu') {
    data = data.filter((avocat) => avocat.perdu > avocat.gagne && avocat.perdu > 0)
  } else if (perfFilter.value === 'encours') {
    data = data.filter((avocat) => avocat.enCours > 0)
  }

  if (sortMode.value === 'az') {
    data.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }))
  } else if (sortMode.value === 'za') {
    data.sort((a, b) => b.nom.localeCompare(a.nom, 'fr', { sensitivity: 'base' }))
  } else if (sortMode.value === 'specialite') {
    data.sort((a, b) => a.specialite.localeCompare(b.specialite, 'fr', { sensitivity: 'base' }))
  } else if (sortMode.value === 'anciennete') {
    data.sort((a, b) => a.ancienneteScore - b.ancienneteScore)
  }

  return data
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredSorted.value.length / pageSize.value)))
const paginatedAvocats = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredSorted.value.slice(start, start + pageSize.value)
})
const specialites = computed(() => [...new Set(avocats.value.map((avocat) => avocat.specialite))].sort())

const totals = computed(() => {
  const idsAffectes = dossiersAffectesIds.value
  const global = avocats.value.reduce(
    (acc, avocat) => {
      const counts = computeAvocatResultCounts(avocat.id)
      acc.gagne += counts.gagne
      acc.perdu += counts.perdu
      acc.enCours += counts.enCours
      return acc
    },
    { gagne: 0, perdu: 0, enCours: 0 },
  )

  return {
    avocats: avocats.value.length,
    dossiersSuivis: idsAffectes.size,
    dossiersNonAffectes: allDossiers.value.filter((dossier) => !idsAffectes.has(dossier.id)).length,
    gagne: global.gagne,
    perdu: global.perdu,
    enCours: global.enCours,
  }
})

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    if (!form.value.nom || !form.value.specialite || !form.value.adresse || !form.value.num_tel || !form.value.genre) {
      showToast('error', 'Veuillez remplir tous les champs')
      return
    }

    const payload = { ...form.value }
    delete (payload as { id?: string | null }).id

    if (isEdit.value && form.value.id) {
      await updateDoc(doc(db, 'avocats', form.value.id), payload)
      showToast('success', `Avocat ${form.value.nom} modifié avec succès`)
    } else {
      await addDoc(avocatsCol, { ...payload, createdAt: new Date().toISOString() })
      showToast('success', `Avocat ${form.value.nom} ajouté avec succès`)
    }

    showForm.value = false
    await loadData()
  } catch {
    showToast('error', 'Erreur lors de l’enregistrement')
  } finally {
    saving.value = false
  }
}

async function saveAffectation() {
  if (savingAffectation.value) return
  savingAffectation.value = true
  try {
    if (!affectationForm.value.avocatId || !affectationForm.value.dossierId || !affectationForm.value.date_affectation || !affectationForm.value.role || !affectationForm.value.statut) {
      showToast('error', 'Veuillez compléter l’affectation')
      return
    }

    const { dossierId, avocatId, statut } = affectationForm.value

    const avocatExiste = avocats.value.some((item) => item.id === avocatId)
    if (!avocatExiste) {
      showToast('error', 'Avocat introuvable — le suivi ne peut pas être créé')
      return
    }

    const dejaAssigne = getAffectationsForDossier(dossierId).some(
      (item) => getAffectationAvocatId(item) === avocatId,
    )
    if (dejaAssigne) {
      showToast('error', 'Cet avocat est déjà assigné à ce dossier')
      return
    }

    await addDoc(affectationsCol, {
      ...affectationForm.value,
      dossierId,
      avocatId,
      date_fin: affectationForm.value.date_fin || null,
    })

    const dossier = allDossiers.value.find((item) => item.id === dossierId)
    const resultCategory = classifyResult(statut)
    const dossierPatch: Record<string, string> = {}
    const issueResultat = parseDossierResultat(statut)
    if (issueResultat) {
      dossierPatch.resultat = issueResultat
    }
    if (!dossier?.avocatId) {
      dossierPatch.avocatId = avocatId
    }
    if (resultCategory === 'encours' && dossier?.statut === 'Ouvert') {
      dossierPatch.statut = 'En cours'
    }
    if (Object.keys(dossierPatch).length > 0) {
      await updateDoc(doc(db, 'dossiers', dossierId), dossierPatch)
    }

    const nbAvocats = getAffectationsForDossier(dossierId).length + 1
    const message = nbAvocats > 1
      ? `Avocat ajouté — ${nbAvocats} avocat(s) suivent ce dossier`
      : 'Suivi enregistré — l’avocat suit désormais ce dossier'
    showToast('success', message)
    showAffectationModal.value = false
    await loadData()
  } catch {
    showToast('error', 'Erreur lors de l’affectation')
  } finally {
    savingAffectation.value = false
  }
}

async function retirerAffectation(affectation: Affectation) {
  const dossierId = getAffectationDossierId(affectation)

  if (!dossierId) {
    showToast('error', 'Dossier introuvable pour cette affectation')
    return
  }

  const label = getDossierLabel(dossierId)
  const restants = getAffectationsForDossier(dossierId).filter((item) => item.id !== affectation.id)
  const hint = restants.length > 0
    ? `${restants.length} autre(s) avocat(s) resteront assigné(s) à ce dossier.`
    : 'Le dossier n’aura plus d’avocat assigné.'

  if (!window.confirm(
    `Retirer cet avocat du dossier « ${label} » ?\n\n${hint}`,
  )) {
    return
  }

  withdrawingAffectationId.value = affectation.id
  try {
    const remaining = getAffectationsForDossier(dossierId).filter(
      (item) => item.id !== affectation.id,
    )
    const removedAvocatId = getAffectationAvocatId(affectation)

    await deleteDoc(doc(db, 'affectations', affectation.id))

    if (remaining.length === 0) {
      await clearDossierSuivi(dossierId)
    } else {
      const dossier = allDossiers.value.find((item) => item.id === dossierId)
      if (dossier?.avocatId === removedAvocatId) {
        const nextAvocatId = getAffectationAvocatId(remaining[0])
        await updateDoc(doc(db, 'dossiers', dossierId), { avocatId: nextAvocatId })
        dossier.avocatId = nextAvocatId
      }
    }

    showToast('success', `Suivi retiré — « ${label} » n’est plus assigné`)
    await loadData()
  } catch {
    showToast('error', 'Erreur lors du retrait du suivi')
  } finally {
    withdrawingAffectationId.value = null
  }
}

async function remove(id: string) {
  const avocat = avocats.value.find((item) => item.id === id)
  const nbSuivis = computeAvocatResultCounts(id).dossiersSuivis

  const message = nbSuivis > 0
    ? `Supprimer l’avocat « ${avocat?.nom ?? ''} » ?\n\n${nbSuivis} dossier(s) qu’il suivait seront remis en attente (suivi annulé).`
    : `Supprimer l’avocat « ${avocat?.nom ?? ''} » ?`

  if (!window.confirm(message)) return

  try {
    await cancelAllSuiviForAvocat(id)
    await deleteDoc(doc(db, 'avocats', id))
    await loadData()
    if (selected.value?.id === id) showDetail.value = false
    showToast('success', nbSuivis > 0
      ? 'Avocat supprimé — les suivis de dossiers ont été annulés'
      : 'Avocat supprimé')
  } catch {
    showToast('error', 'Erreur lors de la suppression')
  }
}

const currentStats = computed(() => {
  if (!selected.value) return null
  return avocatStats.value.find((avocat) => avocat.id === selected.value?.id) ?? null
})

const selectedAffectations = computed(() => {
  if (!selected.value) return []
  return activeAffectationsForSelected.value
    .map((item) => ({
      ...item,
      dossierId: getAffectationDossierId(item),
      dossierLabel: getDossierLabel(getAffectationDossierId(item)),
      statutLabel: formatStatutLabel(item.statut),
    }))
    .sort((a, b) => String(b.date_affectation).localeCompare(String(a.date_affectation)))
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
      <div class="mb-6 flex flex-col gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Gestion des avocats</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Consultez vos avocats, leurs dossiers assignés et l’état de chaque affaire.
          </p>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            <span class="font-medium">{{ totals.dossiersSuivis }}</span> dossier(s) pris en charge
            · <span class="font-medium">{{ totals.dossiersNonAffectes }}</span> en attente d’avocat
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button class="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" :disabled="avocats.length === 0 || dossiersDisponibles.length === 0" @click="openAffectationModal()">
            + Assigner un dossier
          </button>
          <button class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white" @click="openAdd">
            + Ajouter avocat
          </button>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <div class="text-sm font-medium text-slate-700 dark:text-slate-200">Équipe</div>
          <div class="mt-2 text-2xl font-semibold">{{ totals.avocats }}</div>
          <p class="mt-1 text-xs text-slate-500">Avocat(s) enregistré(s) dans le cabinet</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <div class="text-sm font-medium text-slate-700 dark:text-slate-200">Dossiers</div>
          <div class="mt-2 flex flex-wrap gap-3">
            <div>
              <div class="text-2xl font-semibold text-blue-600">{{ totals.dossiersSuivis }}</div>
              <p class="text-xs text-slate-500">Assignés</p>
            </div>
            <div>
              <div class="text-2xl font-semibold text-amber-600">{{ totals.dossiersNonAffectes }}</div>
              <p class="text-xs text-slate-500">Sans avocat</p>
            </div>
          </div>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <div class="text-sm font-medium text-slate-700 dark:text-slate-200">Résultats des affaires</div>
          <div class="mt-3 flex flex-wrap gap-2">
            <span class="rounded-full px-3 py-1 text-sm font-medium" :class="RESULT_META.encours.badgeClass">
              {{ totals.enCours }} en traitement
            </span>
            <span class="rounded-full px-3 py-1 text-sm font-medium" :class="RESULT_META.gagne.badgeClass">
              {{ totals.gagne }} gagnée{{ totals.gagne > 1 ? 's' : '' }}
            </span>
            <span class="rounded-full px-3 py-1 text-sm font-medium" :class="RESULT_META.perdu.badgeClass">
              {{ totals.perdu }} perdue{{ totals.perdu > 1 ? 's' : '' }}
            </span>
          </div>
        </div>
      </div>

      <div class="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div class="grid gap-3 lg:grid-cols-6">
          <input v-model="search" placeholder="Rechercher…" class="rounded-xl border px-4 py-2.5 dark:bg-slate-800 lg:col-span-2" />
          <select v-model="filterSpecialite" class="rounded-xl border px-4 py-2.5 dark:bg-slate-800">
            <option value="">Toutes spécialités</option>
            <option v-for="specialite in specialites" :key="specialite" :value="specialite">{{ specialite }}</option>
          </select>
          <select v-model="filterGenre" class="rounded-xl border px-4 py-2.5 dark:bg-slate-800">
            <option value="">Tous genres</option>
            <option value="Homme">Homme</option>
            <option value="Femme">Femme</option>
          </select>
          <select v-model="perfFilter" class="rounded-xl border px-4 py-2.5 dark:bg-slate-800">
            <option value="all">Tous les profils</option>
            <option value="gagne">Plutôt des affaires gagnées</option>
            <option value="perdu">Plutôt des affaires perdues</option>
            <option value="encours">Avec dossiers en traitement</option>
          </select>
          <select v-model="sortMode" class="rounded-xl border px-4 py-2.5 dark:bg-slate-800">
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
            <option value="anciennete">Ancienneté</option>
            <option value="specialite">Spécialité</option>
          </select>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div class="flex flex-wrap gap-2">
          <button class="rounded-xl px-4 py-2.5 text-sm font-medium" :class="viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'" @click="viewMode = 'grid'">Grille</button>
          <button class="rounded-xl px-4 py-2.5 text-sm font-medium" :class="viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'" @click="viewMode = 'list'">Liste</button>
        </div>
        <div class="text-sm text-slate-500">{{ filteredSorted.length }} résultat(s)</div>
      </div>

      <div v-if="loading" class="mt-6 rounded-2xl bg-white p-8 text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">Chargement…</div>

      <div v-else>
        <div v-if="filteredSorted.length === 0" class="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          Aucun avocat ne correspond à vos critères.
        </div>

        <div v-else-if="viewMode === 'grid'" class="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <div v-for="avocat in paginatedAvocats" :key="avocat.id" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-4">
                <UserAvatar :name="avocat.nom" size="lg" class="rounded-2xl" />
                <div>
                  <h3 class="text-lg font-semibold">{{ avocat.nom }}</h3>
                  <p class="text-sm text-slate-500">{{ avocat.specialite }}</p>
                </div>
              </div>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">{{ avocat.genre }}</span>
            </div>

            <p class="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {{ getAvocatResume(avocat) }}
            </p>

            <div
              v-if="avocat.gagne > 0 || avocat.perdu > 0 || avocat.enCours > 0"
              class="mt-4 flex flex-wrap gap-2"
            >
              <span
                v-if="avocat.enCours > 0"
                class="rounded-full px-3 py-1 text-xs font-medium"
                :class="RESULT_META.encours.badgeClass"
              >
                {{ avocat.enCours }} en traitement
              </span>
              <span
                v-if="avocat.gagne > 0"
                class="rounded-full px-3 py-1 text-xs font-medium"
                :class="RESULT_META.gagne.badgeClass"
              >
                {{ avocat.gagne }} gagnée{{ avocat.gagne > 1 ? 's' : '' }}
              </span>
              <span
                v-if="avocat.perdu > 0"
                class="rounded-full px-3 py-1 text-xs font-medium"
                :class="RESULT_META.perdu.badgeClass"
              >
                {{ avocat.perdu }} perdue{{ avocat.perdu > 1 ? 's' : '' }}
              </span>
            </div>

            <div class="mt-4 space-y-1 text-sm text-slate-500 dark:text-slate-400">
              <div>{{ avocat.adresse }}</div>
              <div>{{ avocat.num_tel }}</div>
              <div v-if="avocat.affairesPlaidees > 0">
                {{ avocat.affairesPlaidees }} affaire{{ avocat.affairesPlaidees > 1 ? 's' : '' }} plaidée{{ avocat.affairesPlaidees > 1 ? 's' : '' }}
              </div>
            </div>

            <div class="mt-5 flex flex-wrap gap-2">
              <button class="rounded-xl bg-slate-200 px-3 py-2 text-sm dark:bg-slate-700" @click="openDetail(avocat)">Détail</button>
              <RouterLink
                :to="{ name: 'avocatHistorique', params: { avocatId: avocat.id } }"
                class="rounded-xl bg-violet-100 px-3 py-2 text-sm text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
              >
                Historique
              </RouterLink>
              <button class="rounded-xl bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/40" @click="openAffectationModal(avocat)">Assigner</button>
              <button class="rounded-xl bg-blue-100 px-3 py-2 text-sm text-blue-700 dark:bg-blue-900/40" @click="openEdit(avocat)">Modifier</button>
              <button class="rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/40" @click="remove(avocat.id)">Supprimer</button>
            </div>
          </div>
        </div>

        <div v-else class="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <tr>
                <th class="px-4 py-3 font-medium">Nom</th>
                <th class="px-4 py-3 font-medium">Spécialité</th>
                <th class="px-4 py-3 font-medium">Dossiers</th>
                <th class="px-4 py-3 font-medium">État des affaires</th>
                <th class="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="avocat in paginatedAvocats" :key="avocat.id" class="border-b border-slate-100 dark:border-slate-800">
                <td class="px-4 py-3 font-medium">{{ avocat.nom }}</td>
                <td class="px-4 py-3 text-slate-500">{{ avocat.specialite }}</td>
                <td class="px-4 py-3">
                  <span class="font-medium">{{ avocat.totalAssignes }}</span>
                  <span class="text-slate-500"> au total</span>
                  <span v-if="avocat.dossiersSuivis > 0" class="text-slate-500"> · {{ avocat.dossiersSuivis }} en cours</span>
                </td>
                <td class="px-4 py-3">
                  <p class="max-w-xs text-slate-600 dark:text-slate-300">{{ getAvocatResume(avocat) }}</p>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap justify-end gap-2">
                    <button class="rounded-lg bg-slate-200 px-2 py-1 text-xs dark:bg-slate-700" @click="openDetail(avocat)">Détail</button>
                    <RouterLink
                      :to="{ name: 'avocatHistorique', params: { avocatId: avocat.id } }"
                      class="rounded-lg bg-violet-100 px-2 py-1 text-xs text-violet-800 dark:bg-violet-900/40"
                    >
                      Historique
                    </RouterLink>
                    <button class="rounded-lg bg-emerald-100 px-2 py-1 text-xs text-emerald-700" @click="openAffectationModal(avocat)">Assigner</button>
                    <button class="rounded-lg bg-blue-100 px-2 py-1 text-xs text-blue-700" @click="openEdit(avocat)">Modifier</button>
                    <button class="rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-700" @click="remove(avocat.id)">Supprimer</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="filteredSorted.length > 0" class="mt-6 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <button class="rounded-xl border px-4 py-2.5 disabled:opacity-50" :disabled="currentPage === 1" @click="currentPage -= 1">Précédent</button>
          <div class="text-sm text-slate-500">Page {{ currentPage }} / {{ totalPages }}</div>
          <button class="rounded-xl border px-4 py-2.5 disabled:opacity-50" :disabled="currentPage === totalPages" @click="currentPage += 1">Suivant</button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showDetail"
        class="app-modal-overlay"
        @click="closeDetail"
      >
        <div class="app-modal-overlay__wrap app-modal-overlay__wrap--center">
          <div class="app-modal-overlay__dialog max-w-5xl" @click.stop>
            <div class="shrink-0 flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-700">
              <div class="min-w-0 pr-2">
                <h2 class="truncate text-xl font-semibold">{{ selected?.nom }}</h2>
                <p class="text-sm text-slate-500">{{ selected?.specialite }}</p>
              </div>
              <div class="flex shrink-0 flex-wrap gap-2">
                <RouterLink
                  v-if="selected"
                  :to="{ name: 'avocatHistorique', params: { avocatId: selected.id } }"
                  class="rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white"
                >
                  Historique complet
                </RouterLink>
                <button class="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white" @click="openAffectationModal(selected || undefined)">Assigner un dossier</button>
                <button class="rounded-xl border px-3 py-2 text-sm" @click="closeDetail">Fermer</button>
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div class="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-4">
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><div class="text-xs uppercase text-slate-500">Adresse</div><div class="mt-1 font-medium">{{ selected?.adresse }}</div></div>
                <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><div class="text-xs uppercase text-slate-500">Téléphone</div><div class="mt-1 font-medium">{{ selected?.num_tel }}</div></div>
                <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><div class="text-xs uppercase text-slate-500">Genre</div><div class="mt-1 font-medium">{{ selected?.genre }}</div></div>
                <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><div class="text-xs uppercase text-slate-500">Dossiers suivis</div><div class="mt-1 font-medium">{{ currentStats?.dossiersSuivis ?? 0 }}</div></div>
              </div>

              <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                <div class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Bilan des dossiers</div>
                <p v-if="currentStats" class="mb-4 text-sm text-slate-600 dark:text-slate-300">
                  {{ getAvocatResume(currentStats) }}
                </p>
                <div class="grid gap-3 sm:grid-cols-3">
                  <div class="rounded-xl bg-blue-100 p-4 dark:bg-blue-900/30">
                    <div class="text-xs font-medium text-blue-800 dark:text-blue-200">En traitement</div>
                    <div class="mt-1 text-2xl font-semibold text-blue-900 dark:text-blue-100">{{ currentStats?.enCours ?? 0 }}</div>
                    <p class="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">Dossiers toujours ouverts</p>
                  </div>
                  <div class="rounded-xl bg-emerald-100 p-4 dark:bg-emerald-900/30">
                    <div class="text-xs font-medium text-emerald-800 dark:text-emerald-200">Affaires gagnées</div>
                    <div class="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{{ currentStats?.gagne ?? 0 }}</div>
                    <p class="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">Décisions favorables</p>
                  </div>
                  <div class="rounded-xl bg-rose-100 p-4 dark:bg-rose-900/30">
                    <div class="text-xs font-medium text-rose-800 dark:text-rose-200">Affaires perdues</div>
                    <div class="mt-1 text-2xl font-semibold text-rose-900 dark:text-rose-100">{{ currentStats?.perdu ?? 0 }}</div>
                    <p class="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80">Décisions défavorables</p>
                  </div>
                </div>
              </div>

              <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                <div class="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Dossiers suivis actuellement</div>
                <p class="mb-3 text-xs text-slate-500">
                  Chaque ligne correspond à un dossier assigné à cet avocat. Retirer le suivi libère le dossier.
                </p>
                <p v-if="selectedAffectations.length === 0" class="text-sm text-slate-500">
                  Cet avocat ne suit aucun dossier pour le moment.
                </p>
                <div v-else class="space-y-3">
                  <div
                    v-for="item in selectedAffectations"
                    :key="item.id"
                    class="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div class="font-medium text-slate-800 dark:text-slate-100">{{ item.dossierLabel }}</div>
                      <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="RESULT_META[classifyResult(item.statut) || 'encours'].badgeClass">
                        {{ item.statutLabel }}
                      </span>
                    </div>
                    <div class="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      <div v-if="item.date_affectation">
                        <span class="text-slate-500">Depuis le</span> {{ formatDate(item.date_affectation) || item.date_affectation }}
                      </div>
                      <div v-if="item.role">
                        <span class="text-slate-500">Rôle :</span> {{ item.role }}
                      </div>
                      <div v-if="item.observation">
                        <span class="text-slate-500">Note :</span> {{ item.observation }}
                      </div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <RouterLink
                        v-if="item.dossierId"
                        :to="{
                          name: 'doyenDossierDetail',
                          params: { dossierId: item.dossierId },
                          query: { from: 'avocats', avocatId: selected?.id },
                        }"
                        class="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        Fiche de suivi
                      </RouterLink>
                      <button
                        type="button"
                        class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                        :disabled="withdrawingAffectationId === item.id"
                        @click="retirerAffectation(item)"
                      >
                        {{ withdrawingAffectationId === item.id ? 'Retrait...' : 'Retirer le suivi' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                <div class="mb-2 text-xs uppercase text-slate-500">Résumé</div>
                <div class="text-sm text-slate-600 dark:text-slate-300">
                  {{ currentStats ? getAvocatResume(currentStats) : 'Sélectionnez un avocat pour voir son activité.' }}
                </div>
              </div>
            </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showForm"
        class="app-modal-overlay"
        @click="closeForm"
      >
        <div class="app-modal-overlay__wrap app-modal-overlay__wrap--center">
          <div class="app-modal-overlay__dialog max-w-2xl" @click.stop>
            <div class="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-700">
              <h2 class="text-xl font-semibold">{{ isEdit ? 'Modifier avocat' : 'Ajouter avocat' }}</h2>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div class="grid gap-4 px-4 py-5 sm:px-6 md:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-medium">Nom</label>
              <input v-model="form.nom" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium">Spécialité</label>
              <input v-model="form.specialite" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium">Adresse</label>
              <input v-model="form.adresse" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium">Numéro téléphone</label>
              <input v-model="form.num_tel" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800" />
            </div>
            <div class="md:col-span-2">
              <label class="mb-2 block text-sm font-medium">Genre</label>
              <select v-model="form.genre" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800">
                <option value="">Choisir</option>
                <option>Homme</option>
                <option>Femme</option>
              </select>
            </div>
              </div>
            </div>

            <div class="shrink-0 border-t border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-700">
              <div class="flex flex-wrap justify-end gap-3">
                <button class="rounded-xl border px-4 py-2.5" @click="closeForm">Annuler</button>
                <button class="rounded-xl bg-blue-600 px-4 py-2.5 text-white disabled:opacity-50" :disabled="saving" @click="save">
                  {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showAffectationModal"
        class="app-modal-overlay"
        @click="closeAffectationModal"
      >
        <div class="app-modal-overlay__wrap app-modal-overlay__wrap--center">
          <div class="app-modal-overlay__dialog max-w-3xl" @click.stop>
            <div class="shrink-0 flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 dark:border-slate-700">
              <div class="min-w-0 flex-1 pr-2">
                <h2 class="text-xl font-semibold">Assigner un dossier</h2>
                <p class="mt-1 text-sm text-slate-500">
                  Un dossier n’est suivi que si un avocat lui est assigné. Un dossier ne peut avoir qu’un seul avocat à la fois.
                </p>
              </div>
              <button class="shrink-0 rounded-xl border px-3 py-2 text-sm" @click="closeAffectationModal">Fermer</button>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div class="grid gap-4 px-4 py-5 sm:px-6 md:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-medium">Avocat</label>
              <select v-model="affectationForm.avocatId" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800">
                <option value="">Choisir un avocat</option>
                <option v-for="avocat in avocats" :key="avocat.id" :value="avocat.id">{{ avocat.nom }}</option>
              </select>
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium">Dossier</label>
              <select v-model="affectationForm.dossierId" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800">
                <option value="">Choisir un dossier</option>
                <option v-for="dossier in dossiersDisponibles" :key="dossier.id" :value="dossier.id">
                  {{ getDossierLabel(dossier.id) }} — ouvert le {{ dossier.createdAtLabel || 'date inconnue' }}
                </option>
              </select>
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium">Date d’affectation</label>
              <input v-model="affectationForm.date_affectation" type="date" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800" />
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium">Date de fin</label>
              <input v-model="affectationForm.date_fin" type="date" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800" />
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium">Rôle</label>
              <input v-model="affectationForm.role" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800" />
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium">Résultat de l’affaire</label>
              <select v-model="affectationForm.statut" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800">
                <option value="en cours">En traitement — le dossier est toujours suivi</option>
                <option value="gagné">Gagnée — décision favorable au client</option>
                <option value="perdu">Perdue — décision défavorable</option>
              </select>
              <p class="mt-1 text-xs text-slate-500">Ce choix met à jour le suivi visible sur la fiche de l’avocat.</p>
            </div>

            <div class="md:col-span-2">
              <label class="mb-2 block text-sm font-medium">Observation</label>
              <textarea v-model="affectationForm.observation" rows="3" class="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-800" />
            </div>

              </div>
            </div>

            <div class="shrink-0 border-t border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-700">
              <div class="flex flex-wrap justify-end gap-3">
                <button class="rounded-xl border px-4 py-2.5" @click="closeAffectationModal">Annuler</button>
                <button class="rounded-xl bg-emerald-600 px-4 py-2.5 text-white disabled:opacity-50" :disabled="savingAffectation" @click="saveAffectation">
                  {{ savingAffectation ? 'Enregistrement…' : 'Enregistrer l’affectation' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
