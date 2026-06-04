<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { AuthFirebaseError } from '@/services/auth-firebase'
import { FormControl, FormField, FormItem, FormMessage } from '@/ui/shadcn/ui/form'
import { PASSWORD_POLICY_HINT, passwordFieldSchema } from '@/utils/password-policy'

defineOptions({
  name: 'SetupDoyenForm',
})

const emits = defineEmits<{
  onComplete: []
  onBackToLogin: []
}>()

const appAccountStore = useAppAccountStore()
const title = import.meta.env.VITE_APP_TITLE

const loading = ref(false)
const errorMessage = ref('')

const form = useForm({
  validationSchema: toTypedSchema(z.object({
    nom: z.string().min(2, 'Saisissez le nom du doyen'),
    email: z.string().email('Adresse e-mail invalide'),
    password: passwordFieldSchema,
    confirmPassword: z.string().min(1, 'Confirmez le mot de passe'),
  }).refine(data => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })),
  initialValues: {
    nom: '',
    email: '',
    password: '',
    confirmPassword: '',
  },
})

const onSubmit = form.handleSubmit(async (values) => {
  loading.value = true
  errorMessage.value = ''
  try {
    await appAccountStore.setupDoyen({
      email: values.email,
      password: values.password,
      nom: values.nom,
    })
    emits('onComplete')
    // La navigation est gérée par login.vue via @on-complete
  } catch (err) {
    if (err instanceof AuthFirebaseError) {
      errorMessage.value = err.message
    } else {
      errorMessage.value = 'Impossible de créer le compte. Réessayez.'
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="auth-form-shell flex flex-col">
    <div class="mb-6 space-y-2">
      <h3 class="font-bold">
        Installation du cabinet
      </h3>
      <p class="text-sm text-muted-foreground lg:text-base">
        {{ title }} — créez le compte <strong>doyen</strong> (administrateur). Cette étape n’apparaît qu’une seule fois.
      </p>
    </div>

    <div class="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
      Ce compte pourra ensuite créer les utilisateurs secrétaire et chargé des finances.
    </div>

    <form @submit="onSubmit">
      <p v-if="errorMessage" class="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ errorMessage }}
      </p>

      <FormField v-slot="{ componentField, errors }" name="nom">
        <FormItem class="pb-6 relative space-y-0">
          <FormControl>
            <FaInput type="text" placeholder="Nom complet du doyen" class="w-full" :class="{ 'border-destructive': errors.length }" v-bind="componentField">
              <template #start>
                <FaIcon name="i-lucide:user" />
              </template>
            </FaInput>
          </FormControl>
          <Transition enter-active-class="transition-opacity" enter-from-class="opacity-0" leave-active-class="transition-opacity" leave-to-class="opacity-0">
            <FormMessage class="text-xs bottom-1 absolute" />
          </Transition>
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField, errors }" name="email">
        <FormItem class="pb-6 relative space-y-0">
          <FormControl>
            <FaInput type="email" placeholder="E-mail de connexion" class="w-full" :class="{ 'border-destructive': errors.length }" v-bind="componentField">
              <template #start>
                <FaIcon name="i-lucide:mail" />
              </template>
            </FaInput>
          </FormControl>
          <Transition enter-active-class="transition-opacity" enter-from-class="opacity-0" leave-active-class="transition-opacity" leave-to-class="opacity-0">
            <FormMessage class="text-xs bottom-1 absolute" />
          </Transition>
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField, value, errors }" name="password">
        <FormItem class="pb-6 relative space-y-0">
          <FormControl>
            <FaInput type="password" placeholder="Mot de passe" class="w-full" :class="{ 'border-destructive': errors.length }" v-bind="componentField">
              <template #start>
                <FaIcon name="i-lucide:lock" />
              </template>
            </FaInput>
          </FormControl>
          <FaPasswordStrength :password="value" class="mt-2" />
          <p class="mt-1 text-xs text-muted-foreground">
            {{ PASSWORD_POLICY_HINT }}
          </p>
          <Transition enter-active-class="transition-opacity" enter-from-class="opacity-0" leave-active-class="transition-opacity" leave-to-class="opacity-0">
            <FormMessage class="text-xs bottom-1 absolute" />
          </Transition>
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField, errors }" name="confirmPassword">
        <FormItem class="pb-6 relative space-y-0">
          <FormControl>
            <FaInput type="password" placeholder="Confirmer le mot de passe" class="w-full" :class="{ 'border-destructive': errors.length }" v-bind="componentField">
              <template #start>
                <FaIcon name="i-lucide:lock-keyhole" />
              </template>
            </FaInput>
          </FormControl>
          <Transition enter-active-class="transition-opacity" enter-from-class="opacity-0" leave-active-class="transition-opacity" leave-to-class="opacity-0">
            <FormMessage class="text-xs bottom-1 absolute" />
          </Transition>
        </FormItem>
      </FormField>

      <FaButton :loading="loading" size="lg" class="relative z-10 w-full" type="submit">
        Créer le compte doyen et accéder à l’application
      </FaButton>
      <div class="mt-4 text-center">
        <FaButton
          variant="link"
          type="button"
          class="relative z-10 h-auto p-0"
          :disabled="loading"
          @click="emits('onBackToLogin')"
        >
          Déjà un compte ? Se connecter
        </FaButton>
      </div>
    </form>
  </div>
</template>
