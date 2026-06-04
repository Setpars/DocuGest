<script setup lang="ts">
import { diffTwoObj } from '@fantastic-admin/settings'
import Login from '@/components/AppAccountForm/login.vue'
import ResetPassword from '@/components/AppAccountForm/reset-password.vue'
import SetupDoyen from '@/components/AppAccountForm/setup-doyen.vue'
import AppOfflineBanner from '@/components/AppOfflineBanner/index.vue'
import ColorScheme from '@/layouts/components/Topbar/Toolbar/ColorScheme/index.vue'
import { getDefaultPathForRole } from '@/constants/permissions'
import settingsDefault from '@/settings'
import '@/assets/styles/auth-form.css'

defineOptions({
  name: 'Login',
})

const route = useRoute()
const router = useRouter()
const appSettingsStore = useAppSettingsStore()

const redirect = ref(route.query.redirect?.toString() ?? appSettingsStore.settings.app.home.fullPath)

const appAccountStore = useAppAccountStore()
const appTitle = import.meta.env.VITE_APP_TITLE

const layoutAlign = ref<'left' | 'center' | 'right'>('center')
const email = ref<string>()
const formType = ref<'login' | 'resetPassword'>('login')
const needsSetup = ref<boolean | null>(null)
const checkingSetup = ref(true)
/** L’utilisateur a choisi « Se connecter » au lieu du formulaire d’installation. */
const setupDismissed = ref(false)

const showSetupForm = computed(() => needsSetup.value === true && !setupDismissed.value)

watch(
  () => appSettingsStore.mode,
  (mode) => {
    if (mode === 'mobile' && layoutAlign.value !== 'center') {
      layoutAlign.value = 'center'
    }
  },
  { immediate: true },
)

onMounted(async () => {
  try {
    if (!useAppOfflineStore().isOnline) {
      needsSetup.value = false
      return
    }
    needsSetup.value = await appAccountStore.checkNeedsSetup()
  } catch {
    needsSetup.value = false
  } finally {
    checkingSetup.value = false
  }
})

async function afterAuthSuccess() {
  const data = diffTwoObj(settingsDefault, appSettingsStore.settings)
  const target = appAccountStore.role
    ? getDefaultPathForRole(appAccountStore.role)
    : (redirect.value || '/gestion/dossiers')

  await router.replace(target)

  if (Object.keys(data).length > 0) {
    appSettingsStore.updateSettings(data)
  }
}

async function handleLogin() {
  await afterAuthSuccess()
}

async function handleSetupComplete() {
  await afterAuthSuccess()
}
</script>

<template>
  <AppOfflineBanner />
  <div class="bg-banner" />
  <div class="login-toolbar text-base p-1 border rounded-lg bg-background flex-center gap-1 absolute z-20">
    <FaDropdown
      v-if="appSettingsStore.mode === 'pc'"
      :items="[[
        { label: 'Disposition à gauche', disabled: layoutAlign === 'left', handle: () => { layoutAlign = 'left' } },
        { label: 'Disposition centrée', disabled: layoutAlign === 'center', handle: () => { layoutAlign = 'center' } },
        { label: 'Disposition à droite', disabled: layoutAlign === 'right', handle: () => { layoutAlign = 'right' } },
      ]]"
    >
      <FaButton variant="ghost" size="icon-sm">
        <FaIcon
          :name="{
            left: 'i-icon-park-outline:left-bar',
            center: 'i-icon-park-outline:square',
            right: 'i-icon-park-outline:right-bar',
          }[layoutAlign]" class="size-4"
        />
      </FaButton>
    </FaDropdown>
    <ColorScheme v-if="appSettingsStore.settings.toolbar.colorScheme" />
  </div>
  <div class="login-page">
    <div class="login-box" :class="layoutAlign">
      <div class="login-banner">
        <div class="logo-brand absolute flex items-center gap-2">
          <img src="@/assets/images/logo.svg" class="logo-brand__icon h-8 w-8 shrink-0 rounded-lg object-contain sm:h-9 sm:w-9" alt="DocuGest">
          <span class="logo-brand__title truncate text-base font-semibold tracking-tight text-white drop-shadow-sm sm:text-lg">{{ appTitle }}</span>
        </div>
        <img src="@/assets/images/login-banner.png" class="banner" alt="">
        <AppCopyright v-if="appSettingsStore.mode === 'pc' && ['left', 'right'].includes(layoutAlign)" class="login-banner__copyright absolute bottom-0 w-full" />
      </div>
      <div class="login-form">
        <div class="login-form__inner w-full min-w-0">
        <div v-if="checkingSetup" class="auth-form-shell text-center text-muted-foreground">
          Vérification de l’installation…
        </div>
        <SetupDoyen
          v-else-if="showSetupForm"
          @on-complete="handleSetupComplete"
          @on-back-to-login="setupDismissed = true"
        />
        <template v-else>
          <Login
            v-if="formType === 'login'"
            :email
            :show-initial-setup-link="needsSetup === true"
            @on-login="handleLogin"
            @on-reset-password="(val) => { formType = 'resetPassword'; email = val }"
            @on-initial-setup="setupDismissed = false"
          />
          <ResetPassword
            v-else
            :email
            @on-reset-password="(val) => { formType = 'login'; email = val }"
            @on-login="formType = 'login'"
          />
        </template>
        </div>
      </div>
    </div>
    <AppCopyright v-if="appSettingsStore.mode === 'mobile' || layoutAlign === 'center'" class="login-page__copyright" />
  </div>
