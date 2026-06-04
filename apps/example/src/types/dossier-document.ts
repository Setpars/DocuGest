export type DossierDocumentType = 'note_honoraire' | 'piece_juridique'

export type PieceJuridiqueKind
  = | 'assignation'
    | 'conclusions'
    | 'requete'
    | 'pv'
    | 'lettre'
    | 'libre'

export type DossierDocument = {
  id: string
  dossierId: string
  type: DossierDocumentType
  /** Sous-type pour les pièces juridiques */
  pieceKind?: PieceJuridiqueKind
  titre: string
  contenuHtml: string
  createdAt: string
  updatedAt: string
}

export type DossierDocumentForm = {
  id: string | null
  dossierId: string
  /** Uniquement pour les pièces juridiques */
  pieceKind?: PieceJuridiqueKind
  titre: string
  contenuHtml: string
}
