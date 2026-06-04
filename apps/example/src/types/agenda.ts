export type AgendaType = 'rendez-vous' | 'audience'

export type AgendaEntry = {
  id: string
  date: string
  type: AgendaType
  heure: string
  jour: string
  description: string
}

export type AgendaFormData = {
  id: string | null
  date: string
  type: AgendaType
  heure: string
  jour: string
  description: string
}
