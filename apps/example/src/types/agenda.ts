export type AgendaType = 'rendez-vous' | 'audience'

/** Événement agenda lié à un dossier (#idDossier). */
export type AgendaEntry = {
  id: string
  dossierId: string
  date: string
  type: AgendaType
  heure: string
  jour: string
  description: string
}

export type AgendaFormData = {
  id: string | null
  dossierId: string
  date: string
  type: AgendaType
  heure: string
  jour: string
  description: string
}
