import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Firestore,
} from 'firebase/firestore'
import { fetchAvocatNameMap } from '@/services/affectation'
import {
  buildDossierInsightFromParts,
  mapDossierFields,
} from '@/services/dossier-insight-build'
import type {
  AvocatHistoriqueEntry,
  AvocatHistoriqueSummary,
  DossierInsight,
  DossierInsightAffectation,
} from '@/types/dossier-insight'
import { classifyDossierIssue } from '@/utils/dossier-resultat'
import {
  getAffectationAvocatId,
  getAffectationDossierId,
  type AffectationRecord,
} from '@/utils/affectation'

function mapAffectationForHistorique(
  item: AffectationRecord,
  avocatNames: Record<string, string>,
): DossierInsightAffectation {
  const avocatId = getAffectationAvocatId(item)
  return {
    id: item.id,
    avocatId,
    avocatNom: avocatNames[avocatId] || 'Avocat inconnu',
    date_affectation: String(item.date_affectation ?? ''),
    date_fin: item.date_fin ? String(item.date_fin) : null,
    role: String(item.role ?? ''),
    statut: String(item.statut ?? ''),
    observation: String(item.observation ?? ''),
  }
}

export async function loadDossierInsight(
  firestore: Firestore,
  dossierId: string,
): Promise<DossierInsight | null> {
  const dossierSnap = await getDoc(doc(firestore, 'dossiers', dossierId))
  if (!dossierSnap.exists()) return null

  const [affSnap, paiSnap, docSnap, avocatNames] = await Promise.all([
    getDocs(collection(firestore, 'affectations')),
    getDocs(query(collection(firestore, 'paiements'), where('dossierId', '==', dossierId))),
    getDocs(query(collection(firestore, 'dossier_documents'), where('dossierId', '==', dossierId))),
    fetchAvocatNameMap(firestore),
  ])

  return buildDossierInsightFromParts(dossierId, {
    dossierBase: dossierSnap.data() as Record<string, unknown>,
    affectationRecords: affSnap.docs.map((item) => ({
      id: item.id,
      ...(item.data() as Record<string, unknown>),
    })),
    paiementRecords: paiSnap.docs.map((item) => ({
      id: item.id,
      ...(item.data() as Record<string, unknown>),
    })),
    documentRecords: docSnap.docs.map((item) => ({
      id: item.id,
      ...(item.data() as Record<string, unknown>),
    })),
    avocatNames,
  })
}

export async function loadAvocatHistorique(
  firestore: Firestore,
  avocatId: string,
): Promise<AvocatHistoriqueSummary | null> {
  const avocatSnap = await getDoc(doc(firestore, 'avocats', avocatId))
  if (!avocatSnap.exists()) return null

  const avocatData = avocatSnap.data() as Record<string, unknown>
  const avocatNom = String(avocatData.nom ?? '')
  const specialite = String(avocatData.specialite ?? '')

  const [affSnap, dossiersSnap, avocatNames] = await Promise.all([
    getDocs(collection(firestore, 'affectations')),
    getDocs(collection(firestore, 'dossiers')),
    fetchAvocatNameMap(firestore),
  ])

  const affsForAvocat = affSnap.docs
    .map((item) => ({ id: item.id, ...(item.data() as Omit<AffectationRecord, 'id'>) }))
    .filter((item) => getAffectationAvocatId(item) === avocatId)

  const dossierById = new Map<string, Record<string, unknown>>()
  for (const item of dossiersSnap.docs) {
    dossierById.set(item.id, item.data() as Record<string, unknown>)
  }

  const byDossier = new Map<string, AffectationRecord[]>()
  for (const aff of affsForAvocat) {
    const dossierId = getAffectationDossierId(aff)
    if (!dossierId) continue
    const list = byDossier.get(dossierId) ?? []
    list.push(aff)
    byDossier.set(dossierId, list)
  }

  const entries: AvocatHistoriqueEntry[] = []

  for (const [dossierId, affs] of byDossier) {
    const raw = dossierById.get(dossierId)
    if (!raw) continue

    const fields = mapDossierFields(dossierId, raw)
    const affectations = affs
      .map((item) => mapAffectationForHistorique(item, avocatNames))
      .sort((a, b) => String(b.date_affectation).localeCompare(String(a.date_affectation)))

    const derniereAffectation = affectations[0]?.date_affectation ?? ''

    entries.push({
      dossierId,
      motif: fields.motif,
      clientNom: fields.clientNom,
      partie_en_cause: fields.partie_en_cause,
      juridiction: fields.juridiction,
      statut: fields.statut,
      resultat: fields.resultat,
      date_ouverture: fields.date_ouverture,
      date_fermeture: fields.date_fermeture,
      issueCategory: classifyDossierIssue(fields.statut, fields.resultat),
      affectations,
      derniereAffectation,
    })
  }

  entries.sort((a, b) => String(b.derniereAffectation).localeCompare(String(a.derniereAffectation)))

  let enCours = 0
  let gagne = 0
  let perdu = 0
  let closSansIssue = 0

  for (const entry of entries) {
    if (entry.issueCategory === 'gagne') gagne++
    else if (entry.issueCategory === 'perdu') perdu++
    else if (entry.issueCategory === 'encours') enCours++
    else closSansIssue++
  }

  return {
    avocatId,
    avocatNom,
    specialite,
    total: entries.length,
    enCours,
    gagne,
    perdu,
    closSansIssue,
    entries,
  }
}
