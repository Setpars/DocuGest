import type { PieceJuridiqueKind } from '@/types/dossier-document'
import type { ModeleSourceType } from '@/utils/import-modele-piece'

export type PieceModele = {
  id: string
  nom: string
  sourceType: ModeleSourceType
  fileName: string
  contenuHtml: string
  pieceKind?: PieceJuridiqueKind
  createdAt: string
  updatedAt: string
}
