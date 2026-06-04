import type { Router } from 'vue-router'
import { useNProgress } from '@vueuse/integrations/useNProgress'
import { warnKeepAliveComponentNameMissing } from 'virtual:fantastic-admin/turbo-console'
import { getDefaultPathForRole } from '@/constants/permissions'
import { asyncRoutes } from './routes'
import '@/assets/styles/nprogress.css'

function registerDynamicRoutes(router: Router) {
  const appRouteStore = useAppRouteStore()
  const removeRoutes: (() => void)[] = []

  appRouteStore.routes.forEach((route) => {
    if (!/^(?:https?:|mailto:|tel:)/.test(route.path)) {
      try {
        removeRoutes.push(router.addRoute(route))
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[router] Route ignorée:', route.path, err)
        }
      }
    }
  })
  appRouteStore.systemRoutes.forEach((route) => {
    try {
      removeRoutes.push(router.addRoute(route))
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[router] Route système ignorée:', route.path, err)
      }
    }
  })
  appRouteStore.setCurrentRemoveRoutes(removeRoutes)
}

async function ensureDynamicRoutes(router: Router) {
  const appSettingsStore = useAppSettingsStore()
  const appAccountStore = useAppAccountStore()
  const appRouteStore = useAppRouteStore()

  if (appRouteStore.isGenerate) {
    return
  }

  if (appSettingsStore.settings.app.account.auth) {
    try {
      await appAccountStore.getPermissions()
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[router] Chargement des permissions:', err)
      }
    }
  }

  switch (appSettingsStore.settings.app.routeBaseOn) {
    case 'frontend':
      appRouteStore.generateRoutesAtFront(asyncRoutes)
      break
    case 'backend':
      await appRouteStore.generateRoutesAtBack()
      break
  }

  registerDynamicRoutes(router)
}

function setupRoutes(router: Router) {
  router.beforeEach(async (to) => {
    const appSettingsStore = useAppSettingsStore()
    const appAccountStore = useAppAccountStore()
    const appRouteStore = useAppRouteStore()
    const appMenuStore = useAppMenuStore()
    if (!appAccountStore.isLogin) {
      await appAccountStore.tryRestoreSession()
    }

    if (appAccountStore.isLogin) {
      // 是否已根据权限动态生成并注册路由
      if (appRouteStore.isGenerate) {
        // 导航菜单如果不是 single 模式，则需要根据 path 定位主导航菜单的选中状态
        appSettingsStore.settings.menu.mode !== 'single' && appMenuStore.setActived(to.path)
        // 如果已登录状态下，进入登录页会强制跳转到主页
        if (to.name === 'login') {
          const rolePath = appAccountStore.role
            ? getDefaultPathForRole(appAccountStore.role)
            : appMenuStore.sidebarMenusFirstDeepestPath
          return {
            path: rolePath || appSettingsStore.settings.app.home.fullPath,
            replace: true,
          }
        }
        else if (
          !appSettingsStore.settings.app.home.enable
          && (to.fullPath === appSettingsStore.settings.app.home.fullPath || to.path === '/')
        ) {
          const rolePath = appAccountStore.role
            ? getDefaultPathForRole(appAccountStore.role)
            : appMenuStore.sidebarMenusFirstDeepestPath
          return {
            path: rolePath || appMenuStore.sidebarMenusFirstDeepestPath,
            replace: true,
          }
        }
      }
      else {
        try {
          await ensureDynamicRoutes(router)
        } catch (e) {
          if (import.meta.env.DEV) {
            console.error('[router] Échec génération des routes:', e)
          }
          if (!appRouteStore.isGenerate) {
            appRouteStore.generateRoutesAtFront(asyncRoutes)
            registerDynamicRoutes(router)
          }
        }
        return {
          path: to.path,
          query: to.query,
          replace: true,
        }
      }
    }
    else {
      if (to.name !== 'login') {
        return {
          name: 'login',
          query: {
            redirect: to.fullPath !== appSettingsStore.settings.app.home.fullPath ? to.fullPath : undefined,
          },
        }
      }
    }
  })
}

