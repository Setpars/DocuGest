<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { AuthFirebaseError } from '@/services/auth-firebase'
import { FormControl, FormField, FormItem, FormMessage } from '@/ui/shadcn/ui/form'

defineOptions({
  name: 'ResetPasswordForm',
})

const props = defineProps<{
  email?: string
}>()

const emits = defineEmits<{
  onLogin: [email?: string]
  onResetPassword: [email?: string]
}>()

const appAccountStore = useAppAccountStore()
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const form = useForm({
  validationSchema: toTypedSchema(z.object({
    email: z.string().email('Adresse e-mail invalide'),
  })),
  initialValues: {
    email: props.email ?? '',
  },
})

const onSubmit = form.handleSubmit(async (values) => {
  loading.value = true
  successMessage.value = ''
  errorMessage.value = ''
  try {
    await appAccountStore.requestPasswordReset(values.email)
    successMessage.value = 'Un e-mail de réinitialisation a été envoyé. Consultez votre boîte de réception.'
    emits('onResetPassword', values.email)
  } catch (err) {
    if (err instanceof AuthFirebaseError) {
      errorMessage.value = err.message
    } else {
      errorMessage.value = 'Envoi impossible. Réessayez plus tard.'
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="auth-form-shell flex flex-col">
    <form class="w-full min-w-0" @submit="onSubmit">
      <div class="mb-8 space-y-2">
        <h3 class="font-bold">
          Mot de passe oublié ? 🔒
        </h3>
        <p class="text-sm text-muted-foreground lg:text-base">
          Saisissez votre e-mail pour recevoir un lien de réinitialisation (Firebase Auth).
        </p>
      </div>
      <p v-if="successMessage" class="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
        {{ successMessage }}
      </p>
      <p v-if="errorMessage" class="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ errorMessage }}
      </p>
      <FormField v-slot="{ componentField, errors }" name="email">
        <FormItem class="pb-6 relative space-y-0">
          <FormControl>
            <FaInput type="email" placeholder="Adresse e-mail" class="w-full" :class="{ 'border-destructive': errors.length }" v-bind="componentField">
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
      <FaButton :loading="loading" size="lg" class="w-full" type="submit">
        Envoyer le lien
      </FaButton>
      <div class="mt-4 text-center">
        <FaButton variant="link" class="p-0 h-auto" type="button" @click="emits('onLogin', form.values.email)">
          Retour à la connexion
        </FaButton>
      </div>
    </form>
  </div>
</template>