</template>

<style scoped>
.bg-banner {
  position: fixed;
  z-index: 0;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  background:
    radial-gradient(closest-side, oklch(var(--border) / 10%) 30%, oklch(var(--primary) / 20%) 30%, oklch(var(--border) / 30%) 50%) no-repeat,
    radial-gradient(closest-side, oklch(var(--border) / 10%) 30%, oklch(var(--primary) / 20%) 30%, oklch(var(--border) / 30%) 50%) no-repeat;
  background-position: 100% 100%, 0% 0%;
  background-size: 200vw 200vh;
  filter: blur(100px);
}

.login-toolbar {
  top: max(0.75rem, env(safe-area-inset-top, 0px));
  right: max(0.75rem, env(safe-area-inset-right, 0px));
}

.login-page {
  position: relative;
  z-index: 10;
  box-sizing: border-box;
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding:
    max(3.5rem, calc(env(safe-area-inset-top, 0px) + 3rem))
    max(0.75rem, env(safe-area-inset-right, 0px))
    max(1rem, env(safe-area-inset-bottom, 0px))
    max(0.75rem, env(safe-area-inset-left, 0px));
  overflow-x: hidden;
  overflow-y: auto;
}

.login-box {
  display: flex;
  width: 100%;
  max-width: min(96vw, 920px);
  flex-direction: column;
  overflow: hidden;
  background-color: oklch(var(--background));
  box-shadow: 0 8px 32px oklch(0% 0 0 / 12%);
  border-radius: 0.75rem;
}

.login-banner {
  position: relative;
  flex-shrink: 0;
  width: 100%;
  min-height: 10rem;
  max-height: 28vh;
  overflow: hidden;
  background: oklch(var(--muted));
}

.login-banner::before {
  position: absolute;
  inset: 0;
  content: "";
  background:
    radial-gradient(closest-side, oklch(var(--border) / 10%) 30%, oklch(var(--primary) / 20%) 30%, oklch(var(--border) / 30%) 50%) no-repeat,
    radial-gradient(closest-side, oklch(var(--border) / 10%) 30%, oklch(var(--primary) / 20%) 30%, oklch(var(--border) / 30%) 50%) no-repeat;
  background-position: 100% 100%, 0% 0%;
  background-size: 200vw 200vh;
  filter: blur(100px);
}

.logo-brand {
  z-index: 2;
  top: max(0.75rem, env(safe-area-inset-top, 0px));
  left: max(0.75rem, env(safe-area-inset-left, 0px));
  max-width: calc(100% - 1.5rem);
}

.login-banner .banner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(100%, 22rem);
  max-height: 85%;
  object-fit: contain;
  transform: translate(-50%, -50%);
}

.login-form {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.login-form__inner {
  margin: 0 auto;
  max-width: 32rem;
}

.login-page__copyright {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: min(96vw, 920px);
  margin-top: 1rem;
  padding: 0 0.5rem 0.5rem;
  pointer-events: none;
}

.login-page__copyright :deep(a) {
  pointer-events: auto;
}

/* Tablette et mobile : colonne, pleine largeur utile */
@media (width < 1024px) {
  .login-page {
    justify-content: flex-start;
    padding-top: max(3.25rem, calc(env(safe-area-inset-top, 0px) + 2.75rem));
  }

  .login-box {
    max-width: 100%;
    min-height: 0;
    flex: 1;
    border-radius: 0.5rem;
  }

  .login-banner {
    min-height: 8rem;
    max-height: 22vh;
  }

  .login-banner .banner {
    width: min(90%, 16rem);
  }
}

/* Grand écran : disposition côte à côte (centrée par défaut) */
@media (width >= 1024px) {
  .login-page {
    justify-content: center;
    padding-top: max(1rem, env(safe-area-inset-top, 0px));
  }

  .login-box {
    flex-direction: row;
    max-height: min(92dvh, 40rem);
  }

  .login-box.left {
    flex-direction: row-reverse;
    max-width: 100%;
    max-height: 100dvh;
    border-radius: 0;
  }

  .login-box.right {
    max-width: 100%;
    max-height: 100dvh;
    border-radius: 0;
  }

  .login-box.center {
    max-width: min(94vw, 56rem);
  }

  .login-banner {
    width: min(42%, 22rem);
    min-height: auto;
    max-height: none;
    flex-shrink: 0;
  }

  .login-box.left .login-banner,
  .login-box.right .login-banner {
    width: auto;
    flex: 1;
  }

  .login-box.left .login-banner .banner,
  .login-box.right .login-banner .banner {
    width: min(50vw, 28rem);
  }

  .login-form {
    flex: 1;
    min-width: 0;
    width: auto;
  }

  .login-box.left .login-form,
  .login-box.right .login-form {
    margin: 0 clamp(1.5rem, 5vw, 4rem);
  }
}

@media (width >= 1024px) {
  [data-mode="pc"] .login-box.center {
    position: relative;
    top: auto;
    left: auto;
    transform: none;
  }
}
</style>
