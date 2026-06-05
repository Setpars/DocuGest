<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import {
  applyAuthPersistence,
  getRememberMePreference,
  setRememberMePreference,
} from '@/firebase/auth-persistence'
import { AuthFirebaseError } from '@/services/auth-firebase'
import { FormControl, FormField, FormItem, FormMessage } from '@/ui/shadcn/ui/form'
import type { LoginAccountChoice } from '@/utils/login-directory'
import { fetchLoginAccountChoices } from '@/utils/login-directory'

defineOptions({
  name: 'LoginForm',
})

const props = defineProps<{
  email?: string
  /** Affiche le lien vers l’installation initiale (aucun doyen en base). */
  showInitialSetupLink?: boolean
}>()

const emits = defineEmits<{
  onLogin: [email?: string]
  onResetPassword: [email?: string]
  onInitialSetup: []
}>()

const appAccountStore = useAppAccountStore()
const appOfflineStore = useAppOfflineStore()

const title = import.meta.env.VITE_APP_TITLE
const loading = ref(false)
const googleLoading = ref(false)
const offlineLoading = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

const isOffline = computed(() => !appOfflineStore.isOnline)
const canOfflineLogin = computed(() => appOfflineStore.canOfflineLogin)

const type = ref<'default' | 'qrcode'>('default')

const accountChoices = ref<LoginAccountChoice[]>([])
const loadingAccounts = ref(true)
const manualEmail = ref(false)
const passwordInputRef = ref<{ ref?: HTMLInputElement } | null>(null)

const emailSelectOptions = computed(() =>
  accountChoices.value.map(a => ({
    label: a.nom === a.email ? a.email : `${a.nom} — ${a.email}`,
    value: a.email,
  })),
)

const useAccountPicker = computed(() => accountChoices.value.length > 0 && !manualEmail.value)

const form = useForm({
  validationSchema: toTypedSchema(z.object({
    email: z.string().email('Adresse e-mail invalide'),
    password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
    remember: z.boolean(),
  })),
  initialValues: {
    email: props.email ?? localStorage.getItem('login_email') ?? '',
    password: '',
    remember: getRememberMePreference(),
  },
})

onMounted(async () => {
  if (isOffline.value) {
    accountChoices.value = await fetchLoginAccountChoices()
    loadingAccounts.value = false
    applyDefaultEmail()
    return
  }
  try {
    accountChoices.value = await fetchLoginAccountChoices()
  } finally {
    loadingAccounts.value = false
    applyDefaultEmail()
  }
})

function applyDefaultEmail() {
  const remembered = localStorage.getItem('login_email')?.trim()
  const fallback = remembered
    || accountChoices.value[0]?.email
    || ''
  if (fallback) {
    form.setFieldValue('email', fallback)
    manualEmail.value = accountChoices.value.length === 0
  } else {
    manualEmail.value = true
  }
}

function focusPasswordField() {
  nextTick(() => passwordInputRef.value?.ref?.focus())
}

function onEmailSelected(
  value: string | number | boolean | bigint | Record<string, unknown> | null | undefined,
  onUpdate?: (v: string) => void,
) {
  const email = String(value ?? '')
  onUpdate?.(email)
  form.setFieldValue('email', email)
  focusPasswordField()
}

const onSubmit = form.handleSubmit(async (values) => {
  if (isOffline.value) {
    errorMessage.value = 'Connexion en ligne impossible hors connexion. Utilisez le mode hors ligne si disponible.'
    return
  }
  loading.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    setRememberMePreference(values.remember)
    await applyAuthPersistence(values.remember)
    await appAccountStore.login({
      email: values.email,
      password: values.password,
    })
    if (values.remember) {
      localStorage.setItem('login_email', values.email)
    }
    else {
      localStorage.removeItem('login_email')
    }
    emits('onLogin', values.email)
  } catch (err) {
    if (err instanceof AuthFirebaseError) {
      errorMessage.value = err.message
    } else {
      errorMessage.value = 'Connexion impossible. Réessayez.'
    }
  } finally {
    loading.value = false
  }
})

async function onGoogleLogin() {
  if (isOffline.value) {
    errorMessage.value = 'La connexion Google nécessite une connexion internet.'
    return
  }
  googleLoading.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    const remember = form.values.remember ?? getRememberMePreference()
    setRememberMePreference(remember)
    await applyAuthPersistence(remember)
    await appAccountStore.loginGoogle()
    if (remember && appAccountStore.account) {
      localStorage.setItem('login_email', appAccountStore.account)
    }
    emits('onLogin', appAccountStore.account)
  } catch (err) {
    if (err instanceof AuthFirebaseError) {
      errorMessage.value = err.message
    } else {
      errorMessage.value = 'Connexion Google impossible. Réessayez.'
    }
  } finally {
    googleLoading.value = false
  }
}

async function onOfflineLogin() {
  offlineLoading.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    const ok = appAccountStore.loginFromOfflineCache()
    if (!ok) {
      errorMessage.value = 'Aucune session enregistrée. Connectez-vous une fois en ligne.'
      return
    }
    infoMessage.value = 'Mode hors ligne — les modifications seront synchronisées au retour d’internet.'
    emits('onLogin', appAccountStore.account)
  } finally {
    offlineLoading.value = false
  }
}
</script>

