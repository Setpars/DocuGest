import type { ThemeSettings } from '@fantastic-admin/settings'

const STORAGE_KEY = 'theme-preference'

export type ThemePreference = Pick<ThemeSettings, 'colorScheme' | 'radius' | 'colorAmblyopia'>

export function readThemePreference(): Partial<ThemePreference> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<ThemePreference>
  } catch {
    return null
  }
}

export function writeThemePreference(theme: ThemeSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    colorScheme: theme.colorScheme ?? '',
    radius: theme.radius,
    colorAmblyopia: theme.colorAmblyopia ?? false,
  } satisfies ThemePreference))
}

export function applyThemePreference(
  target: ThemeSettings,
  saved: Partial<ThemePreference> | null,
) {
  if (!saved) return
  if (saved.colorScheme !== undefined) target.colorScheme = saved.colorScheme
  if (saved.radius !== undefined) target.radius = saved.radius
  if (saved.colorAmblyopia !== undefined) target.colorAmblyopia = saved.colorAmblyopia
}
