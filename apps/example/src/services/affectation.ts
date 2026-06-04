import { collection, getDocs, type Firestore } from 'firebase/firestore'
import type { AffectationRecord } from '@/utils/affectation'

export async function fetchAllAffectations(firestore: Firestore): Promise<AffectationRecord[]> {
  const snap = await getDocs(collection(firestore, 'affectations'))
  return snap.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Omit<AffectationRecord, 'id'>),
  }))
}

export async function fetchAvocatNameMap(firestore: Firestore): Promise<Record<string, string>> {
  const snap = await getDocs(collection(firestore, 'avocats'))
  const map: Record<string, string> = {}
  for (const item of snap.docs) {
    map[item.id] = String((item.data() as Record<string, unknown>).nom ?? '')
  }
  return map
}