<template>
  <div class="auth-form-shell flex flex-col">
    <div class="mb-6 space-y-2">
      <h3 class="font-bold">
        Bienvenue 👋🏻
      </h3>
      <p class="text-sm text-muted-foreground lg:text-base">
        {{ title }} — choisissez votre compte, puis saisissez le mot de passe
      </p>
    </div>
    <div class="mb-4">
      <FaTabs
        v-model="type" :list="[
          { label: 'E-mail et mot de passe', value: 'default' },
          { label: 'Connexion par QR code', value: 'qrcode' },
        ]" class="auth-tabs"
      />
    </div>
    <div v-show="type === 'default'">
      <form @submit="onSubmit">
        <p v-if="isOffline" class="mb-4 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Vous êtes hors ligne. Les données saisies seront enregistrées localement puis synchronisées.
        </p>
        <p v-if="errorMessage" class="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {{ errorMessage }}
        </p>
        <p v-if="infoMessage" class="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {{ infoMessage }}
        </p>
        <FormField v-slot="{ componentField, errors }" name="email">
          <FormItem class="pb-6 relative space-y-0">
            <FormControl>
              <div v-if="loadingAccounts" class="text-sm text-muted-foreground py-2">
                Chargement des comptes…
              </div>
              <template v-else-if="useAccountPicker">
                <FaSelect
                  :model-value="componentField.modelValue"
                  class="w-full"
                  placeholder="Sélectionner un compte"
                  :options="emailSelectOptions"
                  :disabled="isOffline"
                  @update:model-value="(v) => onEmailSelected(v, componentField['onUpdate:modelValue'])"
                />
              </template>
              <FaInput
                v-else
                type="email"
                placeholder="Adresse e-mail"
                class="w-full"
                :class="{ 'border-destructive': errors.length }"
                :disabled="isOffline"
                v-bind="componentField"
              >
                <template #start>
                  <FaIcon name="i-lucide:mail" />
                </template>
              </FaInput>
            </FormControl>
            <Transition enter-active-class="transition-opacity" enter-from-class="opacity-0" leave-active-class="transition-opacity" leave-to-class="opacity-0">
              <FormMessage class="text-xs bottom-1 absolute" />
            </Transition>
            <div v-if="!loadingAccounts && accountChoices.length > 0" class="mt-2 text-center">
              <FaButton
                v-if="useAccountPicker"
                variant="link"
                type="button"
                class="h-auto p-0 text-xs"
                @click="manualEmail = true"
              >
                Saisir une autre adresse e-mail
              </FaButton>
              <FaButton
                v-else
                variant="link"
                type="button"
                class="h-auto p-0 text-xs"
                @click="manualEmail = false; applyDefaultEmail()"
              >
                Choisir dans la liste des comptes
              </FaButton>
            </div>
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField, errors }" name="password">
          <FormItem class="pb-6 relative space-y-0">
            <FormControl>
              <FaInput
                ref="passwordInputRef"
                type="password"
                placeholder="Mot de passe"
                class="w-full"
                :class="{ 'border-destructive': errors.length }"
                v-bind="componentField"
              >
                <template #start>
                  <FaIcon name="i-lucide:lock" />
                </template>
              </FaInput>
            </FormControl>
            <Transition enter-active-class="transition-opacity" enter-from-class="opacity-0" leave-active-class="transition-opacity" leave-to-class="opacity-0">
              <FormMessage class="text-xs bottom-1 absolute" />
            </Transition>
          </FormItem>
        </FormField>
        <div class="auth-form-actions-row mb-4">
          <div class="flex-center-start">
            <FormField v-slot="{ componentField }" type="checkbox" name="remember">
              <FormItem>
                <FormControl>
                  <FaCheckbox :model-value="componentField.modelValue" @update:model-value="componentField['onUpdate:modelValue']?.($event)">
                    Se souvenir de moi
                  </FaCheckbox>
                </FormControl>
              </FormItem>
            </FormField>
          </div>
          <FaButton variant="link" class="p-0 h-auto" type="button" @click="emits('onResetPassword', form.values.email)">
            Mot de passe oublié ?
          </FaButton>
        </div>
        <FaButton
          variant="outline"
          size="lg"
          class="w-full"
          type="button"
          :loading="googleLoading"
          :disabled="isOffline || loading"
          @click="onGoogleLogin"
        >
          <span class="flex items-center justify-center gap-2">
            <svg class="size-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuer avec Google
          </span>
        </FaButton>

        <div class="my-4 flex items-center gap-3">
          <span class="h-px flex-1 bg-border" />
          <span class="text-xs text-muted-foreground">ou</span>
          <span class="h-px flex-1 bg-border" />
        </div>

        <FaButton :loading="loading" size="lg" class="w-full" type="submit" :disabled="isOffline || googleLoading">
          Connexion par e-mail
        </FaButton>
        <FaButton
          v-if="canOfflineLogin"
          variant="outline"
          size="lg"
          class="mt-3 w-full"
          type="button"
          :loading="offlineLoading"
          @click="onOfflineLogin"
        >
          Continuer hors ligne (dernière session)
        </FaButton>
        <div v-if="showInitialSetupLink" class="mt-4 text-center">
          <FaButton
            variant="link"
            type="button"
            class="relative z-10 h-auto p-0 font-medium"
            :disabled="isOffline"
            @click="emits('onInitialSetup')"
          >
            Installation du cabinet (créer le compte doyen)
          </FaButton>
        </div>
      </form>
    </div>
    <div v-show="type === 'qrcode'">
      <div class="flex-col-center">
        <img src="https://s2.loli.net/2024/04/26/GsahtuIZ9XOg5jr.png" class="mx-auto h-auto max-h-[min(250px,40vw)] w-full max-w-[250px]">
        <div class="text-sm text-secondary-foreground mt-2 op-50">
          Scannez le code QR pour vous connecter
        </div>
      </div>
    </div>
  </div>
</template>
