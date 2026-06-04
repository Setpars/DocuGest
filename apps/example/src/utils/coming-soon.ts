import { PIECES_JURIDIQUES_COMING_SOON_HINT } from '@/constants/features'

/** Style commun pour contrôles « fonctionnalité à venir ». */
export const COMING_SOON_CONTROL_CLASS =
  'cursor-not-allowed opacity-50 pointer-events-none select-none'

export function comingSoonTitle(hint = PIECES_JURIDIQUES_COMING_SOON_HINT): string {
  return hint
}
