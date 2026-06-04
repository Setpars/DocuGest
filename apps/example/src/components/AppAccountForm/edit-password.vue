<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { AuthFirebaseError } from '@/services/auth-firebase'
import { FormControl, FormField, FormItem, FormMessage } from '@/ui/shadcn/ui/form'
import { PASSWORD_POLICY_HINT, passwordFieldSchema } from '@/utils/password-policy'

defineOptions({
  name: 'EditPasswordForm',
})

const appAccountStore = useAppAccountStore()

const loading = ref(false)
const errorMessage = ref('')

const form = useForm({
  validationSchema: toTypedSchema(
    z.object({
      password: z.string().min(1, 'Veuillez saisir l’ancien mot de passe'),
      newPassword: passwordFieldSchema,
      checkPassword: z.string().min(1, 'Veuillez confirmer le nouveau mot de passe'),
    }).refine(data => data.newPassword === data.checkPassword, {
      message: 'Les deux mots de passe ne correspondent pas',
      path: ['checkPassword'],
    }),
  ),
  initialValues: {
    password: '',
    newPassword: '',
    checkPassword: '',
  },
})

const onSubmit = form.handleSubmit(async (values) => {
  loading.value = true
  errorMessage.value = ''
  try {
    await appAccountStore.editPassword({
      password: values.password,
      newPassword: values.newPassword,
    })
    faToast.success('Mot de passe modifié. Veuillez vous reconnecter.')
    appAccountStore.logout()
  } catch (err) {
    if (err instanceof AuthFirebaseError) {
      errorMessage.value = err.message
    } else {
      errorMessage.value = 'Modification impossible.'
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex-col-stretch-center w-full">
    <div class="mb-6 space-y-2">
      <h3 class="text-4xl font-bold">
        Modifier le mot de passe
      </h3>
      <p class="text-sm text-muted-foreground lg:text-base">
        {{ PASSWORD_POLICY_HINT }}
      </p>
    </div>
    <form @submit="onSubmit">
      <p v-if="errorMessage" class="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ errorMessage }}
      </p>
      <FormField v-slot="{ componentField, errors }" name="password">
        <FormItem class="pb-6 relative space-y-0">
          <FormControl>
            <FaInput type="password" placeholder="Mot de passe actuel" class="w-full" :class="{ 'border-destructive': errors.length }" v-bind="componentField">
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
      <FormField v-slot="{ componentField, value, errors }" name="newPassword">
        <FormItem class="pb-6 relative space-y-0">
          <FormControl>
            <FaInput type="password" placeholder="Nouveau mot de passe" class="w-full" :class="{ 'border-destructive': errors.length }" v-bind="componentField">
              <template #start>
                <FaIcon name="i-lucide:lock" />
              </template>
            </FaInput>
          </FormControl>
          <FaPasswordStrength :password="value" class="mt-2" />
          <Transition enter-active-class="transition-opacity" enter-from-class="opacity-0" leave-active-class="transition-opacity" leave-to-class="opacity-0">
            <FormMessage class="text-xs bottom-1 absolute" />
          </Transition>
        </FormItem>
      </FormField>
      <FormField v-slot="{ componentField, errors }" name="checkPassword">
        <FormItem class="pb-6 relative space-y-0">
          <FormControl>
            <FaInput type="password" placeholder="Confirmer le mot de passe" class="w-full" :class="{ 'border-destructive': errors.length }" v-bind="componentField">
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
      <FaButton :loading="loading" size="lg" class="mt-8 w-full" type="submit">
        Enregistrer
      </FaButton>
    </form>
  </div>
</template>
