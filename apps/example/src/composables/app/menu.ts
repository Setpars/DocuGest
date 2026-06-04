export function useAppMenu() {
  const router = useRouter()

  const appSettingsStore = useAppSettingsStore()
  const appMenuStore = useAppMenuStore()

  function generateTitle(title?: string | (() => any) | null, fallback = '[ Sans titre ]') {
    const resolved = typeof title === 'function' ? title() : title
    if (resolved === undefined || resolved === null || String(resolved).trim() === '') {
      return fallback
    }
    return String(resolved)
  }

  function switchTo(index: number) {
    appMenuStore.setActived(index)
    if (
      appSettingsStore.settings.menu.mainMenuClickMode === 'jump'
      || (appSettingsStore.settings.menu.mainMenuClickMode === 'smart' && appMenuStore.sidebarMenusHasOnlyMenu)
    ) {
      router.push(appMenuStore.sidebarMenusFirstDeepestPath)
    }
  }

  return {
    generateTitle,
    switchTo,
  }
}
