import { collection, getDocs, type Firestore } from 'firebase/firestore'
import { COLLECTIONS } from '@/constants/collections'
import { mapAffectationFromFirestore, mapAvocatFromFirestore } from '@/domain/mappers'
import type { AffectationRecord } from '@/utils/affectation'

export async function fetchAllAffectations(firestore: Firestore): Promise<AffectationRecord[]> {
  const snap = await getDocs(collection(firestore, COLLECTIONS.affectation))
  return snap.docs.map((item) =>
    mapAffectationFromFirestore(item.id, item.data() as Record<string, unknown>),
  )
}

export async function fetchAvocatNameMap(firestore: Firestore): Promise<Record<string, string>> {
  const snap = await getDocs(collection(firestore, COLLECTIONS.avocat))
  const map: Record<string, string> = {}
  for (const item of snap.docs) {
    map[item.id] = mapAvocatFromFirestore(item.id, item.data() as Record<string, unknown>).nom
  }
  return map
}