// Redirige vers le premier enfant autorisé uniquement si la route parente n’a pas encore de page résolue.
function setupRedirectAuthChildrenRoute(router: Router) {
  router.beforeEach((to) => {
    const { auth } = useAppAuth()

    // Déjà sur une page nommée (Clients, agenda, pièces juridiques…) : ne pas rediriger
    if (to.name && to.name !== 'notFound' && to.name !== 'reload') {
      return
    }

    const matched = to.matched
    if (matched.length < 2) {
      return
    }

    const leaf = matched[matched.length - 1]
    const parent = matched[matched.length - 2]
    if (!leaf || !parent || leaf.path !== '') {
      return
    }

    // Parent réel (/gestion/clients), pas le segment enfant vide partagé par toutes les routes
    const parentPath = parent.path
    if (!parentPath) {
      return
    }

    const parentRoute = router.getRoutes().find(
      route => route.path === parentPath && route.children?.length,
    )
    if (!parentRoute || parentRoute.redirect) {
      return
    }

    const findAuthRoute = parentRoute.children.find(
      route => route.meta?.menu !== false && auth(route.meta?.auth ?? ''),
    )
    if (findAuthRoute?.name) {
      return {
        name: findAuthRoute.name as string,
        replace: true,
      }
    }
  })
}

// 进度条
function setupProgress(router: Router) {
  const { isLoading } = useNProgress()
  router.beforeEach(() => {
    const appSettingsStore = useAppSettingsStore()
    if (appSettingsStore.settings.page.progress) {
      isLoading.value = true
    }
  })
  router.afterEach(() => {
    const appSettingsStore = useAppSettingsStore()
    if (appSettingsStore.settings.page.progress) {
      isLoading.value = false
    }
  })
}
// 标题
function resolvePageTitle(to: { matched: { meta?: { title?: unknown } }[], meta: { title?: unknown } }): string | undefined {
  for (let i = to.matched.length - 1; i >= 0; i--) {
    const title = to.matched[i]?.meta?.title
    if (title !== undefined && title !== null && String(title).trim() !== '') {
      return String(title)
    }
  }
  const root = to.meta.title
  return root !== undefined && root !== null ? String(root) : undefined
}

function setupTitle(router: Router) {
  router.afterEach((to) => {
    const appSettingsStore = useAppSettingsStore()
    appSettingsStore.setTitle(resolvePageTitle(to))
  })
}

// 页面保活
function setupKeepAlive(router: Router) {
  router.afterEach(async (to, from) => {
    const appKeepAliveStore = useAppKeepAliveStore()
    if (to.meta.keepAlive) {
      const componentName = to.matched.at(-1)?.components?.default.name
      if (componentName) {
        // 保活当前页面前，先判断是否需要清除保活，判断依据：
        // 1. 如果 to.meta.keepAlive 为 boolean 类型，并且不为 true，则需要清除保活
        // 2. 如果 to.meta.keepAlive 为 string 类型，并且与 from.name 不一致，则需要清除保活
        // 3. 如果 to.meta.keepAlive 为 array 类型，并且不包含 from.name，则需要清除保活
        // 4. 如果 to.meta.noKeepAlive 为 string 类型，并且与 from.name 一致，则需要清除保活
        // 5. 如果 to.meta.noKeepAlive 为 array 类型，并且包含 from.name，则需要清除保活
        // 6. 如果是刷新页面，则需要清除保活
        let shouldClear = false
        if (typeof to.meta.keepAlive === 'boolean') {
          shouldClear = !to.meta.keepAlive
        }
        else if (typeof to.meta.keepAlive === 'string') {
          shouldClear = to.meta.keepAlive !== from.name
        }
        else if (Array.isArray(to.meta.keepAlive)) {
          shouldClear = !to.meta.keepAlive.includes(from.name as string)
        }
        if (to.meta.noKeepAlive) {
          if (typeof to.meta.noKeepAlive === 'string') {
            shouldClear = to.meta.noKeepAlive === from.name
          }
          else if (Array.isArray(to.meta.noKeepAlive)) {
            shouldClear = to.meta.noKeepAlive.includes(from.name as string)
          }
        }
        if (from.name === 'reload') {
          shouldClear = true
        }
        if (shouldClear) {
          appKeepAliveStore.remove(componentName)
          await nextTick()
        }
        appKeepAliveStore.add(componentName)
      }
      else if (import.meta.env.DEV) {
        warnKeepAliveComponentNameMissing((to.matched.at(-1)?.components?.default as any).__file)
      }
    }
  })
}

// 其他
function setupOther(router: Router) {
  router.afterEach(() => {
    document.documentElement.scrollTop = 0
  })
}

export default function setupGuards(router: Router) {
  setupRoutes(router)
  setupRedirectAuthChildrenRoute(router)
  setupProgress(router)
  setupTitle(router)
  setupKeepAlive(router)
  setupOther(router)
}
