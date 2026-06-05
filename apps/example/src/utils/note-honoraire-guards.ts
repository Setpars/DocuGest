import { NOTE_HONORAIRE_MESSAGES } from '@/constants/note-honoraire'

export function dossierHasHonorairesMontant(montant: number | undefined | null): boolean {
  return (Number(montant) || 0) > 0
}

export function dossierCanCreateNoteHonoraire(input: {
  montantHonorairesTotal?: number | null
  noteHonoraireId?: string | null
  existingNotesCount?: number
}): { ok: true } | { ok: false, reason: string } {
  if (!dossierHasHonorairesMontant(input.montantHonorairesTotal)) {
    return { ok: false, reason: NOTE_HONORAIRE_MESSAGES.missingMontant }
  }
  const hasNote = Boolean(input.noteHonoraireId?.trim())
    || (input.existingNotesCount ?? 0) > 0
  if (hasNote) {
    return { ok: false, reason: NOTE_HONORAIRE_MESSAGES.alreadyExists }
  }
  return { ok: true }
}
