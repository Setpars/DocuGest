import type { User } from 'firebase/auth'
import type { LocationQueryRaw } from 'vue-router'
import { auth } from '@/firebase'
import router from '@/router'
import {
  bindAuthStateListener,
  initFirebaseAuthPersistence,
  waitForFirebaseAuthReady,
} from '@/firebase/auth-init'
import { getPermissionsForRole } from '@/constants/permissions'
import {
  AuthFirebaseError,
  changeOwnPassword,
  createBootstrapDoyen,
  loginWithFirebase,
  loginWithGoogle,
  logoutFirebase,
  needsInitialSetup,
  resolveAuthSessionFromUser,
  restoreFirebaseSession,
  sendUserPasswordReset,
} from '@/services/auth-firebase'
import type { AppUserRole, AuthSession } from '@/types/auth'
import { getCachedOfflineSession } from '@/services/offline-session'
import { writeAuditLog } from '@/utils/audit-log'

let authInitStarted = false

export const useAppAccountStore = defineStore('appAccount', () => {
  const appSettingsStore = useAppSettingsStore()
  const appTabbarStore = useAppTabbarStore()
  const appRouteStore = useAppRouteStore()
  const appMenuStore = useAppMenuStore()

  const token = ref(localStorage.getItem('token') ?? '')
  const account = ref(localStorage.getItem('account') ?? '')
  const avatar = ref(
    (() => {
      const stored = localStorage.getItem('avatar') ?? ''
      if (!stored || stored.includes('dicebear.com')) return ''
      return stored
    })(),
  )
  const userId = ref(localStorage.getItem('userId') ?? '')
  const role = ref((localStorage.getItem('userRole') ?? '') as AppUserRole | '')
  const displayName = ref(localStorage.getItem('displayName') ?? '')

  const permissions = ref<string[]>(
    (() => {
      const storedRole = localStorage.getItem('userRole') as AppUserRole | ''
      if (storedRole && ['secretaire', 'doyen', 'finance'].includes(storedRole)) {
        return getPermissionsForRole(storedRole)
      }
      return []
    })(),
  )

  const authReady = ref(false)

  /** Connecté : token + profil Pinia (aligné sur Firebase après init). */
  const isLogin = computed(() => Boolean(token.value && userId.value))

  /** Alias explicite pour les guards / composants. */
  const isAuthenticated = computed(() => isLogin.value)

  function normalizeStoredAvatar(value?: string) {
    const url = value?.trim() ?? ''
    if (!url || url.includes('dicebear.com')) return ''
    return url
  }

  function applySession(session: AuthSession) {
    const avatarUrl = normalizeStoredAvatar(session.avatar)
    localStorage.setItem('account', session.account)
    localStorage.setItem('token', session.token)
    localStorage.setItem('avatar', avatarUrl)
    localStorage.setItem('userId', session.user.id)
    localStorage.setItem('userRole', session.user.role)
    localStorage.setItem('displayName', session.user.nom)
    account.value = session.account
    token.value = session.token
    avatar.value = avatarUrl
    userId.value = session.user.id
    role.value = session.user.role
    displayName.value = session.user.nom
    permissions.value = session.permissions
  }

  function clearLocalSession() {
    localStorage.removeItem('token')
    localStorage.removeItem('account')
    localStorage.removeItem('avatar')
    localStorage.removeItem('userId')
    localStorage.removeItem('userRole')
    localStorage.removeItem('displayName')
    token.value = ''
    account.value = ''
    avatar.value = ''
    userId.value = ''
    role.value = ''
    displayName.value = ''
    permissions.value = []
  }

  async function syncFromFirebaseUser(user: User | null) {
    if (!user) {
      clearLocalSession()
      return
    }
    try {
      const session = await resolveAuthSessionFromUser(user)
      if (session) {
        applySession(session)
      } else {
        clearLocalSession()
      }
    } catch {
      clearLocalSession()
    }
  }

  async function initAuth(): Promise<void> {
    if (authInitStarted) {
      await waitForFirebaseAuthReady()
      return
    }
    authInitStarted = true

    await initFirebaseAuthPersistence()

    bindAuthStateListener(async (user) => {
      await syncFromFirebaseUser(user)
      authReady.value = true
    })

    await waitForFirebaseAuthReady()
  }

  async function waitUntilAuthReady(): Promise<void> {
    if (authReady.value) return
    await initAuth()
  }

  async function checkNeedsSetup() {
    await waitUntilAuthReady()
    return needsInitialSetup()
  }

  async function setupDoyen(data: { email: string, password: string, nom: string }) {
    const result = await createBootstrapDoyen(data)
    applySession(result)
    await writeAuditLog({
      action: 'creation',
      entity: 'utilisateur',
      entityId: result.user.id,
      details: 'Installation initiale — compte doyen créé',
    })
  }

  async function login(data: { email: string, password: string }) {
    const result = await loginWithFirebase(data.email, data.password)
    applySession(result)
    await writeAuditLog({
      action: 'connexion',
      entity: 'utilisateur',
      entityId: result.user.id,
      details: `Connexion (${result.user.role})`,
    })
  }

  async function loginGoogle() {
    const result = await loginWithGoogle()
    applySession(result)
    await writeAuditLog({
      action: 'connexion',
      entity: 'utilisateur',
      entityId: result.user.id,
      details: `Connexion Google (${result.user.role})`,
    })
  }

  function loginFromOfflineCache(): boolean {
    const cached = getCachedOfflineSession()
    if (!cached) return false
    applySession({
      token: cached.token,
      account: cached.account,
      avatar: cached.avatar,
      user: {
        id: cached.userId,
        email: cached.account,
        nom: cached.displayName,
        role: cached.role,
        actif: true,
        createdAt: '',
        updatedAt: '',
      },
      permissions: cached.permissions,
    })
    useAppOfflineStore().setOfflineSession(true)
    return true
  }

  async function tryRestoreSession(): Promise<boolean> {
    await waitUntilAuthReady()
    const restored = await restoreFirebaseSession()
    if (restored) {
      applySession(restored)
      return true
    }
    clearLocalSession()
    return false
  }

  async function logout(redirect = router.currentRoute.value.fullPath) {
    const redirectQuery: LocationQueryRaw | undefined = (
      redirect !== appSettingsStore.settings.app.home.fullPath
      && router.currentRoute.value.name !== 'login'
    )
      ? { redirect }
      : undefined

    try {
      await logoutFirebase()
    } catch { /* ignore */ }

    clearLocalSession()
    logoutCleanStatus()

    await router.push({
      name: 'login',
      query: redirectQuery,
    })
  }

  async function requestLogout() {
    await logout()
  }

  function logoutCleanStatus() {
    appSettingsStore.updateSettings({}, true)
    appTabbarStore.clean()
    appRouteStore.removeRoutes()
    appMenuStore.setActived(0)
  }

  async function getPermissions() {
    if (role.value) {
      permissions.value = getPermissionsForRole(role.value)
      return
    }
    await tryRestoreSession()
  }

  async function editPassword(data: { password: string, newPassword: string }) {
    if (!data.newPassword) {
      throw new AuthFirebaseError('auth/weak-password', 'Le nouveau mot de passe est obligatoire.')
    }
    try {
      await changeOwnPassword(data.password, data.newPassword)
      if (auth.currentUser) {
        const freshToken = await auth.currentUser.getIdToken(true)
        token.value = freshToken
        localStorage.setItem('token', freshToken)
      }
    } catch (err) {
      if (err instanceof AuthFirebaseError) throw err
      throw new AuthFirebaseError('auth/unknown', 'Modification impossible. Reconnectez-vous puis réessayez.')
    }
  }

  async function requestPasswordReset(email: string) {
    await sendUserPasswordReset(email)
  }

  function lock() {
    localStorage.removeItem('token')
    token.value = ''
  }

  function unlock() {
    if (auth.currentUser) {
      auth.currentUser.getIdToken().then((t) => {
        token.value = t
        localStorage.setItem('token', t)
      })
    }
  }

  return {
    token,
    account,
    avatar,
    userId,
    role,
    displayName,
    permissions,
    authReady,
    isLogin,
    isAuthenticated,
    initAuth,
    waitUntilAuthReady,
    checkNeedsSetup,
    setupDoyen,
    login,
    loginGoogle,
    loginFromOfflineCache,
    logout,
    requestLogout,
    getPermissions,
    editPassword,
    requestPasswordReset,
    tryRestoreSession,
    lock,
    unlock,
  }
})
